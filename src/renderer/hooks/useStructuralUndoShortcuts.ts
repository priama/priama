import { useEffect } from 'react'
import { coordinatedRedo, coordinatedUndo } from '@/lib/coordinatedUndo'

export function useStructuralUndoShortcuts(): void {
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement
      const tag = target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      const mod = e.metaKey || e.ctrlKey
      if (!mod || e.key.toLowerCase() !== 'z') return

      e.preventDefault()
      e.stopPropagation()
      if (e.shiftKey) {
        void coordinatedRedo()
      } else {
        void coordinatedUndo()
      }
    }

    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [])

  useEffect(() => {
    const unsubUndo = window.electronAPI.on('menu:undo', () => {
      void coordinatedUndo()
    })
    const unsubRedo = window.electronAPI.on('menu:redo', () => {
      void coordinatedRedo()
    })
    return () => {
      unsubUndo()
      unsubRedo()
    }
  }, [])
}
