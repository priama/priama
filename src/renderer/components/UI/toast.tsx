import { create } from 'zustand'
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ToastVariant = 'default' | 'warning' | 'success'

export interface ToastAction {
  label: string
  onClick: () => void
}

export interface ToastInput {
  title: string
  description?: string
  variant?: ToastVariant
  /** Only where the message earns one — "Show", "Undo". Never just to say "done". */
  action?: ToastAction
}

interface Toast extends Required<Pick<ToastInput, 'title' | 'variant'>> {
  id: string
  description?: string
  action?: ToastAction
}

interface ToastState {
  toasts: Toast[]
  addToast: (input: ToastInput) => void
  removeToast: (id: string) => void
}

const AUTO_DISMISS_MS = 6500

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: ({ title, description, variant = 'default', action }) => {
    const id = crypto.randomUUID()
    set((s) => ({
      toasts: [
        ...s.toasts.filter((t) => !(t.title === title && t.variant === variant)),
        { id, title, description, variant, action }
      ]
    }))
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
    }, AUTO_DISMISS_MS)
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
}))

function ToastIcon({ variant }: { variant: ToastVariant }): React.JSX.Element {
  if (variant === 'warning') {
    return <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden />
  }
  if (variant === 'success') {
    return <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden />
  }
  return <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
}

export function Toaster(): React.JSX.Element {
  const { toasts, removeToast } = useToastStore()

  if (toasts.length === 0) return <></>

  return (
    <div
      className="fixed bottom-10 right-4 z-[100] flex w-[min(100vw-2rem,22rem)] flex-col gap-2"
      role="region"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className={cn(
            'animate-in fade-in slide-in-from-bottom-2 flex items-start gap-3 rounded-lg border px-3.5 py-3 shadow-lg duration-200',
            toast.variant === 'warning' &&
              'border-amber-500/35 bg-card text-foreground shadow-amber-950/20',
            toast.variant === 'success' &&
              'border-emerald-500/35 bg-card text-foreground',
            toast.variant === 'default' && 'border-border bg-card text-foreground'
          )}
        >
          <ToastIcon variant={toast.variant} />
          <div className="min-w-0 flex-1 space-y-0.5">
            <p className="text-sm font-medium leading-snug">{toast.title}</p>
            {toast.description ? (
              <p className="text-xs leading-relaxed text-muted-foreground">{toast.description}</p>
            ) : null}
          </div>
          {toast.action && (
            <button
              type="button"
              onClick={() => {
                toast.action?.onClick()
                removeToast(toast.id)
              }}
              className="shrink-0 self-center rounded-md px-2 py-1 text-xs font-medium transition-colors hover:bg-muted"
            >
              {toast.action.label}
            </button>
          )}
          <button
            type="button"
            onClick={() => removeToast(toast.id)}
            className="shrink-0 rounded-md p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}
