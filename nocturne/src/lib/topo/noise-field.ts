// No top-level imports of simplex-noise or d3-contour — deferred inside generateSingleTerrain()
// so that Turbopack never tries to resolve them as static module-namespace exports in a
// dynamic-import chunk (which causes "is not a function" on the resolved namespace).

const GRID_WIDTH = 140
const GRID_HEIGHT = 90
const NUM_CONTOUR_LEVELS = 18
const NOISE_SCALE = 0.016

function ringToPath(ring: number[][]): string {
  if (ring.length < 2) return ''
  const parts: string[] = [`M${ring[0][0]},${ring[0][1]}`]
  for (let i = 1; i < ring.length - 1; i++) {
    parts.push(`L${ring[i][0]},${ring[i][1]}`)
  }
  parts.push('Z')
  return parts.join('')
}

function multipolygonToPath(coords: number[][][][]): string {
  return coords
    .flatMap((polygon) => polygon)
    .map(ringToPath)
    .join('')
}

export async function generateSingleTerrain(): Promise<string[]> {
  const [{ createNoise2D }, { contours }] = await Promise.all([
    import('simplex-noise'),
    import('d3-contour'),
  ])

  const noise2D = createNoise2D()

  // Build the noise field
  const field: number[][] = []
  for (let y = 0; y < GRID_HEIGHT; y++) {
    const row: number[] = []
    for (let x = 0; x < GRID_WIDTH; x++) {
      const raw = noise2D(x * NOISE_SCALE, y * NOISE_SCALE)
      row.push((raw + 1) / 2)
    }
    field.push(row)
  }

  // Flatten to 1D: values[x + y * GRID_WIDTH] = field[y][x]
  const values: number[] = new Array(GRID_WIDTH * GRID_HEIGHT)
  for (let y = 0; y < GRID_HEIGHT; y++) {
    for (let x = 0; x < GRID_WIDTH; x++) {
      values[x + y * GRID_WIDTH] = field[y][x]
    }
  }

  const thresholds = Array.from(
    { length: NUM_CONTOUR_LEVELS },
    (_, i) => 0.2 + (i * (0.85 - 0.2)) / (NUM_CONTOUR_LEVELS - 1),
  )

  const gen = contours()
    .size([GRID_WIDTH, GRID_HEIGHT])
    .thresholds(thresholds)

  return gen(values)
    .map((geom) => multipolygonToPath(geom.coordinates))
    .filter((d) => d.length > 0)
}
