const api = require('../../utils/request')

Page({
  data: {
    sessionId: '',
    restId: '',
    session: null,
    restRecord: null,
    completedItem: null,
    nextItem: null,
    remainingSeconds: 0,
    timerText: '00:00',
    isEnded: false
  },

  timer: null,

  onLoad(options) {
    const sessionId = options.session_id
    const restId = options.rest_id
    if (!sessionId || !restId) {
      wx.showToast({ title: '参数错误', icon: 'none' })
      wx.navigateBack()
      return
    }
    this.setData({ sessionId, restId })
    this.loadSession()
  },

  onUnload() {
    this.clearTimer()
  },

  onHide() {
    this.clearTimer()
  },

  onShow() {
    if (this.data.sessionId && !this.data.isEnded) {
      this.loadSession()
    }
  },

  clearTimer() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  },

  loadSession() {
    api.get(`/api/training/sessions/${this.data.sessionId}`)
      .then(data => {
        const restRecord = (data.rest_records || []).find(r => r.id === this.data.restId)
        const completedItem = restRecord
          ? (data.items || []).find(i => i.id === restRecord.related_item_id)
          : null
        const nextItem = data.current_item || null
        this.setData({
          session: data,
          restRecord,
          completedItem,
          nextItem
        }, () => {
          this.startCountdown()
        })
      })
      .catch(() => {})
  },

  startCountdown() {
    this.clearTimer()
    this.tick()
    this.timer = setInterval(() => this.tick(), 1000)
  },

  tick() {
    const { restRecord } = this.data
    if (!restRecord || !restRecord.rest_target_end_time) return
    const end = new Date(restRecord.rest_target_end_time.replace(' ', 'T')).getTime()
    const now = Date.now()
    const diff = Math.ceil((end - now) / 1000)
    if (diff <= 0) {
      this.setData({
        remainingSeconds: 0,
        timerText: '00:00',
        isEnded: true
      })
      this.clearTimer()
      return
    }
    this.setData({
      remainingSeconds: diff,
      timerText: this.formatSeconds(diff),
      isEnded: false
    })
  },

  formatSeconds(total) {
    const m = String(Math.floor(total / 60)).padStart(2, '0')
    const s = String(total % 60).padStart(2, '0')
    return `${m}:${s}`
  },

  skipRest() {
    const { sessionId, restId } = this.data
    wx.showLoading({ title: '提交中' })
    api.post(`/api/training/sessions/${sessionId}/rest/${restId}/skip`)
      .then(() => {
        wx.hideLoading()
        wx.navigateBack()
      })
      .catch(() => {
        wx.hideLoading()
      })
  },

  extendRest(e) {
    const seconds = parseInt(e.currentTarget.dataset.seconds)
    const { sessionId, restId } = this.data
    wx.showLoading({ title: '延长中' })
    api.post(`/api/training/sessions/${sessionId}/rest/${restId}/extend`, {
      additional_seconds: seconds
    })
      .then(rest => {
        wx.hideLoading()
        this.setData({ restRecord: rest, isEnded: false }, () => {
          this.startCountdown()
        })
      })
      .catch(() => {
        wx.hideLoading()
      })
  },

  nextSet() {
    const { sessionId, restId } = this.data
    if (this.data.isEnded) {
      wx.showLoading({ title: '提交中' })
      api.post(`/api/training/sessions/${sessionId}/rest/${restId}/complete`)
        .then(() => {
          wx.hideLoading()
          wx.navigateBack()
        })
        .catch(() => wx.hideLoading())
      return
    }
    wx.navigateBack()
  },

  showFinishSheet() {
    wx.showActionSheet({
      itemList: ['中断并保存', '放弃训练'],
      itemColor: '#1f2937',
      success: (res) => {
        const types = ['interrupted_saved', 'abandoned']
        const titles = ['确认中断并保存？', '确认放弃训练？']
        const finishType = types[res.tapIndex]
        wx.showModal({
          title: titles[res.tapIndex],
          content: '结束后将返回训练首页',
          confirmColor: res.tapIndex === 1 ? '#ef4444' : '#3b82f6',
          success: (r) => {
            if (r.confirm) {
              this.finishSession(finishType)
            }
          }
        })
      }
    })
  },

  finishSession(finishType) {
    const { sessionId } = this.data
    wx.showLoading({ title: '结束中' })
    api.post(`/api/training/sessions/${sessionId}/finish`, {
      finish_type: finishType,
      end_time: require('../../utils/time').formatDateTime(new Date())
    })
      .then(() => {
        wx.hideLoading()
        wx.showToast({ title: '已结束', icon: 'success' })
        wx.switchTab({ url: '/pages/training/training' })
      })
      .catch(() => wx.hideLoading())
  }
})
