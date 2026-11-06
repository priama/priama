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
import { ScrollArea } from '@/components/UI/scroll-area'
import { useAppStore } from '@/store/appStore'
import { useToastStore } from '@/components/UI/toast'
import { flushAllDirty } from '@/lib/contentPersistence'
import type { BackupRecord, BackupStatus } from '@shared/types'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'
import { RestoreBackupModal } from '@/components/Project/RestoreBackupModal'

const MAX_DESTINATIONS = 5

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

function SectionLabel({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </span>
  )
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
  const [restoreFileOpen, setRestoreFileOpen] = useState(false)

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
    setRestoreFileOpen(false)
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
  const local = status?.local ?? []
  const destinations = status?.destinations ?? []
  const totalBytes = local.reduce((sum, b) => sum + b.sizeBytes, 0)

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
    if (status.destinations.length >= MAX_DESTINATIONS) return
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
      <Dialog open={open && !confirmOpen && !restoreFileOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[600px] max-h-[calc(100vh-4rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Backups</DialogTitle>
            <DialogDescription>
              Zipped copies of the whole project. Restoring replaces what is on disk.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <SectionLabel>On this computer</SectionLabel>
              <div className="overflow-hidden rounded-lg border border-border">
                <ScrollArea className="h-52">
                  {local.length === 0 ? (
                    <p className="p-4 text-sm text-muted-foreground">
                      No backup zips yet. Make one below.
                    </p>
                  ) : (
                    local.map((b) => (
                      <button
                        key={b.path}
                        type="button"
                        onClick={() => setSelectedPath(b.path)}
                        className={cn(
                          'flex w-full min-w-0 items-center gap-3 px-3 py-2 text-left transition-colors [&+button]:border-t [&+button]:border-border/60',
                          selectedPath === b.path ? 'bg-accent' : 'hover:bg-accent/50'
                        )}
                      >
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="truncate text-[13px] font-medium">
                              {formatBackupDate(b.createdAt)}
                            </span>
                            <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                              {kindLabel(b.kind)}
                            </span>
                          </span>
                          <span className="truncate text-xs text-muted-foreground">
                            {b.name ? b.name : formatBackupWhen(b.createdAt)}
                          </span>
                        </span>
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                          {formatBytes(b.sizeBytes)}
                        </span>
                      </button>
                    ))
                  )}
                </ScrollArea>

                <div className="flex items-center gap-1 border-t border-border bg-muted/40 px-2 py-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    disabled={!selected || busy}
                    onClick={() => void handleReveal()}
                  >
                    Show in Folder
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                    disabled={!selected || busy}
                    onClick={() => {
                      setConfirmText('')
                      setConfirmOpen(true)
                    }}
                  >
                    Restore…
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    disabled={busy}
                    onClick={() => setRestoreFileOpen(true)}
                  >
                    Restore from file…
                  </Button>
                  <span className="ml-auto shrink-0 pr-1 text-xs tabular-nums text-muted-foreground">
                    {local.length} {local.length === 1 ? 'backup' : 'backups'}
                    {local.length > 0 && ` · ${formatBytes(totalBytes)}`}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid gap-2">
              <SectionLabel>New backup</SectionLabel>
              <div className="flex gap-2">
                <Input
                  placeholder="Name it, or leave blank"
                  value={backupName}
                  onChange={(e) => setBackupName(e.target.value)}
                  disabled={busy}
                />
                <Button
                  className="shrink-0"
                  disabled={busy || status?.inFlight}
                  onClick={() => void handleBackupNow()}
                >
                  {busy ? 'Backing up…' : 'Back Up Now'}
                </Button>
              </div>
            </div>

            <div className="grid gap-2">
              <SectionLabel>Copies elsewhere</SectionLabel>
              <div className="overflow-hidden rounded-lg border border-border">
                {destinations.map((d) => {
                  const ok = d.reachable && d.writable
                  return (
                    <div
                      key={d.path}
                      className="flex min-w-0 items-center gap-2.5 border-b border-border/60 px-3 py-2.5"
                    >
                      <span
                        className={cn(
                          'h-[7px] w-[7px] shrink-0 rounded-full',
                          ok ? 'bg-emerald-500' : 'bg-amber-500'
                        )}
                        aria-hidden
                      />
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="truncate text-[13px] font-medium">
                          {d.label || detectPathLabel(d.path)}
                        </span>
                        <span className="truncate text-xs text-muted-foreground" title={d.path}>
                          {d.path}
                        </span>
                        {d.lastSuccessfulCopyAt && (
                          <span className="truncate text-xs text-muted-foreground">
                            Last copy {formatBackupWhen(d.lastSuccessfulCopyAt)}
                          </span>
                        )}
                      </span>
                      <span
                        className={cn(
                          'shrink-0 text-xs',
                          ok ? 'text-muted-foreground' : 'text-amber-600'
                        )}
                      >
                        {ok ? 'Available' : !d.reachable ? 'Not found' : 'Not writable'}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0 text-muted-foreground"
                        onClick={() => void handleRemoveDestination(d.path)}
                        disabled={busy}
                        aria-label={`Remove ${d.path}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )
                })}

                <button
                  type="button"
                  onClick={() => void handleAddDestination()}
                  disabled={pickingFolder || busy || destinations.length >= MAX_DESTINATIONS}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-accent/50 disabled:pointer-events-none disabled:opacity-50"
                >
                  <span className="text-[13px] font-medium">Add a location…</span>
                  <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                    {destinations.length} of {MAX_DESTINATIONS}
                  </span>
                </button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RestoreBackupModal
        open={restoreFileOpen}
        onOpenChange={(v) => {
          setRestoreFileOpen(v)
          if (!v) void refresh()
        }}
        openProject={projectId && projectMeta ? { id: projectId, title: projectMeta.title } : null}
      />

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
