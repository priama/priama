import { formatDistanceToNow } from 'date-fns'
import { Moon, Sun, Download, Save, BookOpen } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { Button } from '@/components/UI/button'
import { useProject } from '@/hooks/useProject'
import { FocusModeButton } from '@/components/Editor/FocusModeButton'

export function StatusBar(): React.JSX.Element {
  const {
    lastSaved,
    isDirty,
    theme,
    toggleTheme,
    projectMeta,
    backupWarningCount,
    setShowExportDialog
  } = useAppStore()
  const { saveProject } = useProject()

  const savedLabel = isDirty
    ? 'Unsaved changes'
    : lastSaved
      ? `Last saved: ${formatDistanceToNow(new Date(lastSaved), { addSuffix: true })}`
      : 'Ready'

  const backupLabel =
    backupWarningCount > 0
      ? `Backup warning: ${backupWarningCount} location${backupWarningCount === 1 ? '' : 's'} unavailable`
      : 'All backups synced'

  const openDevicePreview = (): void => {
    void window.electronAPI.windows.openDevicePreview({ scope: 'manuscript' })
  }

  return (
    <footer className="flex h-7 shrink-0 items-center justify-between border-t border-border bg-muted/30 px-4 text-xs text-muted-foreground">
      <div className="flex items-center gap-3">
        <span>{savedLabel}</span>
        <span className="text-border">|</span>
        <span className={backupWarningCount > 0 ? 'text-amber-500' : ''}>{backupLabel}</span>
        {projectMeta && (
          <>
            <span className="text-border">|</span>
            <span>{projectMeta.title}</span>
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
