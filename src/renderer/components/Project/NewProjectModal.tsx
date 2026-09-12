import { useState } from 'react'
import {
  BookMarked,
  BookOpen,
  Check,
  FileText,
  FolderOpen,
  Lightbulb,
  Loader2,
  MapPin,
  Plus,
  Scroll,
  StickyNote,
  UserCircle,
  Users,
  X
} from 'lucide-react'
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
import { cn } from '@/lib/utils'
import { detectPathLabel } from '@shared/pathUtils'
import { PROJECT_TEMPLATES } from '@shared/types'
import { resolveCategoriesFromPresetIds } from '@shared/categoryPresets'
import type {
  CategoryDefinition,
  ManuscriptSplitMode,
  ParsedManuscriptFile,
  TemplateId
} from '@shared/types'
import { splitManuscript, splitManuscriptAuto } from '@shared/import/splitManuscript'
import { useProject } from '@/hooks/useProject'
import { ProjectOriginStep } from '@/components/Project/ProjectOriginStep'
import {
  ImportPreviewStep,
  type PreviewChapterRow
} from '@/components/Project/ImportPreviewStep'

const GENRES = ['Fantasy', 'Sci-Fi', 'Romance', 'Mystery', 'Horror', 'Other'] as const

const ICON_COMPONENTS: Record<string, React.ComponentType<{ className?: string }>> = {
  Users,
  MapPin,
  Scroll,
  StickyNote,
  UserCircle,
  BookOpen,
  Lightbulb,
  BookMarked,
  FileText
}

type WizardStep = 'origin' | 'preview' | 'details' | 'template' | 'location' | 'backups' | 'creating'

interface NewProjectModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface BackupRow {
  id: string
  path: string
}

function rowsFromParsed(
  parsed: ParsedManuscriptFile,
  mode?: ManuscriptSplitMode
): { mode: ManuscriptSplitMode; rows: PreviewChapterRow[] } {
  const result = mode ? splitManuscript(parsed.html, mode) : splitManuscriptAuto(parsed.html)
  return {
    mode: result.mode,
    rows: result.chapters.map((chapter, index) => ({
      ...chapter,
      id: String(index),
      included: chapter.title !== 'Front matter'
    }))
  }
}

