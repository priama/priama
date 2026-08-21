import { useEffect } from 'react'
import { useAppStore } from '@/store/appStore'

/** Wires Edit → Find in Project (Cmd+Shift+F) and keeps overlay open state in sync. */
export function useProjectFind(): void {
  const isProjectOpen = useAppStore((s) => s.isProjectOpen)
  const setProjectFindOpen = useAppStore((s) => s.setProjectFindOpen)

  useEffect(() => {
    const unsub = window.electronAPI.on('menu:findInProject', () => {
      const state = useAppStore.getState()
      if (!state.isProjectOpen) return
      if (state.projectFindOpen) {
        // Already open — re-focus by toggling focus via a no-op reopen signal:
        // consumers listen to projectFindOpen; keep true and dispatch a custom event.
        window.dispatchEvent(new CustomEvent('project-find:refocus'))
        return
      }
      setProjectFindOpen(true)
    })
    return unsub
  }, [setProjectFindOpen])

  useEffect(() => {
    if (!isProjectOpen) {
      useAppStore.getState().setProjectFindOpen(false)
    }
  }, [isProjectOpen])
}
