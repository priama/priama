import { useEffect, useRef, useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/UI/dialog'
import { Input } from '@/components/UI/input'
import { Button } from '@/components/UI/button'
import type { RecentProjectWithStatus } from '@shared/types'

const COUNTDOWN_SECONDS = 10

interface DeleteProjectModalProps {
  project: RecentProjectWithStatus | null
  onClose: () => void
  onConfirm: (project: RecentProjectWithStatus) => Promise<void>
}

/** primaryPath points at the project file; the folder around it is what gets removed. */
function projectFolderOf(primaryPath: string): string {
  const cut = Math.max(primaryPath.lastIndexOf('/'), primaryPath.lastIndexOf('\\'))
  return cut > 0 ? primaryPath.slice(0, cut) : primaryPath
}

function FactRow({
  title,
  path,
  note
}: {
  title: string
  path?: string
  note?: string
}): React.JSX.Element {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 px-3 py-2.5">
      <span className="text-[13px] font-medium">{title}</span>
      {path && (
        <span className="truncate text-xs text-muted-foreground" title={path}>
          {path}
        </span>
      )}
      {note && <span className="text-xs text-muted-foreground">{note}</span>}
    </div>
  )
}

export function DeleteProjectModal({
  project,
  onClose,
  onConfirm
}: DeleteProjectModalProps): React.JSX.Element {
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS)
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [backupPaths, setBackupPaths] = useState<string[]>([])
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!project) return
    setCountdown(COUNTDOWN_SECONDS)
    setConfirmText('')
    setDeleting(false)

    intervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [project?.id])

  // Backup folders live in the app config, keyed by project id — readable without opening it.
  useEffect(() => {
    const projectId = project?.id
    if (!projectId) return
    let cancelled = false
    void window.electronAPI.tomes.getConfig().then((config) => {
      if (!cancelled) setBackupPaths(config.backupLocations[projectId] ?? [])
    })
    // Clearing on the way out keeps one project's folders off the next one's dialog.
    return () => {
      cancelled = true
      setBackupPaths([])
    }
  }, [project?.id])

  const canConfirm =
    countdown === 0 && confirmText.trim() === project?.title?.trim() && !deleting

  const handleConfirm = async (): Promise<void> => {
    if (!project || !canConfirm) return
    setDeleting(true)
    try {
      await onConfirm(project)
    } finally {
      setDeleting(false)
    }
  }

  const handleOpenChange = (open: boolean): void => {
    if (!open && !deleting) onClose()
  }

  const deleteLabel = deleting
    ? 'Deleting…'
    : countdown > 0
      ? `Delete in ${countdown}`
      : 'Delete'

  return (
    <Dialog open={!!project} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="items-center gap-2 space-y-0 text-center sm:text-center">
          <span
            className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-destructive/10"
            aria-hidden
          >
            <TriangleAlert className="h-5 w-5 text-destructive" />
          </span>
          <DialogTitle className="leading-snug">
            Delete &ldquo;{project?.title}&rdquo;?
          </DialogTitle>
          <DialogDescription className="max-w-[320px]">
            This removes the project folder from your computer. It cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="overflow-hidden rounded-lg border border-border">
            <FactRow
              title="Deleted from your computer"
              path={project ? projectFolderOf(project.primaryPath) : undefined}
              note="Backups saved inside this folder go with it."
            />
            <div className="ml-3 h-px bg-border" />
            {backupPaths.length === 0 ? (
              <FactRow
                title="No backup copies elsewhere"
                note="Nothing of this project survives outside the folder above."
              />
            ) : (
              <div className="flex min-w-0 flex-col gap-0.5 px-3 py-2.5">
                <span className="text-[13px] font-medium">
                  {backupPaths.length} backup {backupPaths.length === 1 ? 'folder' : 'folders'} kept
                </span>
                {backupPaths.map((path) => (
                  <span key={path} className="truncate text-xs text-muted-foreground" title={path}>
                    {path}
                  </span>
                ))}
                <span className="mt-1 text-xs text-muted-foreground">
                  Priama does not delete these. Remove them yourself if you want them gone.
                </span>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="delete-confirm" className="text-sm text-muted-foreground">
              Type <span className="font-medium text-foreground">{project?.title}</span> to confirm
            </label>
            <Input
              id="delete-confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleConfirm()
              }}
              placeholder="Project name"
              disabled={deleting}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} disabled={deleting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            className="tabular-nums"
            onClick={() => void handleConfirm()}
            disabled={!canConfirm}
          >
            {deleteLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
