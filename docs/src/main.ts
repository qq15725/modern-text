import { Text } from '../../src'

const text = new Text({
  style: {
    width: 100,
    height: 200,
    fontSize: 22,
    backgroundColor: '#0000FF',
    textDecoration: 'underline',
  },
  content: [
    {
      fragments: [
        { content: 'He', style: { color: 'red', fontSize: 12 } },
        { content: 'llo', style: { color: 'black' } },
      ],
    },
    { content: ', ', style: { color: 'grey' } },
    { content: 'World!', style: { color: 'black' } },
  ],
})

document.body.append(text.view)

console.log(text.measure())
