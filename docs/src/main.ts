import { Text } from '../../src'

const text = new Text({
  style: {
    width: 100,
    height: 200,
    fontSize: 22,
    backgroundColor: '#0000FF',
    textDecoration: 'underline',
  },
  data: [
    {
      fragments: [
        { data: 'He', style: { color: 'red', fontSize: 12 } },
        { data: 'llo', style: { color: 'black' } },
      ],
    },
    { data: ', ', style: { color: 'grey' } },
    { data: 'World!', style: { color: 'black' } },
  ],
})

document.body.append(text.view)

console.log(text.measure())
