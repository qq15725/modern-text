import { Text } from '../../src'

const text = new Text({
  style: {
    width: 100,
    height: 200,
    fontSize: 22,
    textDecoration: 'underline',
  },
  data: [
    {
      letterSpacing: 3,
      fragments: [
        { data: 'He', color: 'red', fontSize: 12 },
        { data: 'llo', color: 'black' },
      ],
    },
    { data: ', ', color: 'grey' },
    { data: 'World!', color: 'black' },
  ],
})

document.body.append(text.view)

console.log(text.measure())
