# SiteScan — Color Wheel Generator: Handoff Document

## Goal

Build and deploy a React web app that lets users:
1. Input hex color values (with optional labels)
2. Visualize them as positioned dots on an HSL color wheel
3. Show a color list panel on the right (colour count + title + rounded-square swatches + hex codes)
4. Export the result as PNG or SVG at a custom resolution
5. Deploy via GitHub Actions to GitHub Pages

---

## Tech Stack

- **Framework:** React 18 + Vite 6 (no TypeScript)
- **Styling:** CSS Modules
- **Deployment:** GitHub Actions → GitHub Pages
- **Project root:** `c:\code\SiteScan`

---

## Current Progress

### Done

- [x] Full React app scaffolded with Vite (`npm run dev` / `npm run build`)
- [x] GitHub Actions workflow at `.github/workflows/deploy.yml` (build → upload `dist/` → deploy)
- [x] GitHub Pages live — enabled via repo Settings → Pages → Source → GitHub Actions
- [x] Color wheel rendered on `<canvas>` using pixel-by-pixel HSL math (`putImageData`)
- [x] Color dots positioned by hue (angle) and saturation (distance from center)
- [x] Hover tooltip over dots showing hex + label
- [x] Color list panel on the right side of the exported image:
  - Colour count label above title ("N colours")
  - Bold title (default: "Selected colours")
  - Separator line with generous gap to first item
  - Rounded-square swatches (not circles), 20% corner radius
  - Hex code in monospace + optional label inline to the right
  - **Vertically centred**: `computeListY0` anchors the item block at `H/2`, expanding up/down — not top-anchored
  - **Auto single→two-column layout** when colors overflow available height
  - **Dynamic scaling**: if two columns still overflow, swatch/font sizes shrink proportionally; if even minimum size isn't enough, truncates with "+N more"
  - **Click-to-copy**: clicking a color row copies the hex to clipboard, shows a brief "Copied!" toast
- [x] Settings panel:
  - Chart title input (default: "Selected colours")
  - **Canvas size dropdown** — 3 standard 16:9 presets only: HD (1366×768), Full HD (1920×1080), 2K (2560×1440)
  - Dot size slider
  - Export option checkboxes: "Show colour list" and "Show dot labels"
- [x] Export PNG (full resolution) and Export SVG (vector)
- [x] White background fix using `destination-over` compositing
- [x] `.gitignore` with `node_modules/`, `dist/`, `.env`, editor files
- [x] **50-color limit**: `addColor` blocks beyond 50; UI disables all inputs and shows warning when limit reached
- [x] **Duplicate color warning**: attempting to add an already-present hex shows inline warning
- [x] **Auto `#` completion**: hex input auto-prepends `#` on blur if missing (e.g. `FF6600` → `#FF6600`)
- [x] **Adaptive wheel radius**: `getWheelGeometry` shrinks `wheelR` when needed so the colour list always has ≥ 180 px on the right
- [x] **Wheel position**: `cx = max(wheelR + 15, W * 0.33)` — shifted left for better visual balance
- [x] **Wheel-to-list gap**: `max(48, W * 0.042)` — generous breathing room between wheel edge and list
- [x] **Sharp preview canvas**: preview renders at exact buffer resolution (`cssW * dpr × cssH * dpr`) using `buildCanvas` directly, then `drawImage` 1:1 — no scaling blur on any DPR screen

---

## File Structure

