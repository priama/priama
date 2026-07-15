import { Extension } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import type { Transaction } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { check } from '@/lib/spellCheck'
import {
  buildEntryTitleIndex,
  findEntityMatches,
  type EntryTitleIndex
} from '@/lib/entryTitleIndex'
import { useAppStore } from '@/store/appStore'

const DEBOUNCE_MS = 400
const LEAF_TEXT = '​'

export const spellCheckPluginKey = new PluginKey<SpellPluginState>('spellCheck')

interface BlockResult {
  hash: string
  decorations: Decoration[]
}

interface SpellPluginState {
  decorations: DecorationSet
  cache: Map<number, BlockResult>
  dirtyPositions: Set<number>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    spellCheck: {
      refreshSpellCheck: () => ReturnType
      removeSpellDecoration: (from: number, to: number) => ReturnType
    }
  }
}

function hashBlock(node: PMNode): string {
  return node.textContent
}

function getBlockPositions(doc: PMNode): Map<number, PMNode> {
  const blocks = new Map<number, PMNode>()
  doc.forEach((child, offset) => {
    blocks.set(offset, child)
  })
  return blocks
}

function findChangedBlocks(oldDoc: PMNode, tr: Transaction): Set<number> {
  const dirty = new Set<number>()
  if (!tr.docChanged) return dirty

  tr.mapping.maps.forEach((stepMap) => {
    stepMap.forEach((oldStart, oldEnd, newStart, newEnd) => {
      const newDoc = tr.doc
      newDoc.nodesBetween(newStart, Math.min(newEnd, newDoc.content.size), (node, pos) => {
        if (node.isBlock && !node.isTextblock) return true
        if (node.isTextblock) {
          dirty.add(pos)
          return false
        }
        return true
      })
    })
  })

  return dirty
}

function buildBlockText(node: PMNode): { text: string; posMap: number[] } {
  const posMap: number[] = []
  let text = ''

  node.descendants((child, pos) => {
    if (child.isText) {
      const nodeText = child.text!
      const start = text.length
      for (let i = 0; i < nodeText.length; i++) {
        posMap[start + i] = pos + i
      }
      text += nodeText
    } else if (child.isLeaf) {
      posMap[text.length] = pos
      text += LEAF_TEXT
    }
  })

  return { text, posMap }
}

async function checkBlock(
  doc: PMNode,
  blockPos: number,
  blockNode: PMNode,
  entryIndex: EntryTitleIndex,
  signal: AbortSignal
): Promise<Decoration[]> {
  const { text, posMap } = buildBlockText(blockNode)
  if (!text.trim()) return []

  const entityMatches = findEntityMatches(entryIndex, text)
  const excludeRanges = entityMatches.map((m) => ({ from: m.from, to: m.to }))

  const spellMatches = await check(text, { signal, excludeRanges })
  if (signal.aborted) return []

  const decorations: Decoration[] = []

  for (const match of entityMatches) {
    const localFrom = posMap[match.from]
    const localTo = posMap[match.to - 1]
    if (localFrom === undefined || localTo === undefined) continue

    const absFrom = blockPos + 1 + localFrom
    const absTo = blockPos + 1 + localTo + 1
    if (absFrom < 0 || absTo > doc.content.size) continue

    decorations.push(
      Decoration.inline(absFrom, absTo, {
        class: 'entity-name-ref',
        'data-entity-id': match.entry.id,
        'data-entity-type': match.entry.type,
        'data-category-id': match.entry.categoryId ?? '',
        'data-entity-title': match.entry.title
      })
    )
  }

  for (const match of spellMatches) {
    const localFrom = posMap[match.from]
    const localTo = posMap[match.to - 1]
    if (localFrom === undefined || localTo === undefined) continue

    const absFrom = blockPos + 1 + localFrom
    const absTo = blockPos + 1 + localTo + 1

    if (absFrom < 0 || absTo > doc.content.size) continue

    decorations.push(
      Decoration.inline(absFrom, absTo, {
        class: 'spell-error',
        'data-word': match.word,
        'data-suggestions': JSON.stringify(match.suggestions),
        'data-message': match.message ?? ''
      })
    )
  }

  return decorations
}

