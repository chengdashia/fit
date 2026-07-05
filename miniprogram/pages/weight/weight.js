const api = require('../../utils/request')
const time = require('../../utils/time')

Page({
  data: {
    latest: null,
    targetWeight: null,
    distance: 0,
    range: '7d',
    trend: [],
    history: [],
    page: 1,
    pageSize: 20,
    hasMore: true,
    loading: false,
    modalVisible: false,
    modalTitle: '记录体重',
    form: {
      id: '',
      weight_kg: '',
      date: '',
      time: '',
      note: ''
    }
  },

  onLoad() {
    this.setData({
      'form.date': time.formatDate(new Date()),
      'form.time': time.formatTime(new Date())
    })
  },

  onShow() {
    this.loadAll()
  },

  loadAll() {
    this.loadLatest()
    this.loadGoal()
    this.loadTrend()
    this.setData({ page: 1, history: [], hasMore: true }, () => {
      this.loadHistory()
    })
  },

  loadLatest() {
    api.get('/api/weight/records', { page: 1, page_size: 1 })
      .then(res => {
        const list = res.list || []
        this.setData({ latest: list[0] || null }, () => this.calcDistance())
      })
      .catch(() => {})
  },

  loadGoal() {
    api.get('/api/user/goal')
      .then(res => {
        const target = res ? res.target_weight_kg : null
        this.setData({ targetWeight: target }, () => {
          this.calcDistance()
          this.drawTrendChart()
        })
      })
      .catch(() => {})
  },

  calcDistance() {
    const { latest, targetWeight } = this.data
    if (!latest || targetWeight == null) {
      this.setData({ distance: 0 })
      return
    }
    const d = parseFloat((latest.weight_kg - targetWeight).toFixed(1))
    this.setData({ distance: d })
  },

  loadTrend() {
    api.get('/api/weight/trend', { range: this.data.range })
      .then(res => {
        const raw = res.points || []
        const weights = raw.map(p => parseFloat(p.weight_kg))
        const min = weights.length ? Math.min(...weights) : 0
        const max = weights.length ? Math.max(...weights) : 0
        const span = max - min || 1
        const points = raw.map(p => {
          const w = parseFloat(p.weight_kg)
          return {
            ...p,
            dateText: time.formatDate(p.date).slice(5),
            weightText: w.toFixed(1),
            percent: Math.max(10, Math.min(100, ((w - min) / span) * 100))
          }
        })
        this.setData({ trend: points }, () => this.drawTrendChart())
      })
      .catch(() => {})
  },

  drawTrendChart() {
    const query = wx.createSelectorQuery().in(this)
    query.select('#weightTrendChart')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res || !res[0] || !res[0].node) return
        const node = res[0].node
        const ctx = node.getContext('2d')
        const dpr = wx.getSystemInfoSync().pixelRatio
        const width = res[0].width
        const height = res[0].height
        node.width = width * dpr
        node.height = height * dpr
        ctx.scale(dpr, dpr)
        this.renderTrendChart(ctx, width, height)
      })
  },

  renderTrendChart(ctx, width, height) {
    ctx.clearRect(0, 0, width, height)
    const points = (this.data.trend || []).map(p => ({
      dateText: p.dateText,
      weight: Number(p.weight_kg)
    }))
    if (points.length === 0) return

    const padding = { top: 32, right: 24, bottom: 34, left: 42 }
    const plotWidth = width - padding.left - padding.right
    const plotHeight = height - padding.top - padding.bottom
    const weights = points.map(p => p.weight)
    let min = Math.min(...weights)
    let max = Math.max(...weights)
    const target = this.data.targetWeight == null ? null : Number(this.data.targetWeight)
    if (target != null) {
      min = Math.min(min, target)
      max = Math.max(max, target)
    }
    if (min === max) {
      min -= 1
      max += 1
    }
    const range = max - min
    const getX = (i) => points.length === 1
      ? padding.left + plotWidth / 2
      : padding.left + (plotWidth * i) / (points.length - 1)
    const getY = (w) => padding.top + plotHeight - ((w - min) / range) * plotHeight

    ctx.strokeStyle = 'rgba(111,136,181,0.18)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ;[0, 0.5, 1].forEach(r => {
      const y = padding.top + plotHeight * r
      ctx.moveTo(padding.left, y)
      ctx.lineTo(width - padding.right, y)
    })
    ctx.stroke()

    if (target != null) {
      const y = getY(target)
      ctx.setLineDash([6, 6])
      ctx.strokeStyle = 'rgba(47,111,246,0.45)'
      ctx.beginPath()
      ctx.moveTo(padding.left, y)
      ctx.lineTo(width - padding.right, y)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = '#2f6ff6'
      ctx.font = '11px sans-serif'
      ctx.textAlign = 'right'
      ctx.fillText(`目标 ${target.toFixed(1)}kg`, width - padding.right, y - 8)
    }

    const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + plotHeight)
    gradient.addColorStop(0, 'rgba(47,111,246,0.18)')
    gradient.addColorStop(1, 'rgba(47,111,246,0)')
    ctx.beginPath()
    points.forEach((p, i) => {
      const x = getX(i)
      const y = getY(p.weight)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.lineTo(getX(points.length - 1), padding.top + plotHeight)
    ctx.lineTo(getX(0), padding.top + plotHeight)
    ctx.closePath()
    ctx.fillStyle = gradient
    ctx.fill()

    ctx.beginPath()
    ctx.strokeStyle = '#2f6ff6'
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    points.forEach((p, i) => {
      const x = getX(i)
      const y = getY(p.weight)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.stroke()

    points.forEach((p, i) => {
      const x = getX(i)
      const y = getY(p.weight)
      ctx.beginPath()
      ctx.arc(x, y, 5, 0, Math.PI * 2)
      ctx.fillStyle = '#ffffff'
      ctx.fill()
      ctx.lineWidth = 2
      ctx.strokeStyle = '#2f6ff6'
      ctx.stroke()
      ctx.fillStyle = '#667085'
      ctx.font = '10px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(p.dateText, x, padding.top + plotHeight + 22)
      ctx.fillStyle = '#344054'
      ctx.fillText(p.weight.toFixed(1), x, y - 12)
    })
  },

  loadHistory() {
    if (this.data.loading || !this.data.hasMore) return
    this.setData({ loading: true })
    api.get('/api/weight/records', {
      page: this.data.page,
      page_size: this.data.pageSize
    })
      .then(res => {
        const list = (res.list || []).map(item => ({
          ...item,
          dateText: time.formatDate(item.record_time),
          timeText: time.formatTime(item.record_time)
        }))
        const history = this.data.page === 1 ? list : this.data.history.concat(list)
        this.setData({
          history,
          hasMore: res.has_more !== false && list.length === this.data.pageSize,
          page: this.data.page + 1,
          loading: false
        })
      })
      .catch(() => {
        this.setData({ loading: false })
      })
  },

  switchRange(e) {
    const range = e.currentTarget.dataset.range
    if (range === this.data.range) return
    this.setData({ range }, () => this.loadTrend())
  },

  openAddModal() {
    this.setData({
      modalVisible: true,
      modalTitle: '记录体重',
      form: {
        id: '',
        weight_kg: '',
        date: time.formatDate(new Date()),
        time: time.formatTime(new Date()),
        note: ''
      }
    })
  },

  openEditModal(e) {
    const item = e.currentTarget.dataset.item
    const d = new Date(item.record_time)
    this.setData({
      modalVisible: true,
      modalTitle: '编辑体重',
      form: {
        id: item.id,
        weight_kg: String(item.weight_kg),
        date: time.formatDate(d),
        time: time.formatTime(d),
        note: item.note || ''
      }
    })
  },

  closeModal() {
    this.setData({ modalVisible: false })
  },

  stopPropagation() {
    // do nothing
  },

  onWeightInput(e) {
    this.setData({ 'form.weight_kg': e.detail.value })
  },

  onDateChange(e) {
    this.setData({ 'form.date': e.detail.value })
  },

  onTimeChange(e) {
    this.setData({ 'form.time': e.detail.value })
  },

  onNoteInput(e) {
    this.setData({ 'form.note': e.detail.value })
  },

  saveRecord() {
    const { form } = this.data
    const weight = parseFloat(form.weight_kg)
    if (!weight || weight < 20 || weight > 300) {
      wx.showToast({ title: '请输入20-300之间的体重', icon: 'none' })
      return
    }
    const recordTime = time.combineDateTimeWithOffset(form.date, form.time)
    if (new Date(recordTime) > new Date()) {
      wx.showToast({ title: '不能记录未来时间', icon: 'none' })
      return
    }
    const payload = {
      weight_kg: weight,
      record_time: recordTime,
      note: form.note
    }
    const promise = form.id
      ? api.put(`/api/weight/records/${form.id}`, payload)
      : api.post('/api/weight/records', payload)

    promise
      .then(() => {
        wx.showToast({ title: '保存成功', icon: 'success' })
        this.setData({ modalVisible: false })
        this.loadAll()
      })
      .catch(() => {})
  },

  deleteRecord(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '确认删除',
      content: '删除后不可恢复',
      confirmColor: '#ef4444',
      success: (res) => {
        if (res.confirm) {
          api.del(`/api/weight/records/${id}`)
            .then(() => {
              wx.showToast({ title: '已删除', icon: 'success' })
              this.loadAll()
            })
            .catch(() => {})
        }
      }
    })
  },

  onReachBottom() {
    this.loadHistory()
  },

  onPullDownRefresh() {
    this.loadAll()
    wx.stopPullDownRefresh()
  }
})
