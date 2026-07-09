import { dialog, BrowserWindow, app } from 'electron'
import { homedir } from 'os'
import { join } from 'path'

const TOMES_FILTER = {
  name: 'Priama Project',
  extensions: ['tomes']
}

const IMAGE_FILTER = {
  name: 'Images',
  extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp']
}

export async function showOpenTomesDialog(window: BrowserWindow): Promise<string | null> {
  const result = await dialog.showOpenDialog(window, {
    title: 'Open Priama Project',
    filters: [TOMES_FILTER],
    properties: ['openFile']
  })

  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths[0]
}

export async function showChooseFolderDialog(
  window: BrowserWindow,
  title = 'Choose Folder'
): Promise<string | null> {
  const parent = BrowserWindow.getFocusedWindow() ?? window
  parent.focus()
  app.focus({ steal: true })

  const result = await dialog.showOpenDialog(parent, {
    title,
    defaultPath: join(homedir(), 'Documents'),
    properties: ['openDirectory', 'createDirectory'],
    buttonLabel: 'Select Folder'
  })

  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths[0]
}

export async function showSelectImageDialog(window: BrowserWindow): Promise<string | null> {
  const result = await dialog.showOpenDialog(window, {
    title: 'Select Image',
    filters: [IMAGE_FILTER],
    properties: ['openFile']
  })

  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths[0]
}

const EXPORT_FILTERS: Record<'docx' | 'pdf' | 'epub', { name: string; extensions: string[] }> = {
  docx: { name: 'Word Document', extensions: ['docx'] },
  pdf: { name: 'PDF Document', extensions: ['pdf'] },
  epub: { name: 'EPUB Ebook', extensions: ['epub'] }
}

function sanitizeFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '').trim() || 'export'
}

export async function showSaveExportDialog(
  window: BrowserWindow,
  format: 'docx' | 'pdf' | 'epub',
  title: string
): Promise<string | null> {
  const parent = BrowserWindow.getFocusedWindow() ?? window
  parent.focus()

  const filter = EXPORT_FILTERS[format]
  const result = await dialog.showSaveDialog(parent, {
    title: 'Export Manuscript',
    defaultPath: join(homedir(), 'Documents', `${sanitizeFilename(title)}.${filter.extensions[0]}`),
    filters: [filter],
    properties: ['createDirectory', 'showOverwriteConfirmation']
  })

  if (result.canceled || !result.filePath) return null

  let filePath = result.filePath
  const ext = `.${filter.extensions[0]}`
  if (!filePath.toLowerCase().endsWith(ext)) {
    filePath += ext
  }
  return filePath
}
