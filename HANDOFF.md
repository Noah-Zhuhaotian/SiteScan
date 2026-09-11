# SiteScan — Color Wheel Generator: Handoff Document

## Goal

Build and deploy a React web app + companion Mac desktop tool that lets users:
1. Input hex color values (with optional labels)
2. Analyse competitor websites to extract brand colours (Background / Text / Accent)
3. Export a combined JSON from multiple sites and import it into the web app
4. Visualize all colours as positioned dots on an HSL color wheel
5. Show a color list panel on the right (colour count + title + big rounded-square swatches + hex + label stacked)
6. Export the result as PNG or SVG at a custom resolution
7. Deploy via GitHub Actions to GitHub Pages

---

## Tech Stack

- **Framework:** React 18 + Vite 6 (no TypeScript)
- **Styling:** CSS Modules
- **Deployment:** GitHub Actions → GitHub Pages
- **Project root:** `c:\code\SiteScan`
- **Companion tool:** `c:\code\SiteScan\extractor\` — Python 3.11+ desktop app (CustomTkinter + Playwright)

---

## Current Progress

### Done

- [x] Full React app scaffolded with Vite (`npm run dev` / `npm run build`)
- [x] GitHub Actions workflow at `.github/workflows/deploy.yml` (build → upload `dist/` → deploy)
- [x] GitHub Actions workflow at `.github/workflows/build-mac-extractor.yml` — manual `workflow_dispatch` with a `version` input; builds on `macos-latest`, zips `.app`, creates a GitHub Release with the zip attached
- [x] GitHub Pages live — enabled via repo Settings → Pages → Source → GitHub Actions
- [x] Color wheel rendered on `<canvas>` using pixel-by-pixel HSL math (`putImageData`)
- [x] Color dots positioned by hue (angle) and saturation (distance from center)
- [x] Hover tooltip over dots showing hex + label
- [x] Color list panel on the right side of the exported image:
  - Colour count label above title ("N colours")
  - Bold title (default: "Selected colours")
  - Separator line with generous gap to first item
  - **New layout**: big rounded-square swatch (left) + hex code above / label below (right), stacked vertically
  - Swatch ~0.062× min(W,H), ITEM_RATIO = 1.6 for breathing room
  - **Fixed container layout**: `computeListGeometry` anchors the entire list (header + items) in a container with 8% top/bottom margins (84% usable height); title always has consistent top clearance regardless of colour count
  - Items flow **top-to-bottom** from just below the separator — no vertical centering
  - Wheel-to-list gap: `max(72, W * 0.062)` — wider breathing room
  - **Auto single→two-column layout** when colors overflow available height
  - **Dynamic scaling**: if two columns still overflow, swatch/font sizes shrink proportionally; if minimum size isn't enough, truncates with "+N more"
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
- [x] **Adaptive wheel radius**: `getWheelGeometry` shrinks `wheelR` when needed so the colour list always has ≥ 200 px on the right
- [x] **Wheel position**: `cx = max(wheelR + 15, W * 0.33)` — shifted left for better visual balance
- [x] **Wheel-to-list gap**: `max(48, W * 0.042)` — generous breathing room between wheel edge and list
- [x] **Sharp preview canvas**: preview renders at exact buffer resolution (`cssW * dpr × cssH * dpr`) using `buildCanvas` directly, then `drawImage` 1:1 — no scaling blur on any DPR screen
- [x] **showLabels default OFF**: dot labels hidden by default to avoid clutter when comparing many brands
- [x] **JSON import**: sidebar "Import JSON" section supports paste-in-textarea OR file upload (drag-drop supported); shows preview card with swatches before confirming add
- [x] **`addColors` bulk handler**: accepts both `string[]` (hex) and `{hex, label}[]` — always preserves labels from JSON import

### Python Companion Tool (`extractor/`)

- [x] `color_utils.py` — `hex_to_rgb`, `rgb_to_hsl`, `color_distance`, `deduplicate`, `lightness`
- [x] `extractor.py` — `extract_colors(url, n_bg, n_text, n_accent, on_status)` using Playwright `channel="chrome"` (system Chrome, no bundled browser)
  - Scrolls 4× to trigger lazy-loaded elements
  - JavaScript run in-browser: classifies elements by tag + CTA selector heuristics → `background`, `text`, `accent` frequency maps
  - Deduplicates similar colours (RGB distance threshold = 40)
- [x] `main.py` — CustomTkinter desktop UI:
  - Add multiple websites one at a time; each is analysed in a background thread
  - Sites list with mini swatches + remove button
  - Combined preview grouped by category (Background / Text / Accent), one column per site
  - **Per-category copy buttons**: `[ Background ] [ Text ] [ Accent ]` — copies category-filtered JSON to clipboard
  - Label format: `"label": CAT_LABELS[cat]` — category name only (e.g. `"Accent"`), not brand name
  - Window: 540×920, vertically resizable, minsize 540×600
  - ~~Save All JSON button~~ removed — copy-to-clipboard workflow is sufficient
- [x] `requirements.txt`: `customtkinter>=5.2.0`, `playwright>=1.44.0`, `Pillow>=10.0.0`, `pyinstaller>=6.0.0`
- [x] `build_mac.sh` — PyInstaller `.app` build script (no `playwright install` needed; uses system Chrome)
- [x] `README.md` — extractor-specific docs: download, usage, JSON format, run from source, build instructions

---

## Workflow: Competitive Colour Analysis

```
1. Run extractor/main.py on Mac
2. Add competitor URLs (Stripe, Apple, Figma…) — each analysed in ~10–20s
3. Click "Text" → copies Text-only JSON to clipboard
4. Paste into SiteScan "Import JSON" textarea → click "Add N colours"
5. Repeat for "Accent", "Background" as separate imports if desired
6. Colour wheel shows all brands' colours with label = category (e.g. "Accent")
7. Export PNG/SVG for presentation
```

**JSON format (between extractor and web app):**
```json
{
  "sites": ["Stripe", "Apple", "Figma"],
  "category": "Accent",
  "colors": [
    { "hex": "#635BFF", "label": "Accent" },
    { "hex": "#0071E3", "label": "Accent" },
    { "hex": "#9B51E0", "label": "Accent" }
  ]
}
```

---

## File Structure

```
c:\code\SiteScan\
├── index.html
├── vite.config.js                      # base: './'
├── package.json
├── .gitignore
├── HANDOFF.md
├── .github/workflows/deploy.yml
├── .github/workflows/build-mac-extractor.yml  # manual trigger → builds .app → GitHub Release
├── extractor/                          # Python companion tool
│   ├── main.py                         # CustomTkinter UI
│   ├── extractor.py                    # Playwright colour extraction
│   ├── color_utils.py                  # Colour math helpers
│   ├── requirements.txt
│   └── build_mac.sh                    # PyInstaller .app build
└── src/
    ├── main.jsx
    ├── App.jsx                         # Root — holds all state, MAX_COLORS = 50
    ├── App.module.css
    ├── index.css                       # Global styles, CSS variables, shared .btn classes
    ├── components/
    │   ├── ControlPanel.jsx/css        # Left sidebar container
    │   ├── ColorInput.jsx/css          # Color picker + hex input + add button
    │   ├── ColorList.jsx/css           # List of added colors with remove buttons
    │   ├── Settings.jsx/css            # Title, size dropdown, dot size, export checkboxes
    │   ├── JsonImport.jsx/css          # Paste JSON textarea + file upload; preview before adding
    │   ├── ImageColorPicker.jsx/css    # (exists but not mounted — kept for reference)
    │   └── PreviewCanvas.jsx/css       # Canvas preview + hover tooltip + click-to-copy + export
    └── utils/
        ├── color.js                    # hexToRgb, rgbToHsl, hslToRgb, isValidHex
        ├── extractColors.js            # Browser-side k-means (used by ImageColorPicker, unused in UI)
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
  title: 'Selected colours',
  canvasW: 1366,
  canvasH: 768,
  dotSize: 28,
  showLabels: false,   // OFF by default — avoids clutter when comparing brands
  showColorList: true,
}
// colors: [{ hex: '#FF6600', label: 'Accent' }, ...]
```

### `addColors` bulk handler (in `App.jsx`)

Accepts both plain hex strings and `{hex, label}` objects:

```js
const addColors = (items) => {
  setColors(prev => {
    const existing = new Set(prev.map(c => c.hex))
    const additions = items
      .map(item => typeof item === 'string'
        ? { hex: item.toUpperCase(), label: '' }
        : { hex: item.hex.toUpperCase(), label: item.label || '' })
      .filter(item => !existing.has(item.hex))
    return [...prev, ...additions].slice(0, MAX_COLORS)
  })
}
```

### Canvas size presets (`Settings.jsx`)

```js
const SIZE_PRESETS = [
  { label: '1366 × 768 — 16:9 (HD)',       w: 1366, h: 768 },
  { label: '1920 × 1080 — 16:9 (Full HD)', w: 1920, h: 1080 },
  { label: '2560 × 1440 — 16:9 (2K)',      w: 2560, h: 1440 },
]
```

### Wheel geometry (`renderer.js`)

```js
export const WHEEL_RATIO = 0.46
const MIN_LIST_W = 200

