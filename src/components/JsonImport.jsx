import { useRef, useState } from 'react'
import styles from './JsonImport.module.css'

function parseData(str) {
  const data = JSON.parse(str)
  if (!Array.isArray(data.colors)) throw new Error('Missing "colors" array')
  const valid = data.colors.filter(c => /^#[0-9A-Fa-f]{6}$/.test(c.hex))
  if (valid.length === 0) throw new Error('No valid hex colours found')
  const site = Array.isArray(data.sites) && data.sites.length
    ? data.sites.join(', ')
    : (data.site || 'Imported')
  return { site, colors: valid }
}

export default function JsonImport({ onAddColors, existingColors, maxColors }) {
  const fileRef = useRef()
  const [text, setText] = useState('')
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState(null)
  const [preview, setPreview] = useState(null)

  const tryParse = (str) => {
    setError(null)
    if (!str.trim()) { setPreview(null); return }
    try {
      setPreview(parseData(str))
    } catch (err) {
      setPreview(null)
      if (str.trim().length > 10) setError(err.message)
    }
  }

  const handleTextChange = (e) => {
    setText(e.target.value)
    tryParse(e.target.value)
  }

  const processFile = (file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      setText(e.target.result)
      tryParse(e.target.result)
    }
    reader.readAsText(file)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    processFile(e.dataTransfer.files[0])
  }

  const clear = () => { setText(''); setPreview(null); setError(null) }

  const doImport = () => {
    if (!preview) return
    const existing = new Set(existingColors.map(c => c.hex.toUpperCase()))
    const slots = maxColors - existingColors.length
    const toAdd = preview.colors
      .filter(c => !existing.has(c.hex.toUpperCase()))
      .slice(0, slots)
      .map(c => ({ hex: c.hex.toUpperCase(), label: c.label || '' }))
    onAddColors(toAdd)
    clear()
  }

  const slotsLeft = maxColors - existingColors.length
  const newCount = preview
    ? preview.colors.filter(c => !existingColors.some(e => e.hex.toUpperCase() === c.hex.toUpperCase())).length
    : 0

  return (
    <div>
      <div
        className={`${styles.textareaWrap} ${dragging ? styles.dragging : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <textarea
          className={styles.textarea}
          value={text}
          onChange={handleTextChange}
          placeholder={'Paste JSON here…'}
          rows={4}
          spellCheck={false}
        />
      </div>

      <div className={styles.fileRow}>
        <input
          ref={fileRef} type="file" accept=".json,application/json"
          onChange={(e) => { processFile(e.target.files[0]); e.target.value = '' }}
          style={{ display: 'none' }}
        />
        <button className="btn btn-ghost btn-sm" onClick={() => fileRef.current.click()}>
          Upload .json
        </button>
        {text && (
          <button className="btn btn-ghost btn-sm" onClick={clear}>Clear</button>
        )}
      </div>

      {error && <p className={styles.warn}>{error}</p>}

      {preview && (
        <div className={styles.preview}>
          <div className={styles.previewHeader}>
            <span className={styles.siteName}>{preview.site}</span>
            <span className={styles.colorCount}>{preview.colors.length} colours</span>
          </div>
          <div className={styles.swatchRow}>
            {preview.colors.map((c, i) => (
              <div
                key={i}
                className={styles.dot}
                style={{ background: c.hex }}
                title={`${c.hex}${c.label ? ' · ' + c.label : ''}`}
              />
            ))}
          </div>
          <div className={styles.previewActions}>
            <button
              className="btn btn-primary btn-sm"
              onClick={doImport}
              disabled={newCount === 0 || slotsLeft === 0}
            >
              Add {Math.min(newCount, slotsLeft)} colour{Math.min(newCount, slotsLeft) !== 1 ? 's' : ''}
            </button>
            {newCount === 0 && <span className={styles.warn}>Already on wheel</span>}
          </div>
        </div>
      )}
    </div>
  )
}
