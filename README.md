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
import { fonts } from 'modern-font'
import { renderText } from 'modern-text'

fonts.loadFallbackFont('/fallback.woff').then(() => {
  const view = document.createElement('canvas')
  document.body.append(view)

  renderText({
    view,
    style: {
      width: 100,
      height: 200,
      fontSize: 22,
      textDecoration: 'underline',
    },
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
  })
})
```
