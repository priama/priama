import { useCallback, useState } from 'react'
import { ArchiveRestore, FileArchive, FolderInput, ShieldCheck, TriangleAlert } from 'lucide-react'
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
import { useToastStore } from '@/components/UI/toast'
import { useProject } from '@/hooks/useProject'
import { flushAllDirty } from '@/lib/contentPersistence'
import type { BackupInspection, BackupInspectionCounts } from '@shared/types'

interface RestoreBackupModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /**
   * The project open right now, when there is one. Only a backup carrying this
   * project's own id can be restored in place; anything else is opened as a copy.
   */
  openProject?: { id: string; title: string } | null
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function formatWhen(iso?: string): string | null {
  if (!iso) return null
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) return null
  return new Date(ms).toLocaleString()
}

function summariseCounts(counts?: BackupInspectionCounts): string {
  if (!counts) return ''
  const parts: string[] = []
  const add = (n: number, one: string, many: string): void => {
    if (n > 0) parts.push(`${n} ${n === 1 ? one : many}`)
  }
  add(counts.chapters, 'chapter', 'chapters')
  add(counts.scenes, 'scene', 'scenes')
  add(counts.characters, 'character', 'characters')
  add(counts.locations, 'location', 'locations')
  add(counts.lore, 'lore entry', 'lore entries')
  add(counts.notes, 'note', 'notes')
  add(counts.entries, 'entry', 'entries')
  return parts.length > 0 ? parts.join(' · ') : 'Empty project — no chapters or wiki entries'
}

