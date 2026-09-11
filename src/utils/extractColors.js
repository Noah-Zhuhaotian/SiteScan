// Resize image to ≤MAX_DIM and return all opaque pixel RGB triples
export function sampleImagePixels(imgUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const MAX = 150
      const scale = Math.min(1, MAX / img.width, MAX / img.height)
      const w = Math.max(1, Math.round(img.width * scale))
      const h = Math.max(1, Math.round(img.height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      canvas.getContext('2d').drawImage(img, 0, 0, w, h)
      const { data } = canvas.getContext('2d').getImageData(0, 0, w, h)
      const pixels = []
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] < 128) continue
        pixels.push([data[i], data[i + 1], data[i + 2]])
      }
      resolve(pixels)
    }
    img.onerror = reject
    img.src = imgUrl
  })
}

// K-means clustering on an array of [r,g,b] pixels; returns k hex strings sorted by cluster size
export function extractColorsFromPixels(pixels, k) {
  if (pixels.length === 0) return []
  const kk = Math.min(k, pixels.length)

  // Evenly-spaced initialisation (avoids duplicate centers)
  const step = Math.floor(pixels.length / kk)
  let centers = Array.from({ length: kk }, (_, i) => [...pixels[i * step]])

  const assignments = new Int32Array(pixels.length)

  for (let iter = 0; iter < 25; iter++) {
    let changed = false
    for (let i = 0; i < pixels.length; i++) {
      let minD = Infinity, best = 0
      for (let j = 0; j < kk; j++) {
        const dr = pixels[i][0] - centers[j][0]
        const dg = pixels[i][1] - centers[j][1]
        const db = pixels[i][2] - centers[j][2]
        const d = dr * dr + dg * dg + db * db
        if (d < minD) { minD = d; best = j }
      }
      if (assignments[i] !== best) { assignments[i] = best; changed = true }
    }
    if (!changed) break

    const sums = Array.from({ length: kk }, () => [0, 0, 0, 0])
    for (let i = 0; i < pixels.length; i++) {
      const c = assignments[i]
      sums[c][0] += pixels[i][0]
      sums[c][1] += pixels[i][1]
      sums[c][2] += pixels[i][2]
      sums[c][3]++
    }
    centers = centers.map((c, j) => {
      const n = sums[j][3]
      return n > 0 ? [sums[j][0] / n, sums[j][1] / n, sums[j][2] / n] : c
    })
  }

  const counts = new Array(kk).fill(0)
  for (let i = 0; i < assignments.length; i++) counts[assignments[i]]++

  return centers
    .map((c, i) => ({ rgb: c, n: counts[i] }))
    .sort((a, b) => b.n - a.n)
    .map(({ rgb: [r, g, b] }) =>
      '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0').toUpperCase()).join('')
    )
}
