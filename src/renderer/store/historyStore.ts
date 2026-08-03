import { create } from 'zustand'
import { useToastStore } from '@/components/UI/toast'

export interface StructuralCommand {
  description: string
  execute(): Promise<void>
  undo(): Promise<void>
  /** Present on create commands so callers can select the new node after push */
  getCreatedId?: () => string | null
}

interface HistoryState {
  past: StructuralCommand[]
  future: StructuralCommand[]
  isUndoing: boolean
  canUndo: boolean
  canRedo: boolean

  push: (cmd: StructuralCommand) => Promise<string | null>
  undo: () => Promise<void>
  redo: () => Promise<void>
  clear: () => void
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  past: [],
  future: [],
  isUndoing: false,
  canUndo: false,
  canRedo: false,

  push: async (cmd) => {
    await cmd.execute()
    set((s) => ({
      past: [...s.past, cmd],
      future: [],
      canUndo: true,
      canRedo: false
    }))
    return cmd.getCreatedId?.() ?? null
  },

  undo: async () => {
    const { past } = get()
    if (past.length === 0) return
    const cmd = past[past.length - 1]
    set({ isUndoing: true })
    try {
      await cmd.undo()
      set((s) => ({
        past: s.past.slice(0, -1),
        future: [cmd, ...s.future],
        isUndoing: false,
        canUndo: s.past.length - 1 > 0,
        canRedo: true
      }))
    } catch (err) {
      console.error('Undo failed:', err)
      set({ isUndoing: false })
      useToastStore.getState().addToast({ title: 'Undo failed', variant: 'warning' })
    }
  },

  redo: async () => {
    const { future } = get()
    if (future.length === 0) return
    const cmd = future[0]
    set({ isUndoing: true })
    try {
      await cmd.execute()
      set((s) => ({
        past: [...s.past, cmd],
        future: s.future.slice(1),
        isUndoing: false,
        canUndo: true,
        canRedo: s.future.length - 1 > 0
      }))
    } catch (err) {
      console.error('Redo failed:', err)
      set({ isUndoing: false })
      useToastStore.getState().addToast({ title: 'Redo failed', variant: 'warning' })
    }
  },

  clear: () => set({ past: [], future: [], canUndo: false, canRedo: false, isUndoing: false })
}))
