const api = require('../../utils/request')
const time = require('../../utils/time')

Page({
  data: {
    list: [],
    page: 1,
    pageSize: 20,
    hasMore: true,
    loading: false,
    detailId: '',
    detail: null
  },

  onLoad() {
    this.loadHistory()
  },

  loadHistory() {
    if (this.data.loading || !this.data.hasMore) return
    this.setData({ loading: true })
    api.get('/api/training/sessions/history', {
      page: this.data.page,
      page_size: this.data.pageSize
    })
      .then(res => {
        const items = (res.list || []).map(item => ({
          ...item,
          dateText: item.start_time ? time.formatDate(item.start_time) : '-',
          timeText: item.start_time ? time.formatTime(item.start_time) : '-',
          durationText: this.formatDuration(item.duration_seconds),
          statusText: this.statusText(item.session_status)
        }))
        const list = this.data.page === 1 ? items : this.data.list.concat(items)
        this.setData({
          list,
          hasMore: res.has_more !== false && items.length === this.data.pageSize,
          page: this.data.page + 1,
          loading: false
        })
      })
      .catch(() => {
        this.setData({ loading: false })
      })
  },

  formatDuration(seconds) {
    const s = seconds || 0
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    if (h > 0) {
      return `${h}小时${String(m).padStart(2, '0')}分`
    }
    return `${m}:${String(sec).padStart(2, '0')}`
  },

  statusText(status) {
    const map = {
      completed: '已完成',
      interrupted_saved: '中断保存',
      abandoned: '已放弃'
    }
    return map[status] || status
  },

  showDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.showLoading({ title: '加载中' })
    api.get(`/api/training/sessions/${id}/history-detail`)
      .then(data => {
        wx.hideLoading()
        const detail = this.buildDetail(data)
        this.setData({ detailId: id, detail })
      })
      .catch(() => {
        wx.hideLoading()
      })
  },

  buildDetail(session) {
    const orderMap = {}
    ;(session.units || []).forEach(u => { orderMap[u.id] = u.sort_order })
    const sortedItems = (session.items || []).slice().sort((a, b) => {
      const oa = orderMap[a.session_unit_id] || 0
      const ob = orderMap[b.session_unit_id] || 0
      if (oa !== ob) return oa - ob
      if (a.round_index !== b.round_index) return a.round_index - b.round_index
      if (a.set_index !== b.set_index) return a.set_index - b.set_index
      return a.segment_index - b.segment_index
    })
    const units = (session.units || []).map(u => ({
      ...u,
      items: sortedItems
        .filter(i => i.session_unit_id === u.id)
        .map(it => ({
          ...it,
          resultText: this.formatItemResult(it),
          badgeText: it.is_temporary_added ? '临时加组' : ''
        }))
    }))
    return {
      ...session,
      units,
      startText: session.start_time ? time.formatDate(session.start_time) + ' ' + time.formatTime(session.start_time) : '-',
      durationText: this.formatDuration(session.duration_seconds)
    }
  },

  formatItemResult(item) {
    if (item.status === 'skipped') return '已跳过'
    if (item.status !== 'completed') return '未完成'
    const target = `目标 ${item.target_weight}kg × ${item.target_reps}次`
    const actual = `实际 ${item.actual_weight}kg × ${item.actual_reps}次`
    if (item.actual_weight === item.target_weight && item.actual_reps === item.target_reps) {
      return actual
    }
    return `${target} → ${actual}`
  },

  closeDetail() {
    this.setData({ detailId: '', detail: null })
  },

  stopPropagation() {
    // do nothing
  },

  onReachBottom() {
    this.loadHistory()
  }
})
