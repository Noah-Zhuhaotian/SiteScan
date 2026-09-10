import { hexToRgb, rgbToHsl, hslToRgb } from './color'

export const WHEEL_RATIO = 0.46
const MIN_LIST_W = 180 // minimum useful width for the right-side colour list

export function getWheelGeometry(W, H, showColorList = false) {
  let wheelR = Math.min(W, H) * WHEEL_RATIO

  if (showColorList) {
    // Ensure the colour list always has at least MIN_LIST_W px on the right.
    // cx = max(wheelR+15, W*0.37), so two cases bound wheelR:
    //   case A (cx driven by W*0.37): wheelR ≤ W*0.63 − margin − MIN_LIST_W
    //   case B (cx driven by wheelR):  2*wheelR + 15 + margin ≤ W − MIN_LIST_W
    const margin = Math.max(48, W * 0.042)
    const maxA = W * 0.63 - margin - MIN_LIST_W
    const maxB = (W - MIN_LIST_W - 15 - margin) / 2
    wheelR = Math.max(50, Math.min(wheelR, maxA, maxB))
  }

  const cx = Math.max(wheelR + 15, W * 0.33)
  const cy = H * 0.5
  return { wheelR, cx, cy }
}

// Compute raw dot positions from HSL
function computeDotPositions(colors, cx, cy, wheelR) {
  return colors.map(c => {
    const { r, g, b } = hexToRgb(c.hex)
    const { h, s } = rgbToHsl(r, g, b)
    const angleRad = (h * Math.PI) / 180
    const dist = (Math.min(s, 100) / 100) * wheelR
    return { ...c, x: cx + dist * Math.cos(angleRad), y: cy + dist * Math.sin(angleRad) }
  })
}


// Compute how to lay out the color list: how many columns, what sizes, what to truncate.
function computeListLayout(colors, nominalSwatchSize, nominalFontSize, availableH) {
  const MIN_SWATCH = 14
  const MIN_FONT = 10
  const ITEM_RATIO = 1.45

  const nominalItemH = nominalSwatchSize * ITEM_RATIO
  const maxPerCol = Math.max(1, Math.floor(availableH / nominalItemH))

  const makeLayout = (sw, fs, cols, visible, overflow) => ({
    cols,
    swatchSize: sw,
    fontSize: fs,
    itemH: sw * ITEM_RATIO,
    colWidth: sw + Math.round(fs * 9.5),
    visibleColors: visible,
    overflow,
  })

  if (colors.length <= maxPerCol) {
    return makeLayout(nominalSwatchSize, nominalFontSize, 1, colors, 0)
  }

  if (Math.ceil(colors.length / 2) <= maxPerCol) {
    return makeLayout(nominalSwatchSize, nominalFontSize, 2, colors, 0)
  }

  const itemsPerCol2 = Math.ceil(colors.length / 2)
  const scale = (availableH / itemsPerCol2) / nominalItemH
  const scaledSwatch = Math.max(MIN_SWATCH, Math.floor(nominalSwatchSize * scale))
  const scaledFont = Math.max(MIN_FONT, Math.floor(nominalFontSize * scale))
  const scaledItemH = scaledSwatch * ITEM_RATIO
  const maxAtScaled = Math.floor(availableH / scaledItemH) * 2

  if (colors.length <= maxAtScaled) {
    return makeLayout(scaledSwatch, scaledFont, 2, colors, 0)
  }

  const minItemH = MIN_SWATCH * ITEM_RATIO
  const maxAtMin = Math.floor(availableH / minItemH) * 2
  const showCount = Math.max(1, maxAtMin - 1)
  return makeLayout(MIN_SWATCH, MIN_FONT, 2, colors.slice(0, showCount), colors.length - showCount)
}

// Compute listY0 so the item block is vertically centered at H/2.
// listY0 is the vertical center of the first item row.
function computeListY0(layout, H) {
  const { itemH, fontSize, cols, visibleColors } = layout
  const col1Count = cols === 2 ? Math.ceil(visibleColors.length / 2) : visibleColors.length
  const countSize = Math.round(fontSize * 0.88)
  const minY0 = itemH * 2.15 + countSize + 8   // keep header on-screen
  const centered = H / 2 - (col1Count - 1) * itemH / 2
  return Math.max(minY0, centered)
}

