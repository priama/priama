import type { SaveResult, TreeNode } from '@shared/types'
import { useAppStore } from '@/store/appStore'

const DEBOUNCE_MS = 400
const AUTOSAVE_INTERVAL_MS = 30_000

type DirtyEntry = { content: string }

const dirtyNodes = new Map<string, DirtyEntry>()
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>()
const persisting = new Set<string>()

let getActiveEditorContent: (() => { nodeId: string; content: string } | null) | null = null

function syncDirtyFlag(): void {
  const hasPending = dirtyNodes.size > 0 || debounceTimers.size > 0 || persisting.size > 0
  useAppStore.getState().setDirty(hasPending)
}

export function registerActiveEditor(
  getter: (() => { nodeId: string; content: string } | null) | null
): void {
  getActiveEditorContent = getter
}

let getActiveNoteContent: (() => { nodeId: string; content: string } | null) | null = null

export function registerActiveNoteContent(
  getter: (() => { nodeId: string; content: string } | null) | null
): void {
  getActiveNoteContent = getter
}

export function resetPersistenceState(): void {
  for (const timer of debounceTimers.values()) clearTimeout(timer)
  debounceTimers.clear()
  dirtyNodes.clear()
  persisting.clear()
  syncDirtyFlag()
}

/** Capture active editor/note content. When `nodeId` is set, only that node is captured. */
function captureActiveContent(nodeId?: string): void {
  const active = getActiveEditorContent?.()
  if (active && (nodeId === undefined || active.nodeId === nodeId)) {
    dirtyNodes.set(active.nodeId, { content: active.content })
  }
  const note = getActiveNoteContent?.()
  if (note && (nodeId === undefined || note.nodeId === nodeId)) {
    dirtyNodes.set(note.nodeId, { content: note.content })
  }
}

function cancelDebounce(nodeId: string): void {
  const timer = debounceTimers.get(nodeId)
  if (timer) {
    clearTimeout(timer)
    debounceTimers.delete(nodeId)
  }
}

async function persistNode(nodeId: string): Promise<void> {
  const entry = dirtyNodes.get(nodeId)
  if (!entry || persisting.has(nodeId)) return

  const writingContent = entry.content
  persisting.add(nodeId)
  syncDirtyFlag()

  try {
    await window.electronAPI.tree.update(nodeId, { content: writingContent })
    const current = dirtyNodes.get(nodeId)
    // Only clear if nothing newer arrived while we were writing.
    if (current && current.content === writingContent) {
      dirtyNodes.delete(nodeId)
    }
  } catch (err) {
    console.error(`Failed to persist node ${nodeId}:`, err)
  } finally {
    persisting.delete(nodeId)
    if (dirtyNodes.has(nodeId)) {
      // Newer edit landed during the write — persist it immediately.
      cancelDebounce(nodeId)
      syncDirtyFlag()
      void persistNode(nodeId)
    } else {
      syncDirtyFlag()
    }
  }
}

function schedulePersist(nodeId: string): void {
  cancelDebounce(nodeId)
  debounceTimers.set(
    nodeId,
    setTimeout(() => {
      debounceTimers.delete(nodeId)
      syncDirtyFlag()
      void persistNode(nodeId)
    }, DEBOUNCE_MS)
  )
  syncDirtyFlag()
}

export function markContentDirty(nodeId: string, content: string): void {
  dirtyNodes.set(nodeId, { content })
  schedulePersist(nodeId)
}

export function hasUnpersistedChanges(): boolean {
  return dirtyNodes.size > 0 || debounceTimers.size > 0 || persisting.size > 0
}

/** Prefer local in-progress content over incoming sync for dirty/active/persisting nodes. */
export function mergeIncomingNodes(incoming: TreeNode[]): TreeNode[] {
  const activeEditor = getActiveEditorContent?.()
  const activeNote = getActiveNoteContent?.()

  return incoming.map((n) => {
    if (activeEditor?.nodeId === n.id) {
      return { ...n, content: activeEditor.content }
    }
    if (activeNote?.nodeId === n.id) {
      return { ...n, content: activeNote.content }
    }
    const dirty = dirtyNodes.get(n.id)
    if (dirty) {
      return { ...n, content: dirty.content }
    }
    return n
  })
}

export async function flushNode(nodeId: string): Promise<void> {
  cancelDebounce(nodeId)
  captureActiveContent(nodeId)
  await persistNode(nodeId)
}

export async function flushAllDirty(): Promise<void> {
  captureActiveContent()
  for (const nodeId of debounceTimers.keys()) cancelDebounce(nodeId)
  const ids = [...dirtyNodes.keys()]
  for (const id of ids) {
    await persistNode(id)
  }
}

export async function flushAndSaveProject(): Promise<SaveResult> {
  await flushAllDirty()
  return window.electronAPI.tomes.saveProject()
}

/** Test helpers — not for production UI. */
export const __test__ = {
  getDirtyContent(nodeId: string): string | undefined {
    return dirtyNodes.get(nodeId)?.content
  },
  isPersisting(nodeId: string): boolean {
    return persisting.has(nodeId)
  },
  async persistNow(nodeId: string): Promise<void> {
    cancelDebounce(nodeId)
    await persistNode(nodeId)
  }
}

export { AUTOSAVE_INTERVAL_MS }
