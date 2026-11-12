import fse from 'fs-extra'
import { extname } from 'path'
import { BrowserWindow } from 'electron'
import type { BookSettings, ExportOptions, ExportSection } from '@shared/types'
import { buildFrontMatterBlocks } from '@shared/export/frontMatter'
import { marginInches, pdfPageSize } from '@shared/export/formatting'
import { buildManuscriptHtml } from './htmlTemplate'
import { getProjectRootPath } from '../tomes/projectStore'
import { join } from 'path'

async function readCoverDataUri(coverImagePath: string | null): Promise<string | null> {
  if (!coverImagePath) return null
  const root = getProjectRootPath()
  if (!root) return null
  const absolutePath = join(root, coverImagePath)
  if (!(await fse.pathExists(absolutePath))) return null

  const ext = extname(absolutePath).toLowerCase()
  const mime =
    ext === '.png'
      ? 'image/png'
      : ext === '.gif'
        ? 'image/gif'
        : ext === '.webp'
          ? 'image/webp'
          : 'image/jpeg'
  const data = await fse.readFile(absolutePath)
  return `data:${mime};base64,${data.toString('base64')}`
}

export async function exportPdf(
  savePath: string,
  options: ExportOptions,
  sections: ExportSection[],
  bookSettings: BookSettings
): Promise<void> {
  const { title, author, formatting } = options
  const { htmlBlocks: frontMatterHtml } = buildFrontMatterBlocks(bookSettings, { title, author })
  const coverDataUri = await readCoverDataUri(bookSettings.coverImagePath)
  const html = buildManuscriptHtml(title, author, sections, formatting, bookSettings, {
    coverDataUri,
    frontMatterHtml
  })
  const margin = marginInches(formatting.marginPreset)

  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  try {
    const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`
    await win.loadURL(dataUrl)

    const pdf = await win.webContents.printToPDF({
      printBackground: true,
      pageSize: pdfPageSize(formatting.pageSize),
      margins: {
        marginType: 'custom',
        top: margin,
        bottom: margin,
        left: margin,
        right: margin
      }
    })

    await fse.writeFile(savePath, pdf)
  } finally {
    if (!win.isDestroyed()) {
      win.close()
    }
  }
}