```
c:\code\SiteScan\
├── index.html                          # Vite entry point
├── vite.config.js                      # base: './'
├── package.json
├── .gitignore
├── .github/workflows/deploy.yml        # CI/CD to GitHub Pages
└── src/
    ├── main.jsx
    ├── App.jsx                         # Root — holds all state, MAX_COLORS = 50
    ├── App.module.css
    ├── index.css                       # Global styles, CSS variables, shared .btn classes
    ├── components/
    │   ├── ControlPanel.jsx/css        # Left sidebar container
    │   ├── ColorInput.jsx/css          # Color picker + hex input + add button
    │   │                               # Auto-prepends # on blur; duplicate warning
    │   ├── ColorList.jsx/css           # List of added colors with remove buttons
    │   ├── Settings.jsx/css            # Title, size dropdown, dot size, export checkboxes
    │   └── PreviewCanvas.jsx/css       # Canvas preview + hover tooltip + click-to-copy + export
    └── utils/
        ├── color.js                    # hexToRgb, rgbToHsl, hslToRgb, isValidHex
        └── renderer.js                 # buildCanvas(), buildSvg(), getWheelGeometry(),
                                        # getColorListLayout(), computeListLayout(),
                                        # computeListY0(), WHEEL_RATIO
```

---

## Key Architecture Notes

### State (in `App.jsx`)

```js
const MAX_COLORS = 50

const DEFAULT_SETTINGS = {
  title: 'Selected colours', // Chart title (shown on export)
  canvasW: 1366,             // Export width px
  canvasH: 768,              // Export height px (16:9 default)
  dotSize: 28,               // Dot radius px
  showLabels: true,          // Show dot labels on export
  showColorList: true,       // Show right-side colour list on export
}
// colors: [{ hex: '#FF6600', label: 'Primary' }, ...]
```

### Canvas size presets (`Settings.jsx`)

```js
const SIZE_PRESETS = [
  { label: '1366 × 768 — 16:9 (HD)',       w: 1366, h: 768 },
  { label: '1920 × 1080 — 16:9 (Full HD)', w: 1920, h: 1080 },
  { label: '2560 × 1440 — 16:9 (2K)',      w: 2560, h: 1440 },
]
```

Free-form width/height inputs and aspect-ratio buttons were removed. The dropdown is the only size control.

### Wheel geometry (`renderer.js`)

```js
export const WHEEL_RATIO = 0.46
const MIN_LIST_W = 180  // minimum px reserved for colour list

export function getWheelGeometry(W, H, showColorList = false) {
  let wheelR = Math.min(W, H) * WHEEL_RATIO
  if (showColorList) {
    const margin = Math.max(48, W * 0.042)  // gap between wheel edge and list
    const maxA = W * 0.63 - margin - MIN_LIST_W
    const maxB = (W - MIN_LIST_W - 15 - margin) / 2
    wheelR = Math.max(50, Math.min(wheelR, maxA, maxB))
  }
  const cx = Math.max(wheelR + 15, W * 0.33)  // shifted left vs original 0.37
  const cy = H * 0.5
  return { wheelR, cx, cy }
}
```

- Dot position: `dist = (sat / 100) * wheelR` — dots CAN overflow the wheel edge for high-saturation colours (intentional).
- Dots overlap at their true HSL positions; no push-apart algorithm (it created unnatural chains).

### Colour list vertical centering (`computeListY0` in `renderer.js`)

```js
function computeListY0(layout, H) {
  const { itemH, fontSize, cols, visibleColors } = layout
  const col1Count = cols === 2 ? Math.ceil(visibleColors.length / 2) : visibleColors.length
  const countSize = Math.round(fontSize * 0.88)
  const minY0 = itemH * 2.15 + countSize + 8   // keep header on-screen
  const centered = H / 2 - (col1Count - 1) * itemH / 2
  return Math.max(minY0, centered)
}
```

The item block is centred at `H/2`. The header (count label + title + separator) floats above `listY0`. Layout is computed with `availH = H * 0.80`.

### Colour list layout (`computeListLayout` in `renderer.js`)

Called internally by `buildCanvas`, `buildSvg`, and `getColorListLayout`. Returns:
```js
{ cols, swatchSize, fontSize, itemH, colWidth, visibleColors, overflow }
```

Priority order:
1. Single column at nominal size
2. Two columns at nominal size
3. Two columns scaled down (proportional shrink of swatch + font)
4. Two columns at minimum size (swatch 14 px, font 10 px) + `+N more` row

### Colour list header positions (in `drawColorList`)

