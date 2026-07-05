const api = require('../../utils/request')
const auth = require('../../utils/auth')

const GOAL_STAGE_MAP = {
  fat_loss: '减脂',
  muscle_gain: '增肌'
}

const GOAL_STATUS_MAP = {
  fat_loss: '减脂中',
  muscle_gain: '增肌中'
}

const GOAL_ICON_MAP = {
  fat_loss: '🔥',
  muscle_gain: '💪'
}

Page({
  data: {
    statusBarHeight: 20,
    profile: {},
    goal: null,
    goalStageText: '',
    goalStatusText: '',
    goalStageIcon: ''
  },

  onLoad() {
    const sys = wx.getSystemInfoSync()
    this.setData({ statusBarHeight: sys.statusBarHeight || 20 })
    this.loadData()
  },

  onShow() {
    this.loadData()
  },

  onPullDownRefresh() {
    this.loadData().finally(() => {
      wx.stopPullDownRefresh()
    })
  },

  loadData() {
    return Promise.all([
      api.get('/api/user/profile'),
      api.get('/api/user/goal')
    ])
      .then(([profile, goal]) => {
        const stage = (goal && goal.goal_stage) || ''
        this.setData({
          profile: profile || {},
          goal: goal || null,
          goalStageText: GOAL_STAGE_MAP[stage] || '',
          goalStatusText: GOAL_STATUS_MAP[stage] || '目标未设置',
          goalStageIcon: GOAL_ICON_MAP[stage] || '🎯'
        })
      })
      .catch(() => {
        this.setData({
          profile: {},
          goal: null,
          goalStageText: '',
          goalStatusText: '目标未设置',
          goalStageIcon: '🎯'
        })
      })
  },

  goEditProfile() {
    wx.navigateTo({ url: '/pages/onboarding/onboarding?from=profile' })
  },

  goFrequentFood() {
    wx.navigateTo({ url: '/pages/frequent-food/frequent-food' })
  },

  goTrainingHistory() {
    wx.navigateTo({ url: '/pages/training-history/training-history' })
  },

  showAbout() {
    wx.showModal({
      title: '关于小程序',
      content: '健身饮食记录 MVP，用于记录饮食、训练、体重和目标进度。',
      showCancel: false
    })
  },

  handleLogout() {
    wx.showModal({
      title: '确认退出',
      content: '退出后需要重新登录',
      success: (res) => {
        if (res.confirm) {
          auth.logout()
        }
      }
    })
  }
})
