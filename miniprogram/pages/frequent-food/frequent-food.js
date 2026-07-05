const { get, post, del } = require('../../utils/request')
const { formatDateTime, getDefaultMealType, mealTypeName } = require('../../utils/time')
const { showRecordSuccess } = require('../../utils/dietRecordSuccess')

function round(num) {
  return Math.round((num + Number.EPSILON) * 100) / 100
}

Page({
  data: {
    mealType: '',
    mealTypeName,
    foods: [],
    loading: false,
    showModal: false,
    selected: null,
    weightG: ''
  },

  onLoad(options) {
    this.setData({
      mealType: options.mealType || getDefaultMealType()
    })
    this.loadFoods()
  },

  onShow() {
    this.loadFoods()
  },

  loadFoods() {
    this.setData({ loading: true })
    get('/api/diet/frequent-foods')
      .then(list => {
        this.setData({ foods: list || [], loading: false })
      })
      .catch(() => {
        this.setData({ loading: false })
      })
  },

  selectFood(e) {
    const item = e.currentTarget.dataset.item
    this.setData({
      selected: item,
      weightG: item.default_weight_g || 100,
      showModal: true
    })
  },

  onWeightInput(e) {
    this.setData({ weightG: e.detail.value })
  },

  closeModal() {
    this.setData({ showModal: false, selected: null })
  },

  deleteFood(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '删除常吃食物',
      content: '删除后不影响历史饮食记录',
      confirmColor: '#ef4444',
      success: (res) => {
        if (res.confirm) {
          del(`/api/diet/frequent-foods/${id}`).then(() => {
            wx.showToast({ title: '已删除', icon: 'success' })
            this.loadFoods()
          }).catch(() => {})
        }
      }
    })
  },

  confirm() {
    const item = this.data.selected
    const w = parseFloat(this.data.weightG) || 0
    if (w <= 0) {
      wx.showToast({ title: '请输入有效克数', icon: 'none' })
      return
    }
    const baseWeight = item.default_weight_g || 100
    const factor = baseWeight > 0 ? w / baseWeight : 0
    const foodItem = {
      food_name: item.food_name,
      portion_desc: `${w}g`,
      weight_g: w,
      calorie: round(item.calorie * factor),
      protein: round(item.protein * factor),
      carb: round(item.carb * factor),
      fat: round(item.fat * factor),
      data_source: 'frequent'
    }
    const payload = {
      meal_type: this.data.mealType,
      record_time: formatDateTime(new Date()),
      source_type: 'frequent_food',
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
