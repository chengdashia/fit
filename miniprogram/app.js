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
    // 仅对 tabBar 顶层页面触发未完成训练检查
    // 训练执行/休息页内部有自己的 onShow，不应该触发此全局弹窗
    const pages = getCurrentPages()
    const cur = pages[pages.length - 1]
    if (!cur) return
    const route = cur.route || ''
    const skipRoutes = [
      'pages/login/login',
      'pages/onboarding/onboarding',
      'pages/training-session/training-session',
      'pages/training-rest/training-rest'
    ]
    if (skipRoutes.some(r => route.indexOf(r) === 0)) return
    if (!wx.getStorageSync('token')) return
    const trainingResume = require('./utils/trainingResume')
    trainingResume.checkUnfinished()
  }
})