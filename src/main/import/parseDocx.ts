import { basename } from 'path'
import fse from 'fs-extra'
import mammoth from 'mammoth'
import yauzl from 'yauzl'
import { sanitizeImportedHtml } from '@shared/import/sanitizeImportedHtml'
import { decodeHtmlEntities } from '@shared/import/htmlEntities'
import type { ParsedManuscriptFile } from '@shared/types'

const MAX_DOCX_BYTES = 40 * 1024 * 1024

const MAMMOTH_STYLE_MAP = [
  "p[style-name='Title'] => p:fresh",
  "p[style-name='Subtitle'] => p:fresh"
]

function titleFromFileName(fileName: string): string {
  return fileName
    .replace(/\.docx$/i, '')
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function readZipEntryText(buffer: Buffer, entryName: string): Promise<string | null> {
  return new Promise((resolve) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true }, (err, zipfile) => {
      if (err || !zipfile) {
        resolve(null)
        return
      }
      let settled = false
      const finish = (value: string | null): void => {
        if (settled) return
        settled = true
        try {
          zipfile.close()
        } catch {
          // already closed
        }
        resolve(value)
      }
      zipfile.on('error', () => finish(null))
      zipfile.on('end', () => finish(null))
      zipfile.on('entry', (entry) => {
        if (entry.fileName !== entryName) {
          zipfile.readEntry()
          return
        }
        zipfile.openReadStream(entry, (streamErr, stream) => {
          if (streamErr || !stream) {
            finish(null)
            return
          }
          const chunks: Buffer[] = []
          stream.on('data', (chunk: Buffer) => chunks.push(chunk))
          stream.on('error', () => finish(null))
          stream.on('end', () => finish(Buffer.concat(chunks).toString('utf8')))
        })
      })
      zipfile.readEntry()
    })
  })
}

function textFromCoreXml(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'i'))
  if (!match) return ''
  return decodeHtmlEntities(match[1].trim())
}

async function readDocProperties(buffer: Buffer): Promise<{ title: string; author: string }> {
  try {
    const xml = await readZipEntryText(buffer, 'docProps/core.xml')
    if (!xml) return { title: '', author: '' }
    return {
      title: textFromCoreXml(xml, 'dc:title'),
      author: textFromCoreXml(xml, 'dc:creator')
    }
  } catch {
    return { title: '', author: '' }
  }
}

export async function parseDocxBuffer(
  buffer: Buffer,
  fileName: string
): Promise<ParsedManuscriptFile> {
  const converted = await mammoth.convertToHtml(
    { buffer },
    { styleMap: MAMMOTH_STYLE_MAP }
  )
  const html = sanitizeImportedHtml(converted.value)
  const props = await readDocProperties(buffer)
  const fromFile = titleFromFileName(fileName)

  return {
    html,
    suggestedTitle: props.title || fromFile,
    suggestedAuthor: props.author,
    fileName
  }
}

export async function parseDocxFile(filePath: string): Promise<ParsedManuscriptFile> {
  if (!filePath.toLowerCase().endsWith('.docx')) {
    throw new Error('Choose a Word document (.docx)')
  }
  const stat = await fse.stat(filePath)
  if (stat.size > MAX_DOCX_BYTES) {
    throw new Error('That Word file is too large to import (40 MB limit)')
  }
  const buffer = await fse.readFile(filePath)
  try {
    return await parseDocxBuffer(buffer, basename(filePath))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not read Word file'
    throw new Error(`Could not import this Word file. ${message}`)
  }
}
