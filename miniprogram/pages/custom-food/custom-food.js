const { post } = require('../../utils/request')
const { formatDateTime, getDefaultMealType, mealTypeName } = require('../../utils/time')
const { showRecordSuccess } = require('../../utils/dietRecordSuccess')

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack']

Page({
  data: {
    mealType: '',
    mealTypes: MEAL_TYPES,
    mealTypeName,
    form: {
      food_name: '',
      weight_g: '',
      calorie: '',
      protein: '',
      carb: '',
      fat: ''
    },
    saveAsFrequent: false
  },

  onLoad(options) {
    this.setData({
      mealType: options.mealType || getDefaultMealType()
    })
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({
      [`form.${field}`]: e.detail.value
    })
  },

  selectMeal(e) {
    this.setData({ mealType: e.currentTarget.dataset.type })
  },

  toggleSave(e) {
    this.setData({ saveAsFrequent: e.detail.value })
  },

  submit() {
    const f = this.data.form
    if (!f.food_name.trim() || !f.weight_g || f.calorie === '') {
      wx.showToast({ title: '请填写完整必填项', icon: 'none' })
      return
    }
    const weight = parseFloat(f.weight_g)
    if (weight <= 0) {
      wx.showToast({ title: '克数必须大于0', icon: 'none' })
      return
    }
    const foodItem = {
      food_name: f.food_name.trim(),
      portion_desc: `${weight}g`,
      weight_g: weight,
      calorie: parseFloat(f.calorie) || 0,
      protein: parseFloat(f.protein) || 0,
      carb: parseFloat(f.carb) || 0,
      fat: parseFloat(f.fat) || 0,
      data_source: 'user_custom'
    }
    const payload = {
      meal_type: this.data.mealType,
      record_time: formatDateTime(new Date()),
      source_type: 'custom',
      save_as_frequent: this.data.saveAsFrequent,
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