// Returns hit-test bounding boxes for each visible color in the list (export coordinates).
// Used by PreviewCanvas for click-to-copy.
export function getColorListLayout(colors, W, H) {
  if (!colors.length) return null
  const { wheelR, cx } = getWheelGeometry(W, H, true)
  const nominalSwatch = Math.max(18, Math.round(Math.min(W, H) * 0.038))
  const nominalFont   = Math.max(11, Math.round(Math.min(W, H) * 0.021))
  const listX = cx + wheelR + Math.max(48, W * 0.042)
  if (listX + 60 >= W) return null

  const layout = computeListLayout(colors, nominalSwatch, nominalFont, H * 0.80)
  const listY0 = computeListY0(layout, H)
  const { cols, swatchSize, itemH, colWidth, visibleColors } = layout
  const col1Count = cols === 2 ? Math.ceil(visibleColors.length / 2) : visibleColors.length

  const items = visibleColors.map((c, i) => {
    const inCol2 = cols === 2 && i >= col1Count
    const colX = inCol2 ? listX + colWidth + 16 : listX
    const rowIndex = inCol2 ? i - col1Count : i
    const y = listY0 + rowIndex * itemH
    return { hex: c.hex, label: c.label, x: colX, y: y - swatchSize / 2, w: colWidth, h: itemH }
  })

  return { items }
}

function drawWheelPixels(ctx, cx, cy, radius) {
  const r = Math.floor(radius)
  const size = r * 2
  const img = ctx.createImageData(size, size)
  const data = img.data

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const dx = px - r
      const dy = py - r
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist > r) continue

      const hue = ((Math.atan2(dy, dx) * 180 / Math.PI) + 360) % 360
      const sat = dist / r
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

function drawColorList(ctx, layout, listX, listY0, title, totalCount) {
  const { cols, swatchSize, fontSize, itemH, colWidth, visibleColors, overflow } = layout
  const swatchRadius = Math.round(swatchSize * 0.2)
  const titleSize = Math.round(fontSize * 1.15)
  const countSize = Math.round(fontSize * 0.88)
  const col1Count = cols === 2 ? Math.ceil(visibleColors.length / 2) : visibleColors.length

  ctx.textAlign = 'left'

  // Count label above title
  ctx.fillStyle = '#888'
  ctx.font = `500 ${countSize}px -apple-system, Arial, sans-serif`
  ctx.fillText(`${totalCount} colour${totalCount !== 1 ? 's' : ''}`, listX, listY0 - itemH * 2.05)

  ctx.fillStyle = '#333'
  ctx.font = `700 ${titleSize}px -apple-system, Arial, sans-serif`
  ctx.fillText(title || 'Competition Colours', listX, listY0 - itemH * 1.45)

  const sepWidth = cols === 2 ? colWidth * 2 + 16 : colWidth
  ctx.strokeStyle = '#d0d0d0'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(listX, listY0 - itemH * 0.82)
  ctx.lineTo(listX + sepWidth, listY0 - itemH * 0.82)
  ctx.stroke()

  visibleColors.forEach((c, i) => {
    const inCol2 = cols === 2 && i >= col1Count
    const colX = inCol2 ? listX + colWidth + 16 : listX
    const rowIndex = inCol2 ? i - col1Count : i
    const y = listY0 + rowIndex * itemH

    drawRoundRect(ctx, colX, y - swatchSize / 2, swatchSize, swatchSize, swatchRadius)
    ctx.fillStyle = c.hex
    ctx.fill()
    ctx.strokeStyle = 'rgba(0,0,0,0.1)'
    ctx.lineWidth = 1.5
    ctx.stroke()

    const textX = colX + swatchSize + 10
    const textY = y + fontSize * 0.36
    ctx.fillStyle = '#1a1a1a'
    ctx.font = `${fontSize}px 'Courier New', monospace`
    ctx.fillText(c.hex, textX, textY)

    if (c.label) {
      const hexWidth = ctx.measureText(c.hex).width
      ctx.fillStyle = '#999'
      ctx.font = `${Math.round(fontSize * 0.82)}px -apple-system, Arial, sans-serif`
      ctx.fillText(c.label, textX + hexWidth + 10, textY)
    }
  })

  if (overflow > 0) {
    const overflowY = listY0 + col1Count * itemH + fontSize * 0.36
    ctx.fillStyle = '#aaa'
    ctx.font = `${fontSize}px -apple-system, Arial, sans-serif`
    ctx.fillText(`+${overflow} more`, listX, overflowY)
  }

  ctx.textAlign = 'left'
}

function drawDots(ctx, colors, cx, cy, wheelR, dotSize, showLabels) {
  const lineW = Math.max(2, dotSize * 0.15)
  const dots = computeDotPositions(colors, cx, cy, wheelR)

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

export function buildCanvas(colors, title, W, H, dotSize, showLabels = true, showColorList = true) {
  const oc = document.createElement('canvas')
  oc.width = W; oc.height = H
  const ctx = oc.getContext('2d')

  const { wheelR, cx, cy } = getWheelGeometry(W, H, showColorList)
  drawWheelPixels(ctx, cx, cy, wheelR)

  if (showColorList) {
    const nominalSwatch = Math.max(18, Math.round(Math.min(W, H) * 0.038))
    const nominalFont   = Math.max(11, Math.round(Math.min(W, H) * 0.021))
    const listX = cx + wheelR + Math.max(48, W * 0.042)

    if (listX + 60 < W) {
      const layout = computeListLayout(colors, nominalSwatch, nominalFont, H * 0.80)
      const listY0 = computeListY0(layout, H)
      drawColorList(ctx, layout, listX, listY0, title, colors.length)
    }
  }

  drawDots(ctx, colors, cx, cy, wheelR, dotSize, showLabels)

  ctx.globalCompositeOperation = 'destination-over'
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)
  ctx.globalCompositeOperation = 'source-over'

  return oc
}

