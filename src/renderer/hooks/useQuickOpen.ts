import { useEffect } from 'react'
import { useAppStore } from '@/store/appStore'

/** Wires Edit → Quick Open (Cmd+P) and keeps overlay open state in sync. */
export function useQuickOpen(): void {
  const isProjectOpen = useAppStore((s) => s.isProjectOpen)
  const setQuickOpenOpen = useAppStore((s) => s.setQuickOpenOpen)

  useEffect(() => {
    const unsub = window.electronAPI.on('menu:quickOpen', () => {
      const state = useAppStore.getState()
      if (!state.isProjectOpen) return
      if (state.quickOpenOpen) {
        window.dispatchEvent(new CustomEvent('quick-open:refocus'))
        return
      }
      setQuickOpenOpen(true)
    })
    return unsub
  }, [setQuickOpenOpen])

  useEffect(() => {
    if (!isProjectOpen) {
      useAppStore.getState().setQuickOpenOpen(false)
    }
  }, [isProjectOpen])
}