export function NewProjectModal({ open, onOpenChange }: NewProjectModalProps): React.JSX.Element {
  const { createProjectFromInput } = useProject()
  const [step, setStep] = useState<WizardStep>('origin')
  const [origin, setOrigin] = useState<'blank' | 'import'>('blank')
  const [parsed, setParsed] = useState<ParsedManuscriptFile | null>(null)
  const [splitMode, setSplitMode] = useState<ManuscriptSplitMode>('heading1')
  const [detectedMode, setDetectedMode] = useState<ManuscriptSplitMode>('heading1')
  const [previewRows, setPreviewRows] = useState<PreviewChapterRow[]>([])
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [genre, setGenre] = useState<string>('Fantasy')
  const [primaryDir, setPrimaryDir] = useState<string | null>(null)
  const [backupRows, setBackupRows] = useState<BackupRow[]>([])
  const [creating, setCreating] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hiddenForPicker, setHiddenForPicker] = useState(false)
  const [pickingFolder, setPickingFolder] = useState(false)
  const [selectedTemplateId, setSelectedTemplateId] = useState<TemplateId | null>(null)
  const [selectedCategories, setSelectedCategories] = useState<CategoryDefinition[]>([])

  const reset = (): void => {
    setStep('origin')
    setOrigin('blank')
    setParsed(null)
    setSplitMode('heading1')
    setDetectedMode('heading1')
    setPreviewRows([])
    setTitle('')
    setAuthor('')
    setGenre('Fantasy')
    setPrimaryDir(null)
    setBackupRows([])
    setCreating(false)
    setParsing(false)
    setError(null)
    setSelectedTemplateId(null)
    setSelectedCategories([])
  }

  const handleClose = (value: boolean): void => {
    if (!creating && !parsing) {
      if (!value) reset()
      onOpenChange(value)
    }
  }

  const chooseFolder = async (dialogTitle: string): Promise<string | null> => {
    setHiddenForPicker(true)
    setPickingFolder(true)
    await new Promise((resolve) => setTimeout(resolve, 100))
    try {
      return await window.electronAPI.dialog.chooseFolder(dialogTitle)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open folder picker')
      return null
    } finally {
      setPickingFolder(false)
      setHiddenForPicker(false)
    }
  }

  const applyParsedFile = (next: ParsedManuscriptFile): void => {
    const split = rowsFromParsed(next)
    setParsed(next)
    setDetectedMode(split.mode)
    setSplitMode(split.mode)
    setPreviewRows(split.rows)
    if (next.suggestedTitle) setTitle(next.suggestedTitle)
    if (next.suggestedAuthor) setAuthor(next.suggestedAuthor)
  }

  const pickDocx = async (): Promise<boolean> => {
    setError(null)
    setHiddenForPicker(true)
    setPickingFolder(true)
    await new Promise((resolve) => setTimeout(resolve, 100))
    let filePath: string | null = null
    try {
      filePath = await window.electronAPI.dialog.selectDocx()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open file picker')
      setPickingFolder(false)
      setHiddenForPicker(false)
      return false
    }
    setPickingFolder(false)
    setHiddenForPicker(false)
    if (!filePath) return false

    setParsing(true)
    try {
      const next = await window.electronAPI.manuscript.parseDocx(filePath)
      applyParsedFile(next)
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not import that Word file')
      return false
    } finally {
      setParsing(false)
    }
  }

  const handleImport = async (): Promise<void> => {
    setOrigin('import')
    const ok = await pickDocx()
    if (ok) setStep('preview')
  }

  const handleSplitModeChange = (mode: ManuscriptSplitMode): void => {
    if (!parsed) return
    const split = rowsFromParsed(parsed, mode)
    setSplitMode(mode)
    setPreviewRows(split.rows)
  }

  const pickPrimaryFolder = async (): Promise<void> => {
    setError(null)
    const path = await chooseFolder('Choose Primary Save Location')
    if (path) setPrimaryDir(path)
  }

  const addBackupRow = async (): Promise<void> => {
    if (backupRows.length >= 5) return
    setError(null)
    const path = await chooseFolder('Choose Backup Location')
    if (path && !backupRows.some((r) => r.path === path)) {
      setBackupRows([...backupRows, { id: crypto.randomUUID(), path }])
    }
  }

  const removeBackupRow = (id: string): void => {
    setBackupRows(backupRows.filter((r) => r.id !== id))
  }

  const handleCreate = async (): Promise<void> => {
    if (!primaryDir || !title.trim() || !author.trim() || !selectedTemplateId) return
    const importedChapters =
      origin === 'import'
        ? previewRows.filter((row) => row.included).map(({ title: chapterTitle, html }) => ({
            title: chapterTitle,
            html
          }))
        : undefined
    if (origin === 'import' && (!importedChapters || importedChapters.length === 0)) {
      setError('Select at least one chapter to import')
      setStep('preview')
      return
    }
    setCreating(true)
    setStep('creating')
    setError(null)
    try {
      await createProjectFromInput({
        title: title.trim(),
        author: author.trim(),
        genre: genre === 'Other' ? '' : genre,
        primaryParentDir: primaryDir,
        backupLocations: backupRows.map((r) => r.path),
        templateId: selectedTemplateId,
        categories: selectedCategories,
        importedChapters
      })
      reset()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project')
      setCreating(false)
      setStep('backups')
    }
  }

  return (
    <Dialog open={open && !hiddenForPicker} onOpenChange={handleClose}>
      <DialogContent
        className={step === 'preview' ? 'sm:max-w-xl' : 'sm:max-w-lg'}
        onPointerDownOutside={(e) => (creating || parsing) && e.preventDefault()}
      >
        {step === 'origin' && (
          <ProjectOriginStep error={error} parsing={parsing} onBlank={() => {
            setOrigin('blank')
            setError(null)
            setStep('details')
          }} onImport={() => void handleImport()} />
        )}

        {step === 'preview' && parsed && (
          <ImportPreviewStep
            fileName={parsed.fileName}
            splitMode={splitMode}
            detectedMode={detectedMode}
            chapters={previewRows}
            onSplitModeChange={handleSplitModeChange}
            onToggleChapter={(id) => {
              setPreviewRows((rows) =>
                rows.map((row) => (row.id === id ? { ...row, included: !row.included } : row))
              )
            }}
            onChooseDifferentFile={() => void handleImport()}
            onBack={() => {
              setError(null)
              setStep('origin')
            }}
            onNext={() => setStep('details')}
          />
        )}

        {step === 'details' && (
          <>
            <DialogHeader>
              <DialogTitle>New Book Project</DialogTitle>
              <DialogDescription>Tell us about your book.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="title">Book title *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="My Fantasy Book"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="author">Author name *</Label>
                <Input
                  id="author"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder="Your name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="genre">Genre</Label>
                <select
                  id="genre"
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                >
                  {GENRES.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={() => setStep(origin === 'import' ? 'preview' : 'origin')}>
                Back
              </Button>
              <Button onClick={() => setStep('template')} disabled={!title.trim() || !author.trim()}>
                Next
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'template' && (
          <>
            <DialogHeader>
              <DialogTitle>Choose a template</DialogTitle>
              <DialogDescription>
                Templates set up your wiki categories. You can add or remove categories later.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2 py-2">
              {PROJECT_TEMPLATES.map((template) => {
                const isSelected = selectedTemplateId === template.id
                const templateCategories = resolveCategoriesFromPresetIds(template.presetIds)
                return (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => {
                      setSelectedTemplateId(template.id)
                      setSelectedCategories(templateCategories)
                    }}
                    className={cn(
                      'w-full rounded-lg border p-4 text-left transition-colors',
                      isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-border/80 hover:bg-accent/30'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{template.name}</span>
                      {isSelected && <Check className="h-4 w-4 text-primary" />}
                    </div>

                    <p className="mt-0.5 text-xs text-muted-foreground">{template.description}</p>

                    {templateCategories.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {templateCategories.map((cat) => {
                          const IconComponent = ICON_COMPONENTS[cat.icon]
                          return (
                            <span
                              key={cat.id}
                              className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                            >
                              {IconComponent && <IconComponent className="h-3 w-3" />}
                              {cat.name}
                            </span>
                          )
                        })}
                      </div>
                    )}

                    {templateCategories.length === 0 && (
                      <p className="mt-2 text-xs italic text-muted-foreground/60">
                        No categories. Just the manuscript.
                      </p>
                    )}
                  </button>
                )
              })}
            </div>

            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={() => setStep('details')}>
                Back
              </Button>
              <Button onClick={() => setStep('location')} disabled={selectedTemplateId === null}>
                Next
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'location' && (
          <>
            <DialogHeader>
              <DialogTitle>Primary Save Location</DialogTitle>
              <DialogDescription>
                This is your main working copy. Choose a folder you trust, such as Documents, Desktop, or
                inside your iCloud/Google Drive folder.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <Button
                variant="outline"
                onClick={pickPrimaryFolder}
                disabled={pickingFolder}
                className="w-full"
              >
                {pickingFolder ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FolderOpen className="mr-2 h-4 w-4" />
                )}
                {pickingFolder ? 'Opening folder picker...' : 'Choose Folder'}
              </Button>
              {primaryDir && (
                <div className="flex items-start gap-2 rounded-md border border-green-500/30 bg-green-500/10 p-3 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                  <div>
                    <p className="font-medium text-green-600 dark:text-green-400">Location selected</p>
                    <p className="mt-1 break-all text-muted-foreground">{primaryDir}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Project folder: {primaryDir}/{title.trim().replace(/[<>:"/\\|?*]/g, '')}
                    </p>
                  </div>
                </div>
              )}
            </div>
            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={() => setStep('template')}>
                Back
              </Button>
              <Button onClick={() => setStep('backups')} disabled={!primaryDir}>
                Next
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'backups' && (
          <>
            <DialogHeader>
              <DialogTitle>Backup Locations</DialogTitle>
              <DialogDescription>
                Optional: copy zip backups to another drive or folder. Local zips always live in the
                project&apos;s backups folder. You can add up to 5 locations and manage them later
                from File → Backups.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              {backupRows.map((row) => (
                <div
                  key={row.id}
                  className="flex items-center gap-2 rounded-md border border-border p-2 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <span className="mb-1 inline-block rounded bg-muted px-1.5 py-0.5 text-xs">
                      {detectPathLabel(row.path)}
                    </span>
                    <p className="truncate text-muted-foreground">{row.path}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => removeBackupRow(row.id)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {backupRows.length < 5 && (
                <Button variant="outline" size="sm" onClick={addBackupRow} disabled={pickingFolder}>
                  <Plus className="mr-1 h-3 w-3" />
                  Add backup location
                </Button>
              )}
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={() => setStep('location')}>
                Back
              </Button>
              <Button onClick={() => void handleCreate()}>Continue</Button>
            </DialogFooter>
          </>
        )}

        {step === 'creating' && (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              {origin === 'import' ? 'Importing your manuscript...' : 'Creating your project...'}
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
