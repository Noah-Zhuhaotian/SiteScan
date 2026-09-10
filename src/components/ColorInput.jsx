import { useState } from 'react'
import { isValidHex } from '../utils/color'
import styles from './ColorInput.module.css'

export default function ColorInput({ onAdd, colorCount = 0, maxColors = 50, colors = [] }) {
  const [hex, setHex] = useState('#FF6600')
  const [label, setLabel] = useState('')
  const [dupWarning, setDupWarning] = useState(false)

  const atLimit = colorCount >= maxColors

  const syncPickerToHex = (e) => {
    setHex(e.target.value.toUpperCase())
    setDupWarning(false)
  }

  const syncHexToPicker = (e) => {
    setHex(e.target.value)
    setDupWarning(false)
  }

  const submit = () => {
    if (atLimit) return
    const finalHex = (isValidHex(hex) ? hex : '#FF6600').toUpperCase()
    if (colors.some(c => c.hex.toUpperCase() === finalHex)) {
      setDupWarning(true)
      return
    }
    setDupWarning(false)
    onAdd(finalHex, label.trim())
    setLabel('')
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter') submit()
  }

  return (
    <div className={styles.root}>
      <div className={styles.row}>
        <input
          type="color"
          className={styles.picker}
          value={isValidHex(hex) ? hex : '#FF6600'}
          onChange={syncPickerToHex}
          disabled={atLimit}
        />
        <input
          type="text"
          className={styles.hexInput}
          value={hex}
          onChange={syncHexToPicker}
          onKeyDown={onKeyDown}
          placeholder="#RRGGBB"
          maxLength={7}
          disabled={atLimit}
        />
      </div>
      <div className={styles.row} style={{ marginTop: 8 }}>
        <input
          type="text"
          value={label}
          onChange={e => setLabel(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Label (optional)"
          style={{ flex: 1 }}
          disabled={atLimit}
        />
        <button className="btn btn-primary" onClick={submit} disabled={atLimit}>+ Add</button>
      </div>
      {dupWarning && (
        <p className={styles.warning}>
          This colour is already in the list.
        </p>
      )}
      {atLimit && (
        <p className={styles.warning}>
          {maxColors} colour limit reached. Export this wheel and start a new one for better readability.
        </p>
      )}
    </div>
  )
}
