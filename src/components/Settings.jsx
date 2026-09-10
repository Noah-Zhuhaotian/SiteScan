import styles from './Settings.module.css'

const SIZE_PRESETS = [
  { label: '1366 × 768 — 16:9 (HD)',       w: 1366, h: 768 },
  { label: '1920 × 1080 — 16:9 (Full HD)', w: 1920, h: 1080 },
  { label: '2560 × 1440 — 16:9 (2K)',      w: 2560, h: 1440 },
]

export default function Settings({ settings, onChange }) {
  const { title, canvasW, canvasH, dotSize, showLabels, showColorList } = settings

  const selectedValue = SIZE_PRESETS.findIndex(p => p.w === canvasW && p.h === canvasH)
  const selectValue = selectedValue >= 0 ? selectedValue : ''

  const applySize = (idx) => {
    const p = SIZE_PRESETS[idx]
    onChange('canvasW', p.w)
    onChange('canvasH', p.h)
  }

  return (
    <>
      <div className={styles.group}>
        <p className="section-label">Chart Title</p>
        <input
          type="text"
          value={title}
          onChange={e => onChange('title', e.target.value)}
          placeholder="Competition Colours"
        />
      </div>

      <div className={styles.group}>
        <p className="section-label">Canvas Size</p>
        <select
          value={selectValue}
          onChange={e => applySize(Number(e.target.value))}
          className={styles.sizeSelect}
        >
          {selectValue === '' && <option value="" disabled>Custom size</option>}
          {SIZE_PRESETS.map((p, i) => (
            <option key={i} value={i}>{p.label}</option>
          ))}
        </select>
      </div>

      <div className={styles.group}>
        <p className="section-label">
          Dot Size — <span style={{ color: 'var(--text)', fontWeight: 600 }}>{dotSize}px</span>
        </p>
        <input
          type="range"
          min={8} max={80}
          value={dotSize}
          onChange={e => onChange('dotSize', parseInt(e.target.value))}
        />
      </div>

      <div className={styles.group}>
        <p className="section-label">Export Options</p>
        <label className={styles.checkRow}>
          <input
            type="checkbox"
            checked={showColorList}
            onChange={e => onChange('showColorList', e.target.checked)}
          />
          <span>Show colour list</span>
        </label>
        <label className={styles.checkRow} style={{ marginTop: 8 }}>
          <input
            type="checkbox"
            checked={showLabels}
            onChange={e => onChange('showLabels', e.target.checked)}
          />
          <span>Show dot labels</span>
        </label>
      </div>
    </>
  )
}
