import { HelpCircle, TriangleAlert } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/UI/dialog'
import { Button } from '@/components/UI/button'
import { cn } from '@/lib/utils'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  onConfirm: () => void | Promise<void>
}

/**
 * One shape for every confirmation: icon, question, consequence, two buttons.
 * The confirm button carries the verb — never "OK".
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm
}: ConfirmDialogProps): React.JSX.Element {
  const Icon = destructive ? TriangleAlert : HelpCircle

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader className="items-center gap-2 space-y-0 text-center sm:text-center">
          <span
            className={cn(
              'grid h-12 w-12 shrink-0 place-items-center rounded-full',
              destructive ? 'bg-destructive/10' : 'bg-muted'
            )}
            aria-hidden
          >
            <Icon
              className={cn('h-5 w-5', destructive ? 'text-destructive' : 'text-muted-foreground')}
            />
          </span>
          <DialogTitle className="leading-snug">{title}</DialogTitle>
          <DialogDescription className="max-w-[320px]">{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            onClick={() => {
              void Promise.resolve(onConfirm()).finally(() => onOpenChange(false))
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
