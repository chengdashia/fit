const api = require('./request')

function navigateToSession(sessionOrId) {
  const sessionId = typeof sessionOrId === 'string' ? sessionOrId : sessionOrId.id
  return api.get(`/api/training/sessions/${sessionId}`).then(data => {
    if (data.session_status === 'resting' && data.active_rest_record) {
      wx.navigateTo({
        url: `/pages/training-rest/training-rest?session_id=${sessionId}&rest_id=${data.active_rest_record.id}`
      })
    } else {
      wx.navigateTo({
        url: `/pages/training-session/training-session?session_id=${sessionId}`
      })
    }
  })
}

module.exports = { navigateToSession }
