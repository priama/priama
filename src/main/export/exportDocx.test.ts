import { join } from 'path'
import { tmpdir } from 'os'
import fse from 'fs-extra'
import yauzl from 'yauzl'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../config', () => ({
  addRecentProject: vi.fn().mockResolvedValue(undefined),
  setBackupLocations: vi.fn().mockResolvedValue(undefined),
  updateRecentLastOpened: vi.fn().mockResolvedValue(undefined),
  updateRecentTitle: vi.fn().mockResolvedValue(undefined),
  getBackupLocations: vi.fn().mockResolvedValue([]),
  getConfig: vi.fn().mockResolvedValue({ preferences: {}, recentProjects: [] })
}))

import {
  DEFAULT_BOOK_SETTINGS,
  DEFAULT_EXPORT_FORMATTING,
  type BookSettings,
  type ExportFormatting,
  type ExportSection
} from '@shared/types'
import { manuscriptFormatting } from '@shared/export/formatPresets'
import { exportDocx } from './exportDocx'

const sections: ExportSection[] = [
  {
    id: 'c1',
    title: 'Alpha',
    level: 'chapter',
    html: '<p>Body text.</p>',
    displayHeading: 'Chapter 1: Alpha'
  },
  {
    id: 's1',
    title: 'Beta',
    level: 'scene',
    html: '<p>After break.</p>',
    displayHeading: null,
    sceneBreakBefore: true
  }
]

function readZipEntries(buffer: Buffer, wanted: RegExp): Promise<Map<string, string>> {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true }, (err, zipfile) => {
      if (err || !zipfile) {
        reject(err ?? new Error('could not open the docx zip'))
        return
      }
      const out = new Map<string, string>()
      zipfile.on('entry', (entry) => {
        if (!wanted.test(entry.fileName)) {
          zipfile.readEntry()
          return
        }
        zipfile.openReadStream(entry, (streamErr, stream) => {
          if (streamErr || !stream) {
            reject(streamErr ?? new Error(`could not read ${entry.fileName}`))
            return
          }
          const chunks: Buffer[] = []
          stream.on('data', (chunk) => chunks.push(chunk))
          stream.on('end', () => {
            out.set(entry.fileName, Buffer.concat(chunks).toString('utf8'))
            zipfile.readEntry()
          })
        })
      })
      zipfile.on('end', () => resolve(out))
      zipfile.on('error', reject)
      zipfile.readEntry()
    })
  })
}

async function exportToEntries(
  formatting: ExportFormatting,
  bookSettings: BookSettings = DEFAULT_BOOK_SETTINGS
): Promise<Map<string, string>> {
  const dir = await fse.mkdtemp(join(tmpdir(), 'priama-docx-'))
  const savePath = join(dir, 'export.docx')
  try {
    await exportDocx(
      savePath,
      {
        format: 'docx',
        title: 'My Book',
        author: 'Jane Smith',
        scope: 'manuscript',
        formatting
      },
      sections,
      bookSettings
    )
    return readZipEntries(await fse.readFile(savePath), /^word\/(document|header\d+)\.xml$/)
  } finally {
    await fse.remove(dir)
  }
}

function headerXml(entries: Map<string, string>): string | undefined {
  for (const [name, xml] of entries) {
    if (/^word\/header\d+\.xml$/.test(name)) return xml
  }
  return undefined
}

describe('exportDocx', () => {
  it('keeps book defaults: Georgia, the project scene break marker, no page header', async () => {
    const entries = await exportToEntries(DEFAULT_EXPORT_FORMATTING)
    const document = entries.get('word/document.xml')
    expect(document).toBeDefined()
    expect(document).toContain('Georgia')
    expect(document).toContain('* * *')
    expect(document).not.toContain('w:line="480"')
    expect(headerXml(entries)).toBeUndefined()
  })

  it('writes standard manuscript format: Times New Roman 12, double-spaced, 1-inch margins', async () => {
    const entries = await exportToEntries(manuscriptFormatting('My Book', 'Jane Smith'))
    const document = entries.get('word/document.xml')
    expect(document).toBeDefined()
    expect(document).toContain('Times New Roman')
    expect(document).toContain('w:sz w:val="24"')
    expect(document).toContain('w:line="480"')
    expect(document).toContain('w:lineRule="auto"')
    expect(document).toContain('w:top="1440"')
    expect(document).toContain('>#</w:t>')
    expect(document).not.toContain('* * *')
  })

  it('puts the author, title and a live page number field in the header', async () => {
    const entries = await exportToEntries(manuscriptFormatting('My Book', 'Jane Smith'))
    const header = headerXml(entries)
    expect(header).toBeDefined()
    expect(header).toContain('Jane Smith / MY BOOK / ')
    expect(header).toContain('PAGE')
    expect(header).toContain('Times New Roman')
  })

  it('leaves the project book settings untouched', async () => {
    const bookSettings: BookSettings = { ...DEFAULT_BOOK_SETTINGS }
    await exportToEntries(manuscriptFormatting('My Book', 'Jane Smith'), bookSettings)
    expect(bookSettings.sceneBreakMarker).toBe('* * *')
    expect(bookSettings.paragraphStyle).toBe('first-line-indent')
    expect(bookSettings.textAlign).toBe('justify')
  })
})
