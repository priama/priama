import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ePub from 'epubjs'
import type { Book, Rendition } from 'epubjs'
import { Button } from '@/components/UI/button'
import { Label } from '@/components/UI/label'
import { ScopeSelector } from '@/components/ScopeSelector'
import { useThemeSync } from '@/hooks/useThemeSync'
import { listManuscriptChapters } from '@shared/export/manuscript'
import {
  DEVICE_PRESETS,
  LARGEST_DEVICE_PRESET,
  type BookSettings,
  type DevicePresetId,
  type DevicePreviewRequestOptions
} from '@shared/types'
import { cn } from '@/lib/utils'
import { TITLEBAR_BUTTONS_INSET } from '@shared/windowChrome'
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'

const DEFAULT_FONT_SIZE = 100
const MAX_FRAME_HEIGHT_RATIO = 0.88
const MIN_FRAME_HEIGHT_RATIO = 0.72

function scaleDimensions(
  widthPx: number,
  heightPx: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  const refScale = Math.min(
    maxWidth / LARGEST_DEVICE_PRESET.widthPx,
    maxHeight / LARGEST_DEVICE_PRESET.heightPx,
    1
  )

  let width = widthPx * refScale
  let height = heightPx * refScale

  const heightFloor = maxHeight * MIN_FRAME_HEIGHT_RATIO
  if (height < heightFloor) {
    const boost = heightFloor / height
    width *= boost
    height = heightFloor
  }

  if (width > maxWidth) {
    const shrink = maxWidth / width
    width = maxWidth
    height *= shrink
  }

  return {
    width: Math.round(width),
    height: Math.round(height)
  }
}

function applyFontSize(rendition: Rendition, percent: number): void {
  rendition.themes.fontSize(`${percent}%`)
}

async function navigateAfterLoad(
  rendition: Rendition,
  book: Book,
  scope: DevicePreviewRequestOptions['scope']
): Promise<void> {
  if (scope === 'manuscript') {
    await rendition.display()
    return
  }

  const navigation = await book.loaded.navigation
  const chapterEntry = navigation.toc[0]
  if (chapterEntry?.href) {
    await rendition.display(chapterEntry.href)
  } else {
    await rendition.display()
  }
}

