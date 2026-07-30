import { useRenameInput } from '@/hooks/useRenameInput'
import type { RenameSurface } from '@/lib/renameSession'
import { cn } from '@/lib/utils'

type ClassName = string | undefined

/**
 * Registers a rename surface for `nodeId`. When this surface owns the durable
 * rename transaction, renders the shared draft input; otherwise renders children
 * (or an optional local/manual rename editor).
 */
export function RenameSurfaceSlot({
  surface,
  nodeId,
  enabled = true,
  inputClassName,
  inputStyle,
  localEditor,
  children
}: {
  surface: RenameSurface
  nodeId: string
  enabled?: boolean
  inputClassName?: ClassName
  inputStyle?: React.CSSProperties
  /** Manual rename UI (context-menu rename) when no session owns this surface. */
  localEditor?: React.ReactNode
  children: React.ReactNode
}): React.JSX.Element {
  const rename = useRenameInput(surface, nodeId, { enabled })

  if (rename.isEditing) {
    return (
      <input
        ref={rename.inputRef}
        value={rename.draft}
        onChange={rename.onChange}
        onFocus={rename.onFocus}
        onBlur={rename.onBlur}
        onKeyDown={rename.onKeyDown}
        className={cn(
          'rounded border border-input bg-background px-2 py-1 outline-none focus-visible:ring-1 focus-visible:ring-ring',
          inputClassName
        )}
        style={inputStyle}
      />
    )
  }

  if (localEditor) return <>{localEditor}</>
  return <>{children}</>
}
