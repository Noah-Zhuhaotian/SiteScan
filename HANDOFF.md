# SiteScan — Color Wheel Generator: Handoff Document

## Goal

Build and deploy a React web app that lets users:
1. Input hex color values (with optional labels)
2. Visualize them as positioned dots on an HSL color wheel
3. Show a color list panel on the right (title + rounded-square swatches + hex codes)
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
- [x] Color wheel rendered on `<canvas>` using pixel-by-pixel HSL math (`putImageData`)
- [x] Color dots positioned by hue (angle) and saturation (distance from center)
- [x] Hover tooltip over dots showing hex + label
- [x] Color list panel on the right side of the exported image:
  - Rounded-square swatches (not circles), 20% corner radius
  - Hex code in monospace + optional label inline to the right
  - Title ("Competition Colours") with separator line
  - **Auto single→two-column layout** when colors overflow available height
  - **Dynamic scaling**: if two columns still overflow, swatch/font sizes shrink proportionally to fit; if even minimum size isn't enough, truncates with "+N more"
  - **Click-to-copy**: clicking a color row in the preview copies the hex to clipboard, shows a brief "Copied!" toast
- [x] Settings: canvas width/height, dot size slider, chart title input
- [x] **Aspect ratio presets**: 16:9 / 4:3 / 3:2 / 1:1 buttons auto-compute height from current width; active preset highlighted
- [x] **Canvas size inputs**: `type="text" inputMode="numeric"`, filters non-digits on change, clamps to 400–3000 px only on blur/Enter (no mid-typing jumps)
- [x] Default canvas: 1366×768 (16:9)
- [x] Export options checkboxes: "Show colour list" and "Show dot labels"
- [x] Export PNG (full resolution) and Export SVG (vector)
- [x] White background fix using `destination-over` compositing
- [x] `.gitignore` with `node_modules/`, `dist/`, `.env`, editor files
- [x] **50-color limit**: `addColor` blocks beyond 50; UI disables all inputs and shows English warning when limit reached
- [x] **Duplicate color warning**: attempting to add an already-present hex shows "This colour is already in the list." inline
- [x] **Color list title moved to top** (`listY0 = H * 0.12`), separator gap fixed so it doesn't overlap the first row
- [x] **Adaptive wheel radius**: `getWheelGeometry(W, H, showColorList)` shrinks `wheelR` when needed so the colour list always has ≥ 180 px on the right — fixes truncation at 1:1 and tall aspect ratios

### GitHub Pages setup (user still needs to do)

1. Go to repo Settings → Pages → Source → **GitHub Actions**
2. Push to `main` branch to trigger the first deploy

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
    │   │                               # Validates duplicate hex; shows English warnings
    │   ├── ColorList.jsx/css           # List of added colors with remove buttons
    │   ├── Settings.jsx/css            # Title, size presets, dot size, export checkboxes
    │   └── PreviewCanvas.jsx/css       # Canvas preview + hover tooltip + click-to-copy + export
    └── utils/
        ├── color.js                    # hexToRgb, rgbToHsl, hslToRgb, isValidHex
        └── renderer.js                 # buildCanvas(), buildSvg(), getWheelGeometry(),
                                        # getColorListLayout(), computeListLayout(), WHEEL_RATIO
```

---

## Key Architecture Notes

### State (in `App.jsx`)

```js
const MAX_COLORS = 50

const DEFAULT_SETTINGS = {
  title: '',        // Chart title (shown on export)
  canvasW: 1366,    // Export width px
  canvasH: 768,     // Export height px (16:9 default)
  dotSize: 28,      // Dot radius px
  showLabels: true, // Show dot labels on export
  showColorList: true, // Show right-side colour list on export
}
// colors: [{ hex: '#FF6600', label: 'Primary' }, ...]
```

### Wheel geometry (`renderer.js`)

```js
export const WHEEL_RATIO = 0.46
const MIN_LIST_W = 180  // minimum px reserved for colour list