export function DevicePreviewWindow(): React.JSX.Element {
  useThemeSync()

  const [scope, setScope] = useState<DevicePreviewRequestOptions['scope']>('manuscript')
  const [nodeId, setNodeId] = useState<string | null>(null)
  const [chapters, setChapters] = useState(() => [] as ReturnType<typeof listManuscriptChapters>)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [bookTitle, setBookTitle] = useState('')

  const [deviceId, setDeviceId] = useState<DevicePresetId>('pocketbook-era')
  const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE)

  const containerRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const bookRef = useRef<Book | null>(null)
  const renditionRef = useRef<Rendition | null>(null)
  const epubRef = useRef<ArrayBuffer | null>(null)
  const fetchIdRef = useRef(0)
  const fontSizeRef = useRef(fontSize)
  const lastBookSettingsKeyRef = useRef<string | null>(null)
  fontSizeRef.current = fontSize

  const referenceSize = useMemo(() => {
    const preset = DEVICE_PRESETS.find((p) => p.id === deviceId) ?? DEVICE_PRESETS[0]
    return { widthPx: preset.widthPx, heightPx: preset.heightPx }
  }, [deviceId])

  const [frameSize, setFrameSize] = useState({ width: 320, height: 480 })
  const frameSizeRef = useRef(frameSize)
  frameSizeRef.current = frameSize

  useEffect(() => {
    void window.electronAPI.tree.getAll().then((nodes) => {
      const listed = listManuscriptChapters(nodes)
      setChapters(listed)
      if (scope === 'chapter' && !nodeId && listed[0]) {
        setNodeId(listed[0].id)
      }
    })
  }, [scope, nodeId])

  const updateFrameSize = useCallback(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const maxWidth = viewport.clientWidth - 48
    const maxHeight = viewport.clientHeight * MAX_FRAME_HEIGHT_RATIO
    setFrameSize(scaleDimensions(referenceSize.widthPx, referenceSize.heightPx, maxWidth, maxHeight))
  }, [referenceSize])

  useEffect(() => {
    updateFrameSize()
    window.addEventListener('resize', updateFrameSize)
    return () => window.removeEventListener('resize', updateFrameSize)
  }, [updateFrameSize])

  const destroyRendition = useCallback(() => {
    renditionRef.current?.destroy()
    renditionRef.current = null
    bookRef.current?.destroy()
    bookRef.current = null
  }, [])

  const renderEpub = useCallback(
    async (buffer: ArrayBuffer, loadScope: DevicePreviewRequestOptions['scope']) => {
      destroyRendition()
      epubRef.current = buffer

      const container = containerRef.current
      if (!container) return

      container.innerHTML = ''

      const { width, height } = frameSizeRef.current
      const book = ePub(buffer)
      bookRef.current = book
      await book.ready

      const rendition = book.renderTo(container, {
        width,
        height,
        spread: 'none',
        flow: 'paginated'
      })
      renditionRef.current = rendition
      await navigateAfterLoad(rendition, book, loadScope)
      applyFontSize(rendition, fontSizeRef.current)
    },
    [destroyRendition]
  )

  const fetchEpub = useCallback(
    async (options: DevicePreviewRequestOptions) => {
      const fetchId = ++fetchIdRef.current
      setLoading(true)
      setError(null)

      try {
        const response = await window.electronAPI.devicePreview.getEpub(options)
        if (fetchId !== fetchIdRef.current) return

        setBookTitle(response.title)
        await renderEpub(response.epub, options.scope)
      } catch (err) {
        if (fetchId !== fetchIdRef.current) return
        setError(err instanceof Error ? err.message : 'Failed to generate preview')
        destroyRendition()
      } finally {
        if (fetchId === fetchIdRef.current) {
          setLoading(false)
        }
      }
    },
    [destroyRendition, renderEpub]
  )

  useEffect(() => {
    const options: DevicePreviewRequestOptions =
      scope === 'chapter' && nodeId ? { scope: 'chapter', nodeId } : { scope: 'manuscript' }
    void fetchEpub(options)
  }, [scope, nodeId, fetchEpub])

  useEffect(() => {
    const unsub = window.electronAPI.on('sync:state', (data: unknown) => {
      const state = data as { meta: { bookSettings?: BookSettings } | null }
      if (!state.meta) return

      const key = JSON.stringify(state.meta.bookSettings ?? {})
      if (key === lastBookSettingsKeyRef.current) return
      lastBookSettingsKeyRef.current = key

      const options: DevicePreviewRequestOptions =
        scope === 'chapter' && nodeId ? { scope: 'chapter', nodeId } : { scope: 'manuscript' }
      void fetchEpub(options)
    })
    return unsub
  }, [scope, nodeId, fetchEpub])

  useEffect(() => {
    if (!renditionRef.current || loading) return
    renditionRef.current.resize(frameSize.width, frameSize.height)
    applyFontSize(renditionRef.current, fontSizeRef.current)
  }, [frameSize, loading])

  useEffect(() => {
    if (!renditionRef.current) return
    applyFontSize(renditionRef.current, fontSize)
  }, [fontSize])

  useEffect(() => () => destroyRendition(), [destroyRendition])

  const handleRefresh = (): void => {
    const options: DevicePreviewRequestOptions =
      scope === 'chapter' && nodeId ? { scope: 'chapter', nodeId } : { scope: 'manuscript' }
    void fetchEpub(options)
  }

  const handleScopeChange = (nextScope: DevicePreviewRequestOptions['scope']): void => {
    setScope(nextScope)
    if (nextScope === 'chapter' && !nodeId && chapters[0]) {
      setNodeId(chapters[0].id)
    }
  }

  const isMac = typeof navigator !== 'undefined' && navigator.userAgent.includes('Mac')

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header
        className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border px-4 py-2 drag-region"
        style={isMac ? { paddingLeft: TITLEBAR_BUTTONS_INSET } : undefined}
      >
        <ScopeSelector
          className="no-drag"
          scope={scope}
          nodeId={nodeId}
          chapters={chapters}
          onScopeChange={handleScopeChange}
          onNodeIdChange={setNodeId}
        />

        <div className="no-drag flex items-center gap-2">
          <Label htmlFor="device-select" className="text-xs text-muted-foreground">
            Device
          </Label>
          <select
            id="device-select"
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value as DevicePresetId)}
            className="h-7 rounded-md border border-border bg-background px-2 text-xs"
          >
            {DEVICE_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label}
              </option>
            ))}
          </select>
        </div>

        <div className="no-drag flex items-center gap-2">
          <Label htmlFor="font-size" className="text-xs text-muted-foreground">
            Font
          </Label>
          <input
            id="font-size"
            type="range"
            min={70}
            max={150}
            value={fontSize}
            onChange={(e) => setFontSize(Number(e.target.value))}
            className="w-24"
          />
          <span className="w-8 text-xs text-muted-foreground">{fontSize}%</span>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="no-drag ml-auto h-7 gap-1 text-xs"
          onClick={handleRefresh}
          disabled={loading}
        >
          <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
          Refresh
        </Button>
      </header>

      <div ref={viewportRef} className="relative flex flex-1 flex-col items-center justify-center overflow-auto p-6">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80">
            <p className="text-sm text-muted-foreground">Generating EPUB preview…</p>
          </div>
        )}

        {error && !loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <div className="flex flex-col items-center gap-2">
          {bookTitle && (
            <p className="max-w-md truncate text-center text-xs font-medium text-muted-foreground">
              {bookTitle}
            </p>
          )}
          <div
            className="relative rounded-lg border-4 border-muted-foreground/30 bg-white shadow-lg"
            style={{ width: frameSize.width + 16, padding: 8 }}
          >
            <div
              ref={containerRef}
              className="overflow-hidden bg-white"
              style={{ width: frameSize.width, height: frameSize.height }}
            />
          </div>
        </div>

        {!loading && !error && (
          <div className="no-drag absolute bottom-4 flex gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => void renditionRef.current?.prev()}
              title="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => void renditionRef.current?.next()}
              title="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
