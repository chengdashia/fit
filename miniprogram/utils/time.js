function formatDate(date) {
  const d = date instanceof Date ? date : new Date(date)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatDateTime(date) {
  const d = date instanceof Date ? date : new Date(date)
  return `${formatDate(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:00`
}

function formatTime(date) {
  const d = date instanceof Date ? date : new Date(date)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function getWeekDay(date) {
  const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  const d = date instanceof Date ? date : new Date(date)
  return days[d.getDay()]
}

function getDefaultMealType() {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 10.5) return 'breakfast'
  if (hour < 14.5) return 'lunch'
  if (hour < 20.5) return 'dinner'
  return 'snack'
}

function mealTypeName(type) {
  const map = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐', snack: '加餐' }
  return map[type] || type
}

module.exports = {
  formatDate,
  formatDateTime,
  formatTime,
  getWeekDay,
  getDefaultMealType,
  mealTypeName
}
