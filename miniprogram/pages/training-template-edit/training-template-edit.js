const api = require('../../utils/request')

const GOAL_OPTIONS = [
  { value: 'fat_loss', label: '减脂' },
  { value: 'muscle_gain', label: '增肌' },
  { value: 'maintenance', label: '维持' },
  { value: 'other', label: '其他' }
]

function uid() {
  return 'u_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
}

function createNormalUnit() {
  return {
    _localId: uid(),
    unit_type: 'normal',
    unit_name: '普通动作',
    sort_order: 0,
    config: {
      unit_type: 'normal',
      exercise_name: '',
      sets: [
        { set_index: 1, target_weight: '', target_reps: '', target_rest_seconds: 180 }
      ]
    }
  }
}

function createSupersetUnit() {
  return {
    _localId: uid(),
    unit_type: 'superset',
    unit_name: '超级组',
    sort_order: 0,
    config: {
      unit_type: 'superset',
      unit_name: '超级组',
      rounds: 3,
      target_rest_seconds: 90,
      exercises: [
        { exercise_name: '', target_weight: '', target_reps: '' },
        { exercise_name: '', target_weight: '', target_reps: '' }
      ]
    }
  }
}

function createDropsetUnit() {
  return {
    _localId: uid(),
    unit_type: 'dropset',
    unit_name: '递减组',
    sort_order: 0,
    config: {
      unit_type: 'dropset',
      exercise_name: '',
      rounds: 1,
      target_rest_seconds: 90,
      segments: [
        { segment_index: 1, target_weight: '', target_reps: '' },
        { segment_index: 2, target_weight: '', target_reps: '' }
      ]
    }
  }
}