export function RestoreBackupModal({
  open,
  onOpenChange,
  openProject = null
}: RestoreBackupModalProps): React.JSX.Element {
  const addToast = useToastStore((s) => s.addToast)
  const { openProjectAtPath } = useProject()

  const [inspection, setInspection] = useState<BackupInspection | null>(null)
  const [confirmText, setConfirmText] = useState('')
  const [busy, setBusy] = useState(false)

  /** Closing always comes through here, so the next open starts from a clean sheet. */
  const handleOpenChange = useCallback(
    (next: boolean): void => {
      if (!next) {
        setInspection(null)
        setConfirmText('')
        setBusy(false)
      }
      onOpenChange(next)
    },
    [onOpenChange]
  )

  const handleChooseFile = useCallback(async () => {
    const api = window.electronAPI.backup
    if (typeof api?.inspect !== 'function' || typeof window.electronAPI.dialog?.selectBackupZip !== 'function') {
      addToast({
        title: 'Restart Priama to restore from a file',
        description: 'This needs a full app restart after the update.',
        variant: 'warning'
      })
      return
    }

    setBusy(true)
    try {
      const path = await window.electronAPI.dialog.selectBackupZip()
      if (!path) return
      setConfirmText('')
      setInspection(await api.inspect(path))
    } catch (err) {
      addToast({
        title: "Couldn't read that file",
        description: err instanceof Error ? err.message : 'The backup could not be inspected',
        variant: 'warning'
      })
    } finally {
      setBusy(false)
    }
  }, [addToast])

  const handleRestoreInPlace = async (): Promise<void> => {
    if (!inspection?.valid || !openProject) return
    if (confirmText.trim() !== openProject.title) return

    setBusy(true)
    try {
      await flushAllDirty()
      const result = await window.electronAPI.backup.restoreFromFile(inspection.path)
      if (!result.success) {
        addToast({
          title: 'Restore failed',
          description: result.message ?? 'Could not restore from that backup',
          variant: 'warning'
        })
        return
      }
      addToast({
        title: 'Project restored',
        description: `Restored from ${inspection.fileName}.`,
        variant: 'success'
      })
      handleOpenChange(false)
    } catch (err) {
      addToast({
        title: 'Restore failed',
        description: err instanceof Error ? err.message : 'Could not restore from that backup',
        variant: 'warning'
      })
    } finally {
      setBusy(false)
    }
  }

  const handleImportAsProject = async (): Promise<void> => {
    if (!inspection?.valid) return

    setBusy(true)
    try {
      const parentDir = await window.electronAPI.dialog.chooseFolder(
        'Choose Where to Save the Restored Project'
      )
      if (!parentDir) return

      if (openProject) {
        await flushAllDirty()
      }

      const result = await window.electronAPI.backup.importAsProject(inspection.path, parentDir)
      if (!result.success || !result.path) {
        addToast({
          title: "Couldn't restore that backup",
          description: result.message ?? 'The backup could not be unpacked',
          variant: 'warning'
        })
        return
      }

      addToast({
        title: 'Backup restored',
        description: result.reassignedId
          ? `“${result.title}” was restored as a separate copy, so the original project is untouched.`
          : `“${result.title}” was restored from ${inspection.fileName}.`,
        variant: 'success'
      })
      handleOpenChange(false)
      await openProjectAtPath(result.path)
    } catch (err) {
      addToast({
        title: "Couldn't restore that backup",
        description: err instanceof Error ? err.message : 'The backup could not be unpacked',
        variant: 'warning'
      })
    } finally {
      setBusy(false)
    }
  }

  const sameProject = Boolean(inspection?.valid && inspection.matchesOpenProject && openProject)
  const savedAt = formatWhen(inspection?.lastSavedAt)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Restore from a backup file</DialogTitle>
          <DialogDescription>
            Pick any Priama backup zip — from an external drive, a cloud folder, or another
            machine. Priama checks the archive before offering to do anything with it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Button variant="outline" onClick={() => void handleChooseFile()} disabled={busy}>
            <FileArchive className="mr-1.5 h-3.5 w-3.5" />
            {inspection ? 'Choose a different file…' : 'Choose backup zip…'}
          </Button>

          {inspection && !inspection.valid && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3">
              <div className="flex items-center gap-2 text-sm font-medium text-amber-500">
                <TriangleAlert className="h-4 w-4 shrink-0" />
                Not a Priama backup
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{inspection.message}</p>
              <p className="mt-1 truncate text-xs text-muted-foreground">{inspection.fileName}</p>
            </div>
          )}

          {inspection?.valid && (
            <div className="space-y-3 rounded-md border border-border p-3">
              <div className="flex items-center gap-2 text-sm font-medium text-emerald-500">
                <ShieldCheck className="h-4 w-4 shrink-0" />
                Valid Priama project backup
              </div>

              <div className="space-y-1 text-sm">
                <p className="font-medium">{inspection.title}</p>
                {inspection.author && (
                  <p className="text-xs text-muted-foreground">by {inspection.author}</p>
                )}
                <p className="text-xs text-muted-foreground">{summariseCounts(inspection.counts)}</p>
                {savedAt && (
                  <p className="text-xs text-muted-foreground">Last saved in backup: {savedAt}</p>
                )}
                <p className="truncate text-xs text-muted-foreground">
                  {inspection.fileName} · {formatBytes(inspection.sizeBytes)}
                  {inspection.roots?.length ? ` · ${inspection.roots.join(', ')}` : ''}
                </p>
              </div>

              {openProject && !sameProject && (
                <p className="rounded bg-muted/60 p-2 text-xs text-muted-foreground">
                  This backup is for a different project than the one you have open, so it can only
                  be restored as a separate project. Nothing already on disk is changed.
                </p>
              )}

              {sameProject && (
                <div className="space-y-2 border-t border-border pt-3">
                  <Label className="text-xs text-muted-foreground">
                    Restore over “{openProject?.title}”
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    This replaces the open project on disk. A “before restore” zip is saved first.
                    Type the project title to confirm.
                  </p>
                  <Input
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder={openProject?.title}
                    disabled={busy}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => handleOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          {inspection?.valid && (
            <Button
              variant="outline"
              onClick={() => void handleImportAsProject()}
              disabled={busy}
            >
              <FolderInput className="mr-1.5 h-3.5 w-3.5" />
              Open as a new project…
            </Button>
          )}
          {sameProject && (
            <Button
              variant="destructive"
              onClick={() => void handleRestoreInPlace()}
              disabled={busy || confirmText.trim() !== openProject?.title}
            >
              <ArchiveRestore className="mr-1.5 h-3.5 w-3.5" />
              Restore over project
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
