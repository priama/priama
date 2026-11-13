import { join, resolve } from 'path'
import fse from 'fs-extra'
import yauzl from 'yauzl'
import { sanitizeImportedHtml } from '@shared/import/sanitizeImportedHtml'
import type { ParsedScrivenerProject, ScrivenerImportRow } from '@shared/types'
import { parseScrivx, ScrivenerFormatError, type ScrivenerBinderItem } from './scrivx'
import { rtfToHtml } from './rtfToHtml'

/**
 * Entry point for .scriv imports. A Scrivener project is a directory bundle
 * (or a .zip of one, from "Zip & Send"); the prose lives in one RTF file per
 * binder document under Files/Data/, and the structure + synopses live in
 * project.scrivx.
 */

const SCRIVX_PATH = 'project.scrivx'
const DATA_DIR = 'Files/Data'
const MAX_ZIP_RTF_BYTES = 200 * 1024 * 1024

interface ScrivenerSource {
  read(relPath: string): Promise<string | null>
  cleanup(): Promise<void>
}

async function dirSource(root: string): Promise<ScrivenerSource> {
  return {
    async read(relPath) {
      try {
        return await fse.readFile(join(root, relPath), 'utf8')
      } catch {
        return null
      }
    },
    async cleanup() {}
  }
}

function readZipStream(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((res, rej) => {
    const chunks: Buffer[] = []
    stream.on('data', (c: Buffer) => chunks.push(c))
    stream.on('error', rej)
    stream.on('end', () => res(Buffer.concat(chunks)))
  })
}

/**
 * Read the zip into memory, keeping only the manuscript RTFs and the scrivx —
 * research media can be hundreds of MB and is never touched.
 */
async function zipSource(zipPath: string): Promise<ScrivenerSource> {
  const files = new Map<string, string>()

  await new Promise<void>((res, rej) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
      if (err || !zipfile) {
        rej(new Error('Could not open the zipped project'))
        return
      }
      let totalBytes = 0
      zipfile.on('error', rej)
      zipfile.on('end', () => res())
      zipfile.on('entry', (entry) => {
        const name = entry.fileName.replace(/\\/g, '/')
        // Scrivener's "Zip & Send" nests everything under a *.scriv/ root.
        const stripped = name.replace(/^[^/]+\.scriv\//i, '')
        const wanted = [name, stripped].some(
          (n) =>
            n === SCRIVX_PATH ||
            (n.startsWith(`${DATA_DIR}/`) && n.toLowerCase().endsWith('.rtf'))
        )
        if (!wanted || /\/$/.test(name)) {
          zipfile.readEntry()
          return
        }
        totalBytes += entry.uncompressedSize
        if (totalBytes > MAX_ZIP_RTF_BYTES) {
          zipfile.close()
          rej(new Error('This Scrivener project is too large to import'))
          return
        }
        zipfile.openReadStream(entry, async (streamErr, stream) => {
          if (streamErr || !stream) {
            zipfile.readEntry()
            return
          }
          try {
            const text = (await readZipStream(stream)).toString('utf8')
            files.set(name, text)
            if (stripped !== name) files.set(stripped, text)
          } catch {
            // A single unreadable document should not sink the import.
          }
          zipfile.readEntry()
        })
      })
      zipfile.readEntry()
    })
  })

  return {
    async read(relPath) {
      return files.get(relPath.replace(/\\/g, '/')) ?? null
    },
    async cleanup() {
      files.clear()
    }
  }
}

function rtfCandidates(item: ScrivenerBinderItem): string[] {
  const candidates: string[] = []
  if (item.uuid) {
    candidates.push(
      `${DATA_DIR}/${item.uuid}.rtf`,
      `${DATA_DIR}/${item.uuid.toUpperCase()}.rtf`,
      `${DATA_DIR}/${item.uuid.toLowerCase()}.rtf`
    )
  }
  if (item.id) candidates.push(`${DATA_DIR}/${item.id}.rtf`)
  return candidates
}

async function readDocumentHtml(
  source: ScrivenerSource,
  item: ScrivenerBinderItem
): Promise<string> {
  for (const candidate of rtfCandidates(item)) {
    const rtf = await source.read(candidate)
    if (rtf === null) continue
    const { html } = rtfToHtml(rtf)
    return sanitizeImportedHtml(html)
  }
  // Documents that were never edited have no RTF on disk; they import empty.
  return ''
}

interface WalkStats {
  folders: number
  documents: number
  compileExcluded: number
}

async function walkBinder(
  source: ScrivenerSource,
  items: ScrivenerBinderItem[],
  depth: number,
  parentIncluded: boolean,
  rows: ScrivenerImportRow[],
  stats: WalkStats
): Promise<void> {
  for (const item of items) {
    // PDFs, images and other non-prose binder items are out of scope for v1.
    if (item.kind === 'other') continue

    const includeInCompile = parentIncluded && item.includeInCompile
    if (!includeInCompile) stats.compileExcluded += 1

    const title = item.title.trim() || 'Untitled'
    const html = await readDocumentHtml(source, item)

    if (item.kind === 'folder') {
      stats.folders += 1
      rows.push({ id: item.id, title, kind: 'folder', depth, html, synopsis: item.synopsis, includeInCompile })
      await walkBinder(source, item.children, depth + 1, includeInCompile, rows, stats)
    } else {
      stats.documents += 1
      rows.push({ id: item.id, title, kind: 'document', depth, html, synopsis: item.synopsis, includeInCompile })
    }
  }
}

export async function parseScrivenerPath(sourcePath: string): Promise<ParsedScrivenerProject> {
  const stat = await fse.stat(sourcePath).catch(() => null)
  if (!stat) throw new Error('Could not find that Scrivener project')

  let source: ScrivenerSource
  if (stat.isDirectory()) {
    source = await dirSource(resolve(sourcePath))
  } else if (sourcePath.toLowerCase().endsWith('.zip')) {
    source = await zipSource(sourcePath)
  } else {
    throw new Error('Choose a Scrivener project (.scriv) or a zipped project (.zip)')
  }

  try {
    const scrivxXml = await source.read(SCRIVX_PATH)
    if (!scrivxXml) {
      throw new ScrivenerFormatError('No project.scrivx found — not a Scrivener project')
    }

    const info = parseScrivx(scrivxXml)

    const rows: ScrivenerImportRow[] = []
    const stats: WalkStats = { folders: 0, documents: 0, compileExcluded: 0 }
    await walkBinder(source, info.draftItems, 0, true, rows, stats)

    if (rows.length === 0) {
      throw new ScrivenerFormatError('The Draft folder is empty — nothing to import')
    }

    const fileName = sourcePath.replace(/\\/g, '/').split('/').filter(Boolean).pop() ?? 'project'

    return {
      fileName: fileName.replace(/\.scrivx?$|\.zip$/i, '') || fileName,
      suggestedTitle: info.title || fileName.replace(/\.scriv$|\.zip$/i, ''),
      suggestedAuthor: info.author,
      rows,
      stats: {
        folders: stats.folders,
        documents: stats.documents,
        researchSkipped: info.researchCount,
        compileExcluded: stats.compileExcluded
      }
    }
  } finally {
    await source.cleanup()
  }
}
