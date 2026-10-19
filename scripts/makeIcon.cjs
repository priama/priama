#!/usr/bin/env node
/**
 * Rasterise the Priama app icon to build/icon.png, preserving alpha.
 *
 * There is no librsvg / ImageMagick / sharp here, and macOS QuickLook flattens transparency
 * to white — which silently produced a square white tile in the Dock. The mark is nothing but
 * a rounded rect and six axis-aligned rectangles, so it is rasterised directly instead, with
 * no dependencies. Keep this in step with branding/priama-app-icon.svg.
 */
const zlib = require('zlib')
const fs = require('fs')
const path = require('path')

const SIZE = 1024
const SS = 4 // supersampling per axis

const TILE = { x0: 100, y0: 100, x1: 924, y1: 924, r: 185, rgb: [0xfa, 0xfa, 0xf9] }
const INK = [0x18, 0x18, 0x1a]

// Mark 01 on its native 64-unit grid: glyph spans x 18..46, y 8..56.
const GLYPH_H = 0.6 * (TILE.y1 - TILE.y0)
const S = GLYPH_H / 48
const OX = SIZE / 2 - 14 * S
const OY = SIZE / 2 - 24 * S
const unit = (u, v, u2, v2) => [OX + (u - 18) * S, OY + (v - 8) * S, OX + (u2 - 18) * S, OY + (v2 - 8) * S]

const GLYPH = [
  unit(18, 8, 31.5, 14), unit(25, 14, 31.5, 50), unit(18, 50, 31.5, 56), // left half
  unit(32.5, 8, 46, 14), unit(32.5, 14, 39, 50), unit(32.5, 50, 46, 56) // right half
]

function inTile(x, y) {
  const { x0, y0, x1, y1, r } = TILE
  if (x < x0 || x > x1 || y < y0 || y > y1) return false
  const cx = x < x0 + r ? x0 + r : x > x1 - r ? x1 - r : x
  const cy = y < y0 + r ? y0 + r : y > y1 - r ? y1 - r : y
  if (cx === x && cy === y) return true
  const dx = x - cx
  const dy = y - cy
  return dx * dx + dy * dy <= r * r
}

const inGlyph = (x, y) => GLYPH.some(([a, b, c, d]) => x >= a && x < c && y >= b && y < d)

const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1))
const step = 1 / SS
const samples = SS * SS

for (let py = 0; py < SIZE; py++) {
  const row = py * (SIZE * 4 + 1)
  raw[row] = 0 // filter: none
  for (let px = 0; px < SIZE; px++) {
    let tile = 0
    let glyph = 0
    for (let sy = 0; sy < SS; sy++) {
      const y = py + (sy + 0.5) * step
      for (let sx = 0; sx < SS; sx++) {
        const x = px + (sx + 0.5) * step
        if (!inTile(x, y)) continue
        tile++
        if (inGlyph(x, y)) glyph++
      }
    }
    const o = row + 1 + px * 4
    if (tile === 0) continue
    const alpha = tile / samples
    const ink = glyph / tile // glyph only ever sits on the tile
    for (let c = 0; c < 3; c++) {
      raw[o + c] = Math.round(TILE.rgb[c] * (1 - ink) + INK[c] * ink)
    }
    raw[o + 3] = Math.round(alpha * 255)
  }
}

const CRC = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return (buf) => {
    let c = -1
    for (let i = 0; i < buf.length; i++) c = t[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
    return (c ^ -1) >>> 0
  }
})()

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(CRC(body))
  return Buffer.concat([len, body, crc])
}

const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(SIZE, 0)
ihdr.writeUInt32BE(SIZE, 4)
ihdr[8] = 8 // bit depth
ihdr[9] = 6 // truecolour with alpha
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0))
])

const out = path.join(__dirname, '..', 'build', 'icon.png')
fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, png)
console.log(`wrote ${out} — ${SIZE}x${SIZE}, glyph ${Math.round(GLYPH_H)}px tall`)
