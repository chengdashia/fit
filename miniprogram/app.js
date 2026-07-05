App({
  globalData: {
    userInfo: null,
    apiBaseUrl: 'http://localhost:8000'
  },
  onLaunch() {
    const token = wx.getStorageSync('token')
    const userId = wx.getStorageSync('userId')
    if (token && userId) {
      this.globalData.token = token
      this.globalData.userId = userId
    }
  },
  onShow() {
    const pages = getCurrentPages()
    const route = pages.length ? pages[pages.length - 1].route : ''
    const skipRoutes = ['pages/login/login', 'pages/onboarding/onboarding', 'pages/training-session/training-session', 'pages/training-rest/training-rest']
    if (skipRoutes.some(r => route.includes(r))) return
    if (!wx.getStorageSync('token')) return
    const trainingResume = require('./utils/trainingResume')
    trainingResume.checkUnfinished()
  }
})
