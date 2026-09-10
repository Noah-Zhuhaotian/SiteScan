import { useRef, useEffect, useCallback, useState } from 'react'
import { buildCanvas, buildSvg, getWheelGeometry, getColorListLayout } from '../utils/renderer'
import { hexToRgb, rgbToHsl } from '../utils/color'
import styles from './PreviewCanvas.module.css'

export default function PreviewCanvas({ colors, settings }) {
  const canvasRef = useRef(null)
  const wrapRef = useRef(null)
  const [tooltip, setTooltip] = useState(null)
  const [copied, setCopied] = useState(null)
  const [cursorPointer, setCursorPointer] = useState(false)

  const { title, canvasW, canvasH, dotSize, showLabels, showColorList } = settings

  const render = useCallback(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return

    const offscreen = buildCanvas(colors, title, canvasW, canvasH, dotSize, showLabels, showColorList)

    const maxW = wrap.clientWidth - 2
    const maxH = wrap.clientHeight - 2
    const scale = Math.min(1, maxW / canvasW, maxH / canvasH)

    canvas.width = Math.round(canvasW * scale)
    canvas.height = Math.round(canvasH * scale)
    canvas.getContext('2d').drawImage(offscreen, 0, 0, canvas.width, canvas.height)
  }, [colors, title, canvasW, canvasH, dotSize, showLabels, showColorList])

  useEffect(() => { render() }, [render])

  useEffect(() => {
    const observer = new ResizeObserver(render)
    if (wrapRef.current) observer.observe(wrapRef.current)
    return () => observer.disconnect()
  }, [render])

  const toExportCoords = useCallback((mx, my) => {
    const canvas = canvasRef.current
    if (!canvas) return null
    return { ex: mx * canvasW / canvas.width, ey: my * canvasH / canvas.height }
  }, [canvasW, canvasH])

  const handleMouseMove = useCallback((e) => {
    const canvas = canvasRef.current
    if (!canvas || colors.length === 0) {
      setTooltip(null)
      setCursorPointer(false)
      return
    }

    const mx = e.nativeEvent.offsetX
    const my = e.nativeEvent.offsetY
    const coords = toExportCoords(mx, my)
    if (!coords) return
    const { ex, ey } = coords

    // Check dot hover
    const { wheelR, cx, cy } = getWheelGeometry(canvasW, canvasH, showColorList)
    for (const c of colors) {
      const { r, g, b } = hexToRgb(c.hex)
      const { h, s } = rgbToHsl(r, g, b)
      const angleRad = (h * Math.PI) / 180
      const dist = (Math.min(s, 100) / 100) * wheelR
      const dx = cx + dist * Math.cos(angleRad)
      const dy = cy + dist * Math.sin(angleRad)

      if (Math.hypot(ex - dx, ey - dy) <= dotSize * 1.6) {
        setTooltip({ x: mx, y: my, hex: c.hex, label: c.label })
        setCursorPointer(false)
        return
      }
    }
    setTooltip(null)

    // Check color list hover → pointer cursor
    if (showColorList) {
      const listLayout = getColorListLayout(colors, canvasW, canvasH)
      if (listLayout) {
        const over = listLayout.items.some(item =>
          ex >= item.x && ex <= item.x + item.w && ey >= item.y && ey <= item.y + item.h
        )
        setCursorPointer(over)
        return
      }
    }
    setCursorPointer(false)
  }, [colors, canvasW, canvasH, dotSize, showColorList, toExportCoords])

  const handleClick = useCallback((e) => {
    if (!showColorList || colors.length === 0) return
    const mx = e.nativeEvent.offsetX
    const my = e.nativeEvent.offsetY
    const coords = toExportCoords(mx, my)
    if (!coords) return
    const { ex, ey } = coords

    const listLayout = getColorListLayout(colors, canvasW, canvasH)
    if (!listLayout) return

    for (const item of listLayout.items) {
      if (ex >= item.x && ex <= item.x + item.w && ey >= item.y && ey <= item.y + item.h) {
        navigator.clipboard.writeText(item.hex).catch(() => {})
        setCopied(item.hex)
        setTimeout(() => setCopied(null), 1800)
        return
      }
    }
  }, [colors, canvasW, canvasH, showColorList, toExportCoords])

  const exportPng = () => {
    const oc = buildCanvas(colors, title, canvasW, canvasH, dotSize, showLabels, showColorList)
    const a = document.createElement('a')
    a.download = 'color-wheel.png'
    a.href = oc.toDataURL('image/png')
    a.click()
  }

  const exportSvg = () => {
    const svg = buildSvg(colors, title, canvasW, canvasH, dotSize, showLabels, showColorList)
    const blob = new Blob([svg], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.download = 'color-wheel.svg'
    a.href = url
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className={styles.area}>
      <div className={styles.toolbar}>
        <div className={styles.info}>
          <span className={styles.label}>Preview</span>
          <span className="badge">{canvasW} × {canvasH}</span>
        </div>
        <div className={styles.actions}>
          <button className="btn btn-primary" onClick={exportPng}>Export PNG</button>
          <button className="btn btn-secondary" onClick={exportSvg}>Export SVG</button>
        </div>
      </div>

      <div ref={wrapRef} className={styles.wrap}>
        <div className={styles.canvasBox}>
          <canvas
            ref={canvasRef}
            className={styles.canvas}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => { setTooltip(null); setCursorPointer(false) }}
            onClick={handleClick}
            style={{ cursor: cursorPointer ? 'pointer' : 'crosshair' }}
          />
          {tooltip && (
            <div
              className={styles.tooltip}
              style={{ left: tooltip.x + 14, top: tooltip.y - 40 }}
            >
              <div className={styles.tooltipSwatch} style={{ background: tooltip.hex }} />
              <div>
                <div className={styles.tooltipHex}>{tooltip.hex}</div>
                {tooltip.label && <div className={styles.tooltipLabel}>{tooltip.label}</div>}
              </div>
            </div>
          )}
          {copied && (
            <div className={styles.copiedToast}>
              <span className={styles.copiedSwatch} style={{ background: copied }} />
              {copied} copied!
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
