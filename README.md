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

`modern-text` measures and renders rich text on Canvas with a layout model that
mirrors the browser's. It has no React/Vue dependency, ships ESM + CJS, and can
run **either in the browser (using the DOM as ground truth) or fully DOM-free in
Node / SSR / Web Workers**.

## Features

- 📐 **DOM-accurate layout** — paragraphs, line wrapping, baselines, alignment.
- 🧩 **Two interchangeable layout backends**
  - `DomMeasurer` — measures via a hidden DOM tree + `getBoundingClientRect()`.
  - `FontMeasurer` — pure-JS, computes layout from font glyph metrics; runs with
    no `document`, so it works in **Node / SSR / Workers** and is deterministic.
- ↔️ **Horizontal & vertical** writing modes (`horizontal-tb`, `vertical-rl`).
- 🅰️ **Rich inline styling** — per-fragment font size/family/weight/style, color,
  letter-spacing, line-height, text-indent, text-align, vertical-align,
  text-decoration (underline / line-through / overline), text-transform,
  text-stroke, padding / margin.
- 🎨 **Fills & strokes** — solid colors and linear gradients per fragment.
- 🖍️ **Highlights** — draw an image/SVG behind selected fragments.
- 🔵 **List markers** — `disc` / `none` / custom image bullets.
- 🌑 **Effects** — stacked translate / skew / color layers (shadows, offsets).
- 🌀 **Text deformation** — 34 opt-in presets (arch, bend, wave, trapezoid,
  ellipse, heart, …).
- ✏️ **`<text-editor>` web component** — cursor, selection and keyboard editing.

## Install

```bash
npm i modern-text modern-font
```

`modern-font` provides the font parsing/loading used for measuring and drawing
glyphs.

## Quick start

```ts
import { fonts } from 'modern-font'
import { renderText } from 'modern-text'

await fonts.loadFallbackFont('/fallback.woff')

const view = document.createElement('canvas')
document.body.append(view)

renderText({
  view,
  fonts,
  style: { width: 300, fontSize: 22, textDecoration: 'underline' },
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
```

## Layout backends

By default `modern-text` uses the pure-JS **`'font'`** backend (`FontMeasurer`),
which resolves fonts from the `fonts` you pass or from `modern-font`'s global
registry. Pass `'dom'` to use the browser as ground truth, or a custom
`TextMeasurer`:

```ts
new Text({ fonts, measurer: 'font' }) // pure-JS, DOM-free (default)
new Text({ fonts, measurer: 'dom' }) //  browser ground truth
new Text({ measurer: myCustomMeasurer }) // any object implementing TextMeasurer
```

### Node / SSR / Workers

`FontMeasurer` needs no `document`, so the whole measure → render pipeline runs
outside the browser. Register fonts from a buffer with `modern-font`:

```ts
import { readFileSync } from 'node:fs'
import { Fonts, parseFont } from 'modern-font'
import { Text } from 'modern-text'

const buffer = readFileSync('./fonts/NotoSansSC.woff').buffer
const font = parseFont(buffer)
const sfnt = font.createSFNT() // .woff → SFNT
const fonts = new Fonts()
const entry = { src: '', familySet: new Set(['Noto']), buffer, getFont: () => font, getSFNT: () => sfnt } as any
fonts.set('Noto', entry)
fonts.setFallbackFont(entry)

const text = new Text({ fonts, content: '你好世界', style: { fontFamily: 'Noto', fontSize: 32 } })
const result = text.measure() // → boxes for every paragraph / fragment / character
```

## Content model

