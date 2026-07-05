const { get, post, put, del } = require('../../utils/request')
const { formatDate, getWeekDay, getDefaultMealType, mealTypeName, formatDateTime, formatTime } = require('../../utils/time')

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack']
const DEFAULT_TARGETS = { calorie_target: 2000, protein_target: 120 }
const SOURCE_NAMES = {
  photo_ai: '拍照识别',
  manual_search: '手动搜索',
  frequent_food: '常吃食物',
  custom: '自定义'
}

function buildMealSections(grouped, mapRecord) {
  return MEAL_TYPES.map(type => {
    const records = (grouped[type] || []).map(mapRecord)
    const subtotal = records.reduce((acc, r) => ({
      calorie: acc.calorie + (r.total_calorie || 0),
      protein: acc.protein + (r.total_protein || 0)
    }), { calorie: 0, protein: 0 })
    return {
      type,
      label: mealTypeName(type),
      records,
      subtotal,
      hasRecords: records.length > 0
    }
  })
}

Page({
  data: {
    currentDate: '',
    weekDay: '',
    mealTypes: MEAL_TYPES,
    mealTypeLabels: MEAL_TYPES.map(t => mealTypeName(t)),
    summary: { total_calorie: 0, total_protein: 0, total_carb: 0, total_fat: 0 },
    targets: { ...DEFAULT_TARGETS },
    mealSections: [],
    hasAnyRecords: false,
    latestRecordId: '',
    loading: false,
    showEditModal: false,
    editingRecord: null,
    editMealType: '',
    editDate: '',
    editTime: '',
    editFoodItems: []
  },

  onLoad(options) {
    const date = options.date || formatDate(new Date())
    this.setData({
      currentDate: date,
      weekDay: getWeekDay(date)
    })
    this.loadGoal()
    this.loadRecords()
  },

  onShow() {
    this.loadGoal()
    this.loadRecords()
  },

  loadGoal() {
    get('/api/user/goal')
      .then(goal => {
        if (goal) {
          this.setData({
            targets: {
              calorie_target: goal.calorie_target || DEFAULT_TARGETS.calorie_target,
              protein_target: goal.protein_target || DEFAULT_TARGETS.protein_target
            }
          })
        }
      })
      .catch(() => {})
  },

  loadRecords() {
    const { currentDate } = this.data
    this.setData({ loading: true })
    get('/api/diet/records', { date: currentDate })
      .then(res => {
        const grouped = res.grouped_records || {}
        const mapRecord = r => ({
          ...r,
          source_label: SOURCE_NAMES[r.source_type] || r.source_type
        })
        const allRecords = MEAL_TYPES.reduce((acc, type) => {
          return acc.concat(grouped[type] || [])
        }, [])
        allRecords.sort((a, b) => (b.record_time > a.record_time ? 1 : -1))
        const mealSections = buildMealSections(grouped, mapRecord)
        this.setData({
          summary: res.daily_totals || this.data.summary,
          mealSections,
          hasAnyRecords: allRecords.length > 0,
          latestRecordId: allRecords.length ? allRecords[0].id : '',
          loading: false
        })
      })
      .catch(() => {
        this.setData({ loading: false })
      })
  },

  switchDate(e) {
    const delta = parseInt(e.currentTarget.dataset.delta, 10)
    const d = new Date(this.data.currentDate)
    d.setDate(d.getDate() + delta)
    const date = formatDate(d)
    this.setData({
      currentDate: date,
      weekDay: getWeekDay(date)
    })
    this.loadRecords()
  },

  onDateChange(e) {
    const date = e.detail.value
    this.setData({
      currentDate: date,
      weekDay: getWeekDay(date)
    })
    this.loadRecords()
  },

  recordDiet() {
    wx.navigateTo({
      url: `/pages/diet-record/diet-record?mealType=${getDefaultMealType()}`
    })
  },

  recordMeal(e) {
    const type = e.currentTarget.dataset.type
    wx.navigateTo({
      url: `/pages/diet-record/diet-record?mealType=${type}`
    })
  },

  deleteRecord(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '删除记录',
      content: '删除后不再计入统计',
      confirmColor: '#ef4444',
      success: (res) => {
        if (res.confirm) {
          del(`/api/diet/records/${id}`).then(() => {
            wx.showToast({ title: '已删除', icon: 'success' })
            this.loadRecords()
          }).catch(() => {})
        }
      }
    })
  },

  revokeLatest() {
    const id = this.data.latestRecordId
    if (!id) return
    wx.showModal({
      title: '撤销记录',
      content: '撤销最近一次饮食记录',
      success: (res) => {
        if (res.confirm) {
          post(`/api/diet/records/${id}/revoke`).then(() => {
            wx.showToast({ title: '已撤销', icon: 'success' })
            this.loadRecords()
          }).catch(() => {})
        }
      }
    })
  },

  openEdit(e) {
    const record = e.currentTarget.dataset.record
    const d = new Date(record.record_time.replace(' ', 'T'))
    this.setData({
      showEditModal: true,
      editingRecord: record,
      editMealType: record.meal_type,
      editDate: formatDate(d),
      editTime: formatTime(d),
      editFoodItems: (record.food_items || []).map(f => ({ ...f }))
    })
  },

  closeEdit() {
    this.setData({ showEditModal: false, editingRecord: null })
  },

  onEditMealChange(e) {
    this.setData({ editMealType: this.data.mealTypes[e.detail.value] })
  },

  onEditDateChange(e) {
    this.setData({ editDate: e.detail.value })
  },

  onEditTimeChange(e) {
    this.setData({ editTime: e.detail.value })
  },

  onEditFoodInput(e) {
    const { index, field } = e.currentTarget.dataset
    this.setData({ [`editFoodItems[${index}].${field}`]: e.detail.value })
  },

  saveEdit() {
    const record = this.data.editingRecord
    const foodItems = this.data.editFoodItems.map(f => ({
      food_name: f.food_name,
      portion_desc: f.portion_desc || '',
      weight_g: parseFloat(f.weight_g) || 0,
      calorie: parseFloat(f.calorie) || 0,
      protein: parseFloat(f.protein) || 0,
      carb: parseFloat(f.carb) || 0,
      fat: parseFloat(f.fat) || 0,
      data_source: f.data_source || 'user_custom'
    }))
    const recordTime = time.combineDateTimeWithOffset(this.data.editDate, this.data.editTime)
    wx.showLoading({ title: '保存中' })
    put(`/api/diet/records/${record.id}`, {
      meal_type: this.data.editMealType,
      record_time: recordTime,
      food_items: foodItems
    })
      .then(() => {
        wx.hideLoading()
        wx.showToast({ title: '已更新', icon: 'success' })
        this.closeEdit()
        this.loadRecords()
      })
      .catch(() => {
        wx.hideLoading()
      })
  }
})