export function buildSvg(colors, title, W, H, dotSize, showLabels = true, showColorList = true) {
  const { wheelR, cx, cy } = getWheelGeometry(W, H, showColorList)
  const lineW = Math.max(2, dotSize * 0.15)

  const nominalSwatch = Math.max(18, Math.round(Math.min(W, H) * 0.038))
  const nominalFont   = Math.max(11, Math.round(Math.min(W, H) * 0.021))
  const listX = cx + wheelR + Math.max(48, W * 0.042)

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

  let listSvg = ''
  if (showColorList && listX + 60 < W) {
    const layout = computeListLayout(colors, nominalSwatch, nominalFont, H * 0.80)
    const listY0 = computeListY0(layout, H)
    const { cols, swatchSize, fontSize, itemH, colWidth, visibleColors, overflow } = layout
    const swatchR   = Math.round(swatchSize * 0.2)
    const titleSize = Math.round(fontSize * 1.15)
    const countSize = Math.round(fontSize * 0.88)
    const col1Count = cols === 2 ? Math.ceil(visibleColors.length / 2) : visibleColors.length
    const sepWidth  = cols === 2 ? colWidth * 2 + 16 : colWidth

    listSvg += `<text x="${listX.toFixed(2)}" y="${(listY0 - itemH * 2.05).toFixed(2)}" font-family="-apple-system,Arial,sans-serif" font-size="${countSize}" font-weight="500" fill="#888">${colors.length} colour${colors.length !== 1 ? 's' : ''}</text>`
    listSvg += `<text x="${listX.toFixed(2)}" y="${(listY0 - itemH * 1.45).toFixed(2)}" font-family="-apple-system,Arial,sans-serif" font-size="${titleSize}" font-weight="700" fill="#333">${title || 'Competition Colours'}</text>`
    listSvg += `<line x1="${listX.toFixed(2)}" y1="${(listY0 - itemH * 0.82).toFixed(2)}" x2="${(listX + sepWidth).toFixed(2)}" y2="${(listY0 - itemH * 0.82).toFixed(2)}" stroke="#d0d0d0" stroke-width="1"/>`

    visibleColors.forEach((c, i) => {
      const inCol2   = cols === 2 && i >= col1Count
      const colX     = inCol2 ? listX + colWidth + 16 : listX
      const rowIndex = inCol2 ? i - col1Count : i
      const y        = listY0 + rowIndex * itemH
      const textX    = colX + swatchSize + 10
      const textY    = y + fontSize * 0.36
      const approxHexW = fontSize * 0.62 * 7

      listSvg += `<rect x="${colX.toFixed(2)}" y="${(y - swatchSize / 2).toFixed(2)}" width="${swatchSize}" height="${swatchSize}" rx="${swatchR}" ry="${swatchR}" fill="${c.hex}" stroke="rgba(0,0,0,0.1)" stroke-width="1.5"/>`
      listSvg += `<text x="${textX.toFixed(2)}" y="${textY.toFixed(2)}" font-family="'Courier New',monospace" font-size="${fontSize}" fill="#1a1a1a">${c.hex}</text>`
      if (c.label) {
        listSvg += `<text x="${(textX + approxHexW + 10).toFixed(2)}" y="${textY.toFixed(2)}" font-family="Arial,sans-serif" font-size="${Math.round(fontSize * 0.82)}" fill="#999">${c.label}</text>`
      }
    })

    if (overflow > 0) {
      const overflowY = (listY0 + col1Count * itemH + fontSize * 0.36).toFixed(2)
      listSvg += `<text x="${listX.toFixed(2)}" y="${overflowY}" font-family="-apple-system,Arial,sans-serif" font-size="${fontSize}" fill="#aaa">+${overflow} more</text>`
    }
  }

  const dots = computeDotPositions(colors, cx, cy, wheelR)

  let dotsSvg = ''
  dots.forEach(c => {
    const dx = c.x.toFixed(2)
    const dy = c.y.toFixed(2)
    dotsSvg += `<circle cx="${dx}" cy="${dy}" r="${dotSize}" fill="${c.hex}" fill-opacity="0.72" stroke="rgba(255,255,255,0.92)" stroke-width="${lineW.toFixed(2)}"/>`
    if (showLabels && c.label) {
      const labelSize = Math.max(10, Math.round(dotSize * 0.72))
      dotsSvg += `<text x="${dx}" y="${(c.y + dotSize + labelSize).toFixed(2)}" text-anchor="middle" font-size="${labelSize}" font-family="Arial,sans-serif" fill="#111">${c.label}</text>`
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
