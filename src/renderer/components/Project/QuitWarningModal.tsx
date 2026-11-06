import { useEffect, useState } from 'react'
import { Check, Loader2, Plus, TriangleAlert } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/UI/dialog'
import { Button } from '@/components/UI/button'
import { useAppStore } from '@/store/appStore'
import type { BackupLocationStatus } from '@shared/types'

interface QuitWarningModalProps {
  unreachablePaths: string[]
  onCancel: () => void
  onQuitAnyway: () => void
}

type Phase = 'warn' | 'working' | 'done'

/** checkBackupLocations tells us which half of "unavailable" each path is. */
function reasonFor(status: BackupLocationStatus | undefined): string {
  if (!status) return 'Unavailable'
  if (!status.reachable) return 'Not found'
  if (!status.writable) return 'Not writable'
  return 'Unavailable'
}

function PathRow({
  path,
  trailing,
  icon
}: {
  path: string
  trailing: string
  icon: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex min-w-0 items-center gap-2.5 px-3 py-2.5 [&+&]:border-t [&+&]:border-border/60">
      {icon}
      <span className="min-w-0 flex-1 truncate text-[13px]" title={path}>
        {path}
      </span>
      <span className="shrink-0 text-xs text-muted-foreground">{trailing}</span>
    </div>
  )
}

export function QuitWarningModal({
  unreachablePaths,
  onCancel,
  onQuitAnyway
}: QuitWarningModalProps): React.JSX.Element {
  const projectMeta = useAppStore((s) => s.projectMeta)
  const [phase, setPhase] = useState<Phase>('warn')
  const [statuses, setStatuses] = useState<BackupLocationStatus[]>([])
  const [addedPath, setAddedPath] = useState<string | null>(null)
  const [stillUnreachable, setStillUnreachable] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  // Why each one failed — the quit payload carries paths only.
  useEffect(() => {
    let cancelled = false
    void window.electronAPI.tomes.checkBackupLocations(unreachablePaths).then((result) => {
      if (!cancelled) setStatuses(result)
    })
    return () => {
      cancelled = true
    }
  }, [unreachablePaths])

  const statusFor = (path: string): BackupLocationStatus | undefined =>
    statuses.find((s) => s.path === path)

  const handleAddBackup = async (): Promise<void> => {
    const projectId = projectMeta?.id
    if (!projectId) return

    const chosen = await window.electronAPI.dialog.chooseFolder('Choose Backup Location')
    if (!chosen) return

    setError(null)
    setAddedPath(chosen)
    setPhase('working')

    try {
      const config = await window.electronAPI.tomes.getConfig()
      const existing = config.backupLocations[projectId] ?? []
      if (!existing.includes(chosen)) {
        await window.electronAPI.tomes.updateBackupLocations(projectId, [...existing, chosen])
      }
      const result = await window.electronAPI.backup.create()
      setStillUnreachable(result.unreachablePaths)
      if (result.unreachablePaths.includes(chosen)) {
        setError('Priama could not write to that folder.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The backup did not finish.')
    } finally {
      setPhase('done')
    }
  }

  const savedHere = addedPath && !stillUnreachable.includes(addedPath) && !error

  return (
    <Dialog
      open
      onOpenChange={(v) => {
        // Nothing interrupts a copy in progress.
        if (!v && phase !== 'working') onCancel()
      }}
    >
      <DialogContent hideCloseButton={phase === 'working'}>
        {phase === 'working' ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <p className="text-[15px] font-medium">Backing up your project</p>
            {addedPath && (
              <p className="max-w-[360px] truncate text-xs text-muted-foreground" title={addedPath}>
                {addedPath}
              </p>
            )}
          </div>
        ) : phase === 'done' ? (
          <>
            <DialogHeader>
              <DialogTitle>{savedHere ? 'Backup saved' : 'Backup not saved'}</DialogTitle>
              <DialogDescription>
                {savedHere
                  ? 'Your project is copied to the folder you picked.'
                  : (error ?? 'The folder you picked could not be written to.')}
              </DialogDescription>
            </DialogHeader>

            {addedPath && (
              <div className="overflow-hidden rounded-lg border border-border bg-card">
                <PathRow
                  path={addedPath}
                  trailing={savedHere ? 'Saved' : 'Failed'}
                  icon={
                    savedHere ? (
                      <span className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full bg-emerald-500/15">
                        <Check className="h-2.5 w-2.5 text-emerald-700 dark:text-emerald-300" />
                      </span>
                    ) : (
                      <TriangleAlert className="h-3.5 w-3.5 shrink-0 text-destructive" />
                    )
                  }
                />
              </div>
            )}

            {stillUnreachable.length > 0 && (
              <p className="text-[13px] leading-5 text-muted-foreground">
                {stillUnreachable.length}{' '}
                {stillUnreachable.length === 1 ? 'other folder is' : 'other folders are'} still
                unavailable. Priama will copy to{' '}
                {stillUnreachable.length === 1 ? 'it' : 'them'} when it can reach{' '}
                {stillUnreachable.length === 1 ? 'it' : 'them'}.
              </p>
            )}

            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={onCancel}>
                Stay Open
              </Button>
              <Button onClick={onQuitAnyway}>Quit</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Some backups are unavailable</DialogTitle>
              <DialogDescription>
                Your project is saved. These copies could not be made:
              </DialogDescription>
            </DialogHeader>

            <div className="overflow-hidden rounded-lg border border-border bg-card">
              {unreachablePaths.map((path) => (
                <PathRow
                  key={path}
                  path={path}
                  trailing={reasonFor(statusFor(path))}
                  icon={<TriangleAlert className="h-3.5 w-3.5 shrink-0 text-amber-600" />}
                />
              ))}
            </div>

            <p className="text-[13px] leading-5 text-muted-foreground">
              Add a backup folder now, or quit and let Priama copy to these the next time it can
              reach them.
            </p>

            <DialogFooter className="gap-2 sm:justify-between">
              <Button
                variant="outline"
                onClick={() => void handleAddBackup()}
                disabled={!projectMeta}
              >
                <Plus />
                Add Backup
              </Button>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={onCancel}>
                  Stay Open
                </Button>
                <Button variant="destructive" onClick={onQuitAnyway}>
                  Quit Anyway
                </Button>
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
