import { create } from 'zustand'

interface Toast {
  id: string
  message: string
  variant?: 'default' | 'warning'
}

interface ToastState {
  toasts: Toast[]
  addToast: (message: string, variant?: 'default' | 'warning') => void
  removeToast: (id: string) => void
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (message, variant = 'default') => {
    const id = crypto.randomUUID()
    set((s) => ({ toasts: [...s.toasts, { id, message, variant }] }))
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
    }, 5000)
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
}))

export function Toaster(): React.JSX.Element {
  const { toasts, removeToast } = useToastStore()

  if (toasts.length === 0) return <></>

  return (
    <div className="fixed bottom-10 right-4 z-[100] flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex max-w-sm items-center gap-2 rounded-lg border px-4 py-3 text-sm shadow-lg ${
            toast.variant === 'warning'
              ? 'border-amber-500/50 bg-amber-500/10 text-amber-200'
              : 'border-border bg-card text-foreground'
          }`}
        >
          <span className="flex-1">{toast.message}</span>
          <button
            onClick={() => removeToast(toast.id)}
            className="text-muted-foreground hover:text-foreground"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
