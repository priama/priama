import { useCallback, useEffect, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
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
import { useToastStore } from '@/components/UI/toast'
import { flushAllDirty } from '@/lib/contentPersistence'
import type { BackupRecord, BackupStatus } from '@shared/types'
import { cn } from '@/lib/utils'
import { FolderOpen, Plus, Trash2, RotateCcw, HardDrive } from 'lucide-react'

interface BackupsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function kindLabel(kind: BackupRecord['kind']): string {
  if (kind === 'named') return 'Named'
  if (kind === 'pre-restore') return 'Before restore'
  return 'Automatic'
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function formatBackupWhen(iso: string): string {
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) return iso
  try {
    return formatDistanceToNow(new Date(ms), { addSuffix: true })
  } catch {
    return new Date(ms).toLocaleString()
  }
}

function formatBackupDate(iso: string): string {
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) return iso
  return new Date(ms).toLocaleString()
}

function detectPathLabel(path: string): string {
  const lower = path.toLowerCase()
  if (lower.includes('icloud')) return 'iCloud Drive'
  if (lower.includes('google drive')) return 'Google Drive'
  if (lower.includes('mega')) return 'MEGA'
  if (path.startsWith('/Volumes/')) return 'External Drive'
  return 'Local Folder'
}

export function BackupsModal({ open, onOpenChange }: BackupsModalProps): React.JSX.Element {
  const projectMeta = useAppStore((s) => s.projectMeta)
  const projectId = useAppStore((s) => s.projectId)
  const setLastBackupAt = useAppStore((s) => s.setLastBackupAt)
  const addToast = useToastStore((s) => s.addToast)

  const [status, setStatus] = useState<BackupStatus | null>(null)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [backupName, setBackupName] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [pickingFolder, setPickingFolder] = useState(false)

  const refresh = useCallback(async () => {
    const api = window.electronAPI.backup
    if (typeof api?.status !== 'function') {
      addToast({
        title: 'Restart Priama to use Backups',
        description: 'The backup screen needs a full app restart after the update.',
        variant: 'warning'
      })
      return
    }
    const next = await api.status()
    setStatus(next)
    if (next?.lastLocalBackupAt) {
      setLastBackupAt(next.lastLocalBackupAt)
    }
    if (next?.local.length && !selectedPath) {
      setSelectedPath(next.local[0].path)
    }
  }, [setLastBackupAt, selectedPath, addToast])

  useEffect(() => {
    if (!open) return
    setConfirmOpen(false)
    setConfirmText('')
    setBackupName('')
    setSelectedPath(null)
    void refresh()
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps -- refresh on open only

  useEffect(() => {
    if (!open) return
    const unsub = window.electronAPI.on('backup:result', () => {
      void refresh()
    })
    return unsub
  }, [open, refresh])

  const selected = status?.local.find((b) => b.path === selectedPath) ?? null

  const handleBackupNow = async (): Promise<void> => {
    setBusy(true)
    try {
      await flushAllDirty()
      const result = await window.electronAPI.backup.create(backupName.trim() || undefined)
      if (result.warnings.length === 0 && result.localBackupPath) {
        addToast({
          title: 'Backup created',
          description: backupName.trim() || 'Automatic backup saved.',
          variant: 'success'
        })
      }
      setBackupName('')
      await refresh()
      if (result.localBackupPath) setSelectedPath(result.localBackupPath)
    } catch (err) {
      addToast({
        title: 'Backup failed',
        description: err instanceof Error ? err.message : 'Could not create backup',
        variant: 'warning'
      })
    } finally {
      setBusy(false)
    }
  }

  const handleReveal = async (): Promise<void> => {
    if (!selected) return
    await window.electronAPI.tomes.showInFolder(selected.path)
  }

  const handleRestoreConfirm = async (): Promise<void> => {
    if (!selected || !projectMeta) return
    if (confirmText.trim() !== projectMeta.title) return
    setBusy(true)
    try {
      await flushAllDirty()
      const result = await window.electronAPI.backup.restore(selected.path)
      if (!result.success) {
        addToast({
          title: 'Restore failed',
          description: result.message ?? 'Could not restore from backup',
          variant: 'warning'
        })
        return
      }
      addToast({
        title: 'Project restored',
        description: 'Your project was restored from the selected backup.',
        variant: 'success'
      })
      setConfirmOpen(false)
      onOpenChange(false)
    } catch (err) {
      addToast({
        title: 'Restore failed',
        description: err instanceof Error ? err.message : 'Could not restore from backup',
        variant: 'warning'
      })
    } finally {
      setBusy(false)
    }
  }

  const handleAddDestination = async (): Promise<void> => {
    if (!projectId || !status) return
    if (status.destinations.length >= 5) return
    setPickingFolder(true)
    try {
      const path = await window.electronAPI.dialog.chooseFolder('Choose Backup Location')
      if (!path) return
      if (status.destinations.some((d) => d.path === path)) return
      const paths = [...status.destinations.map((d) => d.path), path]
      await window.electronAPI.tomes.updateBackupLocations(projectId, paths)
      await refresh()
    } finally {
      setPickingFolder(false)
    }
  }

  const handleRemoveDestination = async (path: string): Promise<void> => {
    if (!projectId || !status) return
    const paths = status.destinations.map((d) => d.path).filter((p) => p !== path)
    await window.electronAPI.tomes.updateBackupLocations(projectId, paths)
    await refresh()
  }

  const title = projectMeta?.title ?? 'Project'

  return (
    <>
      <Dialog open={open && !confirmOpen} onOpenChange={onOpenChange}>
        <DialogContent presentation="sheet" className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Backups</DialogTitle>
            <DialogDescription>
              Local zip copies of this project for disaster recovery. Restoring replaces the whole
              project on disk.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Local backups</Label>
              <ScrollArea className="h-48 rounded-md border border-border">
                {!status?.local.length ? (
                  <p className="p-4 text-sm text-muted-foreground">
                    No backup zips yet. Use Backup now.
                  </p>
                ) : (
                  <ul className="divide-y divide-border">
                    {status.local.map((b) => (
                      <li key={b.path}>
                        <button
                          type="button"
                          className={cn(
                            'flex w-full flex-col gap-0.5 px-3 py-2 text-left text-sm transition-colors hover:bg-accent/50',
                            selectedPath === b.path && 'bg-accent/60'
                          )}
                          onClick={() => setSelectedPath(b.path)}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">
                              {formatBackupDate(b.createdAt)}
                            </span>
                            <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                              {kindLabel(b.kind)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                            <span className="truncate">
                              {b.name ? b.name : formatBackupWhen(b.createdAt)}
                            </span>
                            <span>{formatBytes(b.sizeBytes)}</span>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </ScrollArea>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!selected || busy}
                  onClick={() => void handleReveal()}
                >
                  <FolderOpen className="mr-1 h-3.5 w-3.5" />
                  Show in Folder
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={!selected || busy}
                  onClick={() => {
                    setConfirmText('')
                    setConfirmOpen(true)
                  }}
                >
                  <RotateCcw className="mr-1 h-3.5 w-3.5" />
                  Restore project…
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Backup now</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Optional name (e.g. Before rewrite)"
                  value={backupName}
                  onChange={(e) => setBackupName(e.target.value)}
                  disabled={busy}
                />
                <Button disabled={busy || status?.inFlight} onClick={() => void handleBackupNow()}>
                  <HardDrive className="mr-1 h-3.5 w-3.5" />
                  Backup
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">External copies</Label>
              <div className="space-y-2">
                {(status?.destinations ?? []).map((d) => (
                  <div
                    key={d.path}
                    className="flex items-start gap-2 rounded-md border border-border p-2 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span className="rounded bg-muted px-1.5 py-0.5 text-xs">
                          {d.label || detectPathLabel(d.path)}
                        </span>
                        <span
                          className={cn(
                            'text-xs',
                            d.reachable && d.writable ? 'text-muted-foreground' : 'text-amber-500'
                          )}
                        >
                          {d.reachable && d.writable ? 'Available' : 'Unavailable'}
                        </span>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">{d.path}</p>
                      {d.lastSuccessfulCopyAt && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Last copy: {formatBackupWhen(d.lastSuccessfulCopyAt)}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => void handleRemoveDestination(d.path)}
                      disabled={busy}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                {(status?.destinations.length ?? 0) < 5 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void handleAddDestination()}
                    disabled={pickingFolder || busy}
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    Add location
                  </Button>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmOpen} onOpenChange={(v) => !v && setConfirmOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restore this backup?</DialogTitle>
            <DialogDescription>
              This replaces the open project on disk with the selected backup. A “before restore”
              zip is saved first. Type the project title “{title}” to confirm.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={title}
            autoFocus
          />
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={busy || confirmText.trim() !== title}
              onClick={() => void handleRestoreConfirm()}
            >
              Restore project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
