const api = require('../../utils/request')
const time = require('../../utils/time')
const trainingResume = require('../../utils/trainingResume')
const { navigateToSession } = require('../../utils/trainingNavigate')
const { getStoredProgram, getTodayPlan, createSplitProgram, SPLIT_DAYS, getTodayDayIndex, saveProgram } = require('../../utils/trainingPresets')

const GOAL_NAMES = {
  fat_loss: '减脂',
  muscle_gain: '增肌',
  maintenance: '维持',
  other: '其他'
}

const FILTERS = [
  { value: 'all', label: '全部' },
  { value: 'muscle_gain', label: '增肌' },
  { value: 'fat_loss', label: '减脂' },
  { value: 'maintenance', label: '塑形' },
  { value: 'other', label: '恢复' }
]

Page({
  data: {
    allTemplates: [],
    templates: [],
    filters: FILTERS,
    activeFilter: 'all',
    loading: false,
    hasSplitProgram: false,
    todayPlan: null,
    splitDays: []
  },

  onShow() {
    this.loadTemplates()
    trainingResume.checkUnfinished(() => this.loadTemplates())
  },

  loadSplitPlan() {
    let program = getStoredProgram()
    if (!program || !program.templateIds || !program.templateIds.length) {
      program = this.detectSplitProgram(this.data.allTemplates)
      if (program) saveProgram(program)
    }
    const todayPlan = getTodayPlan(program)
    const dayIndex = getTodayDayIndex()
    const splitDays = SPLIT_DAYS.map((d, idx) => ({
      key: d.key,
      label: d.label,
      isToday: idx === dayIndex
    }))
    this.setData({
      hasSplitProgram: !!(program && program.templateIds && program.templateIds.length),
      todayPlan,
      splitDays
    })
  },

  detectSplitProgram(templates) {
    const list = templates || []
    const ids = SPLIT_DAYS.map(day => {
      const tpl = list.find(t => t.template_name === day.template_name)
      return tpl ? tpl.id : null
    })
    if (ids.some(id => !id)) return null
    return {
      templateIds: ids,
      labels: SPLIT_DAYS.map(d => d.label),
      createdAt: Date.now()
    }
  },

  initSplitProgram() {
    wx.showLoading({ title: '创建计划中' })
    createSplitProgram(api)
      .then(() => {
        wx.hideLoading()
        wx.showToast({ title: '三分化计划已创建', icon: 'success' })
        this.loadSplitPlan()
        this.loadTemplates()
      })
      .catch(() => {
        wx.hideLoading()
      })
  },

  loadTemplates() {
    this.setData({ loading: true })
    api.get('/api/training/templates')
      .then(res => {
        const list = (res || []).map(t => ({
          ...t,
          goalText: GOAL_NAMES[t.goal_type] || t.goal_type,
          lastUsedText: t.last_used_at
            ? time.formatDate(t.last_used_at)
            : '未使用',
          unitCountText: `${t.unit_count || 0} 个动作单元`
        }))
        this.setData({
          allTemplates: list,
          templates: this.filterTemplates(list, this.data.activeFilter),
          loading: false
        })
        this.loadSplitPlan()
      })
      .catch(() => {
        this.setData({ loading: false })
      })
  },

  filterTemplates(list, filter) {
    if (filter === 'all') return list
    return list.filter(t => t.goal_type === filter)
  },

  switchFilter(e) {
    const filter = e.currentTarget.dataset.filter
    this.setData({
      activeFilter: filter,
      templates: this.filterTemplates(this.data.allTemplates, filter)
    })
  },

  goCreate() {
    wx.navigateTo({ url: '/pages/training-template-edit/training-template-edit' })
  },

  goEdit(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/training-template-edit/training-template-edit?id=${id}` })
  },

  startTraining(e) {
    const id = e.currentTarget.dataset.id
    wx.showLoading({ title: '准备中' })
    api.get('/api/training/sessions/unfinished')
      .then(unfinished => {
        if (unfinished && unfinished.id) {
          wx.hideLoading()
          wx.showActionSheet({
            itemList: ['继续训练', '结束并保存', '放弃训练'],
            success: (res) => {
              const sessionId = unfinished.id
              if (res.tapIndex === 0) {
                navigateToSession(sessionId).catch(() => {})
              } else if (res.tapIndex === 1) {
                this.finishUnfinished(sessionId, 'interrupted_saved')
              } else if (res.tapIndex === 2) {
                wx.showModal({
                  title: '放弃训练',
                  content: '放弃后本次训练不会保存',
                  confirmColor: '#ef4444',
                  success: (r) => {
                    if (r.confirm) this.finishUnfinished(sessionId, 'abandoned')
                  }
                })
              }
            }
          })
          return null
        }
        return api.post('/api/training/sessions/start', {
          template_id: id,
          start_time: time.formatDateTimeWithOffset(new Date())
        })
      })
      .then(data => {
        if (!data) return
        wx.hideLoading()
        wx.navigateTo({ url: `/pages/training-session/training-session?session_id=${data.id}` })
      })
      .catch(() => {
        wx.hideLoading()
      })
  },

  finishUnfinished(sessionId, finishType) {
    wx.showLoading({ title: '处理中' })
    api.post(`/api/training/sessions/${sessionId}/finish`, {
      finish_type: finishType,
      end_time: time.formatDateTimeWithOffset(new Date())
    }).then(() => {
      wx.hideLoading()
      wx.showToast({ title: finishType === 'abandoned' ? '已放弃' : '已保存', icon: 'success' })
      this.loadTemplates()
    }).catch(() => {
      wx.hideLoading()
    })
  },

  copyTemplate(e) {
    const id = e.currentTarget.dataset.id
    wx.showLoading({ title: '复制中' })
    api.get(`/api/training/templates/${id}`)
      .then(tpl => {
        const payload = {
          template_name: `${tpl.template_name} 副本`,
          description: tpl.description,
          goal_type: tpl.goal_type,
          units: (tpl.units || []).map(u => ({
            unit_type: u.unit_type,
            unit_name: u.unit_name,
            sort_order: u.sort_order,
            config: u.config_json
          }))
        }
        return api.post('/api/training/templates', payload)
      })
      .then(() => {
        wx.hideLoading()
        wx.showToast({ title: '复制成功', icon: 'success' })
        this.loadTemplates()
      })
      .catch(() => {
        wx.hideLoading()
      })
  },

  deleteTemplate(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '确认删除',
      content: '删除后不可恢复',
      confirmColor: '#ef4444',
      success: (res) => {
        if (res.confirm) {
          api.del(`/api/training/templates/${id}`)
            .then(() => {
              wx.showToast({ title: '已删除', icon: 'success' })
              this.loadTemplates()
            })
            .catch(() => {})
        }
      }
    })
  },

  goHistory() {
    wx.navigateTo({ url: '/pages/training-history/training-history' })
  },

  copyLastSession() {
    wx.showLoading({ title: '复制中' })
    api.post('/api/training/templates/copy-last-session')
      .then(() => {
        wx.hideLoading()
        wx.showToast({ title: '已复制上次训练', icon: 'success' })
        this.loadTemplates()
      })
      .catch(() => wx.hideLoading())
  }
})