export const SpellCheckExtension = Extension.create({
  name: 'spellCheck',

  addCommands() {
    return {
      refreshSpellCheck:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch) dispatch(tr.setMeta(spellCheckPluginKey, 'recheck'))
          return true
        },
      removeSpellDecoration:
        (from: number, to: number) =>
        ({ state, dispatch }) => {
          if (!dispatch) return true
          const pluginState = spellCheckPluginKey.getState(state)
          if (!pluginState) return true
          const filtered = pluginState.decorations.remove(
            pluginState.decorations.find(from, to, (spec) => spec.class === 'spell-error')
          )
          dispatch(
            state.tr.setMeta(spellCheckPluginKey, {
              ...pluginState,
              decorations: filtered
            })
          )
          return true
        }
    }
  },

  addProseMirrorPlugins() {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null
    let abortController: AbortController | null = null
    let pendingFullRecheck = false

    return [
      new Plugin({
        key: spellCheckPluginKey,

        state: {
          init(): SpellPluginState {
            return {
              decorations: DecorationSet.empty,
              cache: new Map(),
              dirtyPositions: new Set()
            }
          },
          apply(tr, prev): SpellPluginState {
            const meta = tr.getMeta(spellCheckPluginKey)

            if (meta === 'recheck') {
              pendingFullRecheck = true
              return prev
            }

            if (meta && typeof meta === 'object' && 'decorations' in meta) {
              return meta as SpellPluginState
            }

            if (tr.docChanged) {
              const changed = findChangedBlocks(prev.decorations ? tr.before : tr.doc, tr)
              const mapped = prev.decorations.map(tr.mapping, tr.doc)
              return {
                decorations: mapped,
                cache: prev.cache,
                dirtyPositions: new Set([...prev.dirtyPositions, ...changed])
              }
            }

            return prev
          }
        },

        props: {
          decorations(state) {
            return spellCheckPluginKey.getState(state)?.decorations ?? DecorationSet.empty
          }
        },

        view(editorView) {
          const scheduleCheck = (): void => {
            if (debounceTimer) clearTimeout(debounceTimer)
            abortController?.abort()
            abortController = new AbortController()
            const signal = abortController.signal

            debounceTimer = setTimeout(async () => {
              const state = editorView.state
              const pluginState = spellCheckPluginKey.getState(state)
              if (!pluginState || editorView.isDestroyed) return

              const doc = state.doc
              const blocks = getBlockPositions(doc)
              const isFullRecheck = pendingFullRecheck
              pendingFullRecheck = false

              const { nodes, categories } = useAppStore.getState()
              const entryIndex = buildEntryTitleIndex(nodes, categories)

              let positionsToCheck: Set<number>

              if (isFullRecheck || pluginState.cache.size === 0) {
                positionsToCheck = new Set(blocks.keys())
              } else {
                positionsToCheck = new Set(pluginState.dirtyPositions)
              }

              if (positionsToCheck.size === 0) return

              const newCache = new Map(pluginState.cache)
              const allDecorations: Decoration[] = []

              for (const [pos, blockNode] of blocks) {
                if (signal.aborted || editorView.isDestroyed) return

                const hash = hashBlock(blockNode)

                if (!positionsToCheck.has(pos)) {
                  const cached = newCache.get(pos)
                  if (cached && cached.hash === hash) {
                    allDecorations.push(...cached.decorations)
                    continue
                  }
                }

                const decorations = await checkBlock(doc, pos, blockNode, entryIndex, signal)
                if (signal.aborted || editorView.isDestroyed) return

                if (editorView.state.doc !== doc) return

                newCache.set(pos, { hash, decorations })
                allDecorations.push(...decorations)
              }

              for (const pos of newCache.keys()) {
                if (!blocks.has(pos)) newCache.delete(pos)
              }

              if (signal.aborted || editorView.isDestroyed) return
              if (editorView.state.doc !== doc) return

              const newState: SpellPluginState = {
                decorations: DecorationSet.create(doc, allDecorations),
                cache: newCache,
                dirtyPositions: new Set()
              }

              const tr = editorView.state.tr.setMeta(spellCheckPluginKey, newState)
              editorView.dispatch(tr)
            }, DEBOUNCE_MS)
          }

          requestIdleCallback(() => scheduleCheck(), { timeout: 500 })

          return {
            update(view, prevState) {
              if (view.state.doc !== prevState.doc || pendingFullRecheck) {
                scheduleCheck()
              }
            },
            destroy() {
              if (debounceTimer) clearTimeout(debounceTimer)
              abortController?.abort()
            }
          }
        }
      })
    ]
  }
})
