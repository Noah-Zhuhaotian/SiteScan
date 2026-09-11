import { hexToRgb, rgbToHsl, hslToRgb } from './color'

export const WHEEL_RATIO = 0.46
const MIN_LIST_W = 200

// Color list container: 8% gap top and bottom → 84% usable height
const CONTAINER_TOP_FRAC = 0.08
const CONTAINER_H_FRAC   = 0.84

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

function computeDotPositions(colors, cx, cy, wheelR) {
  return colors.map(c => {
    const { r, g, b } = hexToRgb(c.hex)
    const { h, s } = rgbToHsl(r, g, b)
    const angleRad = (h * Math.PI) / 180
    const dist = (Math.min(s, 100) / 100) * wheelR
    return { ...c, x: cx + dist * Math.cos(angleRad), y: cy + dist * Math.sin(angleRad) }
  })
}

// ── Layout computation ──────────────────────────────────────────────────────

function computeListLayout(colors, nominalSwatchSize, nominalFontSize, availableH) {
  const MIN_SWATCH = 20
  const MIN_FONT   = 10
  const ITEM_RATIO = 1.6

  const nominalItemH = nominalSwatchSize * ITEM_RATIO
  const maxPerCol = Math.max(1, Math.floor(availableH / nominalItemH))

  const makeColW = (sw, fs) => sw + Math.round(sw * 0.38) + Math.round(fs * 7)

  const makeLayout = (sw, fs, cols, visible, overflow) => ({
    cols,
    swatchSize: sw,
    fontSize: fs,
    itemH: sw * ITEM_RATIO,
    colWidth: makeColW(sw, fs),
    visibleColors: visible,
    overflow,
  })

  if (colors.length <= maxPerCol)
    return makeLayout(nominalSwatchSize, nominalFontSize, 1, colors, 0)

  if (Math.ceil(colors.length / 2) <= maxPerCol)
    return makeLayout(nominalSwatchSize, nominalFontSize, 2, colors, 0)

  const itemsPerCol2 = Math.ceil(colors.length / 2)
  const scale        = (availableH / itemsPerCol2) / nominalItemH
  const scaledSwatch = Math.max(MIN_SWATCH, Math.floor(nominalSwatchSize * scale))
  const scaledFont   = Math.max(MIN_FONT,   Math.floor(nominalFontSize   * scale))
  const scaledItemH  = scaledSwatch * ITEM_RATIO
  const maxAtScaled  = Math.floor(availableH / scaledItemH) * 2

  if (colors.length <= maxAtScaled)
    return makeLayout(scaledSwatch, scaledFont, 2, colors, 0)

  const minItemH   = MIN_SWATCH * ITEM_RATIO
  const maxAtMin   = Math.floor(availableH / minItemH) * 2
  const showCount  = Math.max(1, maxAtMin - 1)
  return makeLayout(MIN_SWATCH, MIN_FONT, 2, colors.slice(0, showCount), colors.length - showCount)
}

// ── Central geometry computation (canvas, SVG, and hit-testing all use this) ─

function computeListGeometry(colors, W, H) {
  const { wheelR, cx } = getWheelGeometry(W, H, true)
  const nominalSwatch  = Math.max(32, Math.round(Math.min(W, H) * 0.062))
  const nominalFont    = Math.max(11, Math.round(Math.min(W, H) * 0.021))
  const listX          = cx + wheelR + Math.max(72, W * 0.062)   // match getWheelGeometry margin

  if (listX + 60 >= W) return null

  // Fixed container: 10% top padding, 80% height
  const containerTop = H * CONTAINER_TOP_FRAC
  const containerH   = H * CONTAINER_H_FRAC

  const countSize = Math.max(9,  Math.round(nominalFont * 0.88))
  const titleSize = Math.max(11, Math.round(nominalFont * 1.15))

  // Header — tight spacing within container
  const countY = containerTop + Math.round(nominalFont * 1.5)        // count baseline
  const titleY = countY + countSize + 12                              // title baseline
  const sepY   = titleY + Math.round(titleSize * 0.35) + 8           // separator line

  // Items zone: from separator to container bottom
  const itemsGap   = Math.max(12, Math.round(nominalFont * 0.85))
  const itemsStart = sepY + itemsGap
  const availableH = containerTop + containerH - itemsStart

  const layout = computeListLayout(colors, nominalSwatch, nominalFont, availableH)
  const { itemH } = layout

  // Items flow top-to-bottom from the separator
  const listY0 = itemsStart + itemH / 2

  return { layout, listX, listY0, countY, titleY, sepY }
}

