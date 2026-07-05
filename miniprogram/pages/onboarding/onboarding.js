const api = require('../../utils/request')

const GOAL_OPTIONS = [
  { value: 'fat_loss', label: '减脂', desc: '降低体脂，塑造线条', emoji: '🔥' },
  { value: 'muscle_gain', label: '增肌', desc: '增加肌肉，提升力量', emoji: '💪' }
]

const GENDER_LABELS = { male: '男', female: '女' }

const FIELD_META = {
  current_weight_kg: { title: '当前体重', placeholder: '如 76.0', type: 'digit', unit: 'kg' },
  target_weight_kg: { title: '目标体重', placeholder: '如 72.0', type: 'digit', unit: 'kg' },
  height_cm: { title: '身高', placeholder: '如 178（选填）', type: 'number', unit: 'cm' },
  calorie_target: { title: '每日热量目标', placeholder: '如 1800', type: 'number', unit: 'kcal' },
  protein_target: { title: '每日蛋白质目标', placeholder: '如 130', type: 'number', unit: 'g' }
}

Page({
  data: {
    from: '',
    originalGoalStage: '',
    goalOptions: GOAL_OPTIONS,
    genderLabel: '男',
    birthYears: [],
    birthYearIndex: 0,
    form: {
      goal_stage: 'fat_loss',
      current_weight_kg: '',
      target_weight_kg: '',
      height_cm: '',
      gender: 'male',
      birth_year: 2000,
      calorie_target: '',
      protein_target: ''
    },
    showFieldModal: false,
    fieldModalKey: '',
    fieldModalTitle: '',
    fieldModalPlaceholder: '',
    fieldModalType: 'digit',
    fieldModalValue: ''
  },

  onLoad(options) {
    const currentYear = new Date().getFullYear()
    const startYear = currentYear - 100
    const years = []
    for (let y = startYear; y <= currentYear; y++) years.push(String(y))
    const defaultYear = currentYear - 25

    this.setData({
      from: options.from || '',
      birthYears: years,
      'form.birth_year': defaultYear,
      birthYearIndex: defaultYear - startYear,
      genderLabel: GENDER_LABELS.male
    })

    if (this.data.from === 'profile') {
      this.loadExistingData()
    }
  },

  loadExistingData() {
    wx.showLoading({ title: '加载中' })
    Promise.all([api.get('/api/user/profile'), api.get('/api/user/goal')])
      .then(([profile, goal]) => {
        const stage = goal && goal.goal_stage ? goal.goal_stage : 'fat_loss'
        const currentYear = new Date().getFullYear()
        const startYear = currentYear - 100
        const birthYear = profile.birth_year || this.data.form.birth_year
        this.setData({
          originalGoalStage: stage,
          'form.goal_stage': stage,
          'form.current_weight_kg': profile.current_weight_kg ? String(profile.current_weight_kg) : '',
          'form.height_cm': profile.height_cm ? String(profile.height_cm) : '',
          'form.gender': profile.gender || 'male',
          'form.birth_year': birthYear,
          birthYearIndex: Math.max(0, birthYear - startYear),
          genderLabel: GENDER_LABELS[profile.gender] || '男',
          'form.calorie_target': goal && goal.calorie_target ? String(goal.calorie_target) : '',
          'form.protein_target': goal && goal.protein_target ? String(goal.protein_target) : '',
          'form.target_weight_kg': goal && goal.target_weight_kg ? String(goal.target_weight_kg) : ''
        })
      })
      .catch(() => {})
      .finally(() => wx.hideLoading())
  },

  selectGoal(e) {
    this.setData({ 'form.goal_stage': e.currentTarget.dataset.value })
  },

  openGenderPicker() {
    wx.showActionSheet({
      itemList: ['男', '女'],
      success: (res) => {
        const gender = res.tapIndex === 0 ? 'male' : 'female'
        this.setData({
          'form.gender': gender,
          genderLabel: GENDER_LABELS[gender]
        })
      }
    })
  },

  onBirthYearChange(e) {
    const index = e.detail.value
    this.setData({
      birthYearIndex: index,
      'form.birth_year': Number(this.data.birthYears[index])
    })
  },

  openFieldEditor(e) {
    const key = e.currentTarget.dataset.field
    const meta = FIELD_META[key]
    if (!meta) return
    this.setData({
      showFieldModal: true,
      fieldModalKey: key,
      fieldModalTitle: meta.title,
      fieldModalPlaceholder: meta.placeholder,
      fieldModalType: meta.type,
      fieldModalValue: this.data.form[key] || ''
    })
  },

  closeFieldModal() {
    this.setData({ showFieldModal: false })
  },

  noop() {},

  onFieldModalInput(e) {
    this.setData({ fieldModalValue: e.detail.value })
  },

  saveFieldModal() {
    const key = this.data.fieldModalKey
    this.setData({
      [`form.${key}`]: this.data.fieldModalValue,
      showFieldModal: false
    })
  },

  validate() {
    const { form } = this.data
    if (!form.goal_stage) {
      wx.showToast({ title: '请选择阶段目标', icon: 'none' })
      return false
    }
    if (!form.current_weight_kg) {
      wx.showToast({ title: '请填写当前体重', icon: 'none' })
      return false
    }
    if (!form.target_weight_kg) {
      wx.showToast({ title: '请填写目标体重', icon: 'none' })
      return false
    }
    const cw = Number(form.current_weight_kg)
    const tw = Number(form.target_weight_kg)
    if (cw < 20 || cw > 300) {
      wx.showToast({ title: '当前体重需在 20-300 kg', icon: 'none' })
      return false
    }
    if (tw < 20 || tw > 300) {
      wx.showToast({ title: '目标体重需在 20-300 kg', icon: 'none' })
      return false
    }
    if (form.height_cm) {
      const h = Number(form.height_cm)
      if (h < 100 || h > 250) {
        wx.showToast({ title: '身高需在 100-250 cm', icon: 'none' })
        return false
      }
    }
    if (!form.calorie_target || !form.protein_target) {
      wx.showToast({ title: '请填写每日目标', icon: 'none' })
      return false
    }
    const cal = Number(form.calorie_target)
    const pro = Number(form.protein_target)
    if (cal < 800 || cal > 6000) {
      wx.showToast({ title: '热量目标需在 800-6000 kcal', icon: 'none' })
      return false
    }
    if (pro < 20 || pro > 400) {
      wx.showToast({ title: '蛋白质目标需在 20-400 g', icon: 'none' })
      return false
    }
    return true
  },

  doSubmit(syncWeight) {
    const { form } = this.data
    const profilePayload = {
      gender: form.gender,
      birth_year: form.birth_year,
      current_weight_kg: Number(form.current_weight_kg)
    }
    if (form.height_cm) profilePayload.height_cm = Number(form.height_cm)

    const goalPayload = {
      goal_stage: form.goal_stage,
      calorie_target: Number(form.calorie_target),
      protein_target: Number(form.protein_target),
      target_weight_kg: Number(form.target_weight_kg),
      sync_weight_record: syncWeight,
      current_weight_kg: Number(form.current_weight_kg)
    }

    wx.showLoading({ title: '保存中' })
    Promise.all([
      api.put('/api/user/profile', profilePayload),
      api.put('/api/user/goal', goalPayload)
    ])
      .then(() => {
        wx.hideLoading()
        wx.showToast({ title: '保存成功', icon: 'success' })
        if (this.data.from === 'profile') {
          wx.navigateBack()
        } else {
          wx.switchTab({ url: '/pages/home/home' })
        }
      })
      .catch(() => wx.hideLoading())
  },

  submit() {
    if (!this.validate()) return
    const { form, from, originalGoalStage } = this.data

    const runSave = (syncWeight) => {
      this.doSubmit(syncWeight)
    }

    if (from === 'profile' && originalGoalStage && form.goal_stage !== originalGoalStage) {
      wx.showModal({
        title: '切换阶段',
        content: '切换阶段后，首页和饮食目标将按新的目标展示，历史记录不会被修改。',
        success: (res) => {
          if (res.confirm) this.promptSyncWeight(runSave)
        }
      })
      return
    }

    if (from === 'profile') {
      this.promptSyncWeight(runSave)
      return
    }

    runSave(true)
  },

  promptSyncWeight(callback) {
    wx.showModal({
      title: '同步体重记录',
      content: '是否将当前体重同步保存为一条体重记录？',
      confirmText: '同步',
      cancelText: '不同步',
      success: (res) => {
        callback(!!res.confirm)
      }
    })
  }
})
