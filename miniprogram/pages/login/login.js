const auth = require('../../utils/auth')
const api = require('../../utils/request')

Page({
  onLoad() {
    // 强制清理：避免 request.js 把 _authInvalidated 标志清除后，
    // 老 token 仍在 storage 中让 login.js 误判为已登录
    const token = wx.getStorageSync('token')
    if (token) {
      this.checkExistingLogin()
    } else {
      this.doLogin()
    }
  },

  checkExistingLogin() {
    api.get('/api/user/profile')
      .then(() => {
        api.get('/api/user/goal')
          .then(goal => {
            if (goal) {
              wx.switchTab({ url: '/pages/home/home' })
            } else {
              wx.redirectTo({ url: '/pages/onboarding/onboarding' })
            }
          })
          .catch(() => {
            wx.removeStorageSync('token')
            wx.removeStorageSync('userId')
            this.doLogin()
          })
      })
      .catch(() => {
        wx.removeStorageSync('token')
        wx.removeStorageSync('userId')
        this.doLogin()
      })
  },

  doLogin() {
    auth.login()
      .then(data => {
        if (data.has_goal) {
          wx.switchTab({ url: '/pages/home/home' })
        } else {
          wx.redirectTo({ url: '/pages/onboarding/onboarding' })
        }
      })
      .catch(() => {
        wx.showModal({
          title: '登录失败',
          content: '无法完成微信登录，请重试',
          showCancel: false,
          success: () => this.doLogin()
        })
      })
  }
})