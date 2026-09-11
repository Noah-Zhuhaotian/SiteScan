# SiteScan — Color Wheel Generator

A React web app for visualizing brand or competition colors on an HSL color wheel and exporting the result as PNG or SVG.

## Features

- **Color wheel** — pixel-by-pixel HSL rendering; dots positioned by hue (angle) and saturation (distance from center)
- **Color list panel** — right-side panel in a fixed container (8% top/bottom margins); shows colour count, title, swatches, and hex codes; auto single/two-column layout with dynamic scaling; items flow top-to-bottom
- **Click-to-copy** — click any row in the preview to copy the hex code
- **Hover tooltips** — mouse over any dot to see its hex + label
- **Export** — PNG at full resolution or SVG vector
- **Canvas size** — choose from three 16:9 presets: HD (1366×768), Full HD (1920×1080), 2K (2560×1440)
- **Sharp preview** — preview renders at exact device-pixel resolution, no blur on HiDPI / Retina screens
- **50-color limit** with duplicate detection and inline warnings
- **Auto `#` completion** — type `FF6600`, it becomes `#FF6600` on blur

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Build & Deploy

```bash
npm run build   # outputs to dist/
```

Pushing to `main` triggers the GitHub Actions workflow (`.github/workflows/deploy.yml`) which builds and deploys to GitHub Pages automatically.

**First-time Pages setup:** go to repo Settings → Pages → Source → **GitHub Actions**.

## Tech Stack

- React 18 + Vite 6
- CSS Modules
- GitHub Actions → GitHub Pages