Content is a hierarchy: **Text → Paragraph → Fragment → Character**. Each level
inherits and merges style downward. `content` accepts several shapes that are
normalized by [`modern-idoc`](https://github.com/qq15725/modern-idoc):

```ts
// a plain string (single paragraph)
content: 'Hello World'

// an array of paragraphs, each a string or { content, ...paragraphStyle }
content: [
  { content: 'Title', fontSize: 40, textAlign: 'center' },
  { content: 'Body text', color: '#333' },
]

// per-fragment styling inside a paragraph
content: [
  {
    textAlign: 'center',
    fragments: [
      { content: 'red ', color: 'red' },
      { content: 'bold', fontWeight: 'bold' },
    ],
  },
]
```

A newline (`\n`) splits into a new paragraph.

## Styling

Style can be set at the text (root), paragraph, or fragment level.

```ts
style: {
  // box
  width: 400, height: 200, padding: 16,
  // font
  fontSize: 24, fontFamily: 'Arial', fontWeight: 700, fontStyle: 'italic',
  // text
  color: '#222', lineHeight: 1.4, letterSpacing: 1, textIndent: 24,
  textAlign: 'center',          // start | left | center | end | right
  verticalAlign: 'middle',      // top | middle | bottom
  writingMode: 'vertical-rl',   // horizontal-tb | vertical-rl
  textDecoration: 'underline',  // underline | line-through | overline | none
  textTransform: 'uppercase',   // uppercase | lowercase
  textStrokeWidth: 2, textStrokeColor: '#000', // outline stroke
}
```

### Gradient fills

```ts
content: [{
  fragments: [{
    content: 'Gradient',
    fill: {
      linearGradient: {
        angle: 180,
        stops: [
          { color: '#c7f1ff', offset: 0 },
          { color: '#ffffff', offset: 1 },
        ],
      },
    },
  }],
}]
```

### Highlights & list markers

```ts
content: [
  // image drawn behind the fragment
  { fragments: [{ content: 'highlighted', highlightImage: '/brush.svg' }] },
  // list bullet
  { content: 'a bullet item', listStyleType: 'disc' },
  { content: 'a custom bullet', listStyleImage: '/dot.svg' },
]
```

## Effects

`effects` is an ordered stack of transform/color layers drawn behind the main
glyphs — useful for shadows, 3D offsets and outlines. `translateX/Y` are
fractions of the font size; `skewX/Y` are degrees.

```ts
renderText({
  view,
  fonts,
  content: 'Effect',
  style: { fontSize: 80, color: '#FEE90C' },
  effects: [
    { translateX: 0.05, translateY: 0.05, skewY: -5, color: '#000' }, // shadow
    { skewY: -5, color: '#FEE90C' }, // face
  ],
})
```

## Text deformation

Deformation presets are an opt-in subpath. Register them once, then set
`deformation.type`:

```ts
import { registerDeformations } from 'modern-text/deformations'
import { renderText } from 'modern-text'

registerDeformations()

renderText({
  view,
  fonts,
  content: 'Deformation',
  style: { fontSize: 100 },
  deformation: { type: 'arch-curve' },
})
```

<details>
<summary>Available presets (34)</summary>

`bend` · `bend-vertical` · `arch-curve` · `concave-curve` · `upper-arch-curve` ·
`lower-arch-curve` · `bulb-curve` · `skew` · `flag-curve` · `trapezoid` ·
`lower-trapezoid` · `top-trapezoid` · `horizontal-trapezoid` · `bevel` ·
`upper-roof` · `lower-roof` · `angled-projection` · `folded-corner` ·
`lateral-stretching` · `vertical-stretching` · `patchwork-by-word` ·
`step-by-word` · `arch2-by-word` · `wave-by-word` · `step-far-and-near-by-word` ·
`arch-far-and-near-by-word` · `horizontal-rotate-by-word` ·
`arbitrary-offset-rotate-by-word` · `horizontal-curved-rotate-by-word` ·
`ellipse-by-word` · `triangle-by-word` · `pentagon-by-word` ·
`rectangular-by-word` · `heart-by-word`

Register your own with `defineDeformation(name, preset)`.
</details>

## `Text` API

For finer control, drive a `Text` instance directly:

```ts
import { Text } from 'modern-text'

const text = new Text({ fonts, content: 'Hello', style: { fontSize: 24 } })

text.on('update', () => text.render({ view })) // re-render on any change
await text.load() // load async resources (fonts, plugin assets)
text.update() // measure + commit + emit 'update'
text.render({ view, pixelRatio: 2 })

text.boundingBox // overall box after measuring
text.characters // flat list of measured Character (inlineBox / lineBox / path)

text.dispose() // release the cached measurer / renderer
```

- `measure()` returns a non-destructive snapshot of all boxes.
- `update()` measures and commits the result onto the instance.
- `render({ view })` updates if needed, then draws.
- Events: `update`, `measure`, `render`.

### One-shot helpers

```ts
import { measureText, renderText } from 'modern-text'

const result = measureText(options) // sync
const result = await measureText(options, true) // load fonts first

renderText({ view, ...options }) // sync
await renderText({ view, ...options }, true) // load fonts first
```

## `<text-editor>` web component

```ts
import { TextEditor } from 'modern-text/web-components'

TextEditor.register()
```

```html
<text-editor></text-editor>
```

```ts
const editor = document.querySelector('text-editor')
editor.moveToDom(canvas) // overlay the editor on a rendered canvas
editor.set(text) // bind a Text instance — provides cursor, selection, typing
```

## License

[MIT](./LICENSE)
