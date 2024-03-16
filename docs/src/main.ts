import { Text } from '../../src'

const text = new Text({
  style: {
    fontSize: 44,
    width: 1003,
    color: 'linear-gradient(0deg, rgb(235, 229, 229) 0%, rgba(235, 229, 229, 0) 90.7609%)',
  },
  content: '廉以养德、静以修身：廉洁自律诗词金句大集萃！ 多植荷花塘自清，勤反腐败政自明。 水不流则腐，官不廉则败。 修身养性心如玉，纵欲贪色形成魔。 勤以为民，廉以养德，淡以明志，静以修身。 身有正气，不',
})

document.body.append(text.view)

console.log(text.measure(text.style.width))
