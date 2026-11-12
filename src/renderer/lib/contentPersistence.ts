import type { SaveResult, TreeNode } from '@shared/types'
import { useAppStore } from '@/store/appStore'

const DEBOUNCE_MS = 400
const AUTOSAVE_INTERVAL_MS = 30_000

/**
 * Dirty text for a node. Either an already-serialized string (notes, programmatic
 * edits) or a getter the save path calls, so a keystroke never pays for a full
 * document serialization; `content` then holds the last serialized snapshot.
 */
type DirtyEntry = { content?: string; getter?: () => string }

const dirtyNodes = new Map<string, DirtyEntry>()

/** Latest serialized text for an entry: run the getter (and remember the result) if any. */
function resolveEntry(entry: DirtyEntry): string | null {
  if (entry.getter) {
    try {
      const fresh = entry.getter()
      if (typeof fresh === 'string') entry.content = fresh
    } catch {
      // Editor went away mid-resolve; fall back to the last snapshot below.
    }
  }
  return entry.content ?? null
}
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

/**
 * Capture active editor/note content. When `nodeId` is set, only that node is captured.
 * Exported so an unmount can snapshot the latest text while the editor is still alive.
 */
export function captureActiveContent(nodeId?: string): void {
  const active = getActiveEditorContent?.()
  if (active && (nodeId === undefined || active.nodeId === nodeId)) {
    const prev = dirtyNodes.get(active.nodeId)
    dirtyNodes.set(active.nodeId, { content: active.content, getter: prev?.getter })
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

  const writingContent = resolveEntry(entry)
  if (writingContent === null) return
  persisting.add(nodeId)
  syncDirtyFlag()

  try {
    await window.electronAPI.tree.update(nodeId, { content: writingContent })
    const current = dirtyNodes.get(nodeId)
    // Only clear if nothing newer arrived while we were writing.
    if (current && resolveEntry(current) === writingContent) {
      dirtyNodes.delete(nodeId)
      // Keystrokes never touch the store; it catches up once per completed write.
      useAppStore.getState().updateNodeInStore(nodeId, { content: writingContent })
    }
  } catch (err) {
    console.error(`Failed to persist node ${nodeId}:`, err)
  } finally {
    persisting.delete(nodeId)
    const current = dirtyNodes.get(nodeId)
    if (current && resolveEntry(current) !== writingContent) {
      // Newer edit landed during the write — persist it immediately.
      cancelDebounce(nodeId)
      syncDirtyFlag()
      void persistNode(nodeId)
    } else {
      // A failed write stays dirty for the next edit, flush, or autosave to retry;
      // retrying here would spin on a persistent error.
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
      // Snapshot the live editor/note text now (once per save, not per keystroke).
      captureActiveContent(nodeId)
      void persistNode(nodeId)
    }, DEBOUNCE_MS)
  )
  syncDirtyFlag()
}

/**
 * Typing hot path: record the latest text and debounce a write. Deliberately does not
 * touch the store — every `nodes` subscriber would re-render per keystroke. The store's
 * `content` is the last saved copy; read live text with `getLiveContent`.
 *
 * Pass a getter (e.g. `() => editor.getHTML()`) for big-editable surfaces: serialization
 * then happens when the debounce fires, not on every keystroke. A string serializes now.
 */
export function markContentDirty(nodeId: string, content: string | (() => string)): void {
  if (typeof content === 'function') {
    const prev = dirtyNodes.get(nodeId)
    if (!(prev && prev.getter === content)) {
      // Keep the last serialized snapshot as a fallback if the getter dies.
      dirtyNodes.set(nodeId, { getter: content, content: prev?.content })
    }
  } else {
    dirtyNodes.set(nodeId, { content })
  }
  schedulePersist(nodeId)
}

/** Text typed for `nodeId` that has not finished saving, if any. */
export function getUnsavedContent(nodeId: string): string | undefined {
  const entry = dirtyNodes.get(nodeId)
  return entry ? resolveEntry(entry) ?? undefined : undefined
}

/**
 * Latest text for a node: the open editor or note buffer, then unsaved edits, then the
 * store copy, then `fallback`. Use for anything that writes content derived from a node.
 */
export function getLiveContent(nodeId: string, fallback: string): string {
  const editor = getActiveEditorContent?.()
  if (editor?.nodeId === nodeId) return editor.content
  const note = getActiveNoteContent?.()
  if (note?.nodeId === nodeId) return note.content
  const unsaved = dirtyNodes.get(nodeId)
  if (unsaved) {
    const content = resolveEntry(unsaved)
    if (content !== null) return content
  }
  return useAppStore.getState().nodes.find((n) => n.id === nodeId)?.content ?? fallback
}

/**
 * An editing surface let go of `nodeId`: copy its unsaved text into the store now so
 * lists, counts, and a quick reopen do not wait for the debounced write.
 */
export function publishUnsavedContent(nodeId: string): void {
  const pending = dirtyNodes.get(nodeId)
  if (!pending) return
  const content = resolveEntry(pending)
  if (content !== null) useAppStore.getState().updateNodeInStore(nodeId, { content })
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
      const content = resolveEntry(dirty)
      if (content !== null) return { ...n, content }
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

export async function flushAndSaveProject(
  backup: 'autosave' | 'explicit' | 'force' = 'autosave'
): Promise<SaveResult> {
  await flushAllDirty()
  return window.electronAPI.tomes.saveProject(backup)
}

/** Test helpers — not for production UI. */
export const __test__ = {
  getDirtyContent(nodeId: string): string | undefined {
    const entry = dirtyNodes.get(nodeId)
    return entry ? resolveEntry(entry) ?? undefined : undefined
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
