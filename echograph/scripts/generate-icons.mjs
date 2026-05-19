import sharp from 'sharp'
import { mkdir } from 'fs/promises'
import { join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const OUTPUT_DIR = join(__dirname, '..', 'public', 'icons')

/**
 * Generates an SVG with the EchoGraph "E" lettermark.
 * maskable=true reduces the letter size so content stays within the central 80% safe zone.
 */
function makeSVG(size, maskable = false) {
  // For maskable icons, content must stay within the central 80% (10% padding each side)
  const fontRatio = maskable ? 0.48 : 0.62
  const fontSize = Math.round(size * fontRatio)
  const cx = size / 2
  const cy = size / 2

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#0F1117"/>
  <text
    x="${cx}"
    y="${cy}"
    font-family="Inter, -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif"
    font-size="${fontSize}"
    font-weight="500"
    fill="#1D9E75"
    text-anchor="middle"
    dominant-baseline="central"
  >E</text>
</svg>`
}

async function generate() {
  await mkdir(OUTPUT_DIR, { recursive: true })

  const sizes = [
    { name: 'icon-96',          size: 96  },
    { name: 'icon-192',         size: 192 },
    { name: 'icon-512',         size: 512 },
    { name: 'icon-maskable-512', size: 512, maskable: true },
  ]

  for (const { name, size, maskable = false } of sizes) {
    const svg = Buffer.from(makeSVG(size, maskable))
    const outPath = join(OUTPUT_DIR, `${name}.png`)
    await sharp(svg).png().toFile(outPath)
    console.log(`✓ ${name}.png (${size}x${size}${maskable ? ', maskable' : ''})`)
  }

  console.log(`\nIcons written to public/icons/`)
}

generate().catch((err) => {
  console.error('Icon generation failed:', err)
  process.exit(1)
})
