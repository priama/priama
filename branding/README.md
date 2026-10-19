# Priama branding

Candidate marks, drawn as single-colour SVG on a 64×64 viewBox. Each uses
`currentColor`, so one file serves both the light and dark interface.

| File | Mark |
| --- | --- |
| `priama-caret-spine.svg` | A text cursor split down the middle that also reads as a book spine — **the mark in use** |
| `priama-app-icon.svg` | The shipped app icon: 1024×1024, vermilion glyph on a light tile, Apple's icon geometry |
| `priama-tile.svg` | The mark reversed out of a squircle, as `currentColor` |
| `priama-serif-p.svg` | Slab-serif `P` monogram |
| `priama-tome-nodes.svg` | Book spine with three linked wiki nodes |
| `priama-folded-page.svg` | A page with a folded corner |
| `priama-text-caret.svg` | A paragraph with the cursor parked after the last line |

The seam between the two halves is 1 unit of 64, so it fuses below about 24px and
the mark reads as a single caret. It only resolves into two halves at large sizes
and in the launch screen animation, where the halves part to uncover the name.

## Regenerating the app icon

`build/icon.png` is what `electron-builder` turns into the `.icns` and `.ico`.
Regenerate it after changing `priama-app-icon.svg`:

```bash
node scripts/makeIcon.cjs
```

That script rasterises the icon directly — the mark is only a rounded rect and
six axis-aligned rectangles — because this machine has no librsvg, ImageMagick
or sharp, and macOS `qlmanage` **flattens transparency to white**, which silently
shipped a square white tile to the Dock. Keep the script and the SVG in step.

The Dock does not mask app icons, so the rounded corners are cut in the artwork
and everything outside them is transparent. Verify with:

```bash
node -e "const z=require('zlib'),f=require('fs');const b=f.readFileSync('build/icon.png');let o=8,d=[];while(o<b.length){const l=b.readUInt32BE(o);if(b.toString('ascii',o+4,o+8)==='IDAT')d.push(b.subarray(o+8,o+8+l));o+=12+l}const r=z.inflateSync(Buffer.concat(d));console.log('corner alpha:',r[2*(1024*4+1)+1+2*4+3])"
```

A corner alpha of `0` means the transparency survived; `255` means it did not.
