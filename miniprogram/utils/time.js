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

// ISO8601 + 显式时区偏移（兼容 Python datetime.fromisoformat 与 MySQL 读取）
// 例如 "2026-07-05T18:30:00+08:00"，避免后端按 naive UTC 解析导致日期跨天
function formatDateTimeWithOffset(date) {
  const d = date instanceof Date ? date : new Date(date)
  const off = -d.getTimezoneOffset()
  const sign = off >= 0 ? '+' : '-'
  const pad = (n) => String(Math.abs(n)).padStart(2, '0')
  return `${formatDate(d)}T${formatTime(d)}:00${sign}${pad(off / 60 | 0)}:${pad(off % 60)}`
}

// 用 picker 拼出的"本地无时区"字符串（date T time:00）转 ISO 8601 + offset
// 入参示例：date="2026-07-05", time="18:30" => "2026-07-05T18:30:00+08:00"
function combineDateTimeWithOffset(date, time) {
  return formatDateTimeWithOffset(new Date(`${date}T${time}:00`))
}

module.exports = {
  formatDate,
  formatDateTime,
  formatTime,
  getWeekDay,
  getDefaultMealType,
  mealTypeName,
  formatDateTimeWithOffset,
  combineDateTimeWithOffset
}