// Hit-test bounding boxes (for click-to-copy in PreviewCanvas)
export function getColorListLayout(colors, W, H) {
  if (!colors.length) return null
  const geo = computeListGeometry(colors, W, H)
  if (!geo) return null

  const { layout, listX, listY0 } = geo
  const { cols, swatchSize, itemH, colWidth, visibleColors } = layout
  const col1Count = cols === 2 ? Math.ceil(visibleColors.length / 2) : visibleColors.length

  const items = visibleColors.map((c, i) => {
    const inCol2   = cols === 2 && i >= col1Count
    const colX     = inCol2 ? listX + colWidth + 16 : listX
    const rowIndex = inCol2 ? i - col1Count : i
    const rowCy    = listY0 + rowIndex * itemH
    return { hex: c.hex, label: c.label, x: colX, y: rowCy - swatchSize / 2, w: colWidth, h: itemH }
  })

  return { items }
}

// ── Drawing helpers ─────────────────────────────────────────────────────────

function drawWheelPixels(ctx, cx, cy, radius) {
  const r    = Math.floor(radius)
  const size = r * 2
  const img  = ctx.createImageData(size, size)
  const data = img.data

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const dx   = px - r
      const dy   = py - r
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist > r) continue
      const hue          = ((Math.atan2(dy, dx) * 180 / Math.PI) + 360) % 360
      const sat          = dist / r
      const { r: rv, g, b } = hslToRgb(hue / 360, sat, 0.5)
      const idx = (py * size + px) * 4
      data[idx] = rv; data[idx + 1] = g; data[idx + 2] = b; data[idx + 3] = 255
    }
  }
  ctx.putImageData(img, Math.round(cx) - r, Math.round(cy) - r)
}

function drawRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  if (ctx.roundRect) {
    ctx.roundRect(x, y, w, h, r)
  } else {
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.arcTo(x + w, y, x + w, y + r, r)
    ctx.lineTo(x + w, y + h - r)
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
    ctx.lineTo(x + r, y + h)
    ctx.arcTo(x, y + h, x, y + h - r, r)
    ctx.lineTo(x, y + r)
    ctx.arcTo(x, y, x + r, y, r)
    ctx.closePath()
  }
}

// ── Color list renderer ─────────────────────────────────────────────────────

function drawColorList(ctx, geo, title, totalCount) {
  const { layout, listX, listY0, countY, titleY, sepY } = geo
  const { cols, swatchSize, fontSize, itemH, colWidth, visibleColors, overflow } = layout
  const swatchRadius  = Math.round(swatchSize * 0.22)
  const labelFontSize = Math.round(fontSize * 0.76)
  const textGap       = Math.round(swatchSize * 0.38)
  const titleSize     = Math.round(fontSize * 1.15)
  const countSize     = Math.round(fontSize * 0.88)
  const col1Count     = cols === 2 ? Math.ceil(visibleColors.length / 2) : visibleColors.length

  ctx.textAlign = 'left'

  // Count
  ctx.fillStyle = '#888'
  ctx.font = `500 ${countSize}px -apple-system, Arial, sans-serif`
  ctx.fillText(`${totalCount} colour${totalCount !== 1 ? 's' : ''}`, listX, countY)

  // Title
  ctx.fillStyle = '#333'
  ctx.font = `700 ${titleSize}px -apple-system, Arial, sans-serif`
  ctx.fillText(title || 'Selected colours', listX, titleY)

  // Separator
  const sepWidth = cols === 2 ? colWidth * 2 + 16 : colWidth
  ctx.strokeStyle = '#d0d0d0'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(listX, sepY)
  ctx.lineTo(listX + sepWidth, sepY)
  ctx.stroke()

  // Items
  visibleColors.forEach((c, i) => {
    const inCol2   = cols === 2 && i >= col1Count
    const colX     = inCol2 ? listX + colWidth + 16 : listX
    const rowIndex = inCol2 ? i - col1Count : i
    const rowCy    = listY0 + rowIndex * itemH

    drawRoundRect(ctx, colX, rowCy - swatchSize / 2, swatchSize, swatchSize, swatchRadius)
    ctx.fillStyle = c.hex
    ctx.fill()
    ctx.strokeStyle = 'rgba(0,0,0,0.08)'
    ctx.lineWidth = 1.5
    ctx.stroke()

    const textX = colX + swatchSize + textGap

    ctx.fillStyle = '#1a1a1a'
    ctx.font = `${fontSize}px 'Courier New', monospace`
    ctx.fillText(c.hex, textX, rowCy - labelFontSize * 0.5)

    if (c.label) {
      ctx.fillStyle = '#888'
      ctx.font = `${labelFontSize}px -apple-system, Arial, sans-serif`
      ctx.fillText(c.label, textX, rowCy + fontSize * 0.72)
    }
  })

  if (overflow > 0) {
    const overflowY = listY0 + col1Count * itemH + fontSize * 0.5
    ctx.fillStyle = '#aaa'
    ctx.font = `${fontSize}px -apple-system, Arial, sans-serif`
    ctx.fillText(`+${overflow} more`, listX, overflowY)
  }

  ctx.textAlign = 'left'
}

