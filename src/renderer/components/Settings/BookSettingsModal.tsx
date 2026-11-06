import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/UI/dialog'
import { Button } from '@/components/UI/button'
import { AutoGrowTextarea } from '@/components/UI/auto-grow-textarea'
import { Switch } from '@/components/UI/switch'
import { useAppStore } from '@/store/appStore'
import { formatChapterLabel } from '@shared/export/manuscript'
import {
  DEFAULT_BOOK_SETTINGS,
  type BookSettings,
  type ChapterLabelStyle,
  type ChapterNumberFormat,
  type ChapterNumberingScope,
  type ParagraphStyle,
  type SpellCheckLang,
  type TextAlignStyle
} from '@shared/types'
import { setSpellCheckLang } from '@/lib/spellCheck'
import { toAssetUrl } from '@/lib/assetUrl'
import { cn } from '@/lib/utils'

interface BookSettingsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type TabId = 'cover' | 'structure' | 'typography' | 'frontmatter'

const TABS: { id: TabId; label: string }[] = [
  { id: 'cover', label: 'Cover' },
  { id: 'structure', label: 'Structure' },
  { id: 'typography', label: 'Typography' },
  { id: 'frontmatter', label: 'Front matter' }
]

function SectionLabel({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </span>
  )
}

/** Label on the left, control on the right — one bordered card per group. */
function Row({
  label,
  hint,
  children
}: {
  label: string
  hint?: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex min-w-0 items-center justify-between gap-4 px-3 py-2 [&+&]:border-t [&+&]:border-border/60">
      <span className="flex min-w-0 flex-col">
        <span className="text-[13px]">{label}</span>
        {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
      </span>
      <span className="shrink-0">{children}</span>
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <div className="overflow-hidden rounded-lg border border-border bg-card">{children}</div>
}

function Select<T extends string>({
  value,
  options,
  onChange,
  disabled,
  ariaLabel
}: {
  value: T
  options: { id: T; label: string }[]
  onChange: (id: T) => void
  disabled?: boolean
  ariaLabel: string
}): React.JSX.Element {
  return (
    <select
      aria-label={ariaLabel}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as T)}
      className="no-drag h-7 rounded-md border border-input bg-background px-2 text-[13px] shadow-sm outline-none disabled:opacity-50"
    >
      {options.map((opt) => (
        <option key={opt.id} value={opt.id}>
          {opt.label}
        </option>
      ))}
    </select>
  )
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
  ariaLabel
}: {
  value: T
  options: { id: T; label: string }[]
  onChange: (id: T) => void
  ariaLabel: string
}): React.JSX.Element {
  return (
    <div className="flex gap-0.5 rounded-md bg-muted p-0.5" role="group" aria-label={ariaLabel}>
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          aria-pressed={value === opt.id}
          onClick={() => onChange(opt.id)}
          className={cn(
            'no-drag rounded px-2.5 py-1 text-xs font-medium transition-colors',
            value === opt.id
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

const SAMPLE_TITLE = 'The Long Walk Beneath Ys'
const SAMPLE_P1 =
  'The tide went out of Ys for the last time on a Tuesday, and took the bells with it. Hallow counted nine of them in the mud before the gulls arrived.'
const SAMPLE_P2 =
  'Sister Venn had promised twelve. She had promised a great many things that season, and the sea had taken its own view.'

/** Built from formatChapterLabel and the same rules chapterSections uses, so it cannot drift. */
function Preview({ settings }: { settings: BookSettings }): React.JSX.Element {
  const heading = formatChapterLabel(4, SAMPLE_TITLE, settings)
  const align = settings.textAlign === 'justify' ? 'justify' : 'left'
  const indent = settings.paragraphStyle === 'first-line-indent'

  return (
    <div className="grid gap-2 min-w-0">
      <SectionLabel>How it reads</SectionLabel>
      <div className="overflow-hidden rounded-lg border border-border bg-card px-5 py-5 font-serif">
        {heading && (
          <p className="m-0 text-center text-[15px] font-semibold leading-snug">{heading}</p>
        )}
        <p
          className="m-0 mt-3 text-[11.5px] leading-[1.72] text-foreground/80"
          style={{ textAlign: align }}
        >
          {SAMPLE_P1}
        </p>

        {settings.showSceneTitles ? (
          <p className="m-0 mt-3 text-[12px] font-semibold">Low Tide</p>
        ) : settings.sceneBreakMarker ? (
          <p className="m-0 my-2 text-center text-[11.5px] tracking-[0.3em] text-muted-foreground">
            {settings.sceneBreakMarker}
          </p>
        ) : null}

        <p
          className={cn('m-0 text-[11.5px] leading-[1.72] text-foreground/80', indent ? '' : 'mt-3')}
          style={{ textAlign: align, textIndent: indent ? '1.2em' : undefined }}
        >
          {SAMPLE_P2}
        </p>
      </div>
      <p className="text-[11.5px] leading-snug text-muted-foreground">
        The same formatter the export uses.
      </p>
    </div>
  )
}

export function BookSettingsModal({ open, onOpenChange }: BookSettingsModalProps): React.JSX.Element {
  const projectMeta = useAppStore((s) => s.projectMeta)
  const setProjectMeta = useAppStore((s) => s.setProjectMeta)
  const [settings, setSettings] = useState<BookSettings>(DEFAULT_BOOK_SETTINGS)
  const [activeTab, setActiveTab] = useState<TabId>('cover')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!open) return
    setSettings(projectMeta?.bookSettings ?? DEFAULT_BOOK_SETTINGS)
  }, [open, projectMeta])

  const persist = useCallback(
    async (updates: Partial<BookSettings>) => {
      const next = await window.electronAPI.tomes.updateBookSettings(updates)
      setSettings(next)
      if (projectMeta) {
        setProjectMeta({ ...projectMeta, bookSettings: next })
      }
    },
    [projectMeta, setProjectMeta]
  )

  const persistDebounced = useCallback(
    (updates: Partial<BookSettings>) => {
      setSettings((prev) => ({ ...prev, ...updates }))
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        void persist(updates)
      }, 300)
    },
    [persist]
  )

  const persistSpellCheckLang = useCallback(
    async (lang: SpellCheckLang) => {
      const meta = await window.electronAPI.tomes.updateProjectMeta({ spellCheckLang: lang })
      setSpellCheckLang(lang)
      setProjectMeta(meta)
    },
    [setProjectMeta]
  )

  const handleCoverClick = async (): Promise<void> => {
    if (settings.coverImagePath) {
      await window.electronAPI.windows.openImageViewer(settings.coverImagePath, 'Cover')
      return
    }
    const sourcePath = await window.electronAPI.dialog.selectImage()
    if (!sourcePath) return
    const { relativePath } = await window.electronAPI.tomes.importCoverImage(sourcePath)
    await persist({ coverImagePath: relativePath })
  }

  const labelOff =
    settings.chapterLabelStyle === 'title-only' || settings.chapterLabelStyle === 'none'

  const coverUrl = settings.coverImagePath ? toAssetUrl(settings.coverImagePath) : null

  const chapterLabelPrefixValue =
    settings.chapterLabelPrefix === '' ? 'none' : settings.chapterLabelPrefix

  const sceneBreakMarkerValue = settings.sceneBreakMarker === '' ? 'none' : settings.sceneBreakMarker

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent hideCloseButton className="no-drag sm:max-w-3xl max-h-[calc(100vh-4rem)] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-5">
            <div className="flex min-w-0 flex-col gap-1">
              <DialogTitle>Book Settings</DialogTitle>
              <DialogDescription>
                How the book is put together when you export or preview it.
              </DialogDescription>
            </div>
            <Button className="shrink-0" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </div>
        </DialogHeader>

        <div className="flex gap-0.5 rounded-lg bg-muted p-0.5" role="group" aria-label="Section">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              aria-pressed={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'no-drag flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                activeTab === tab.id
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'cover' && (
          <div>
            <button
              type="button"
              onClick={() => void handleCoverClick()}
              className={cn(
                'no-drag mx-auto block aspect-[2/3] w-full max-w-[200px] overflow-hidden rounded-md bg-muted/20 transition-colors',
                settings.coverImagePath
                  ? 'cursor-pointer hover:opacity-95'
                  : 'cursor-pointer border border-dashed border-input hover:bg-muted/30'
              )}
            >
              {coverUrl ? (
                <img src={coverUrl} alt="" className="h-full w-full object-cover" draggable={false} />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-muted-foreground">
                  <Camera className="h-5 w-5" />
                </span>
              )}
            </button>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Click to upload or replace
            </p>
          </div>
        )}

        {activeTab === 'structure' && (
          <div className="grid grid-cols-[minmax(0,1fr)_248px] items-start gap-6">
            <div className="grid min-w-0 gap-4">
              <div className="grid gap-2">
                <SectionLabel>Chapter openings</SectionLabel>
                <Card>
                  <Row label="Heading shows">
                    <Select
                      ariaLabel="Heading shows"
                      value={settings.chapterLabelStyle}
                      options={[
                        { id: 'number-and-title' as ChapterLabelStyle, label: 'Number and title' },
                        { id: 'number-only' as ChapterLabelStyle, label: 'Number only' },
                        { id: 'title-only' as ChapterLabelStyle, label: 'Title only' },
                        { id: 'none' as ChapterLabelStyle, label: 'Nothing' }
                      ]}
                      onChange={(id) => void persist({ chapterLabelStyle: id })}
                    />
                  </Row>
                  <Row label="Numbers as">
                    <Select
                      ariaLabel="Numbers as"
                      value={settings.chapterNumberFormat}
                      options={[
                        { id: 'digits' as ChapterNumberFormat, label: 'Digits' },
                        { id: 'words' as ChapterNumberFormat, label: 'Words' },
                        { id: 'roman' as ChapterNumberFormat, label: 'Roman numerals' }
                      ]}
                      disabled={labelOff}
                      onChange={(id) => void persist({ chapterNumberFormat: id })}
                    />
                  </Row>
                  <Row label="Prefix word">
                    <Select
                      ariaLabel="Prefix word"
                      value={chapterLabelPrefixValue}
                      options={[
                        { id: 'Chapter', label: 'Chapter' },
                        { id: 'none', label: 'None' }
                      ]}
                      disabled={labelOff}
                      onChange={(id) =>
                        void persist({ chapterLabelPrefix: id === 'none' ? '' : id })
                      }
                    />
                  </Row>
                  <Row label="Count from" hint="Where chapter one starts">
                    <Segmented
                      ariaLabel="Count from"
                      value={settings.chapterNumberingScope}
                      options={[
                        {
                          id: 'manuscript-global' as ChapterNumberingScope,
                          label: 'Manuscript'
                        },
                        { id: 'export-relative' as ChapterNumberingScope, label: 'This export' }
                      ]}
                      onChange={(id) => void persist({ chapterNumberingScope: id })}
                    />
                  </Row>
                </Card>
              </div>

              <div className="grid gap-2">
                <SectionLabel>Between scenes</SectionLabel>
                <Card>
                  <Row label="Show scene titles">
                    <Switch
                      ariaLabel="Show scene titles"
                      checked={settings.showSceneTitles}
                      onChange={(next) => void persist({ showSceneTitles: next })}
                    />
                  </Row>
                  <Row label="Break marker">
                    <Select
                      ariaLabel="Break marker"
                      value={sceneBreakMarkerValue}
                      options={[
                        { id: '* * *', label: '* * *' },
                        { id: 'none', label: 'None' }
                      ]}
                      disabled={settings.showSceneTitles}
                      onChange={(id) =>
                        void persist({ sceneBreakMarker: id === 'none' ? '' : id })
                      }
                    />
                  </Row>
                </Card>
              </div>
            </div>

            <Preview settings={settings} />
          </div>
        )}

        {activeTab === 'typography' && (
          <div className="grid grid-cols-[minmax(0,1fr)_248px] items-start gap-6">
            <div className="grid min-w-0 gap-4">
              <div className="grid gap-2">
                <SectionLabel>Body text</SectionLabel>
                <Card>
                  <Row label="Paragraphs">
                    <Select
                      ariaLabel="Paragraphs"
                      value={settings.paragraphStyle}
                      options={[
                        { id: 'first-line-indent' as ParagraphStyle, label: 'First-line indent' },
                        { id: 'spaced' as ParagraphStyle, label: 'Spaced' }
                      ]}
                      onChange={(id) => void persist({ paragraphStyle: id })}
                    />
                  </Row>
                  <Row label="Alignment">
                    <Select
                      ariaLabel="Alignment"
                      value={settings.textAlign}
                      options={[
                        { id: 'justify' as TextAlignStyle, label: 'Justify' },
                        { id: 'left' as TextAlignStyle, label: 'Left' }
                      ]}
                      onChange={(id) => void persist({ textAlign: id })}
                    />
                  </Row>
                </Card>
              </div>

              <div className="grid gap-2">
                <SectionLabel>While you write</SectionLabel>
                <Card>
                  <Row label="Spell check" hint="Not part of the exported book">
                    <Select
                      ariaLabel="Spell check language"
                      value={projectMeta?.spellCheckLang ?? 'en'}
                      options={[
                        { id: 'en' as SpellCheckLang, label: 'English' },
                        { id: 'es' as SpellCheckLang, label: 'Spanish' },
                        { id: 'ru' as SpellCheckLang, label: 'Russian' }
                      ]}
                      onChange={(id) => void persistSpellCheckLang(id)}
                    />
                  </Row>
                </Card>
              </div>
            </div>

            <Preview settings={settings} />
          </div>
        )}

        {activeTab === 'frontmatter' && (
          <div className="grid gap-4">
            <div className="grid gap-2">
              <SectionLabel>Front matter</SectionLabel>
              <Card>
                <Row label="Title page" hint="Title and author before chapter one">
                  <Switch
                    ariaLabel="Include title page"
                    checked={settings.includeTitlePage}
                    onChange={(next) => void persist({ includeTitlePage: next })}
                  />
                </Row>
              </Card>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <SectionLabel>Dedication</SectionLabel>
                <AutoGrowTextarea
                  value={settings.dedication}
                  onChange={(e) => persistDebounced({ dedication: e.target.value })}
                  onBlur={() => void persist({ dedication: settings.dedication })}
                  rows={3}
                />
              </div>
              <div className="grid gap-2">
                <SectionLabel>Copyright</SectionLabel>
                <AutoGrowTextarea
                  value={settings.copyrightText}
                  onChange={(e) => persistDebounced({ copyrightText: e.target.value })}
                  onBlur={() => void persist({ copyrightText: settings.copyrightText })}
                  rows={3}
                />
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
