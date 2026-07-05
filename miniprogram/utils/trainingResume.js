const api = require('./request')
const time = require('./time')
const { navigateToSession } = require('./trainingNavigate')

function finishSession(sessionId, finishType) {
  return api.post(`/api/training/sessions/${sessionId}/finish`, {
    finish_type: finishType,
    end_time: time.formatDateTimeWithOffset(new Date())
  })
}

// 屏蔽窗口：同一 session id 在 N 秒内只允许弹一次 sheet
let _lastShownId = ''
let _lastShownAt = 0
const COOLDOWN_MS = 8000

function showUnfinishedSheet(sessionId, onDone) {
  if (_lastShownId === sessionId && Date.now() - _lastShownAt < COOLDOWN_MS) {
    return
  }
  _lastShownId = sessionId
  _lastShownAt = Date.now()
  wx.showActionSheet({
    itemList: ['继续训练', '结束并保存', '放弃训练'],
    success: (res) => {
      if (res.tapIndex === 0) {
        navigateToSession(sessionId).catch(() => {})
      } else if (res.tapIndex === 1) {
        finishSession(sessionId, 'interrupted_saved').then(() => {
          wx.showToast({ title: '已保存', icon: 'success' })
          if (onDone) onDone()
        }).catch(() => {})
      } else if (res.tapIndex === 2) {
        wx.showModal({
          title: '放弃训练',
          content: '放弃后本次训练不会保存',
          confirmColor: '#ef4f5a',
          success: (r) => {
            if (r.confirm) {
              finishSession(sessionId, 'abandoned').then(() => {
                wx.showToast({ title: '已放弃', icon: 'success' })
                if (onDone) onDone()
              }).catch(() => {})
            }
          }
        })
      }
    }
  })
}

function checkUnfinished(onDone) {
  const token = wx.getStorageSync('token')
  if (!token) return
  api.get('/api/training/sessions/unfinished', undefined, { silent: true })
    .then(data => {
      if (data && data.id) {
        showUnfinishedSheet(data.id, onDone)
      }
    })
    .catch(() => {})
}

function resetCooldown() {
  _lastShownId = ''
  _lastShownAt = 0
}

module.exports = { checkUnfinished, showUnfinishedSheet, finishSession, resetCooldown }