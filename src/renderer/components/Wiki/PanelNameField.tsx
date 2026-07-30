import { useCallback, type Dispatch, type SetStateAction } from 'react'
import { SpellCheckedInput } from '@/components/UI/spell-checked-field'
import { usePendingPanelRename } from '@/hooks/usePendingPanelRename'

/**
 * Name/title input for right-panel entity forms.
 * Binds to the durable rename transaction when active so typing is not
 * reset by node syncs; otherwise uses local name state.
 */
export function PanelNameField({
  nodeId,
  name,
  setName,
  onSave,
  onSaveMetaOnly
}: {
  nodeId: string
  name: string
  setName: Dispatch<SetStateAction<string>>
  /** Persist name + metadata (normal blur / Enter when not in a rename session). */
  onSave: (name: string) => void
  /** Persist metadata only — title already committed by the rename session. */
  onSaveMetaOnly: () => void
}): React.JSX.Element {
  const {
    inputRef,
    shouldRename,
    draft,
    onDraftChange,
    handleFocus,
    finishRename,
    handleKeyDown
  } = usePendingPanelRename(nodeId)

  const value = shouldRename ? draft : name

  const handleCommitSave = useCallback(
    (committedTitle: string | null) => {
      if (committedTitle !== null) {
        setName(committedTitle)
        onSaveMetaOnly()
        return
      }
      onSave(name)
    },
    [name, onSave, onSaveMetaOnly, setName]
  )

  return (
    <SpellCheckedInput
      ref={inputRef}
      value={value}
      onChange={shouldRename ? onDraftChange : (e) => setName(e.target.value)}
      onFocus={handleFocus}
      onKeyDown={(e) =>
        handleKeyDown(e, () => {
          if (shouldRename) {
            setName(draft)
            onSaveMetaOnly()
          } else {
            onSave(name)
          }
        })
      }
      onBlur={() => {
        void (async () => {
          const committed = await finishRename()
          handleCommitSave(committed)
        })()
      }}
    />
  )
}