Relative to `listY0` (centre of first item row):
- Count label baseline: `listY0 - itemH * 2.05`
- Title baseline: `listY0 - itemH * 1.45`
- Separator line: `listY0 - itemH * 0.82`

The gap between separator and top of first swatch is `≈ swatchSize * 0.69` (≈ 20 px at HD).

### Click-to-copy (`PreviewCanvas.jsx` + `getColorListLayout`)

`getColorListLayout(colors, W, H)` returns `{ items: [{ hex, label, x, y, w, h }] }` — bounding boxes in **export coordinates**. `PreviewCanvas` maps mouse clicks from CSS pixels → export pixels using `canvas.clientWidth/Height` (DPR-safe), then hit-tests against these boxes.

### Sharp preview rendering (`PreviewCanvas.jsx`)

```js
const dpr = window.devicePixelRatio || 1
const scale = Math.min(1, maxW / canvasW, maxH / canvasH)
const cssW = Math.round(canvasW * scale)
const cssH = Math.round(canvasH * scale)
const bufW = cssW * dpr
const bufH = cssH * dpr

const scaledDotSize = Math.max(1, Math.round(dotSize * bufW / canvasW))
const offscreen = buildCanvas(colors, title, bufW, bufH, scaledDotSize, ...)

canvas.width = bufW
canvas.height = bufH
canvas.style.width = cssW + 'px'
canvas.style.height = cssH + 'px'
ctx.drawImage(offscreen, 0, 0)  // 1:1, no scaling
```

The offscreen canvas is rendered at the exact preview buffer size, so `drawImage` is a 1:1 copy — no interpolation, no blur. Export always uses the original `canvasW × canvasH`.

Coordinate mapping uses `canvas.clientWidth/Height` (CSS pixels) not `canvas.width` (device pixels) to stay DPR-correct.

### The `putImageData` / white background problem (SOLVED)

`putImageData` bypasses compositing and writes transparent pixels in the bounding square's corners. Fix:

```js
// After drawing wheel + color list + dots:
ctx.globalCompositeOperation = 'destination-over'
ctx.fillStyle = '#ffffff'
ctx.fillRect(0, 0, W, H)
ctx.globalCompositeOperation = 'source-over'
```

**Do not pre-fill with `fillRect` before `putImageData`.**

---

## What Didn't Work (don't repeat)

| Approach | Problem |
|----------|---------|
| `ctx.fillRect` white **before** `putImageData` | `putImageData` overwrites with transparent — produces black square corners in the exported PNG |
| Removing white background entirely (transparent PNG) | Windows Photos shows transparent areas as black; confusing to users |
| Keeping dots inside wheel with `dist = (sat/100) * (wheelR - dotSize)` | Makes highly-saturated colours look wrong (too far from edge); user prefers overflow |
| Chrome extension approach | Switched to web app early — don't revisit |
| `type="number"` for canvas size inputs | Browser spinner arrows bypass `onBlur`; switched to dropdown presets instead |
| Overlap-resolution (iterative push-apart) for dots | Pushes similar-hue colours into an unnatural diagonal chain; reverted to true HSL positions |
| Fixed `listY0 = H * 0.12` for colour list | List was always top-anchored; replaced with `computeListY0` for vertical centering |
| `getWheelGeometry` without `showColorList` param | Square/tall canvases had colour list truncated; now constrained |
| Preview: `drawImage(offscreen[exportRes], 0, 0, cssW*dpr, cssH*dpr)` | Scaling from export resolution to display resolution blurs text on all screens; fixed by rendering at buffer resolution directly |
| Preview: applying DPR to canvas size but still scaling from export res | Still blurry — DPR alone doesn't help if the source is a different resolution |

---

## Potential Next Steps

- [ ] Allow reordering colors in the list (drag-and-drop)
- [ ] Import colors from a CSV or paste a list of hex codes
- [ ] Color picker shows HSL values alongside hex
- [ ] Multiple named presets / saved palettes (localStorage)
- [ ] Optional: show competitor name as a second label line in the colour list
- [ ] Optional: add a legend/key line connecting each colour list item to its dot on the wheel
