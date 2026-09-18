import { useEffect, useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/UI/dialog'
import { Button } from '@/components/UI/button'
import { Input } from '@/components/UI/input'
import { Label } from '@/components/UI/label'
import { ScrollArea } from '@/components/UI/scroll-area'
import { useAppStore } from '@/store/appStore'
import { useExport } from '@/hooks/useExport'
import { listManuscriptChapters, resolveChapterId } from '@shared/export/manuscript'
import { DEFAULT_EXPORT_FORMATTING, type ExportOptions } from '@shared/types'
import { cn } from '@/lib/utils'

interface ExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const FORMATS: { id: ExportOptions['format']; label: string }[] = [
  { id: 'docx', label: 'DOCX' },
  { id: 'epub', label: 'EPUB' },
  { id: 'pdf', label: 'PDF' }
]

function FieldRow({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}

export function ExportDialog({ open, onOpenChange }: ExportDialogProps): React.JSX.Element {
  const projectMeta = useAppStore((s) => s.projectMeta)
  const nodes = useAppStore((s) => s.nodes)
  const selectedNodeId = useAppStore((s) => s.selectedNodeId)
  const { runExport, exporting } = useExport()

  const chapters = useMemo(() => listManuscriptChapters(nodes), [nodes])
  const defaultChapterId = useMemo(
    () => resolveChapterId(nodes, selectedNodeId) ?? chapters[0]?.id ?? null,
    [nodes, selectedNodeId, chapters]
  )

  const [format, setFormat] = useState<ExportOptions['format']>('docx')
  const [scope, setScope] = useState<ExportOptions['scope']>('manuscript')
  const [selectedChapterIds, setSelectedChapterIds] = useState<string[]>([])
  const [title, setTitle] = useState(projectMeta?.title ?? '')
  const [author, setAuthor] = useState(projectMeta?.author ?? '')
  const [genre, setGenre] = useState(projectMeta?.genre ?? '')

  useEffect(() => {
    if (!open) return
    setTitle(projectMeta?.title ?? '')
    setAuthor(projectMeta?.author ?? '')
    setGenre(projectMeta?.genre ?? '')
    setSelectedChapterIds(defaultChapterId ? [defaultChapterId] : [])
  }, [open, projectMeta, defaultChapterId])

  const hasChapters = chapters.length > 0
  const canExport =
    scope === 'manuscript' || (scope === 'chapters' && selectedChapterIds.length > 0)

  const toggleChapter = (id: string): void => {
    setSelectedChapterIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    )
  }

  const selectAllChapters = (): void => {
    setSelectedChapterIds(chapters.map((c) => c.id))
  }

  const clearChapters = (): void => {
    setSelectedChapterIds([])
  }

  const handleExport = async (): Promise<void> => {
    if (!canExport) return

    const options: ExportOptions = {
      format,
      title: title.trim() || projectMeta?.title || 'Untitled',
      author: author.trim(),
      genre: genre.trim() || undefined,
      scope,
      chapterIds: scope === 'chapters' ? selectedChapterIds : undefined,
      formatting: DEFAULT_EXPORT_FORMATTING
    }

    const ok = await runExport(options)
    if (ok) onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="no-drag sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Export Manuscript</DialogTitle>
          <DialogDescription>Export your manuscript as DOCX, EPUB, or PDF.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-1">
          <FieldRow label="Format">
            <div className="flex gap-2">
              {FORMATS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFormat(f.id)}
                  className={cn(
                    'no-drag flex-1 rounded-md border px-3 py-2 text-sm transition-colors',
                    format === f.id
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border hover:bg-accent/50'
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </FieldRow>

          <FieldRow label="Scope">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setScope('manuscript')}
                className={cn(
                  'no-drag flex-1 rounded-md border px-3 py-2 text-sm transition-colors',
                  scope === 'manuscript'
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:bg-accent/50'
                )}
              >
                Full manuscript
              </button>
              <button
                type="button"
                onClick={() => hasChapters && setScope('chapters')}
                disabled={!hasChapters}
                className={cn(
                  'no-drag flex-1 rounded-md border px-3 py-2 text-sm transition-colors disabled:opacity-50',
                  scope === 'chapters'
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:bg-accent/50'
                )}
              >
                Chapters
              </button>
            </div>
          </FieldRow>

          {scope === 'chapters' && (
            <FieldRow label="Select chapters">
              {!hasChapters ? (
                <p className="text-sm text-muted-foreground">No chapters available to export.</p>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="no-drag h-7 text-xs"
                      onClick={selectAllChapters}
                    >
                      Select all
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="no-drag h-7 text-xs"
                      onClick={clearChapters}
                    >
                      Clear
                    </Button>
                  </div>
                  <ScrollArea className="h-40 rounded-md border border-border">
                    <div className="p-2 space-y-1">
                      {chapters.map((chapter) => {
                        const checked = selectedChapterIds.includes(chapter.id)
                        return (
                          <label
                            key={chapter.id}
                            className={cn(
                              'no-drag flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent/50',
                              checked && 'bg-accent/30'
                            )}
                          >
                            <input
                              type="checkbox"
                              className="mt-0.5"
                              checked={checked}
                              onChange={() => toggleChapter(chapter.id)}
                            />
                            <span className="leading-snug">{chapter.pathLabel}</span>
                          </label>
                        )
                      })}
                    </div>
                  </ScrollArea>
                  <p className="text-xs text-muted-foreground">
                    {selectedChapterIds.length} of {chapters.length} selected
                  </p>
                </div>
              )}
            </FieldRow>
          )}

          <div className="grid grid-cols-2 gap-3">
            <FieldRow label="Title">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </FieldRow>
            <FieldRow label="Author">
              <Input value={author} onChange={(e) => setAuthor(e.target.value)} />
            </FieldRow>
          </div>

          <FieldRow label="Genre">
            <Input value={genre} onChange={(e) => setGenre(e.target.value)} placeholder="Fantasy, Romance…" />
          </FieldRow>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={exporting}>
            Cancel
          </Button>
          <Button onClick={() => void handleExport()} disabled={exporting || !canExport}>
            {exporting ? 'Exporting…' : 'Export'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