export function getWheelGeometry(W, H, showColorList = false) {
  let wheelR = Math.min(W, H) * WHEEL_RATIO
  if (showColorList) {
    const margin = Math.max(72, W * 0.062)   // wider gap wheel → list
    const maxA = W * 0.63 - margin - MIN_LIST_W
    const maxB = (W - MIN_LIST_W - 15 - margin) / 2
    wheelR = Math.max(50, Math.min(wheelR, maxA, maxB))
  }
  const cx = Math.max(wheelR + 15, W * 0.33)
  const cy = H * 0.5
  return { wheelR, cx, cy }
}
```

### Colour list layout (`computeListGeometry` in `renderer.js`)

Single source of truth used by canvas draw, SVG build, and click hit-testing:

```js
// Container: top = H * 0.08, height = H * 0.84
// Header inside container (tight spacing):
//   countY = containerTop + nominalFont * 1.5
//   titleY = countY + countSize + 12
//   sepY   = titleY + titleSize * 0.35 + 8
// Items start just below separator, flow top-to-bottom
// listY0 = itemsStart + itemH / 2
```

```js
// ITEM_RATIO = 1.6
// nominalSwatch = max(32, round(min(W,H) * 0.062))
// colWidth = swatchSize + round(swatchSize*0.38) + round(fontSize*7)
```

Each item renders as:
```
[swatchSize × swatchSize swatch]  #RRGGBB       ← fontSize, monospace, y = rowCy - labelFontSize*0.5
                                  label          ← labelFontSize (0.76×), y = rowCy + fontSize*0.72
