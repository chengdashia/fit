const api = require('./request')
const time = require('./time')
const { navigateToSession } = require('./trainingNavigate')

function finishSession(sessionId, finishType) {
  return api.post(`/api/training/sessions/${sessionId}/finish`, {
    finish_type: finishType,
    end_time: time.formatDateTime(new Date())
  })
}

function showUnfinishedSheet(sessionId, onDone) {
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
          confirmColor: '#ef4444',
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
  api.get('/api/training/sessions/unfinished')
    .then(data => {
      if (data && data.id) {
        showUnfinishedSheet(data.id, onDone)
      }
    })
    .catch(() => {})
}

module.exports = { checkUnfinished, showUnfinishedSheet, finishSession }
