<h1 align="center">modern-text</h1>

<p align="center">
  <a href="https://unpkg.com/modern-text">
    <img src="https://img.shields.io/bundlephobia/minzip/modern-text" alt="Minzip">
  </a>
  <a href="https://www.npmjs.com/package/modern-text">
    <img src="https://img.shields.io/npm/v/modern-text.svg" alt="Version">
  </a>
  <a href="https://www.npmjs.com/package/modern-text">
    <img src="https://img.shields.io/npm/dm/modern-text" alt="Downloads">
  </a>
  <a href="https://github.com/qq15725/modern-text/issues">
    <img src="https://img.shields.io/github/issues/qq15725/modern-text" alt="Issues">
  </a>
  <a href="https://github.com/qq15725/modern-text/blob/main/LICENSE">
    <img src="https://img.shields.io/npm/l/modern-text.svg" alt="License">
  </a>
</p>

## Usage

```ts
import { measureText, renderText } from 'modern-text'

const text = {
  style: {
    width: 100,
    height: 200,
    fontSize: 22,
    textDecoration: 'underline',
  },
  // content: 'paragraph'
  // content: [
  //   'paragraph1',
  //   ['paragraph1', 'paragraph2'],
  //   { content: 'paragraph2', fontSize: 20 },
  //   [
  //     { content: 'fragment1', fontSize: 12 },
  //     { content: 'fragment2', fontSize: 30 },
  //   ],
  //   {
  //     backgroundColor: 'blue',
  //     fragments: [
  //       { content: 'fragment3', color: 'red', fontSize: 12 },
  //       { content: 'fragment4', color: 'black' },
  //     ],
  //   },
  // ]
  content: [
    {
      letterSpacing: 3,
      fragments: [
        { content: 'He', color: 'red', fontSize: 12 },
        { content: 'llo', color: 'black' },
      ],
    },
    { content: ', ', color: 'grey' },
    { content: 'World!', color: 'black' },
  ],
}

document.body.append(renderText(text)) // canvas 2d

console.log(measureText(text)) // boundingBox with computed paragraphs
```
