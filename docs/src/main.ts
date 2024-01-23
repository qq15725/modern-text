import { Text } from '../../src'

const text = new Text({
  style: {
    textAlign: 'left',
    verticalAlign: 'baseline',
    lineHeight: 0.71,
    fontWeight: 400,
    letterSpacing: 0,
    fontSize: 136.782,
    height: 201,
    width: 265,
    writingMode: 'horizontal-tb',
  },
  content: [
    {
      backgroundColor: 'blue',
      fragments: [
        { content: '冬', backgroundColor: 'red' },
        { content: '天', fontSize: 89, backgroundColor: 'yellow' },
      ],
    },
    {
      backgroundColor: 'green',
      fragments: [
        { content: ' ', backgroundColor: 'salmon' },
        { content: '你', fontSize: 71, backgroundColor: 'sienna' },
        { content: '好', fontSize: 100, backgroundColor: 'silver' },
      ],
    },
  ],
})

document.body.append(text.view)

console.log(text.measure(text.style.width))
