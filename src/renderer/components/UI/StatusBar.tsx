import { formatDistanceToNow } from 'date-fns'
import { Moon, Sun, Download, Save, BookOpen } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { Button } from '@/components/UI/button'
import { useProject } from '@/hooks/useProject'
import { useManuscriptWordTotal } from '@/hooks/useManuscriptWordTotal'
import { FocusModeButton } from '@/components/Editor/FocusModeButton'

function safeRelativeTime(iso: string | null | undefined): string | null {
  if (!iso) return null
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) return null
  try {
    return formatDistanceToNow(new Date(ms), { addSuffix: true })
  } catch {
    return null
  }
}

export function StatusBar(): React.JSX.Element {
  const {
    lastSaved,
    isDirty,
    theme,
    toggleTheme,
    projectMeta,
    backupWarningCount,
    lastBackupAt,
    setShowExportDialog,
    setShowBackupsModal
  } = useAppStore()
  const { saveProject } = useProject()
  const manuscriptWords = useManuscriptWordTotal()

  const savedRelative = safeRelativeTime(lastSaved)
  const backupRelative = safeRelativeTime(lastBackupAt)

  const savedLabel = isDirty
    ? 'Unsaved changes'
    : savedRelative
      ? `Last saved: ${savedRelative}`
      : 'Ready'

  const backupLabel =
    backupWarningCount > 0
      ? `Backup warning: ${backupWarningCount} location${backupWarningCount === 1 ? '' : 's'} unavailable`
      : backupRelative
        ? `Last backup: ${backupRelative}`
        : 'No backups yet'

  const manuscriptWordsLabel = `${manuscriptWords.toLocaleString()} ${
    manuscriptWords === 1 ? 'word' : 'words'
  }`

  const openDevicePreview = (): void => {
    void window.electronAPI.windows.openDevicePreview({ scope: 'manuscript' })
  }

  return (
    <footer className="flex h-7 shrink-0 items-center justify-between border-t border-border bg-muted/30 px-4 text-xs text-muted-foreground">
      <div className="flex items-center gap-3">
        <span>{savedLabel}</span>
        <span className="text-border">|</span>
        <button
          type="button"
          className={`hover:underline ${backupWarningCount > 0 ? 'text-amber-500' : ''}`}
          onClick={() => setShowBackupsModal?.(true)}
          title="Open Backups"
        >
          {backupLabel}
        </button>
        {projectMeta && (
          <>
            <span className="text-border">|</span>
            <span>{projectMeta.title}</span>
            <span className="text-border">|</span>
            <span className="tabular-nums" title="Manuscript word count">
              {manuscriptWordsLabel}
            </span>
          </>
        )}
      </div>
      <div className="flex items-center gap-1">
        <FocusModeButton />
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={openDevicePreview}
          title="Preview"
        >
          <BookOpen className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => setShowExportDialog(true)}
          title="Export"
        >
          <Download className="h-3 w-3" />
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={saveProject} title="Save">
          <Save className="h-3 w-3" />
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={toggleTheme} title="Toggle theme">
          {theme === 'dark' ? <Sun className="h-3 w-3" /> : <Moon className="h-3 w-3" />}
        </Button>
      </div>
    </footer>
  )
}
