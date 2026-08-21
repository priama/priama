import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/UI/dialog'
import { Button } from '@/components/UI/button'

interface QuitWarningModalProps {
  open: boolean
  unreachablePaths: string[]
  onCancel: () => void
  onQuitAnyway: () => void
}

export function QuitWarningModal({
  open,
  unreachablePaths,
  onCancel,
  onQuitAnyway
}: QuitWarningModalProps): React.JSX.Element {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Some backup locations are unavailable</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-3 pt-2">
              <ul className="list-inside list-disc text-sm text-muted-foreground">
                {unreachablePaths.map((p) => (
                  <li key={p} className="break-all">
                    {p}
                  </li>
                ))}
              </ul>
              <p className="text-sm text-muted-foreground">
                Your project is saved at its primary location. Connect the missing drives and
                re-open Priama so the next backup can copy there.
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onQuitAnyway}>
            Quit Anyway
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
