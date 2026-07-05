const api = require('./request')

function login() {
  return new Promise((resolve, reject) => {
    wx.login({
      success(res) {
        if (res.code) {
          api.post('/api/auth/wechat-login', { code: res.code })
            .then(data => {
              wx.setStorageSync('token', data.token)
              wx.setStorageSync('userId', data.user_id)
              getApp().globalData.token = data.token
              getApp().globalData.userId = data.user_id
              resolve(data)
            })
            .catch(reject)
        } else {
          reject(new Error('登录失败'))
        }
      },
      fail: reject
    })
  })
}

function logout() {
  wx.removeStorageSync('token')
  wx.removeStorageSync('userId')
  getApp().globalData.token = null
  getApp().globalData.userId = null
  wx.redirectTo({ url: '/pages/login/login' })
}

function checkLogin() {
  return !!wx.getStorageSync('token')
}

module.exports = {
  login,
  logout,
  checkLogin
}
