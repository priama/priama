import { useEffect, useState, type Dispatch, type RefObject, type SetStateAction } from 'react'
import { useAppStore } from '@/store/appStore'

export function shouldSyncNameFromTitle(
  nameInputRef: RefObject<HTMLInputElement | null> | undefined,
  activeElement: Element | null = typeof document !== 'undefined' ? document.activeElement : null
): boolean {
  if (!nameInputRef?.current) return true
  return nameInputRef.current !== activeElement
}

export function usePanelNodeState<T>({
  nodeId,
  title,
  metadata,
  metadataSource,
  nameInputRef
}: {
  nodeId: string
  title: string
  metadata: T
  metadataSource: string
  nameInputRef?: RefObject<HTMLInputElement | null>
}): {
  meta: T
  setMeta: Dispatch<SetStateAction<T>>
  name: string
  setName: Dispatch<SetStateAction<string>>
} {
  const [meta, setMeta] = useState(metadata)
  const [name, setName] = useState(title)
  const renameActive = useAppStore(
    (s) => s.renameSession?.nodeId === nodeId && s.renameSession.preferredSurfaces.includes('panel')
  )

  useEffect(() => {
    setMeta(metadata)
    setName(title)
  }, [nodeId])

  useEffect(() => {
    setMeta(metadata)
  }, [nodeId, metadataSource])

  useEffect(() => {
    // Never reset local name from node title while a rename transaction owns this node.
    if (renameActive) return
    if (!shouldSyncNameFromTitle(nameInputRef)) return
    setName(title)
  }, [nodeId, title, nameInputRef, renameActive])

  return { meta, setMeta, name, setName }
}