```

Priority order:
1. Single column at nominal size
2. Two columns at nominal size
3. Two columns scaled down
4. Two columns at minimum (swatch 20px, font 10px) + "+N more"

### Click-to-copy (`PreviewCanvas.jsx` + `getColorListLayout`)

`getColorListLayout` returns bounding boxes in export coordinates. `PreviewCanvas` maps CSS clicks → export pixels using `canvas.clientWidth/Height`.

### Sharp preview rendering (`PreviewCanvas.jsx`)

```js
const dpr = window.devicePixelRatio || 1
// offscreen canvas rendered at cssW*dpr × cssH*dpr
// drawImage 1:1 — no interpolation
```

### The `putImageData` / white background problem (SOLVED)

```js
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
| `ctx.fillRect` white **before** `putImageData` | `putImageData` overwrites with transparent — black corners in PNG |
| Removing white background entirely | Windows Photos shows transparent as black |
| `dist = (sat/100) * (wheelR - dotSize)` | Highly-saturated colours look wrong; overflow is intentional |
| Overlap-resolution (push-apart) for dots | Pushes similar-hue colours into diagonal chain; reverted |
| Fixed `listY0 = H * 0.12` | List was top-anchored; replaced with container-based `computeListGeometry` |
| `computeListY0` centering from `H/2` | Title drifted near top edge with many colours; replaced with fixed container (8% margins) |
| Preview: scaling from export resolution | Blurs text; fixed by rendering at buffer resolution directly |
| `addColors(hexArray)` calling `.toUpperCase()` on objects | `JsonImport` passes `{hex,label}` objects — calling `.toUpperCase()` on object gives `"[object Object]"`, crashing renderer. Fixed by checking `typeof item` |
| `showLabels: true` default with many brands | Wheel becomes unreadable; changed default to `false` |
| `channel="chrome"` with bundled Chromium | Not needed — `channel="chrome"` uses system Chrome directly |
| Label = brand name in JSON export | User wanted label = category name ("Accent", "Text", "Background") |
| Inline hex + label on same row in list | Replaced with stacked layout: big swatch + hex above + label below |

---

## Potential Next Steps

- [ ] Allow reordering colors in the list (drag-and-drop)
- [ ] Import colors from a CSV or paste a list of hex codes
- [ ] Color picker shows HSL values alongside hex
- [ ] Multiple named presets / saved palettes (localStorage)
- [ ] Sign and notarise the Mac `.app` for distribution outside App Store (currently unsigned — users need to right-click → Open on first launch)
- [ ] Filter near-white / near-black colours in extractor (optional toggle)
- [ ] Show each brand's colours as a distinct visual group on the wheel (e.g. ring segments)