Page({
  data: {
    templateId: '',
    goalOptions: GOAL_OPTIONS,
    goalIndex: 3,
    form: {
      template_name: '',
      description: '',
      goal_type: 'other'
    },
    units: []
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ templateId: options.id })
      wx.setNavigationBarTitle({ title: '编辑模板' })
      this.loadTemplate(options.id)
    } else {
      wx.setNavigationBarTitle({ title: '创建模板' })
      this.setData({ units: [] })
    }
  },

  loadTemplate(id) {
    wx.showLoading({ title: '加载中' })
    api.get(`/api/training/templates/${id}`)
      .then(tpl => {
        wx.hideLoading()
        const goalIndex = GOAL_OPTIONS.findIndex(g => g.value === tpl.goal_type)
        const units = (tpl.units || []).map((u, idx) => ({
          _localId: u.id || uid(),
          unit_type: u.unit_type,
          unit_name: u.unit_name,
          sort_order: u.sort_order !== undefined ? u.sort_order : idx,
          config: u.config_json || {}
        }))
        this.setData({
          'form.template_name': tpl.template_name,
          'form.description': tpl.description || '',
          'form.goal_type': tpl.goal_type,
          goalIndex: goalIndex >= 0 ? goalIndex : 3,
          units
        })
      })
      .catch(() => {
        wx.hideLoading()
      })
  },

  onNameInput(e) {
    this.setData({ 'form.template_name': e.detail.value })
  },

  onDescInput(e) {
    this.setData({ 'form.description': e.detail.value })
  },

  onGoalChange(e) {
    const idx = parseInt(e.detail.value)
    this.setData({
      goalIndex: idx,
      'form.goal_type': GOAL_OPTIONS[idx].value
    })
  },

  addNormal() {
    this.setData({ units: this.data.units.concat(createNormalUnit()) })
  },

  addSuperset() {
    this.setData({ units: this.data.units.concat(createSupersetUnit()) })
  },

  addDropset() {
    this.setData({ units: this.data.units.concat(createDropsetUnit()) })
  },

  removeUnit(e) {
    const localId = e.currentTarget.dataset.id
    this.setData({ units: this.data.units.filter(u => u._localId !== localId) })
  },

  moveUnit(e) {
    const { id, dir } = e.currentTarget.dataset
    const units = this.data.units.slice()
    const idx = units.findIndex(u => u._localId === id)
    if (idx < 0) return
    const newIdx = dir === 'up' ? idx - 1 : idx + 1
    if (newIdx < 0 || newIdx >= units.length) return
    const temp = units[idx]
    units[idx] = units[newIdx]
    units[newIdx] = temp
    this.setData({ units })
  },

  updateUnitField(e) {
    const { id, field } = e.currentTarget.dataset
    const value = e.detail.value
    const units = this.data.units.map(u => {
      if (u._localId !== id) return u
      return { ...u, [field]: value }
    })
    this.setData({ units })
  },

  updateConfigField(e) {
    const { id, field } = e.currentTarget.dataset
    const value = e.detail.value
    const units = this.data.units.map(u => {
      if (u._localId !== id) return u
      return { ...u, config: { ...u.config, [field]: value } }
    })
    this.setData({ units })
  },

  updateSet(e) {
    const { id, index, field } = e.currentTarget.dataset
    const value = e.detail.value
    const units = this.data.units.map(u => {
      if (u._localId !== id) return u
      const sets = u.config.sets.slice()
      sets[index] = { ...sets[index], [field]: value }
      return { ...u, config: { ...u.config, sets } }
    })
    this.setData({ units })
  },

  addSet(e) {
    const id = e.currentTarget.dataset.id
    const units = this.data.units.map(u => {
      if (u._localId !== id) return u
      const sets = u.config.sets.concat({
        set_index: u.config.sets.length + 1,
        target_weight: '',
        target_reps: '',
        target_rest_seconds: 180
      })
      return { ...u, config: { ...u.config, sets } }
    })
    this.setData({ units })
  },

  removeSet(e) {
    const { id, index } = e.currentTarget.dataset
    const units = this.data.units.map(u => {
      if (u._localId !== id) return u
      const sets = u.config.sets.filter((_, i) => i !== index)
      return { ...u, config: { ...u.config, sets } }
    })
    this.setData({ units })
  },

  updateExercise(e) {
    const { id, index, field } = e.currentTarget.dataset
    const value = e.detail.value
    const units = this.data.units.map(u => {
      if (u._localId !== id) return u
      const exercises = u.config.exercises.slice()
      exercises[index] = { ...exercises[index], [field]: value }
      return { ...u, config: { ...u.config, exercises } }
    })
    this.setData({ units })
  },

  addExercise(e) {
    const id = e.currentTarget.dataset.id
    const units = this.data.units.map(u => {
      if (u._localId !== id) return u
      const exercises = u.config.exercises.concat({
        exercise_name: '',
        target_weight: '',
        target_reps: ''
      })
      return { ...u, config: { ...u.config, exercises } }
    })
    this.setData({ units })
  },

  removeExercise(e) {
    const { id, index } = e.currentTarget.dataset
    const units = this.data.units.map(u => {
      if (u._localId !== id) return u
      const exercises = u.config.exercises.filter((_, i) => i !== index)
      return { ...u, config: { ...u.config, exercises } }
    })
    this.setData({ units })
  },

  updateSegment(e) {
    const { id, index, field } = e.currentTarget.dataset
    const value = e.detail.value
    const units = this.data.units.map(u => {
      if (u._localId !== id) return u
      const segments = u.config.segments.slice()
      segments[index] = { ...segments[index], [field]: value }
      return { ...u, config: { ...u.config, segments } }
    })
    this.setData({ units })
  },

  addSegment(e) {
    const id = e.currentTarget.dataset.id
    const units = this.data.units.map(u => {
      if (u._localId !== id) return u
      const segments = u.config.segments.concat({
        segment_index: u.config.segments.length + 1,
        target_weight: '',
        target_reps: ''
      })
      return { ...u, config: { ...u.config, segments } }
    })
    this.setData({ units })
  },

  removeSegment(e) {
    const { id, index } = e.currentTarget.dataset
    const units = this.data.units.map(u => {
      if (u._localId !== id) return u
      const segments = u.config.segments.filter((_, i) => i !== index)
      return { ...u, config: { ...u.config, segments } }
    })
    this.setData({ units })
  },

  validate() {
    const { form, units } = this.data
    if (!form.template_name.trim()) {
      wx.showToast({ title: '请输入模板名称', icon: 'none' })
      return false
    }
    if (units.length === 0) {
      wx.showToast({ title: '请至少添加一个动作单元', icon: 'none' })
      return false
    }
    for (const u of units) {
      if (!u.unit_name.trim()) {
        wx.showToast({ title: '请输入单元名称', icon: 'none' })
        return false
      }
      if (u.unit_type === 'normal') {
        if (!u.config.exercise_name.trim()) {
          wx.showToast({ title: '请输入动作名称', icon: 'none' })
          return false
        }
        for (const s of u.config.sets) {
          if (!s.target_weight || !s.target_reps) {
            wx.showToast({ title: '请填写完整组数信息', icon: 'none' })
            return false
          }
        }
      } else if (u.unit_type === 'superset') {
        for (const ex of u.config.exercises) {
          if (!ex.exercise_name.trim() || !ex.target_weight || !ex.target_reps) {
            wx.showToast({ title: '请填写完整超级组信息', icon: 'none' })
            return false
          }
        }
      } else if (u.unit_type === 'dropset') {
        if (!u.config.exercise_name.trim()) {
          wx.showToast({ title: '请输入动作名称', icon: 'none' })
          return false
        }
        for (const seg of u.config.segments) {
          if (!seg.target_weight || !seg.target_reps) {
            wx.showToast({ title: '请填写完整递减组信息', icon: 'none' })
            return false
          }
        }
      }
    }
    return true
  },

  buildPayload() {
    const { form, units } = this.data
    const payload = {
      template_name: form.template_name.trim(),
      description: form.description.trim(),
      goal_type: form.goal_type,
      units: units.map((u, idx) => ({
        unit_type: u.unit_type,
        unit_name: u.unit_name.trim(),
        sort_order: idx,
        config: this.buildConfig(u)
      }))
    }
    return payload
  },

  buildConfig(u) {
    const c = u.config
    if (u.unit_type === 'normal') {
      return {
        unit_type: 'normal',
        exercise_name: c.exercise_name.trim(),
        sets: c.sets.map((s, i) => ({
          set_index: i + 1,
          target_weight: parseFloat(s.target_weight),
          target_reps: parseInt(s.target_reps),
          target_rest_seconds: parseInt(s.target_rest_seconds) || 0
        }))
      }
    }
    if (u.unit_type === 'superset') {
      return {
        unit_type: 'superset',
        unit_name: c.unit_name.trim(),
        rounds: parseInt(c.rounds) || 1,
        target_rest_seconds: parseInt(c.target_rest_seconds) || 0,
        exercises: c.exercises.map(ex => ({
          exercise_name: ex.exercise_name.trim(),
          target_weight: parseFloat(ex.target_weight),
          target_reps: parseInt(ex.target_reps)
        }))
      }
    }
    if (u.unit_type === 'dropset') {
      return {
        unit_type: 'dropset',
        exercise_name: c.exercise_name.trim(),
        rounds: parseInt(c.rounds) || 1,
        target_rest_seconds: parseInt(c.target_rest_seconds) || 0,
        segments: c.segments.map((seg, i) => ({
          segment_index: i + 1,
          target_weight: parseFloat(seg.target_weight),
          target_reps: parseInt(seg.target_reps)
        }))
      }
    }
    return c
  },

  saveTemplate() {
    if (!this.validate()) return
    const payload = this.buildPayload()
    wx.showLoading({ title: '保存中' })
    const promise = this.data.templateId
      ? api.put(`/api/training/templates/${this.data.templateId}`, payload)
      : api.post('/api/training/templates', payload)

    promise
      .then(() => {
        wx.hideLoading()
        wx.showToast({ title: '保存成功', icon: 'success' })
        setTimeout(() => wx.navigateBack(), 800)
      })
      .catch(() => {
        wx.hideLoading()
      })
  }
})
