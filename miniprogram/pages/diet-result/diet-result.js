const { post } = require('../../utils/request')
const { formatDateTimeWithOffset, getDefaultMealType, mealTypeName } = require('../../utils/time')
const { showRecordSuccess } = require('../../utils/dietRecordSuccess')

function round(num) {
  return Math.round((num + Number.EPSILON) * 100) / 100
}

Page({
  data: {
    mealType: '',
    mealTypeName,
    sourceType: 'photo_ai',
    thumb: '',
    candidates: [],
    totals: { calorie: 0, protein: 0, carb: 0, fat: 0 },
    saveAsFrequent: false,
    showEdit: false,
    editIndex: -1,
    editItem: {}
  },

  _dirty: false,
  _saved: false,

  onLoad(options) {
    const meal = options.mealType || getDefaultMealType()
    const sourceType = options.source || 'photo_ai'
    let candidates = []
    try {
      candidates = JSON.parse(decodeURIComponent(options.candidates || '[]'))
    } catch (e) {
      candidates = []
    }
    const thumb = options.thumb ? decodeURIComponent(options.thumb) : ''
    this.setData({
      mealType: meal,
      sourceType,
      thumb,
      candidates: candidates.map((c, i) => ({ ...c, id: i }))
    })
    this._dirty = false
    this._saved = false
    this.calcTotals()
  },

  onUnload() {
    // 未保存但用户主动离开时给出提示（不阻塞返回）
    if (this._dirty && !this._saved) {
      // 不主动弹窗，避免阻塞 onUnload；下次进入 onLoad 时仍会清空
    }
  },

  calcTotals() {
    const totals = this.data.candidates.reduce(
      (acc, item) => {
        acc.calorie += Number(item.calorie) || 0
        acc.protein += Number(item.protein) || 0
        acc.carb += Number(item.carb) || 0
        acc.fat += Number(item.fat) || 0
        return acc
      },
      { calorie: 0, protein: 0, carb: 0, fat: 0 }
    )
    this.setData({
      totals: {
        calorie: round(totals.calorie),
        protein: round(totals.protein),
        carb: round(totals.carb),
        fat: round(totals.fat)
      }
    })
  },

  deleteItem(e) {
    const idx = e.currentTarget.dataset.index
    const candidates = this.data.candidates.filter((_, i) => i !== idx)
      .map((c, i) => ({ ...c, id: i }))
    this.setData({ candidates })
    this._dirty = true
    this.calcTotals()
  },

  openEdit(e) {
    const idx = e.currentTarget.dataset.index
    const item = this.data.candidates[idx]
    this.setData({
      editIndex: idx,
      editItem: { ...item },
      showEdit: true
    })
  },

  closeEdit() {
    this.setData({ showEdit: false })
  },

  onEditInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({
      [`editItem.${field}`]: e.detail.value
    })
  },

  saveEdit() {
    const idx = this.data.editIndex
    const item = this.data.editItem
    const parsed = {
      ...item,
      food_name: item.food_name || '',
      portion_desc: item.portion_desc || '',
      weight_g: parseFloat(item.weight_g) || 0,
      calorie: parseFloat(item.calorie) || 0,
      protein: parseFloat(item.protein) || 0,
      carb: parseFloat(item.carb) || 0,
      fat: parseFloat(item.fat) || 0
    }
    const candidates = this.data.candidates.slice()
    candidates[idx] = parsed
    this.setData({ candidates, showEdit: false })
    this._dirty = true
    this.calcTotals()
  },

  toggleSave(e) {
    this.setData({ saveAsFrequent: e.detail.value })
  },

  goSearch() {
    if (this._dirty && !this._saved) {
      wx.showModal({
        title: '放弃当前编辑？',
        content: '尚未保存当前食物编辑',
        confirmText: '放弃',
        success: (r) => { if (r.confirm) this._doGoSearch() }
      })
      return
    }
    this._doGoSearch()
  },
  _doGoSearch() {
    wx.navigateTo({ url: `/pages/food-search/food-search?mealType=${this.data.mealType}` })
  },

  goCustom() {
    if (this._dirty && !this._saved) {
      wx.showModal({
        title: '放弃当前编辑？',
        content: '尚未保存当前食物编辑',
        confirmText: '放弃',
        success: (r) => { if (r.confirm) this._doGoCustom() }
      })
      return
    }
    this._doGoCustom()
  },
  _doGoCustom() {
    wx.navigateTo({ url: `/pages/custom-food/custom-food?mealType=${this.data.mealType}` })
  },

  confirm() {
    if (!this.data.candidates.length) {
      wx.showToast({ title: '请至少保留一项食物', icon: 'none' })
      return
    }
    const sourceType = this.data.sourceType
    const dataSourceMap = {
      photo_ai: 'ai',
      frequent_food: 'frequent',
      manual_search: 'standard_db',
      custom: 'user_custom'
    }
    const payload = {
      meal_type: this.data.mealType,
      record_time: formatDateTimeWithOffset(new Date()),
      source_type: sourceType,
      save_as_frequent: this.data.saveAsFrequent,
      food_items: this.data.candidates.map(c => ({
        food_name: c.food_name,
        portion_desc: c.portion_desc || '',
        weight_g: parseFloat(c.weight_g) || 0,
        calorie: parseFloat(c.calorie) || 0,
        protein: parseFloat(c.protein) || 0,
        carb: parseFloat(c.carb) || 0,
        fat: parseFloat(c.fat) || 0,
        data_source: c.data_source || dataSourceMap[sourceType] || 'ai'
      }))
    }
    wx.showLoading({ title: '保存中' })
    post('/api/diet/records/confirm', payload)
      .then(() => {
        wx.hideLoading()
        this._saved = true
        showRecordSuccess(this.data.mealType)
      })
      .catch(() => {
        wx.hideLoading()
      })
  }
})