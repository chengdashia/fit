const api = require('../../utils/request')
const time = require('../../utils/time')

Page({
  data: {
    sessionId: '',
    session: null,
    currentItem: null,
    currentUnit: null,
    nextItem: null,
    nextItemText: '',
    actualWeight: '',
    actualReps: '',
    progressText: '',
    progressPercent: 0,
    setInfoText: '',
    restInfoText: '',
    exerciseOutline: []
  },

  onLoad(options) {
    const sessionId = options.session_id || options.id
    if (!sessionId) {
      wx.showToast({ title: '缺少训练会话', icon: 'none' })
      wx.navigateBack()
      return
    }
    this.setData({ sessionId })
    if (options.action === 'finish') {
      this.finishSession('interrupted_saved')
      return
    }
    this.loadSession(true)
  },

  onShow() {
    if (this.data.sessionId) {
      this.loadSession(false)
    }
  },

  loadSession(checkResting) {
    api.get(`/api/training/sessions/${this.data.sessionId}`)
      .then(data => {
        if (checkResting && data.session_status === 'resting' && data.active_rest_record) {
          wx.redirectTo({
            url: `/pages/training-rest/training-rest?session_id=${this.data.sessionId}&rest_id=${data.active_rest_record.id}`
          })
          return
        }
        const currentItem = data.current_item
        const currentUnit = currentItem
          ? (data.units || []).find(u => u.id === currentItem.session_unit_id)
          : null
        const nextItem = this.findNextItem(data, currentItem)
        const setInfo = this.buildSetInfo(data, currentItem, currentUnit)
        this.setData({
          session: data,
          currentItem,
          currentUnit,
          nextItem,
          nextItemText: this.buildNextItemText(nextItem),
          setInfoText: setInfo.setInfoText,
          restInfoText: setInfo.restInfoText,
          exerciseOutline: this.buildExerciseOutline(data, currentItem),
          actualWeight: currentItem && currentItem.actual_weight != null
            ? String(currentItem.actual_weight)
            : (currentItem ? String(currentItem.target_weight) : ''),
          actualReps: currentItem && currentItem.actual_reps != null
            ? String(currentItem.actual_reps)
            : (currentItem ? String(currentItem.target_reps) : ''),
          progressText: this.buildProgressText(data, currentItem),
          progressPercent: this.buildProgressPercent(data, currentItem)
        })
      })
      .catch(() => {})
  },

  findNextItem(session, currentItem) {
    if (!currentItem) return null
    const sorted = this.getSortedItems(session)
    const idx = sorted.findIndex(i => i.id === currentItem.id)
    if (idx < 0 || idx >= sorted.length - 1) return null
    return sorted[idx + 1]
  },

  buildSetInfo(session, currentItem, currentUnit) {
    if (!currentItem || !currentUnit || currentUnit.unit_type !== 'normal') {
      return { setInfoText: '', restInfoText: '' }
    }
    const unitItems = (session.items || [])
      .filter(i => i.session_unit_id === currentItem.session_unit_id)
      .sort((a, b) => a.set_index - b.set_index)
    const totalSets = unitItems.length
    const setIndex = currentItem.set_index || 1
    const restSeconds = currentItem.target_rest_seconds || 0
    let restInfoText = ''
    if (restSeconds >= 60) {
      const mins = Math.floor(restSeconds / 60)
      const secs = restSeconds % 60
      restInfoText = secs > 0
        ? `组间休息 ${mins} 分 ${secs} 秒`
        : `组间休息 ${mins} 分钟`
    } else if (restSeconds > 0) {
      restInfoText = `组间休息 ${restSeconds} 秒`
    }
    return {
      setInfoText: `第 ${setIndex} 组 / 共 ${totalSets} 组`,
      restInfoText
    }
  },

  buildExerciseOutline(session, currentItem) {
    const orderMap = {}
    ;(session.units || []).forEach(u => { orderMap[u.id] = u.sort_order })
    const units = (session.units || []).slice().sort((a, b) => a.sort_order - b.sort_order)
    return units.map(unit => {
      const items = (session.items || []).filter(i => i.session_unit_id === unit.id)
      const totalSets = items.length
      const doneSets = items.filter(i => i.status === 'completed' || i.status === 'skipped').length
      const isCurrent = currentItem && currentItem.session_unit_id === unit.id
      const isDone = totalSets > 0 && doneSets >= totalSets
      const name = unit.unit_name || (items[0] && items[0].exercise_name) || '动作'
      return {
        name,
        meta: `${doneSets}/${totalSets} 组`,
        isCurrent,
        isDone
      }
    })
  },

  buildNextItemText(item) {
    if (!item) return '无'
    const parts = [item.exercise_name]
    if (item.set_index > 0) parts.push(`第${item.set_index}组`)
    if (item.round_index > 0) parts.push(`第${item.round_index}轮`)
    if (item.segment_index > 0) parts.push(`第${item.segment_index}段`)
    parts.push(`${item.target_weight}kg × ${item.target_reps}次`)
    return parts.join(' · ')
  },

  buildProgressText(session, currentItem) {
    const total = (session.items || []).length
    if (total === 0) return '0 / 0'
    if (!currentItem) {
      const finished = (session.items || []).filter(i =>
        i.status === 'completed' || i.status === 'skipped'
      ).length
      return `${finished} / ${total}`
    }
    const sorted = this.getSortedItems(session)
    const currentIndex = sorted.findIndex(i => i.id === currentItem.id)
    const finished = currentIndex >= 0 ? currentIndex : total
    return `${finished + 1} / ${total}`
  },

  buildProgressPercent(session, currentItem) {
    const total = (session.items || []).length
    if (total === 0) return 0
    let finished = 0
    if (!currentItem) {
      finished = (session.items || []).filter(i =>
        i.status === 'completed' || i.status === 'skipped'
      ).length
    } else {
      const sorted = this.getSortedItems(session)
      const currentIndex = sorted.findIndex(i => i.id === currentItem.id)
      finished = currentIndex >= 0 ? currentIndex + 1 : total
    }
    return Math.round((finished / total) * 100)
  },

  getSortedItems(session) {
    const orderMap = {}
    ;(session.units || []).forEach(u => { orderMap[u.id] = u.sort_order })
    return (session.items || []).slice().sort((a, b) => {
      const oa = orderMap[a.session_unit_id] || 0
      const ob = orderMap[b.session_unit_id] || 0
      if (oa !== ob) return oa - ob
      if (a.round_index !== b.round_index) return a.round_index - b.round_index
      if (a.set_index !== b.set_index) return a.set_index - b.set_index
      return a.segment_index - b.segment_index
    })
  },

  onWeightInput(e) {
    this.setData({ actualWeight: e.detail.value })
  },

  onRepsInput(e) {
    this.setData({ actualReps: e.detail.value })
  },

  handleNextState(next) {
    if (next.rest_record) {
      wx.navigateTo({
        url: `/pages/training-rest/training-rest?session_id=${this.data.sessionId}&rest_id=${next.rest_record.id}`
      })
    } else if (next.next_item) {
      this.loadSession(false)
    } else {
      wx.showModal({
        title: '训练完成',
        content: '已完成全部动作，是否结束训练？',
        confirmText: '结束',
        success: (res) => {
          if (res.confirm) {
            this.finishSession('completed')
          } else {
            this.loadSession(false)
          }
        }
      })
    }
  },

  completeSet() {
    const { sessionId, currentItem, actualWeight, actualReps } = this.data
    if (!currentItem) return
    const weight = parseFloat(actualWeight)
    const reps = parseInt(actualReps, 10)
    if (!weight || weight <= 0) {
      wx.showToast({ title: '请输入有效重量', icon: 'none' })
      return
    }
    if (!reps || reps <= 0) {
      wx.showToast({ title: '请输入有效次数', icon: 'none' })
      return
    }
    wx.showLoading({ title: '提交中' })
    api.post(`/api/training/sessions/${sessionId}/items/${currentItem.id}/complete`, {
      actual_weight: weight,
      actual_reps: reps,
      completed_at: time.formatDateTimeWithOffset(new Date())
    })
      .then(next => {
        wx.hideLoading()
        this.handleNextState(next)
      })
      .catch(() => {
        wx.hideLoading()
      })
  },

  skipSet() {
    const { sessionId, currentItem } = this.data
    if (!currentItem) return
    wx.showLoading({ title: '提交中' })
    api.post(`/api/training/sessions/${sessionId}/items/${currentItem.id}/skip`)
      .then(next => {
        wx.hideLoading()
        this.handleNextState(next)
      })
      .catch(() => {
        wx.hideLoading()
      })
  },

  addTempSet() {
    const { sessionId, currentItem, currentUnit } = this.data
    if (!currentItem || !currentUnit) return
    if (currentUnit.unit_type !== 'normal') {
      wx.showToast({ title: '仅普通组支持临时加组', icon: 'none' })
      return
    }
    wx.showLoading({ title: '添加中' })
    api.post(`/api/training/sessions/${sessionId}/items/add-temp-set`, {
      session_unit_id: currentItem.session_unit_id,
      based_on_item_id: currentItem.id,
      target_weight: currentItem.target_weight,
      target_reps: currentItem.target_reps,
      target_rest_seconds: currentItem.target_rest_seconds
    })
      .then(() => {
        wx.hideLoading()
        wx.showToast({ title: '已加组', icon: 'success' })
        this.loadSession(false)
      })
      .catch(() => {
        wx.hideLoading()
      })
  },

  showFinishSheet() {
    wx.showActionSheet({
      itemList: ['正常完成', '中断并保存', '放弃训练'],
      itemColor: '#1f2937',
      success: (res) => {
        const map = ['completed', 'interrupted_saved', 'abandoned']
        const titles = ['确认完成训练？', '确认中断并保存？', '确认放弃训练？']
        const finishType = map[res.tapIndex]
        wx.showModal({
          title: titles[res.tapIndex],
          content: '结束后将返回训练首页',
          confirmColor: res.tapIndex === 2 ? '#ef4444' : '#3b82f6',
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
      end_time: time.formatDateTimeWithOffset(new Date())
    })
      .then(() => {
        wx.hideLoading()
        wx.showToast({ title: '已结束', icon: 'success' })
        wx.switchTab({ url: '/pages/training/training' })
      })
      .catch(() => {
        wx.hideLoading()
      })
  }
})
