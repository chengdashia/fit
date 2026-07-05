const { get, post } = require('../../utils/request')
const time = require('../../utils/time')
const { navigateToSession } = require('../../utils/trainingNavigate')

const TRAINING_STATUS_MAP = {
  not_started: '未开始',
  in_progress: '进行中',
  resting: '进行中',
  completed: '已完成',
  interrupted_saved: '中断保存'
}

function round(v) {
  return Math.round(v || 0)
}

Page({
  data: {
    loading: true,
    loadError: false,
    date: '',
    displayDate: '',
    greeting: '',
    nickname: '小宇',
    avatarInitial: '小',
    goal: null,
    diet: {},
    calorieTarget: 0,
    remainingCalories: 0,
    calorieOver: false,
    calorieDiffText: '',
    dietPercent: 0,
    dietProgress: 0,
    macros: [],
    training: {},
    trainingStatusText: '未开始',
    ctaText: '开始训练',
    ctaAction: 'start',
    quickTrainingLabel: '开始训练',
    lastTemplate: '',
    weight: {},
    displayWeight: '--',
    targetWeightDisplay: '--',
    diffDisplay: '',
    diffPositive: true,
    weightTrend: [],
    showWeightModal: false,
    weightInput: '',
    weightHint: '',
    weightDate: '',
    weightTime: '',
    weightNote: ''
  },

  onShow() {
    const today = new Date()
    const dateStr = time.formatDate(today)
    const app = getApp()
    this.setData({
      date: dateStr,
      displayDate: this.formatDisplayDate(today),
      greeting: this.getGreeting(),
      nickname: app.globalData.userInfo && app.globalData.userInfo.nickName ? app.globalData.userInfo.nickName : '小宇',
      avatarInitial: (app.globalData.userInfo && app.globalData.userInfo.nickName ? app.globalData.userInfo.nickName : '小宇').slice(0, 1)
    }, () => {
      this.loadDashboard()
    })
  },

  onPullDownRefresh() {
    this.loadDashboard().finally(() => {
      wx.stopPullDownRefresh()
    })
  },

  formatDisplayDate(date) {
    const d = date instanceof Date ? date : new Date(date)
    const m = d.getMonth() + 1
    const day = d.getDate()
    return `${m}月${day}日 ${time.getWeekDay(d)}`
  },

  getGreeting() {
    const hour = new Date().getHours()
    if (hour >= 5 && hour < 12) return '早上好'
    if (hour < 18) return '下午好'
    if (hour < 23) return '晚上好'
    return '夜深了'
  },

  loadDashboard() {
    this.setData({ loading: true, loadError: false })
    const date = this.data.date
    return Promise.all([
      get('/api/home/dashboard', { date }),
      get('/api/weight/trend', { range: '7d' }).catch(() => ({ points: [] }))
    ]).then(([dashboard, trendRes]) => {
      const goal = dashboard.goal
      const diet = dashboard.diet_summary || {}
      const training = dashboard.training_summary || {}
      const weight = dashboard.weight_summary || {}
      const weightTrend = (trendRes && trendRes.points) || []
      const dietState = this.computeDiet(goal, diet)
      const trainingState = this.computeTraining(training)
      const weightState = this.computeWeight(goal, weight)
      this.setData({
        loading: false,
        loadError: false,
        goal,
        diet,
        weightTrend,
        ...dietState,
        ...trainingState,
        ...weightState
      }, () => {
        if (goal) {
          this.drawWeightChart()
        }
      })
    }).catch(() => {
      this.setData({ loading: false, loadError: true })
    })
  },

  retryLoad() {
    this.loadDashboard()
  },

  computeDiet(goal, diet) {
    if (!goal) return {}
    const calorieTarget = goal.calorie_target || 1800
    const proteinTarget = goal.protein_target || 0
    let fatTarget = goal.fat_target
    let carbTarget = goal.carb_target

    if (!fatTarget && calorieTarget && proteinTarget) {
      fatTarget = Math.round(calorieTarget * 0.25 / 9)
    }
    if (!carbTarget && calorieTarget && proteinTarget) {
      carbTarget = Math.round((calorieTarget - proteinTarget * 4 - (fatTarget || 0) * 9) / 4)
    }
    if (!fatTarget || fatTarget < 0) fatTarget = 60
    if (!carbTarget || carbTarget < 0) carbTarget = 220

    const intake = diet.calorie_intake || 0
    const diff = calorieTarget - intake
    const calorieOver = diff < 0
    const dietPercent = calorieTarget > 0 ? Math.min(100, Math.round(intake / calorieTarget * 100)) : 0
    const remainingCalories = calorieOver ? 0 : diff
    const calorieDiffText = calorieOver
      ? `超出 ${Math.abs(diff)} kcal`
      : `剩余 ${remainingCalories} kcal`

    const macros = [
      {
        name: '蛋白质',
        intake: round(diet.protein_intake),
        target: proteinTarget,
        percent: proteinTarget > 0 ? Math.min(100, Math.round((diet.protein_intake || 0) / proteinTarget * 100)) : 0,
        color: '#3b82f6'
      },
      {
        name: '碳水',
        intake: round(diet.carb_intake),
        target: carbTarget,
        percent: carbTarget > 0 ? Math.min(100, Math.round((diet.carb_intake || 0) / carbTarget * 100)) : 0,
        color: '#22c55e'
      },
      {
        name: '脂肪',
        intake: round(diet.fat_intake),
        target: fatTarget,
        percent: fatTarget > 0 ? Math.min(100, Math.round((diet.fat_intake || 0) / fatTarget * 100)) : 0,
        color: '#f59e0b'
      }
    ]

    return {
      calorieTarget,
      remainingCalories,
      calorieOver,
      calorieDiffText,
      dietPercent,
      dietProgress: dietPercent * 3.6,
      macros
    }
  },

  computeTraining(training) {
    const status = training.today_status || 'not_started'
    const unfinished = training.unfinished_session_id
    const trainingStatusText = TRAINING_STATUS_MAP[status] || '未开始'

    let ctaText = '开始训练'
    let ctaAction = 'start'
    let quickTrainingLabel = '开始训练'

    if (unfinished) {
      ctaText = '继续训练'
      ctaAction = 'continue'
      quickTrainingLabel = '继续训练'
    } else if (status === 'completed' || status === 'interrupted_saved') {
      ctaText = '查看训练记录'
      ctaAction = 'history'
      quickTrainingLabel = '训练记录'
    }

    const lastTemplate = training.last_template_name || '暂无数据'

    return { training, trainingStatusText, ctaText, ctaAction, quickTrainingLabel, lastTemplate }
  },

  computeWeight(goal, weight) {
    const state = {
      weight,
      displayWeight: '--',
      targetWeightDisplay: '--',
      diffDisplay: '',
      diffPositive: true
    }
    if (weight.latest_weight_kg != null) {
      state.displayWeight = Number(weight.latest_weight_kg).toFixed(1)
    }
    if (weight.latest_record_time) {
      const t = weight.latest_record_time.replace('T', ' ').slice(0, 16)
      state.weight = { ...weight, latest_record_time: t }
    }
    if (goal && goal.target_weight_kg != null) {
      state.targetWeightDisplay = Number(goal.target_weight_kg).toFixed(1)
    }
    if (weight.target_diff_kg != null) {
      const diff = Number(weight.target_diff_kg)
      state.diffPositive = diff >= 0
      state.diffDisplay = (diff >= 0 ? '+' : '') + diff.toFixed(1)
    }
    return state
  },

  drawWeightChart() {
    const query = wx.createSelectorQuery().in(this)
    query.select('#weightChart')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res || !res[0]) return
        const node = res[0].node
        const ctx = node.getContext('2d')
        const dpr = wx.getSystemInfoSync().pixelRatio
        const width = res[0].width
        const height = res[0].height
        node.width = width * dpr
        node.height = height * dpr
        ctx.scale(dpr, dpr)
        this.renderChart(ctx, width, height)
      })
  },

  renderChart(ctx, width, height) {
    const padding = { top: 24, right: 16, bottom: 32, left: 40 }
    const plotWidth = width - padding.left - padding.right
    const plotHeight = height - padding.top - padding.bottom

    let points = (this.data.weightTrend || []).map(p => ({
      date: typeof p.date === 'string' ? p.date : time.formatDate(p.date),
      weight: Number(p.weight_kg)
    }))

    if (points.length === 0) {
      ctx.fillStyle = '#9ca3af'
      ctx.font = '14px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('暂无体重数据', width / 2, height / 2)
      return
    }

    if (points.length > 7) {
      points = points.slice(-7)
    }

    const weights = points.map(p => p.weight)
    let minWeight = Math.min(...weights)
    let maxWeight = Math.max(...weights)
    if (minWeight === maxWeight) {
      minWeight -= 1
      maxWeight += 1
    }
    const weightRange = maxWeight - minWeight

    ctx.clearRect(0, 0, width, height)

    // grid lines
    ctx.strokeStyle = '#e5e7eb'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(padding.left, padding.top)
    ctx.lineTo(width - padding.right, padding.top)
    ctx.moveTo(padding.left, padding.top + plotHeight / 2)
    ctx.lineTo(width - padding.right, padding.top + plotHeight / 2)
    ctx.moveTo(padding.left, padding.top + plotHeight)
    ctx.lineTo(width - padding.right, padding.top + plotHeight)
    ctx.stroke()

    // y-axis labels
    ctx.fillStyle = '#9ca3af'
    ctx.font = '11px sans-serif'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    ctx.fillText(maxWeight.toFixed(1), padding.left - 8, padding.top)
    ctx.fillText(((maxWeight + minWeight) / 2).toFixed(1), padding.left - 8, padding.top + plotHeight / 2)
    ctx.fillText(minWeight.toFixed(1), padding.left - 8, padding.top + plotHeight)

    const getX = (i) => {
      if (points.length === 1) return padding.left + plotWidth / 2
      return padding.left + (plotWidth * i) / (points.length - 1)
    }
    const getY = (w) => padding.top + plotHeight - ((w - minWeight) / weightRange) * plotHeight

    // area fill
    const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + plotHeight)
    gradient.addColorStop(0, 'rgba(59, 130, 246, 0.2)')
    gradient.addColorStop(1, 'rgba(59, 130, 246, 0)')
    ctx.beginPath()
    ctx.moveTo(getX(0), padding.top + plotHeight)
    points.forEach((p, i) => {
      ctx.lineTo(getX(i), getY(p.weight))
    })
    ctx.lineTo(getX(points.length - 1), padding.top + plotHeight)
    ctx.closePath()
    ctx.fillStyle = gradient
    ctx.fill()

    // line
    ctx.beginPath()
    ctx.strokeStyle = '#3b82f6'
    ctx.lineWidth = 3
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    points.forEach((p, i) => {
      const x = getX(i)
      const y = getY(p.weight)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.stroke()

    // dots and labels
    points.forEach((p, i) => {
      const x = getX(i)
      const y = getY(p.weight)

      ctx.beginPath()
      ctx.arc(x, y, 5, 0, Math.PI * 2)
      ctx.fillStyle = '#ffffff'
      ctx.fill()
      ctx.lineWidth = 2
      ctx.strokeStyle = '#3b82f6'
      ctx.stroke()

      const dateObj = new Date(p.date.replace(/-/g, '/'))
      const label = `${dateObj.getMonth() + 1}/${dateObj.getDate()}`
      ctx.fillStyle = '#9ca3af'
      ctx.font = '10px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.fillText(label, x, padding.top + plotHeight + 8)
    })
  },

  goOnboarding() {
    wx.navigateTo({ url: '/pages/onboarding/onboarding' })
  },

  goDietRecord() {
    wx.navigateTo({ url: '/pages/diet-record/diet-record' })
  },

  goDiet() {
    wx.switchTab({ url: '/pages/diet/diet' })
  },

  onTrainingTap() {
    const training = this.data.training
    if (training.unfinished_session_id) {
      this.showUnfinishedTrainingSheet(training.unfinished_session_id)
    } else if (training.today_status === 'completed' || training.today_status === 'interrupted_saved') {
      wx.navigateTo({ url: '/pages/training-history/training-history' })
    } else {
      wx.switchTab({ url: '/pages/training/training' })
    }
  },

  showUnfinishedTrainingSheet(sessionId) {
    wx.showActionSheet({
      itemList: ['继续训练', '结束并保存', '放弃训练'],
      success: (res) => {
        const idx = res.tapIndex
        if (idx === 0) {
          navigateToSession(sessionId).catch(() => {})
        } else if (idx === 1) {
          this.finishTrainingSession(sessionId, 'interrupted_saved')
        } else if (idx === 2) {
          wx.showModal({
            title: '放弃训练',
            content: '放弃后本次训练不会保存',
            confirmColor: '#ef4444',
            success: (r) => {
              if (r.confirm) {
                this.finishTrainingSession(sessionId, 'abandoned')
              }
            }
          })
        }
      }
    })
  },

  finishTrainingSession(sessionId, finishType) {
    wx.showLoading({ title: '处理中' })
    post(`/api/training/sessions/${sessionId}/finish`, {
      finish_type: finishType,
      end_time: time.formatDateTimeWithOffset(new Date())
    }).then(() => {
      wx.hideLoading()
      wx.showToast({ title: finishType === 'abandoned' ? '已放弃' : '已保存', icon: 'success' })
      this.loadDashboard()
    }).catch(() => {
      wx.hideLoading()
    })
  },

  goWeight() {
    wx.switchTab({ url: '/pages/weight/weight' })
  },

  showWeightModal() {
    const hint = this.data.displayWeight !== '--' ? this.data.displayWeight : ''
    const now = new Date()
    this.setData({
      showWeightModal: true,
      weightInput: '',
      weightHint: hint,
      weightDate: time.formatDate(now),
      weightTime: time.formatTime(now),
      weightNote: ''
    })
  },

  hideWeightModal() {
    this.setData({ showWeightModal: false })
  },

  noop() {},

  onWeightInput(e) {
    this.setData({ weightInput: e.detail.value })
  },

  onWeightDateChange(e) {
    this.setData({ weightDate: e.detail.value })
  },

  onWeightTimeChange(e) {
    this.setData({ weightTime: e.detail.value })
  },

  onWeightNoteInput(e) {
    this.setData({ weightNote: e.detail.value })
  },

  submitWeight() {
    const value = parseFloat(this.data.weightInput)
    if (Number.isNaN(value) || value < 20 || value > 300) {
      wx.showToast({ title: '体重需在20-300kg', icon: 'none' })
      return
    }

    const recordTime = time.combineDateTimeWithOffset(this.data.weightDate, this.data.weightTime)
    if (new Date(recordTime) > new Date()) {
      wx.showToast({ title: '不能记录未来时间', icon: 'none' })
      return
    }

    const payload = {
      weight_kg: Number(value.toFixed(1)),
      record_time: recordTime,
      note: this.data.weightNote || ''
    }

    post('/api/weight/records', payload).then(() => {
      wx.showToast({ title: '体重已记录', icon: 'success' })
      this.hideWeightModal()
      this.loadDashboard()
    }).catch(() => {
      wx.showToast({ title: '记录失败', icon: 'none' })
    })
  }
})
