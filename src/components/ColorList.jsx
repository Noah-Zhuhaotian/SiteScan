import styles from './ColorList.module.css'

export default function ColorList({ colors, onRemove }) {
  if (colors.length === 0) {
    return <p className={styles.empty}>No colors added yet</p>
  }

  return (
    <ul className={styles.list}>
      {colors.map((c, i) => (
        <li key={i} className={styles.item}>
          <div className={styles.swatch} style={{ background: c.hex }} />
          <span className={styles.hex}>{c.hex}</span>
          <span className={styles.label}>{c.label}</span>
          <button
            className={styles.remove}
            onClick={() => onRemove(i)}
            title="Remove"
          >
            ×
          </button>
        </li>
      ))}
    </ul>
  )
}
