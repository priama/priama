import { Moon, Sun, Download, Save, BookOpen, Settings } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { Button } from '@/components/UI/button'
import { useProject } from '@/hooks/useProject'
import { useManuscriptWordTotal } from '@/hooks/useManuscriptWordTotal'
import { FocusModeButton } from '@/components/Editor/FocusModeButton'
import { backupStatusLabel } from '@/lib/backupStatusLabel'

export function StatusBar(): React.JSX.Element {
  const isDirty = useAppStore((s) => s.isDirty)
  const theme = useAppStore((s) => s.theme)
  const projectTitle = useAppStore((s) => s.projectMeta?.title ?? null)
  const backupWarningCount = useAppStore((s) => s.backupWarningCount)
  const lastBackupAt = useAppStore((s) => s.lastBackupAt)
  const toggleTheme = useAppStore((s) => s.toggleTheme)
  const setShowExportDialog = useAppStore((s) => s.setShowExportDialog)
  const setShowBackupsModal = useAppStore((s) => s.setShowBackupsModal)
  const setShowBookSettingsModal = useAppStore((s) => s.setShowBookSettingsModal)
  const { saveProject } = useProject()
  const manuscriptWords = useManuscriptWordTotal()

  const savedLabel = isDirty ? 'Saving…' : 'Saved'
  const backupLabel = backupStatusLabel(lastBackupAt, backupWarningCount)

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
        {projectTitle !== null && (
          <>
            <span className="text-border">|</span>
            <span>{projectTitle}</span>
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
          onClick={() => setShowBookSettingsModal(true)}
          title="Book Settings"
        >
          <Settings className="h-3 w-3" />
        </Button>
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