export function getWheelGeometry(W, H, showColorList = false) {
  let wheelR = Math.min(W, H) * WHEEL_RATIO
  if (showColorList) {
    const margin = Math.max(25, W * 0.025)
    const maxA = W * 0.63 - margin - MIN_LIST_W   // cx driven by W*0.37
    const maxB = (W - MIN_LIST_W - 15 - margin) / 2 // cx driven by wheelR
    wheelR = Math.max(50, Math.min(wheelR, maxA, maxB))
  }
  const cx = Math.max(wheelR + 15, W * 0.37)
  const cy = H * 0.5
  return { wheelR, cx, cy }
}
```

- Always pass `showColorList` when the list is visible so the wheel doesn't crowd it out.
- Dot position: `dist = (sat / 100) * wheelR` — dots CAN overflow the wheel edge for high-saturation colours (intentional).
- Dots overlap at their true HSL positions; no push-apart algorithm (it created unnatural chains).

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

### Click-to-copy (`PreviewCanvas.jsx` + `getColorListLayout`)

`getColorListLayout(colors, W, H)` returns `{ items: [{ hex, label, x, y, w, h }] }` — bounding boxes in **export coordinates**. `PreviewCanvas` maps mouse clicks from display pixels → export pixels and hits-tests against these boxes. Cursor switches to `pointer` on hover.

### Canvas size inputs (`Settings.jsx`)

```js
const MIN_DIM = 400
const MAX_DIM = 3000

// Aspect ratio presets
const ASPECT_PRESETS = [
  { label: '16:9', ratio: 9/16 },
  { label: '4:3',  ratio: 3/4 },
  { label: '3:2',  ratio: 2/3 },
  { label: '1:1',  ratio: 1 },
]
```

- Inputs are `type="text" inputMode="numeric"` — no browser spinner arrows, no mid-type clamping.
- `onChange` strips non-digits; `onBlur`/Enter clamps to 400–3000 and commits to state.
- Preset buttons apply ratio to current width → compute height → commit both immediately.
- Active preset detected by `|h/w − ratio| < 0.01`; button highlights when matched.

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

### Hover detection (`PreviewCanvas.jsx`)

Uses `e.nativeEvent.offsetX/Y`, scales to export coordinates, then checks
`Math.hypot(ex − dotX, ey − dotY) <= dotSize * 1.6`. Must use the same
`getWheelGeometry(canvasW, canvasH, showColorList)` and `dist = (sat/100) * wheelR` as the renderer.

---

## What Didn't Work (don't repeat)

| Approach | Problem |
|----------|---------|
| `ctx.fillRect` white **before** `putImageData` | `putImageData` overwrites with transparent — produces black square corners in the exported PNG |
| Removing white background entirely (transparent PNG) | Windows Photos shows transparent areas as black; confusing to users |
| Keeping dots inside wheel with `dist = (sat/100) * (wheelR - dotSize)` | Makes highly-saturated colours look wrong (too far from edge); user prefers overflow |
| Chrome extension approach | Switched to web app early — don't revisit |
| `type="number"` for canvas size inputs | Browser spinner arrows bypass `onBlur` and apply values immediately; switched to `type="text"` |
| Overlap-resolution (iterative push-apart) for dots | Pushes similar-hue colours into an unnatural diagonal chain; reverted to true HSL positions |
| Fixed `listY0 = H * 0.3` for colour list | Title got pushed off-screen when there were many colours; moved to `H * 0.12` |
| `getWheelGeometry` without `showColorList` param | Square/tall canvases had colour list truncated because wheelR was too large; now constrained |

---

## Potential Next Steps

- [ ] Allow reordering colors in the list (drag-and-drop)
- [ ] Import colors from a CSV or paste a list of hex codes
- [ ] Color picker shows HSL values alongside hex
- [ ] Multiple named presets / saved palettes (localStorage)
- [ ] Optional: show competitor name as a second label line in the colour list
- [ ] Optional: add a legend/key line connecting each colour list item to its dot on the wheel
- [ ] Make layout responsive for narrower canvas sizes (colour list wraps below wheel when no right-side space)
- [ ] Add colour count badge to the Export section showing how many colours are included
