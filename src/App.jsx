import { useState } from 'react'
import ControlPanel from './components/ControlPanel'
import PreviewCanvas from './components/PreviewCanvas'
import styles from './App.module.css'

const DEFAULT_SETTINGS = {
  title: 'Selected colours',
  canvasW: 1366,
  canvasH: 768,
  dotSize: 28,
  showLabels: true,
  showColorList: true,
}

export default function App() {
  const [colors, setColors] = useState([])
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)

  const MAX_COLORS = 50

  const addColor = (hex, label) => {
    setColors(prev => {
      if (prev.length >= MAX_COLORS) return prev
      return [...prev, { hex: hex.toUpperCase(), label }]
    })
  }

  const removeColor = (index) => {
    setColors(prev => prev.filter((_, i) => i !== index))
  }

  const clearColors = () => setColors([])

  const updateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <h1>Color Wheel Generator</h1>
      </header>

      <div className={styles.layout}>
        <ControlPanel
          colors={colors}
          settings={settings}
          onAddColor={addColor}
          onRemoveColor={removeColor}
          onClearColors={clearColors}
          onUpdateSetting={updateSetting}
          maxColors={MAX_COLORS}
        />
        <PreviewCanvas
          colors={colors}
          settings={settings}
        />
      </div>
    </div>
  )
}
