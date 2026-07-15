import { useEffect, useState, type Dispatch, type RefObject, type SetStateAction } from 'react'

export function shouldSyncNameFromTitle(
  nameInputRef: RefObject<HTMLInputElement | null> | undefined,
  activeElement: Element | null = document.activeElement
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

  useEffect(() => {
    setMeta(metadata)
    setName(title)
  }, [nodeId])

  useEffect(() => {
    setMeta(metadata)
  }, [nodeId, metadataSource])

  useEffect(() => {
    if (!shouldSyncNameFromTitle(nameInputRef)) return
    setName(title)
  }, [nodeId, title, nameInputRef])

  return { meta, setMeta, name, setName }
}
