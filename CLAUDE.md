# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm build       # Build library (vite build && unbuild) — produces dist/
pnpm dev         # Serve docs site via vite
pnpm test        # Run vitest tests
pnpm lint        # ESLint on src/
pnpm typecheck   # tsc --noEmit
pnpm release     # Bump version, tag, push (bumpp)
```

Run a single test file:
```bash
pnpm vitest run test/index.test.ts
```

## Architecture

`modern-text` is a TypeScript library for measuring and rendering text on Canvas in a way that mirrors the DOM layout model. It has no React/Vue dependency and exports ESM + CJS.

### Core data model (hierarchical)

```
Text                          ← root, owns all state
  └─ Paragraph[]              ← one per line/paragraph
       └─ Fragment[]          ← inline run with uniform style
            └─ Character[]    ← single Unicode code point
```

Each level inherits and merges style downward (`computedStyle`, `computedFill`, `computedOutline`).

### Key classes

| File | Role |
|------|------|
| `src/Text.ts` | Entry point. Orchestrates measure → plugin update → render pipeline. Emits `update`, `measure`, `render` events. |
| `src/Measurer.ts` | DOM-based layout engine. Creates a hidden `<section>/<ul>/<li>/<span>` tree, appends it to `document.body`, reads back `getBoundingClientRect()` for every character, then removes the DOM. Also provides `createDom()` for external use. |
| `src/Canvas2DRenderer.ts` | Wraps `CanvasRenderingContext2D`. Handles pixel-ratio scaling, gradient resolution, and drawing `Path2D` paths or fallback `fillText`. |
| `src/content/Character.ts` | Converts a Unicode character into a `Path2D` using `modern-font` SFNT tables (advance width, glyph paths, italic skew, bold offset). Falls back to `ctx.fillText` when no glyph path is available. |
| `src/definePlugin.ts` | Identity helper — just returns the plugin object typed as `Plugin`. |

### Plugin system

Plugins are the extension mechanism. `Text` ships six built-in plugins registered in `set()`:

- `backgroundPlugin` — draws paragraph/fragment background rects
- `outlinePlugin` — draws stroke paths around glyphs
- `listStylePlugin` — renders list markers
- `textDecorationPlugin` — underline / strikethrough / overline
- `highlightPlugin` — highlight boxes behind text
- `renderPlugin` — the primary glyph renderer; handles `effects` (translate/skew transforms)

Each plugin may implement:
- `update(text)` — called during `measure()`, sorted by `updateOrder`
- `render(renderer)` / `pathSet` — called during `render()`, sorted by `renderOrder`
- `getBoundingBox(text)` — contributes to `pathBox`
- `load(text)` — async, called by `text.load()`

### Lifecycle

1. `new Text(options)` → normalises options via `modern-idoc`, registers plugins, calls `_update()`
2. `text.measure(dom?)` → creates DOM tree, reads layout, updates character glyphs, runs plugin `update()`, returns `MeasureResult`
3. `text.render({ view })` → calls `measure()` if `needsUpdate`, runs plugin `render()` in order

### Dependencies

- `modern-idoc` — shared text/style schema (`normalizeText`, `FullStyle`, `Reactivable`)
- `modern-font` — SFNT/OpenType font parsing and glyph path extraction
- `modern-path2d` — `Path2D`, `BoundingBox`, `Vector2`, `Matrix3`, canvas drawing utilities