function drawDots(ctx, colors, cx, cy, wheelR, dotSize, showLabels) {
  const lineW = Math.max(2, dotSize * 0.15)
  const dots  = computeDotPositions(colors, cx, cy, wheelR)

  dots.forEach(c => {
    ctx.beginPath()
    ctx.arc(c.x, c.y, dotSize, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(255,255,255,0.92)'
    ctx.lineWidth = lineW
    ctx.stroke()

    ctx.beginPath()
    ctx.arc(c.x, c.y, dotSize - lineW / 2, 0, Math.PI * 2)
    ctx.fillStyle = c.hex
    ctx.globalAlpha = 0.72
    ctx.fill()
    ctx.globalAlpha = 1

    if (showLabels && c.label) {
      const labelSize = Math.max(10, Math.round(dotSize * 0.72))
      ctx.font = `500 ${labelSize}px -apple-system, Arial, sans-serif`
      ctx.fillStyle = '#111'
      ctx.textAlign = 'center'
      ctx.fillText(c.label, c.x, c.y + dotSize + labelSize)
    }
  })

  ctx.textAlign = 'left'
}

// ── Public: Canvas ──────────────────────────────────────────────────────────

export function buildCanvas(colors, title, W, H, dotSize, showLabels = true, showColorList = true) {
  const oc  = document.createElement('canvas')
  oc.width  = W; oc.height = H
  const ctx = oc.getContext('2d')

  const { wheelR, cx, cy } = getWheelGeometry(W, H, showColorList)
  drawWheelPixels(ctx, cx, cy, wheelR)

  if (showColorList) {
    const geo = computeListGeometry(colors, W, H)
    if (geo) drawColorList(ctx, geo, title, colors.length)
  }

  drawDots(ctx, colors, cx, cy, wheelR, dotSize, showLabels)

  ctx.globalCompositeOperation = 'destination-over'
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)
  ctx.globalCompositeOperation = 'source-over'

  return oc
}

// ── Public: SVG ─────────────────────────────────────────────────────────────

