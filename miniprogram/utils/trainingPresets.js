const SPLIT_PROGRAM_KEY = 'split_program_v1'

const REST_3MIN = 180

function makeSets(count, weight, reps, restSeconds) {
  return Array.from({ length: count }, (_, i) => ({
    set_index: i + 1,
    target_weight: weight,
    target_reps: reps,
    target_rest_seconds: restSeconds
  }))
}

function makeNormalUnit(exerciseName, sets) {
  return {
    unit_type: 'normal',
    unit_name: exerciseName,
    sort_order: 0,
    config: {
      unit_type: 'normal',
      exercise_name: exerciseName,
      sets
    }
  }
}

const SPLIT_DAYS = [
  {
    key: 'chest',
    label: '练胸',
    template_name: '三分化 · 练胸',
    description: '胸大肌为主，4组×10次，组间休息3分钟',
    goal_type: 'muscle_gain',
    units: [
      makeNormalUnit('杠铃卧推', makeSets(4, 60, 10, REST_3MIN)),
      makeNormalUnit('上斜哑铃卧推', makeSets(4, 20, 12, REST_3MIN)),
      makeNormalUnit('哑铃飞鸟', makeSets(3, 12, 12, REST_3MIN)),
      makeNormalUnit('龙门架夹胸', makeSets(3, 15, 15, REST_3MIN)),
      makeNormalUnit('双杠臂屈伸', makeSets(3, 0, 12, REST_3MIN))
    ]
  },
  {
    key: 'back',
    label: '练背',
    template_name: '三分化 · 练背',
    description: '背阔肌为主，4组×10次，组间休息3分钟',
    goal_type: 'muscle_gain',
    units: [
      makeNormalUnit('引体向上', makeSets(4, 0, 10, REST_3MIN)),
      makeNormalUnit('杠铃划船', makeSets(4, 50, 10, REST_3MIN)),
      makeNormalUnit('高位下拉', makeSets(4, 45, 12, REST_3MIN)),
      makeNormalUnit('坐姿划船', makeSets(3, 40, 12, REST_3MIN)),
      makeNormalUnit('直臂下压', makeSets(3, 25, 15, REST_3MIN))
    ]
  },
  {
    key: 'shoulder',
    label: '练肩',
    template_name: '三分化 · 练肩',
    description: '三角肌为主，4组×10次，组间休息3分钟',
    goal_type: 'muscle_gain',
    units: [
      makeNormalUnit('杠铃推举', makeSets(4, 40, 10, REST_3MIN)),
      makeNormalUnit('哑铃侧平举', makeSets(4, 10, 12, REST_3MIN)),
      makeNormalUnit('哑铃前平举', makeSets(3, 8, 12, REST_3MIN)),
      makeNormalUnit('俯身飞鸟', makeSets(3, 8, 15, REST_3MIN)),
      makeNormalUnit('绳索面拉', makeSets(3, 15, 15, REST_3MIN))
    ]
  }
]

function getStoredProgram() {
  return wx.getStorageSync(SPLIT_PROGRAM_KEY) || null
}

function saveProgram(program) {
  wx.setStorageSync(SPLIT_PROGRAM_KEY, program)
}

function getTodayDayIndex(date) {
  const d = date || new Date()
  const start = new Date(d.getFullYear(), 0, 1)
  const dayOfYear = Math.floor((d - start) / 86400000)
  return dayOfYear % SPLIT_DAYS.length
}

function getTodayPlan(program) {
  if (!program || !program.templateIds || !program.templateIds.length) return null
  const dayIndex = getTodayDayIndex()
  const day = SPLIT_DAYS[dayIndex]
  return {
    dayIndex,
    day,
    templateId: program.templateIds[dayIndex],
    label: day.label,
    templateName: day.template_name
  }
}

function buildCreatePayload(day, sortOrder) {
  return {
    template_name: day.template_name,
    description: day.description,
    goal_type: day.goal_type,
    units: day.units.map((u, idx) => ({
      unit_type: u.unit_type,
      unit_name: u.unit_name,
      sort_order: sortOrder !== undefined ? sortOrder : idx,
      config: u.config
    }))
  }
}

function createSplitProgram(api) {
  const existing = getStoredProgram()
  if (existing && existing.templateIds && existing.templateIds.length === SPLIT_DAYS.length) {
    return Promise.resolve(existing)
  }

  return api.get('/api/training/templates')
    .then(list => {
      const byName = {}
      ;(list || []).forEach(t => { byName[t.template_name] = t.id })
      const program = { templateIds: [], labels: SPLIT_DAYS.map(d => d.label), createdAt: Date.now() }

      return SPLIT_DAYS.reduce((chain, day, idx) => {
        return chain.then(() => {
          const knownId = byName[day.template_name]
          if (knownId) {
            program.templateIds[idx] = knownId
            return Promise.resolve()
          }
          return api.post('/api/training/templates', buildCreatePayload(day, idx))
            .then(tpl => {
              program.templateIds[idx] = tpl.id
            })
        })
      }, Promise.resolve()).then(() => program)
    })
    .then(program => {
      saveProgram(program)
      return program
    })
}

module.exports = {
  SPLIT_DAYS,
  SPLIT_PROGRAM_KEY,
  getStoredProgram,
  saveProgram,
  getTodayPlan,
  getTodayDayIndex,
  createSplitProgram
}
