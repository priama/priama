import { BrowserWindow, screen } from 'electron'
import { join } from 'path'
import type { DevicePreviewRequestOptions, WindowBounds, WindowLayoutState } from '@shared/types'

type ChildWindowKind = 'workspace' | 'imageViewer' | 'devicePreview'

interface ChildWindowRecord {
  window: BrowserWindow
  kind: ChildWindowKind
  nodeId?: string
  imagePath?: string
  ownerWindowId: number
}

const children = new Map<string, ChildWindowRecord>()
let mainWindowRef: BrowserWindow | null = null

export function setMainWindow(win: BrowserWindow): void {
  mainWindowRef = win
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindowRef
}

function themeBackground(theme: 'light' | 'dark'): string {
  return theme === 'dark' ? '#1a1a1a' : '#fafafa'
}

function loadUrl(win: BrowserWindow, hash: string): void {
  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#${hash}`)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), { hash })
  }
}

function defaultBounds(width: number, height: number): WindowBounds {
  const display = screen.getPrimaryDisplay().workArea
  return {
    x: display.x + 40,
    y: display.y + 40,
    width,
    height
  }
}

export function broadcast(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, payload)
    }
  }
}

export function openDocumentWindow(
  nodeId: string,
  title: string,
  theme: 'light' | 'dark',
  bounds?: WindowBounds
): BrowserWindow {
  const existing = [...children.entries()].find(
    ([, r]) => r.kind === 'workspace' && r.nodeId === nodeId
  )
  if (existing) {
    existing[1].window.focus()
    return existing[1].window
  }

  const b = bounds ?? defaultBounds(1400, 900)
  const win = new BrowserWindow({
    x: b.x,
    y: b.y,
    width: b.width,
    height: b.height,
    minWidth: 900,
    minHeight: 600,
    title: `Priama — ${title}`,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    show: false,
    backgroundColor: themeBackground(theme),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  const id = win.id.toString()
  children.set(id, { window: win, kind: 'workspace', nodeId, ownerWindowId: win.id })

  win.once('ready-to-show', () => win.show())

  win.on('closed', () => {
    children.delete(id)
    saveSecondaryWindowState()
  })

  loadUrl(win, `child=workspace&nodeId=${encodeURIComponent(nodeId)}`)
  return win
}

export function openImageViewerWindow(
  imagePath: string,
  title: string,
  theme: 'light' | 'dark'
): BrowserWindow {
  const existing = [...children.entries()].find(
    ([, r]) => r.kind === 'imageViewer' && r.imagePath === imagePath
  )
  if (existing) {
    existing[1].window.setTitle(title)
    existing[1].window.focus()
    return existing[1].window
  }

  const b = defaultBounds(720, 480)
  const win = new BrowserWindow({
    x: b.x,
    y: b.y,
    width: b.width,
    height: b.height,
    minWidth: 320,
    minHeight: 240,
    title,
    show: false,
    backgroundColor: themeBackground(theme),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  const id = win.id.toString()
  children.set(id, {
    window: win,
    kind: 'imageViewer',
    imagePath,
    ownerWindowId: win.id
  })

  win.once('ready-to-show', () => win.show())

  win.on('closed', () => {
    children.delete(id)
  })

  const hash = `child=imageViewer&imagePath=${encodeURIComponent(imagePath)}&title=${encodeURIComponent(title)}`
  loadUrl(win, hash)
  return win
}

export function openDevicePreviewWindow(
  options: DevicePreviewRequestOptions,
  theme: 'light' | 'dark'
): BrowserWindow {
  const b = defaultBounds(1100, 820)
  const win = new BrowserWindow({
    x: b.x,
    y: b.y,
    width: b.width,
    height: b.height,
    minWidth: 640,
    minHeight: 480,
    title: 'Device Preview',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    show: false,
    backgroundColor: themeBackground(theme),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  const id = win.id.toString()
  children.set(id, { window: win, kind: 'devicePreview', ownerWindowId: win.id })

  win.once('ready-to-show', () => win.show())

  win.on('closed', () => {
    children.delete(id)
  })

  const params = new URLSearchParams({ child: 'devicePreview', scope: options.scope })
  if (options.nodeId) {
    params.set('nodeId', options.nodeId)
  }
  loadUrl(win, params.toString())
  return win
}

export function saveSecondaryWindowState(): WindowLayoutState['secondaryWindows'] {
  const secondary: WindowLayoutState['secondaryWindows'] = []
  for (const [, record] of children) {
    if (record.kind === 'workspace' && record.nodeId && !record.window.isDestroyed()) {
      const b = record.window.getBounds()
      secondary.push({
        nodeId: record.nodeId,
        bounds: { x: b.x, y: b.y, width: b.width, height: b.height }
      })
    }
  }
  return secondary
}

export function closeAllChildren(): void {
  for (const [, record] of children) {
    if (!record.window.isDestroyed()) record.window.close()
  }
  children.clear()
}
