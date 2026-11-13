import { useState } from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import {
  BookMarked,
  BookOpen,
  Check,
  ChevronDown,
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
import { Dialog, DialogContent, DialogFooter } from '@/components/UI/dialog'
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
  ParsedScrivenerProject,
  TemplateId
} from '@shared/types'
import { splitManuscript, splitManuscriptAuto } from '@shared/import/splitManuscript'
import { useProject } from '@/hooks/useProject'
import { useAppStore } from '@/store/appStore'
import { WizardStepHeader } from '@/components/Project/WizardStepHeader'
import { isMac } from '@/lib/platform'
import {
  ImportPreviewStep,
  type PreviewChapterRow
} from '@/components/Project/ImportPreviewStep'
import { ScrivenerPreviewStep } from '@/components/Project/ScrivenerPreviewStep'
import { buildImportedTree } from '@shared/import/buildImportedTree'

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

type WizardStep = 'preview' | 'details' | 'template' | 'location' | 'backups' | 'creating'

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

/**
 * Rebuild the nested tree from the flat preview rows, honoring the checkboxes.
 * An unchecked row hides its whole subtree even if a descendant stayed checked.
 */

export function NewProjectModal({ open, onOpenChange }: NewProjectModalProps): React.JSX.Element {
  const { createProjectFromInput } = useProject()
  const setShowRestoreBackupModal = useAppStore((s) => s.setShowRestoreBackupModal)
  const [step, setStep] = useState<WizardStep>('details')
  const [origin, setOrigin] = useState<'blank' | 'import'>('blank')
  const [importKind, setImportKind] = useState<'docx' | 'scrivener' | null>(null)
  const [parsed, setParsed] = useState<ParsedManuscriptFile | null>(null)
  const [parsedScrivener, setParsedScrivener] = useState<ParsedScrivenerProject | null>(null)
  const [scrivenerChecked, setScrivenerChecked] = useState<boolean[]>([])
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
    setStep('details')
    setOrigin('blank')
    setImportKind(null)
    setParsed(null)
    setParsedScrivener(null)
    setScrivenerChecked([])
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
    setImportKind('docx')
    setDetectedMode(split.mode)
    setSplitMode(split.mode)
    setPreviewRows(split.rows)
    if (next.suggestedTitle) setTitle(next.suggestedTitle)
    if (next.suggestedAuthor) setAuthor(next.suggestedAuthor)
  }

  const applyParsedScrivener = (next: ParsedScrivenerProject): void => {
    setParsedScrivener(next)
    setImportKind('scrivener')
    // Scrivener's own Include-in-Compile flags are the defaults.
    setScrivenerChecked(next.rows.map((r) => r.includeInCompile))
    if (next.suggestedTitle) setTitle(next.suggestedTitle)
    if (next.suggestedAuthor) setAuthor(next.suggestedAuthor)
  }

  /** Folder toggles cascade: off hides the subtree, on restores compile defaults. */
  const toggleScrivenerRow = (index: number): void => {
    if (!parsedScrivener) return
    const rows = parsedScrivener.rows
    setScrivenerChecked((prev) => {
      const next = [...prev]
      const becoming = !next[index]
      next[index] = becoming
      const row = rows[index]
      if (row.kind === 'folder') {
        for (let j = index + 1; j < rows.length && rows[j].depth > row.depth; j++) {
          next[j] = becoming ? rows[j].includeInCompile : false
        }
      }
      return next
    })
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

  const pickScrivener = async (): Promise<boolean> => {
    setError(null)
    setHiddenForPicker(true)
    setPickingFolder(true)
    await new Promise((resolve) => setTimeout(resolve, 100))
    let filePath: string | null = null
    try {
      filePath = await window.electronAPI.dialog.selectScrivener()
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
      const next = await window.electronAPI.manuscript.parseScrivener(filePath)
      applyParsedScrivener(next)
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not import that Scrivener project')
      return false
    } finally {
      setParsing(false)
    }
  }

  // The import preview is an extra step, so the run is five long instead of four.
  const stepTotal = origin === 'import' ? 5 : 4
  const folderName = primaryDir
    ? (primaryDir.split(/[\\/]/).filter(Boolean).pop() ?? primaryDir)
    : null
  const projectFolderName = title.trim().replace(/[<>:"/\\|?*]/g, '') || 'Untitled'
  const stepNo = (base: 1 | 2 | 3 | 4): number =>
    origin === 'import' && base > 1 ? base + 1 : base

  const handleImportDocx = async (): Promise<void> => {
    const ok = await pickDocx()
    if (ok) {
      setOrigin('import')
      setStep('preview')
    }
  }

  const handleImportScrivener = async (): Promise<void> => {
    const ok = await pickScrivener()
    if (ok) {
      setOrigin('import')
      setStep('preview')
    }
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
      origin === 'import' && importKind === 'docx'
        ? previewRows.filter((row) => row.included).map(({ title: chapterTitle, html }) => ({
            title: chapterTitle,
            html
          }))
        : undefined
    const importedTree =
      origin === 'import' && importKind === 'scrivener' && parsedScrivener
        ? buildImportedTree(parsedScrivener.rows, scrivenerChecked)
        : undefined
    if (origin === 'import' && importKind === 'docx' && (!importedChapters || importedChapters.length === 0)) {
      setError('Select at least one chapter to import')
      setStep('preview')
      return
    }
    if (origin === 'import' && importKind === 'scrivener' && (!importedTree || importedTree.length === 0)) {
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
        importedChapters,
        importedTree
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
        {step === 'preview' && importKind === 'scrivener' && parsedScrivener && (
          <ScrivenerPreviewStep
            fileName={parsedScrivener.fileName}
            rows={parsedScrivener.rows}
            checked={scrivenerChecked}
            stats={parsedScrivener.stats}
            onToggle={toggleScrivenerRow}
            onChooseDifferentFile={() => void handleImportScrivener()}
            onBack={() => {
              setError(null)
              setStep('details')
            }}
            onNext={() => setStep('details')}
          />
        )}

        {step === 'preview' && importKind === 'docx' && parsed && (
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
            onChooseDifferentFile={() => void handleImportDocx()}
            onBack={() => {
              setError(null)
              setStep('details')
            }}
            onNext={() => setStep('details')}
          />
        )}

        {step === 'details' && (
          <>
            <WizardStepHeader step={stepNo(1)} total={stepTotal} title="New Project" />
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
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
            <DialogFooter className="flex-row items-center justify-between gap-2 sm:justify-between">
              <div className="flex gap-2">
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger asChild>
                    <Button type="button" variant="ghost" disabled={parsing}>
                      {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Import
                      <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                    </Button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.Content
                      className="z-50 min-w-[220px] rounded-md border border-border bg-popover p-1 shadow-md"
                      align="start"
                    >
                      <DropdownMenu.Item
                        className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent"
                        onSelect={() => void handleImportDocx()}
                      >
                        <FileText className="h-4 w-4 opacity-70" />
                        Word document (.docx)
                      </DropdownMenu.Item>
                      <DropdownMenu.Item
                        className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent"
                        onSelect={() => void handleImportScrivener()}
                      >
                        <FolderOpen className="h-4 w-4 opacity-70" />
                        Scrivener project (.scriv)
                      </DropdownMenu.Item>
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu.Root>
                {/* macOS reaches this from the File menu instead. */}
                {!isMac && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      onOpenChange(false)
                      setShowRestoreBackupModal(true)
                    }}
                    disabled={parsing}
                  >
                    Restore backup
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                {origin === 'import' && (parsed || parsedScrivener) && (
                  <Button variant="ghost" onClick={() => setStep('preview')} disabled={parsing}>
                    Back
                  </Button>
                )}
                <Button
                  onClick={() => setStep('template')}
                  disabled={parsing || !title.trim() || !author.trim()}
                >
                  Next
                </Button>
              </div>
            </DialogFooter>
          </>
        )}

        {step === 'template' && (
          <>
            <WizardStepHeader step={stepNo(2)} total={stepTotal} title="Choose a template" />

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
            <WizardStepHeader
              step={stepNo(3)}
              total={stepTotal}
              title="Where should the book live?"
            />

            <div className="overflow-hidden rounded-lg border border-border bg-card">
              <div className="flex min-w-0 items-center gap-3 px-3 py-2.5">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-muted">
                  <FolderOpen className="h-4 w-4 text-muted-foreground" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[13px] font-medium">
                    {folderName ?? 'No folder chosen yet'}
                  </span>
                  <span className="truncate text-xs text-muted-foreground" title={primaryDir ?? ''}>
                    {primaryDir ?? 'The project folder goes inside the one you pick'}
                  </span>
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 shrink-0 px-3 text-xs"
                  onClick={pickPrimaryFolder}
                  disabled={pickingFolder}
                >
                  {pickingFolder ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  {primaryDir ? 'Change…' : 'Choose…'}
                </Button>
              </div>

              {primaryDir && (
                <div className="grid gap-1 border-t border-border/60 bg-muted/30 px-3 py-2.5">
                  <span className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Priama will create
                  </span>
                  <span className="truncate text-[13px] font-medium">{projectFolderName}</span>
                  <span className="text-xs text-muted-foreground">
                    manuscript, wiki, and a backups folder
                  </span>
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
            <WizardStepHeader step={stepNo(4)} total={stepTotal} title="Copies elsewhere" />

            <div className="overflow-hidden rounded-lg border border-border bg-card">
              {backupRows.map((row) => (
                <div
                  key={row.id}
                  className="flex min-w-0 items-center gap-2.5 border-b border-border/60 px-3 py-2.5"
                >
                  <span
                    className="h-[7px] w-[7px] shrink-0 rounded-full bg-emerald-500"
                    aria-hidden
                  />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[13px] font-medium">
                      {detectPathLabel(row.path)}
                    </span>
                    <span className="truncate text-xs text-muted-foreground" title={row.path}>
                      {row.path}
                    </span>
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0 text-muted-foreground"
                    onClick={() => removeBackupRow(row.id)}
                    aria-label={`Remove ${row.path}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}

              <button
                type="button"
                onClick={() => void addBackupRow()}
                disabled={pickingFolder || backupRows.length >= 5}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-accent/50 disabled:pointer-events-none disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="text-[13px] font-medium">Add a location…</span>
                <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                  {backupRows.length} of 5
                </span>
              </button>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <DialogFooter className="items-center gap-2 sm:justify-between">
              <span className="text-xs text-muted-foreground">
                {backupRows.length === 0 ? 'Optional — you can add these later' : ''}
              </span>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setStep('location')}>
                  Back
                </Button>
                <Button onClick={() => void handleCreate()}>Create</Button>
              </div>
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
