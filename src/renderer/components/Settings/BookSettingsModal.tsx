import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/UI/dialog'
import { Label } from '@/components/UI/label'
import { AutoGrowTextarea } from '@/components/UI/auto-grow-textarea'
import { useAppStore } from '@/store/appStore'
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

function FieldRow({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}

function ToggleGroup<T extends string>({
  value,
  options,
  onChange,
  disabled
}: {
  value: T
  options: { id: T; label: string }[]
  onChange: (id: T) => void
  disabled?: boolean
}): React.JSX.Element {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          disabled={disabled}
          onClick={() => onChange(opt.id)}
          className={cn(
            'no-drag rounded-md border px-3 py-2 text-sm transition-colors disabled:opacity-50',
            value === opt.id
              ? 'border-primary bg-primary/10 text-foreground'
              : 'border-border hover:bg-accent/50'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

const LABEL_STYLES: { id: ChapterLabelStyle; label: string }[] = [
  { id: 'number-and-title', label: 'Number + title' },
  { id: 'number-only', label: 'Number only' },
  { id: 'title-only', label: 'Title only' },
  { id: 'none', label: 'None' }
]

const CHAPTER_LABEL_PREFIX_OPTIONS = [
  { id: 'Chapter', label: 'Chapter' },
  { id: 'none', label: 'None' }
] as const

const SCENE_BREAK_MARKER_OPTIONS = [
  { id: '* * *', label: '* * *' },
  { id: 'none', label: 'None' }
] as const

export function BookSettingsModal({ open, onOpenChange }: BookSettingsModalProps): React.JSX.Element {
  const projectMeta = useAppStore((s) => s.projectMeta)
  const setProjectMeta = useAppStore((s) => s.setProjectMeta)
  const [settings, setSettings] = useState<BookSettings>(DEFAULT_BOOK_SETTINGS)
  const [activeTab, setActiveTab] = useState<'cover' | 'structure' | 'typography' | 'frontmatter'>('cover')
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

  const numberFormatDisabled =
    settings.chapterLabelStyle === 'title-only' || settings.chapterLabelStyle === 'none'

  const coverUrl = settings.coverImagePath ? toAssetUrl(settings.coverImagePath) : null

  const chapterLabelPrefixValue =
    settings.chapterLabelPrefix === '' ? 'none' : settings.chapterLabelPrefix

  const sceneBreakMarkerValue = settings.sceneBreakMarker === '' ? 'none' : settings.sceneBreakMarker

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="no-drag sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Book Settings</DialogTitle>
          <DialogDescription>
            Cover, chapter labels, front matter, and typography for export and device preview.
          </DialogDescription>
          <div className="flex gap-0 border-b border-border">
            {(
              [
                { id: 'cover', label: 'Cover' },
                { id: 'structure', label: 'Structure' },
                { id: 'typography', label: 'Typography' },
                { id: 'frontmatter', label: 'Front matter' }
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'no-drag px-4 py-2 text-sm font-medium transition-colors',
                  activeTab === tab.id
                    ? 'border-b-2 border-foreground text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </DialogHeader>

        <div className="pt-4">
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
              <p className="mt-2 text-center text-xs text-muted-foreground">Click to upload or replace</p>
            </div>
          )}

          {activeTab === 'structure' && (
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <FieldRow label="Chapter label style">
                <ToggleGroup
                  value={settings.chapterLabelStyle}
                  options={LABEL_STYLES}
                  onChange={(id) => void persist({ chapterLabelStyle: id })}
                />
              </FieldRow>

              <FieldRow label="Chapter number format">
                <ToggleGroup
                  value={settings.chapterNumberFormat}
                  options={[
                    { id: 'digits' as ChapterNumberFormat, label: 'Digits' },
                    { id: 'words' as ChapterNumberFormat, label: 'Words' },
                    { id: 'roman' as ChapterNumberFormat, label: 'Roman numbers' }
                  ]}
                  onChange={(id) => void persist({ chapterNumberFormat: id })}
                  disabled={numberFormatDisabled}
                />
              </FieldRow>

              <FieldRow label="Chapter numbering">
                <ToggleGroup
                  value={settings.chapterNumberingScope}
                  options={[
                    { id: 'manuscript-global' as ChapterNumberingScope, label: 'Manuscript position' },
                    { id: 'export-relative' as ChapterNumberingScope, label: 'Renumber export' }
                  ]}
                  onChange={(id) => void persist({ chapterNumberingScope: id })}
                />
              </FieldRow>

              <FieldRow label="Chapter label prefix">
                <ToggleGroup
                  value={chapterLabelPrefixValue}
                  options={[...CHAPTER_LABEL_PREFIX_OPTIONS]}
                  onChange={(id) => void persist({ chapterLabelPrefix: id === 'none' ? '' : id })}
                  disabled={settings.chapterLabelStyle === 'title-only' || settings.chapterLabelStyle === 'none'}
                />
              </FieldRow>

              <FieldRow label="Show scene titles">
                <ToggleGroup
                  value={settings.showSceneTitles ? 'yes' : 'no'}
                  options={[
                    { id: 'yes', label: 'Show' },
                    { id: 'no', label: 'Hide' }
                  ]}
                  onChange={(id) => void persist({ showSceneTitles: id === 'yes' })}
                />
              </FieldRow>

              <FieldRow label="Scene break marker">
                <ToggleGroup
                  value={sceneBreakMarkerValue}
                  options={[...SCENE_BREAK_MARKER_OPTIONS]}
                  onChange={(id) => void persist({ sceneBreakMarker: id === 'none' ? '' : id })}
                  disabled={settings.showSceneTitles}
                />
              </FieldRow>
            </div>
          )}

          {activeTab === 'typography' && (
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <FieldRow label="Paragraph style">
                <ToggleGroup
                  value={settings.paragraphStyle}
                  options={[
                    { id: 'first-line-indent' as ParagraphStyle, label: 'First-line indent' },
                    { id: 'spaced' as ParagraphStyle, label: 'Spaced' }
                  ]}
                  onChange={(id) => void persist({ paragraphStyle: id })}
                />
              </FieldRow>

              <FieldRow label="Text alignment">
                <ToggleGroup
                  value={settings.textAlign}
                  options={[
                    { id: 'justify' as TextAlignStyle, label: 'Justify' },
                    { id: 'left' as TextAlignStyle, label: 'Left' }
                  ]}
                  onChange={(id) => void persist({ textAlign: id })}
                />
              </FieldRow>

              <FieldRow label="Spell check language">
                <ToggleGroup
                  value={projectMeta?.spellCheckLang ?? 'en'}
                  options={[
                    { id: 'en' as SpellCheckLang, label: 'English' },
                    { id: 'es' as SpellCheckLang, label: 'Spanish' },
                    { id: 'ru' as SpellCheckLang, label: 'Russian' }
                  ]}
                  onChange={(id) => void persistSpellCheckLang(id)}
                />
              </FieldRow>
            </div>
          )}

          {activeTab === 'frontmatter' && (
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <div className="col-span-2">
                <FieldRow label="Include title page">
                  <ToggleGroup
                    value={settings.includeTitlePage ? 'yes' : 'no'}
                    options={[
                      { id: 'yes', label: 'Yes' },
                      { id: 'no', label: 'No' }
                    ]}
                    onChange={(id) => void persist({ includeTitlePage: id === 'yes' })}
                  />
                </FieldRow>
              </div>

              <FieldRow label="Dedication">
                <AutoGrowTextarea
                  value={settings.dedication}
                  onChange={(e) => persistDebounced({ dedication: e.target.value })}
                  onBlur={() => void persist({ dedication: settings.dedication })}
                  rows={3}
                />
              </FieldRow>

              <FieldRow label="Copyright">
                <AutoGrowTextarea
                  value={settings.copyrightText}
                  onChange={(e) => persistDebounced({ copyrightText: e.target.value })}
                  onBlur={() => void persist({ copyrightText: settings.copyrightText })}
                  rows={3}
                />
              </FieldRow>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
