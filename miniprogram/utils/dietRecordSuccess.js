const { getDefaultMealType } = require('./time')

function showRecordSuccess(mealType) {
  const meal = mealType || getDefaultMealType()
  wx.showModal({
    title: '记录成功',
    content: '是否继续记录下一餐？',
    confirmText: '继续记录',
    cancelText: '回首页',
    success: (res) => {
      if (res.confirm) {
        wx.redirectTo({ url: `/pages/diet-record/diet-record?mealType=${meal}` })
      } else {
        wx.switchTab({ url: '/pages/home/home' })
      }
    }
  })
}

module.exports = { showRecordSuccess }