export function buildSvg(colors, title, W, H, dotSize, showLabels = true, showColorList = true) {
  const { wheelR, cx, cy } = getWheelGeometry(W, H, showColorList)
  const lineW = Math.max(2, dotSize * 0.15)

  // Wheel slices
  let wheelPaths = ''
  for (let i = 0; i < 360; i++) {
    const a1 = (i * Math.PI * 2) / 360
    const a2 = ((i + 1) * Math.PI * 2) / 360
    const x1 = (cx + wheelR * Math.cos(a1)).toFixed(2)
    const y1 = (cy + wheelR * Math.sin(a1)).toFixed(2)
    const x2 = (cx + wheelR * Math.cos(a2)).toFixed(2)
    const y2 = (cy + wheelR * Math.sin(a2)).toFixed(2)
    wheelPaths += `<path d="M${cx.toFixed(2)},${cy.toFixed(2)} L${x1},${y1} A${wheelR.toFixed(2)},${wheelR.toFixed(2)} 0 0,1 ${x2},${y2} Z" fill="hsl(${i},100%,50%)"/>`
  }

  // Color list SVG
  let listSvg = ''
  if (showColorList) {
    const geo = computeListGeometry(colors, W, H)
    if (geo) {
      const { layout, listX, listY0, countY, titleY, sepY } = geo
      const { cols, swatchSize, fontSize, itemH, colWidth, visibleColors, overflow } = layout
      const swatchR       = Math.round(swatchSize * 0.22)
      const labelFontSize = Math.round(fontSize * 0.76)
      const textGap       = Math.round(swatchSize * 0.38)
      const titleSize     = Math.round(fontSize * 1.15)
      const countSize     = Math.round(fontSize * 0.88)
      const col1Count     = cols === 2 ? Math.ceil(visibleColors.length / 2) : visibleColors.length
      const sepWidth      = cols === 2 ? colWidth * 2 + 16 : colWidth

      listSvg += `<text x="${listX.toFixed(2)}" y="${countY.toFixed(2)}" font-family="-apple-system,Arial,sans-serif" font-size="${countSize}" font-weight="500" fill="#888">${colors.length} colour${colors.length !== 1 ? 's' : ''}</text>`
      listSvg += `<text x="${listX.toFixed(2)}" y="${titleY.toFixed(2)}" font-family="-apple-system,Arial,sans-serif" font-size="${titleSize}" font-weight="700" fill="#333">${title || 'Selected colours'}</text>`
      listSvg += `<line x1="${listX.toFixed(2)}" y1="${sepY.toFixed(2)}" x2="${(listX + sepWidth).toFixed(2)}" y2="${sepY.toFixed(2)}" stroke="#d0d0d0" stroke-width="1"/>`

      visibleColors.forEach((c, i) => {
        const inCol2   = cols === 2 && i >= col1Count
        const colX     = inCol2 ? listX + colWidth + 16 : listX
        const rowIndex = inCol2 ? i - col1Count : i
        const rowCy    = listY0 + rowIndex * itemH
        const textX    = colX + swatchSize + textGap

        listSvg += `<rect x="${colX.toFixed(2)}" y="${(rowCy - swatchSize / 2).toFixed(2)}" width="${swatchSize}" height="${swatchSize}" rx="${swatchR}" ry="${swatchR}" fill="${c.hex}" stroke="rgba(0,0,0,0.08)" stroke-width="1.5"/>`
        listSvg += `<text x="${textX.toFixed(2)}" y="${(rowCy - labelFontSize * 0.5).toFixed(2)}" font-family="'Courier New',monospace" font-size="${fontSize}" fill="#1a1a1a">${c.hex}</text>`
        if (c.label) {
          listSvg += `<text x="${textX.toFixed(2)}" y="${(rowCy + fontSize * 0.72).toFixed(2)}" font-family="-apple-system,Arial,sans-serif" font-size="${labelFontSize}" fill="#888">${c.label}</text>`
        }
      })

      if (overflow > 0) {
        listSvg += `<text x="${listX.toFixed(2)}" y="${(listY0 + col1Count * itemH + fontSize * 0.5).toFixed(2)}" font-family="-apple-system,Arial,sans-serif" font-size="${fontSize}" fill="#aaa">+${overflow} more</text>`
      }
    }
  }

  // Dots
  const dots = computeDotPositions(colors, cx, cy, wheelR)
  let dotsSvg = ''
  dots.forEach(c => {
    const dx = c.x.toFixed(2)
    const dy = c.y.toFixed(2)
    dotsSvg += `<circle cx="${dx}" cy="${dy}" r="${dotSize}" fill="${c.hex}" fill-opacity="0.72" stroke="rgba(255,255,255,0.92)" stroke-width="${lineW.toFixed(2)}"/>`
    if (showLabels && c.label) {
      const ls = Math.max(10, Math.round(dotSize * 0.72))
      dotsSvg += `<text x="${dx}" y="${(c.y + dotSize + ls).toFixed(2)}" text-anchor="middle" font-size="${ls}" font-family="Arial,sans-serif" fill="#111">${c.label}</text>`
    }
  })

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="sat" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="white" stop-opacity="1"/>
      <stop offset="100%" stop-color="white" stop-opacity="0"/>
    </radialGradient>
    <clipPath id="wc"><circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${wheelR.toFixed(2)}"/></clipPath>
  </defs>
  <rect width="${W}" height="${H}" fill="white"/>
  <g clip-path="url(#wc)">${wheelPaths}</g>
  <circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${wheelR.toFixed(2)}" fill="url(#sat)"/>
  ${listSvg}
  ${dotsSvg}
</svg>`
}
