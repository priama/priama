import { useCallback, type ChangeEvent, type FocusEvent, type KeyboardEvent, type RefObject } from 'react'
import { useRenameInput } from '@/hooks/useRenameInput'
import { commitRenameSession } from '@/lib/pendingRename'

type PendingPanelRename = {
  inputRef: RefObject<HTMLInputElement | null>
  shouldRename: boolean
  draft: string
  requestId: string | null
  onDraftChange: (e: ChangeEvent<HTMLInputElement>) => void
  handleFocus: (e: FocusEvent<HTMLInputElement>) => void
  /** Commits the rename transaction if active. Returns final title when committed. */
  finishRename: () => Promise<string | null>
  handleKeyDown: (e: KeyboardEvent<HTMLInputElement>, onSave: () => void) => void
}

/**
 * Panel name-field integration with the durable rename transaction.
 * Registers the panel surface, claims ownership when preferred, and exposes
 * the shared draft so local name state is not reset by node syncs.
 */
export function usePendingPanelRename(nodeId: string): PendingPanelRename {
  const rename = useRenameInput('panel', nodeId)

  const finishRename = useCallback(async (): Promise<string | null> => {
    if (!rename.requestId) return null
    const draft = rename.draft
    const ok = await commitRenameSession(rename.requestId)
    return ok ? draft : null
  }, [rename.requestId, rename.draft])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>, onSave: () => void) => {
      if (e.key !== 'Enter') return
      e.preventDefault()
      void (async () => {
        await finishRename()
        onSave()
      })()
    },
    [finishRename]
  )

  return {
    inputRef: rename.inputRef,
    shouldRename: rename.isEditing,
    draft: rename.draft,
    requestId: rename.requestId,
    onDraftChange: rename.onChange,
    handleFocus: rename.onFocus,
    finishRename,
    handleKeyDown
  }
}
