import { useState, useRef, useCallback } from 'react'
import { sampleImagePixels, extractColorsFromPixels } from '../utils/extractColors'
import styles from './ImageColorPicker.module.css'

export default function ImageColorPicker({ onAddColors, existingColors, maxColors }) {
  const [open, setOpen] = useState(false)
  const [imageUrl, setImageUrl] = useState(null)
  const [pixels, setPixels] = useState(null)
  const [k, setK] = useState(8)
  const [extracted, setExtracted] = useState([])
  const [selected, setSelected] = useState(new Set())
  const [loading, setLoading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef()

  const processFile = useCallback(async (file) => {
    if (!file || !file.type.startsWith('image/')) return
    setLoading(true)
    const url = URL.createObjectURL(file)
    try {
      const px = await sampleImagePixels(url)
      const colors = extractColorsFromPixels(px, k)
      setImageUrl(url)
      setPixels(px)
      setExtracted(colors)
      setSelected(new Set(colors.filter(h => !existingColors.some(c => c.hex === h))))
      setOpen(true)
    } catch {
      URL.revokeObjectURL(url)
    }
    setLoading(false)
  }, [k, existingColors])

  const handleFileInput = (e) => {
    processFile(e.target.files[0])
    e.target.value = ''
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    processFile(e.dataTransfer.files[0])
  }

  const changeK = (newK) => {
    setK(newK)
    if (!pixels) return
    const colors = extractColorsFromPixels(pixels, newK)
    setExtracted(colors)
    setSelected(new Set(colors.filter(h => !existingColors.some(c => c.hex === h))))
  }

  const toggle = (hex) => {
    if (existingColors.some(c => c.hex === hex)) return
    setSelected(prev => {
      const next = new Set(prev)
      next.has(hex) ? next.delete(hex) : next.add(hex)
      return next
    })
  }

  const selectAll = () =>
    setSelected(new Set(extracted.filter(h => !existingColors.some(c => c.hex === h))))

  const selectNone = () => setSelected(new Set())

  const handleAdd = () => {
    const slots = maxColors - existingColors.length
    const toAdd = extracted
      .filter(h => selected.has(h))
      .filter(h => !existingColors.some(c => c.hex === h))
      .slice(0, slots)
    onAddColors(toAdd)
    close()
  }

  const close = () => {
    setOpen(false)
    if (imageUrl) URL.revokeObjectURL(imageUrl)
    setImageUrl(null)
    setPixels(null)
    setExtracted([])
    setSelected(new Set())
  }

  const slotsLeft = maxColors - existingColors.length
  const addCount = Math.min(selected.size, slotsLeft)

  return (
    <>
      <div
        className={`${styles.dropZone} ${dragging ? styles.dragging : ''} ${loading ? styles.loading : ''}`}
        onClick={() => !loading && fileRef.current.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <input ref={fileRef} type="file" accept="image/*" onChange={handleFileInput} style={{ display: 'none' }} />
        <span className={styles.dropIcon}>{loading ? '⏳' : '🖼'}</span>
        <span className={styles.dropText}>
          {loading ? 'Extracting…' : 'Drop image or click to upload'}
        </span>
      </div>

      {open && (
        <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && close()}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <span>Extract colours from image</span>
              <button className={styles.closeBtn} onClick={close}>×</button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.topRow}>
                <img src={imageUrl} className={styles.thumb} alt="uploaded" />
                <div className={styles.kControl}>
                  <label className={styles.kLabel}>
                    Colours to extract: <strong>{k}</strong>
                  </label>
                  <input
                    type="range"
                    min={3}
                    max={15}
                    value={k}
                    onChange={e => changeK(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className={styles.swatchGrid}>
                {extracted.map(hex => {
                  const alreadyAdded = existingColors.some(c => c.hex === hex)
                  const isSelected = selected.has(hex)
                  return (
                    <button
                      key={hex}
                      className={`${styles.swatchItem} ${isSelected ? styles.swatchOn : ''} ${alreadyAdded ? styles.swatchDone : ''}`}
                      onClick={() => toggle(hex)}
                      title={alreadyAdded ? 'Already on wheel' : hex}
                    >
                      <div className={styles.swatch} style={{ background: hex }}>
                        {isSelected && !alreadyAdded && <span className={styles.check}>✓</span>}
                        {alreadyAdded && <span className={styles.check}>✓</span>}
                      </div>
                      <span className={styles.hexLabel}>{hex}</span>
                      {alreadyAdded && <span className={styles.doneBadge}>added</span>}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className={styles.modalFooter}>
              <div className={styles.footerLeft}>
                <button className="btn btn-ghost btn-sm" onClick={selectAll}>All</button>
                <button className="btn btn-ghost btn-sm" onClick={selectNone}>None</button>
              </div>
              <button
                className="btn btn-primary"
                onClick={handleAdd}
                disabled={addCount === 0}
              >
                Add {addCount} colour{addCount !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
