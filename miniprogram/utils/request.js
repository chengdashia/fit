// 单例 token 清空 + 标记：避免 401 多次 toast / 多次跳转
let _authInvalidated = false
let _authToastTimer = null

function _clearAuth() {
  try {
    wx.removeStorageSync('token')
    wx.removeStorageSync('userId')
  } catch (e) {}
  const app = getApp && getApp()
  if (app && app.globalData) {
    app.globalData.token = null
    app.globalData.userId = null
  }
}

function _redirectToLogin() {
  if (_authToastTimer) {
    clearTimeout(_authToastTimer)
    _authToastTimer = null
  }
  wx.showToast({ title: '登录已过期，请重新登录', icon: 'none' })
  // 用 reLaunch 清掉整页栈，再让 login.js 强制走 doLogin
  _authToastTimer = setTimeout(() => {
    wx.reLaunch({ url: '/pages/login/login' })
    _authToastTimer = null
  }, 700)
}

function getBaseUrl() {
  return getApp().globalData.apiBaseUrl
}

function request(options) {
  return new Promise((resolve, reject) => {
    const token = wx.getStorageSync('token')
    wx.request({
      url: getBaseUrl() + options.url,
      method: options.method || 'GET',
      data: options.data || {},
      header: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
      },
      success(res) {
        if (res.statusCode === 401) {
          if (!_authInvalidated) {
            _authInvalidated = true
            _clearAuth()
            _redirectToLogin()
            // 1.2s 后放行，让其他并发请求统一感知
            setTimeout(() => { _authInvalidated = false }, 1200)
          }
          reject(new Error('登录已失效'))
          return
        }
        if (res.data && res.data.code === 0) {
          resolve(res.data.data)
        } else {
          const msg = (res.data && res.data.message) ? res.data.message : '请求失败'
          if (!options.silent) {
            wx.showToast({ title: msg, icon: 'none' })
          }
          reject(new Error(msg))
        }
      },
      fail(err) {
        if (!options.silent) {
          wx.showToast({ title: '网络错误', icon: 'none' })
        }
        reject(err)
      }
    })
  })
}

function uploadFile(url, filePath, formData = {}) {
  return new Promise((resolve, reject) => {
    const token = wx.getStorageSync('token')
    wx.uploadFile({
      url: getBaseUrl() + url,
      filePath,
      name: 'image_file',
      formData,
      header: {
        'Authorization': token ? `Bearer ${token}` : ''
      },
      success(res) {
        let data
        try { data = JSON.parse(res.data) } catch (e) {
          wx.showToast({ title: '响应解析失败', icon: 'none' })
          reject(new Error('JSON parse error'))
          return
        }
        if (res.statusCode === 401) {
          if (!_authInvalidated) {
            _authInvalidated = true
            _clearAuth()
            _redirectToLogin()
            setTimeout(() => { _authInvalidated = false }, 1200)
          }
          reject(new Error('登录已失效'))
          return
        }
        if (data.code === 0) {
          resolve(data.data)
        } else {
          wx.showToast({ title: data.message || '上传失败', icon: 'none' })
          reject(new Error(data.message))
        }
      },
      fail(err) {
        wx.showToast({ title: '上传失败', icon: 'none' })
        reject(err)
      }
    })
  })
}

module.exports = {
  request,
  uploadFile,
  get: (url, data, opts) => request({ url, method: 'GET', data, ...(opts || {}) }),
  post: (url, data, opts) => request({ url, method: 'POST', data, ...(opts || {}) }),
  put: (url, data, opts) => request({ url, method: 'PUT', data, ...(opts || {}) }),
  del: (url, data, opts) => request({ url, method: 'DELETE', data, ...(opts || {}) })
}