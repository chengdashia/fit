const { get, post } = require('../../utils/request')
const { formatDateTimeWithOffset, getDefaultMealType, mealTypeName } = require('../../utils/time')
const { showRecordSuccess } = require('../../utils/dietRecordSuccess')

function round(num) {
  return Math.round((num + Number.EPSILON) * 100) / 100
}

Page({
  data: {
    mealType: '',
    mealTypeName,
    keyword: '',
    results: [],
    loading: false,
    showModal: false,
    selected: null,
    weightG: ''
  },

  onLoad(options) {
    this.setData({
      mealType: options.mealType || getDefaultMealType()
    })
  },

  onInput(e) {
    this.setData({ keyword: e.detail.value })
    this.search()
  },

  search() {
    const kw = this.data.keyword.trim()
    if (!kw) {
      this.setData({ results: [] })
      return
    }
    this.setData({ loading: true })
    get('/api/diet/foods/search', { keyword: kw })
      .then(list => {
        this.setData({ results: list || [], loading: false })
      })
      .catch(() => {
        this.setData({ loading: false })
      })
  },

  selectFood(e) {
    const item = e.currentTarget.dataset.item
    this.setData({
      selected: item,
      weightG: 100,
      showModal: true
    })
  },

  onWeightInput(e) {
    this.setData({ weightG: e.detail.value })
  },

  closeModal() {
    this.setData({ showModal: false, selected: null })
  },

  confirm() {
    const item = this.data.selected
    const w = parseFloat(this.data.weightG) || 0
    if (w <= 0) {
      wx.showToast({ title: '请输入有效克数', icon: 'none' })
      return
    }
    const factor = w / 100
    const foodItem = {
      food_name: item.food_name,
      portion_desc: `${w}g`,
      weight_g: w,
      calorie: round(item.calorie_per_100g * factor),
      protein: round(item.protein_per_100g * factor),
      carb: round(item.carb_per_100g * factor),
      fat: round(item.fat_per_100g * factor),
      data_source: item.source === 'frequent_food' ? 'frequent' : 'standard_db'
    }
    const payload = {
      meal_type: this.data.mealType,
      record_time: formatDateTimeWithOffset(new Date()),
      source_type: 'manual_search',
      save_as_frequent: false,
      food_items: [foodItem]
    }
    wx.showLoading({ title: '保存中' })
    post('/api/diet/records/confirm', payload)
      .then(() => {
        wx.hideLoading()
        showRecordSuccess(this.data.mealType)
      })
      .catch(() => {
        wx.hideLoading()
      })
  }
})
