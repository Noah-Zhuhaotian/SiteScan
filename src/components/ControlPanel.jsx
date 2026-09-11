import ColorInput from './ColorInput'
import ColorList from './ColorList'
import Settings from './Settings'
import JsonImport from './JsonImport'
import styles from './ControlPanel.module.css'

export default function ControlPanel({
  colors, settings,
  onAddColor, onAddColors, onRemoveColor, onClearColors, onUpdateSetting,
  maxColors,
}) {
  return (
    <aside className={styles.panel}>
      <section className={styles.section}>
        <p className="section-label">Add Color</p>
        <ColorInput onAdd={onAddColor} colorCount={colors.length} maxColors={maxColors} colors={colors} />
      </section>

      <section className={styles.section}>
        <p className="section-label">Import JSON</p>
        <JsonImport
          onAddColors={onAddColors}
          existingColors={colors}
          maxColors={maxColors}
        />
      </section>

      <section className={styles.section}>
        <p className="section-label">
          Colors <span className="badge">{colors.length}</span>
        </p>
        <ColorList colors={colors} onRemove={onRemoveColor} />
        {colors.length > 0 && (
          <button
            className="btn btn-ghost btn-sm"
            style={{ marginTop: 8 }}
            onClick={onClearColors}
          >
            Clear all
          </button>
        )}
      </section>

      <section className={styles.section}>
        <Settings settings={settings} onChange={onUpdateSetting} />
      </section>
    </aside>
  )
}
