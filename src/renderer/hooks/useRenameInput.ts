import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type ChangeEvent,
  type FocusEvent,
  type KeyboardEvent,
  type RefObject
} from 'react'
import { useAppStore } from '@/store/appStore'
import {
  cancelRenameSession,
  commitRenameSession,
  markRenameFocusFailed,
  registerRenameSurface,
  unregisterRenameSurface,
  reconcileRenameOwner
} from '@/lib/pendingRename'
import { type RenameSurface } from '@/lib/renameSession'

const FOCUS_RETRY_DELAYS_MS = [0, 50, 120, 280, 360]

function isElementFocused(el: HTMLInputElement | null): boolean {
  return !!el && document.activeElement === el
}

function isElementVisible(el: HTMLInputElement | null): boolean {
  if (!el) return false
  const rect = el.getBoundingClientRect()
  return rect.width > 0 && rect.height > 0
}

export type UseRenameInputResult = {
  inputRef: RefObject<HTMLInputElement | null>
  /** True when this surface should render the rename editor for the node. */
  isEditing: boolean
  /** Shared draft from the rename transaction (empty when not editing). */
  draft: string
  requestId: string | null
  onChange: (e: ChangeEvent<HTMLInputElement>) => void
  onFocus: (e: FocusEvent<HTMLInputElement>) => void
  onBlur: () => void
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void
}

/**
 * Registers a mounted rename surface, claims ownership when appropriate,
 * drives focus/select-all with retries, and binds to the durable session draft.
 */
export function useRenameInput(
  surface: RenameSurface,
  nodeId: string,
  options?: {
    /** When false, surface is not considered mounted (e.g. sidebar collapsed). */
    enabled?: boolean
  }
): UseRenameInputResult {
  const enabledOpt = options?.enabled !== false
  const inputRef = useRef<HTMLInputElement | null>(null)
  const focusAttemptRef = useRef(0)

  const requestId = useAppStore((s) => {
    const session = s.renameSession
    if (!session || session.nodeId !== nodeId) return null
    if (!session.preferredSurfaces.includes(surface)) return null
    return session.requestId
  })
  const isOwner = useAppStore((s) => {
    const session = s.renameSession
    return !!session && session.requestId === requestId && session.owner === surface
  })
  const isEditing = useAppStore((s) => {
    const session = s.renameSession
    if (!session || session.requestId !== requestId) return false
    if (session.owner === surface) return true
    if (session.owner === null) {
      return session.preferredSurfaces[0] === surface
    }
    return false
  })
  const draft = useAppStore((s) => {
    const session = s.renameSession
    if (!session || session.requestId !== requestId || !isEditing) return ''
    return session.draft
  })

  const enabled = enabledOpt && requestId !== null

  useEffect(() => {
    if (!enabled) return
    registerRenameSurface(nodeId, surface)
    return () => unregisterRenameSurface(nodeId, surface)
  }, [enabled, nodeId, surface])

  useEffect(() => {
    if (!enabled || !requestId) return
    reconcileRenameOwner(nodeId)
  }, [enabled, nodeId, requestId, isOwner])

  const focusAndSelect = useCallback((): boolean => {
    const el = inputRef.current
    if (!el || !isElementVisible(el)) return false
    el.focus({ preventScroll: true })
    if (!isElementFocused(el)) return false
    const store = useAppStore.getState()
    const current = store.renameSession
    if (!current || current.nodeId !== nodeId || current.owner !== surface) return false
    if (!current.selectAllConsumed) {
      el.select()
      store.markSelectAllConsumed(current.requestId)
    }
    return true
  }, [nodeId, surface])

  useLayoutEffect(() => {
    if (!isOwner || !requestId) return

    focusAttemptRef.current = 0
    const timers: number[] = []
    let cancelled = false

    const attempt = (): void => {
      if (cancelled) return
      const current = useAppStore.getState().renameSession
      if (!current || current.requestId !== requestId || current.owner !== surface) return
      if (focusAndSelect()) return

      focusAttemptRef.current += 1
      const delay = FOCUS_RETRY_DELAYS_MS[focusAttemptRef.current]
      if (delay === undefined) {
        markRenameFocusFailed(requestId, surface)
        useAppStore.getState().releaseRenameOwner(requestId, surface)
        reconcileRenameOwner(nodeId)
        return
      }
      timers.push(window.setTimeout(attempt, delay))
    }

    const raf = requestAnimationFrame(() => {
      if (!focusAndSelect()) attempt()
    })

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      for (const t of timers) clearTimeout(t)
    }
  }, [isOwner, requestId, nodeId, surface, focusAndSelect])

  useEffect(() => {
    if (!isOwner || !requestId) return
    const onFocusIn = (): void => {
      const current = useAppStore.getState().renameSession
      if (!current || current.requestId !== requestId || current.owner !== surface) return
      if (isElementFocused(inputRef.current)) return
      const active = document.activeElement
      if (
        active &&
        active !== document.body &&
        active !== document.documentElement &&
        active instanceof HTMLElement &&
        (active.tagName === 'INPUT' ||
          active.tagName === 'TEXTAREA' ||
          active.isContentEditable)
      ) {
        return
      }
      focusAndSelect()
    }
    window.addEventListener('focusin', onFocusIn)
    return () => window.removeEventListener('focusin', onFocusIn)
  }, [isOwner, requestId, surface, focusAndSelect])

  const onChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      if (!requestId) return
      useAppStore.getState().updateRenameDraft(requestId, e.target.value)
    },
    [requestId]
  )

  const onFocus = useCallback(
    (e: FocusEvent<HTMLInputElement>) => {
      const current = useAppStore.getState().renameSession
      if (!current || current.nodeId !== nodeId || current.owner !== surface) return
      if (!current.selectAllConsumed) {
        e.currentTarget.select()
        useAppStore.getState().markSelectAllConsumed(current.requestId)
      }
    },
    [nodeId, surface]
  )

  const onBlur = useCallback(() => {
    if (!requestId) return
    window.setTimeout(() => {
      const current = useAppStore.getState().renameSession
      if (!current || current.requestId !== requestId) return
      if (current.phase === 'committing') return
      void commitRenameSession(requestId)
    }, 0)
  }, [requestId])

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (!requestId) return
      if (e.key === 'Enter') {
        e.preventDefault()
        void commitRenameSession(requestId)
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        cancelRenameSession(requestId)
      }
    },
    [requestId]
  )

  return {
    inputRef,
    isEditing: enabled && isEditing,
    draft,
    requestId: enabled ? requestId : null,
    onChange,
    onFocus,
    onBlur,
    onKeyDown
  }
}
