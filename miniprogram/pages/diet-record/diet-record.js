const { get, uploadFile } = require('../../utils/request')
const { formatDateTime, getDefaultMealType, mealTypeName, formatDate } = require('../../utils/time')

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack']
const OPTIONS = [
  { name: '拍照识别', icon: '📷', page: 'diet-result', source: 'camera', desc: 'AI识别食物，快速记录热量' },
  { name: '手动搜索', icon: '🔍', page: 'food-search', source: 'search', desc: '搜索食物名称，精确记录营养' },
  { name: '常吃食物', icon: '⭐', page: 'frequent-food', source: 'frequent', desc: '快速选择常吃的食物' },
  { name: '自定义食物', icon: '✏️', page: 'custom-food', source: 'custom', desc: '记录自制食物，添加营养信息' }
]

Page({
  data: {
    mealTypes: MEAL_TYPES,
    options: OPTIONS,
    selectedMealType: '',
    uploading: false,
    currentDate: '',
    summary: { total_calorie: 0, total_protein: 0 },
    targets: { calorie_target: 1800, protein_target: 120 },
    frequentFoods: []
  },

  onLoad(options) {
    this.setData({
      selectedMealType: options.mealType || getDefaultMealType(),
      currentDate: formatDate(new Date())
    })
  },

  onShow() {
    this.loadSummary()
    this.loadFrequentFoods()
  },

  loadSummary() {
    const date = this.data.currentDate
    Promise.all([
      get('/api/diet/records', { date }),
      get('/api/user/goal')
    ]).then(([records, goal]) => {
      const summary = records.daily_totals || { total_calorie: 0, total_protein: 0 }
      const targets = goal ? {
        calorie_target: goal.calorie_target || 1800,
        protein_target: goal.protein_target || 120
      } : this.data.targets
      this.setData({ summary, targets })
    }).catch(() => {})
  },

  loadFrequentFoods() {
    get('/api/diet/frequent-foods')
      .then(list => {
        this.setData({ frequentFoods: (list || []).slice(0, 6) })
      })
      .catch(() => {})
  },

  selectMeal(e) {
    this.setData({ selectedMealType: e.currentTarget.dataset.type })
  },

  onOptionTap(e) {
    const item = e.currentTarget.dataset.item
    if (item.source === 'camera') {
      this.takePhoto()
    } else {
      wx.navigateTo({
        url: `/pages/${item.page}/${item.page}?mealType=${this.data.selectedMealType}`
      })
    }
  },

  takePhoto() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera', 'album'],
      success: (res) => {
        const tempFile = res.tempFiles[0].tempFilePath
        this.uploadAndGo(tempFile)
      },
      fail: () => {
        wx.showToast({ title: '未选择图片', icon: 'none' })
      }
    })
  },

  uploadAndGo(tempFile) {
    const meal = this.data.selectedMealType
    const time = formatDateTime(new Date())
    this.setData({ uploading: true })
    wx.showLoading({ title: '识别中' })
    uploadFile('/api/diet/recognize', tempFile, {
      meal_type: meal,
      record_time: time
    })
      .then(data => {
        wx.hideLoading()
        this.setData({ uploading: false })
        const candidates = encodeURIComponent(JSON.stringify(data.candidates || []))
        wx.navigateTo({
          url: `/pages/diet-result/diet-result?mealType=${meal}&thumb=${encodeURIComponent(tempFile)}&candidates=${candidates}`
        })
      })
      .catch(() => {
        wx.hideLoading()
        this.setData({ uploading: false })
        wx.showActionSheet({
          itemList: ['重新拍照', '手动搜索', '自定义录入'],
          success: (res) => {
            const meal = this.data.selectedMealType
            if (res.tapIndex === 0) {
              this.takePhoto()
            } else if (res.tapIndex === 1) {
              wx.navigateTo({ url: `/pages/food-search/food-search?mealType=${meal}` })
            } else if (res.tapIndex === 2) {
              wx.navigateTo({ url: `/pages/custom-food/custom-food?mealType=${meal}` })
            }
          }
        })
      })
  },

  goFrequentFood() {
    wx.navigateTo({
      url: `/pages/frequent-food/frequent-food?mealType=${this.data.selectedMealType}`
    })
  },

  onFrequentTap(e) {
    const item = e.currentTarget.dataset.item
    const candidates = encodeURIComponent(JSON.stringify([{
      food_name: item.food_name,
      portion_desc: item.default_portion_desc || '1份',
      weight_g: item.default_weight_g,
      calorie: item.calorie,
      protein: item.protein,
      carb: item.carb,
      fat: item.fat,
      data_source: 'frequent'
    }]))
    wx.navigateTo({
      url: `/pages/diet-result/diet-result?mealType=${this.data.selectedMealType}&candidates=${candidates}&source=frequent_food`
    })
  }
})
