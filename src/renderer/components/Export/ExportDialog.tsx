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
import { ScrollArea } from '@/components/UI/scroll-area'
import { useAppStore } from '@/store/appStore'
import { useExport } from '@/hooks/useExport'
import { countNodeWords, isChapterFolder } from '@/lib/treeUtils'
import { scenesChapterStats } from '@shared/manuscriptMeta'
import { listManuscriptChapters, resolveChapterId } from '@shared/export/manuscript'
import { DEFAULT_EXPORT_FORMATTING, type ExportOptions } from '@shared/types'
import type { TreeNode } from '@shared/types'
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

/** Uppercase section label, matching the other grouped-row surfaces. */
function SectionLabel({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </span>
  )
}

function Segmented({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <div className="flex gap-0.5 rounded-lg bg-muted p-0.5">{children}</div>
}

function SegmentedButton({
  selected,
  disabled,
  onClick,
  children
}: {
  selected: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'no-drag flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50',
        selected
          ? 'bg-background text-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground'
      )}
    >
      {children}
    </button>
  )
}

/** Label on the left, value on the right, inside one bordered card. */
function DetailRow({
  id,
  label,
  value,
  placeholder,
  onChange
}: {
  id: string
  label: string
  value: string
  placeholder?: string
  onChange: (value: string) => void
}): React.JSX.Element {
  return (
    <div className="flex min-w-0 items-center gap-3 px-3 py-2">
      <label htmlFor={id} className="w-16 shrink-0 text-sm">
        {label}
      </label>
      <input
        id={id}
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="no-drag min-w-0 flex-1 border-0 bg-transparent p-0 text-right text-sm outline-none placeholder:text-muted-foreground/70"
      />
    </div>
  )
}

/** Words in a chapter: its own text, or the sum of its scenes. */
function chapterWordCount(nodes: TreeNode[], chapterId: string): number {
  const chapter = nodes.find((n) => n.id === chapterId)
  if (!chapter) return 0
  return isChapterFolder(chapter)
    ? scenesChapterStats(chapter, nodes).wordCount
    : countNodeWords(chapter)
}

/** "Part Two / Chapter 5" minus the chapter's own title — the folder path, or ''. */
function folderPathOf(pathLabel: string, title: string): string {
  if (!pathLabel.endsWith(title)) return ''
  return pathLabel.slice(0, pathLabel.length - title.length).replace(/\s*\/\s*$/, '')
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

  const rows = useMemo(
    () =>
      chapters.map((chapter) => ({
        id: chapter.id,
        title: chapter.title,
        folderPath: folderPathOf(chapter.pathLabel, chapter.title),
        words: chapterWordCount(nodes, chapter.id)
      })),
    [chapters, nodes]
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
      <DialogContent className="no-drag sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Export Manuscript</DialogTitle>
          <DialogDescription>Choose a format and what to include.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-1">
          <div className="grid gap-2">
            <SectionLabel>Format</SectionLabel>
            <Segmented>
              {FORMATS.map((f) => (
                <SegmentedButton
                  key={f.id}
                  selected={format === f.id}
                  onClick={() => setFormat(f.id)}
                >
                  {f.label}
                </SegmentedButton>
              ))}
            </Segmented>
          </div>

          <div className="grid gap-2">
            <SectionLabel>Include</SectionLabel>
            <Segmented>
              <SegmentedButton
                selected={scope === 'manuscript'}
                onClick={() => setScope('manuscript')}
              >
                Whole manuscript
              </SegmentedButton>
              <SegmentedButton
                selected={scope === 'chapters'}
                disabled={!hasChapters}
                onClick={() => hasChapters && setScope('chapters')}
              >
                Selected chapters
              </SegmentedButton>
            </Segmented>
          </div>

          {scope === 'chapters' && (
            <div className="grid gap-2">
              {!hasChapters ? (
                <>
                  <SectionLabel>Chapters</SectionLabel>
                  <p className="text-sm text-muted-foreground">No chapters available to export.</p>
                </>
              ) : (
                <>
                  <div className="flex items-baseline justify-between gap-3">
                    <SectionLabel>Chapters</SectionLabel>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="no-drag h-6 px-2 text-xs"
                        onClick={selectAllChapters}
                      >
                        Select all
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="no-drag h-6 px-2 text-xs"
                        onClick={clearChapters}
                      >
                        Clear
                      </Button>
                    </div>
                  </div>

                  <ScrollArea className="h-48 rounded-lg border border-border">
                    <div className="p-1">
                      {rows.map((row) => {
                        const checked = selectedChapterIds.includes(row.id)
                        return (
                          <label
                            key={row.id}
                            className={cn(
                              'no-drag flex min-w-0 cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-accent/50',
                              checked && 'bg-accent/30'
                            )}
                          >
                            <input
                              type="checkbox"
                              className="shrink-0"
                              checked={checked}
                              onChange={() => toggleChapter(row.id)}
                            />
                            <span className="flex min-w-0 flex-1 flex-col">
                              <span className="truncate text-sm leading-snug">{row.title}</span>
                              {row.folderPath && (
                                <span className="truncate text-xs text-muted-foreground">
                                  {row.folderPath}
                                </span>
                              )}
                            </span>
                            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                              {row.words.toLocaleString()} {row.words === 1 ? 'word' : 'words'}
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  </ScrollArea>

                  <span className="text-xs tabular-nums text-muted-foreground">
                    {selectedChapterIds.length} of {chapters.length} selected
                  </span>
                </>
              )}
            </div>
          )}

          <div className="grid gap-2">
            <SectionLabel>Book details</SectionLabel>
            <div className="overflow-hidden rounded-lg border border-border">
              <DetailRow id="export-title" label="Title" value={title} onChange={setTitle} />
              <div className="ml-3 h-px bg-border" />
              <DetailRow id="export-author" label="Author" value={author} onChange={setAuthor} />
              <div className="ml-3 h-px bg-border" />
              <DetailRow
                id="export-genre"
                label="Genre"
                value={genre}
                placeholder="Optional"
                onChange={setGenre}
              />
            </div>
          </div>
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
