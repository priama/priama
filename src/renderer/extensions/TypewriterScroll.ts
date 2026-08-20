import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'
import { useAppStore } from '@/store/appStore'
import { typewriterEnabled } from '@/lib/writingSurface'
import { nextScrollTop, TYPEWRITER_RATIO } from '@/lib/typewriterScroll'

export const typewriterScrollPluginKey = new PluginKey('typewriterScroll')

interface TypewriterStorage {
  searchOpen: boolean
}

declare module '@tiptap/core' {
  interface Storage {
    typewriterScroll: TypewriterStorage
  }
}

function findScrollParent(view: EditorView): HTMLElement | null {
  return view.dom.closest('.editor-scroll') as HTMLElement | null
}

function isPluginActive(view: EditorView, storage: TypewriterStorage): boolean {
  if (storage.searchOpen) return false
  if (!view.editable) return false
  const { selection } = view.state
  if (!selection.empty) return false
  const { typewriterScrolling, focusMode } = useAppStore.getState()
  return typewriterEnabled(typewriterScrolling, focusMode)
}

function pinCaret(view: EditorView, flags: { programmaticScroll: boolean }): void {
  const scrollEl = findScrollParent(view)
  if (!scrollEl) return
  const { selection } = view.state
  if (!selection.empty) return

  let coords: { top: number; bottom: number }
  try {
    coords = view.coordsAtPos(selection.head)
  } catch {
    return
  }

  const rect = scrollEl.getBoundingClientRect()
  const next = nextScrollTop({
    scrollTop: scrollEl.scrollTop,
    scrollHeight: scrollEl.scrollHeight,
    clientHeight: scrollEl.clientHeight,
    caretTop: coords.top,
    scrollRectTop: rect.top,
    scrollRectHeight: rect.height,
    ratio: TYPEWRITER_RATIO
  })

  if (Math.abs(next - scrollEl.scrollTop) < 0.5) return
  flags.programmaticScroll = true
  scrollEl.scrollTop = next
  requestAnimationFrame(() => {
    flags.programmaticScroll = false
  })
}

export const TypewriterScroll = Extension.create({
  name: 'typewriterScroll',

  addStorage() {
    return {
      searchOpen: false
    } satisfies TypewriterStorage
  },

  addProseMirrorPlugins() {
    const extension = this
    let pointerDown = false
    let userScrolling = false
    let lastInputWasKeyboard = false
    let rafId: number | null = null
    const flags = { programmaticScroll: false }
    let unsubStore: (() => void) | null = null

    const schedulePin = (view: EditorView): void => {
      if (rafId !== null) cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        rafId = null
        if (!isPluginActive(view, extension.storage)) return
        if (pointerDown || userScrolling) return
        if (!lastInputWasKeyboard) return
        pinCaret(view, flags)
      })
    }

    return [
      new Plugin({
        key: typewriterScrollPluginKey,
        view(editorView) {
          const scrollEl = findScrollParent(editorView)

          const onWheel = (): void => {
            if (flags.programmaticScroll) return
            userScrolling = true
          }

          const onScroll = (): void => {
            if (flags.programmaticScroll) return
            userScrolling = true
          }

          scrollEl?.addEventListener('wheel', onWheel, { passive: true })
          scrollEl?.addEventListener('scroll', onScroll, { passive: true })

          unsubStore = useAppStore.subscribe((state, prev) => {
            if (
              state.focusMode !== prev.focusMode ||
              state.typewriterScrolling !== prev.typewriterScrolling
            ) {
              const active = typewriterEnabled(state.typewriterScrolling, state.focusMode)
              editorView.dom.classList.toggle('typewriter-padding', active)
              if (active && lastInputWasKeyboard) {
                schedulePin(editorView)
              }
            }
          })

          const { typewriterScrolling, focusMode } = useAppStore.getState()
          editorView.dom.classList.toggle(
            'typewriter-padding',
            typewriterEnabled(typewriterScrolling, focusMode)
          )

          return {
            update(view, prevState) {
              if (!isPluginActive(view, extension.storage)) return
              if (pointerDown || userScrolling) return
              if (!lastInputWasKeyboard) return
              if (
                view.state.selection.eq(prevState.selection) &&
                view.state.doc.eq(prevState.doc)
              ) {
                return
              }
              schedulePin(view)
            },
            destroy() {
              scrollEl?.removeEventListener('wheel', onWheel)
              scrollEl?.removeEventListener('scroll', onScroll)
              unsubStore?.()
              unsubStore = null
              if (rafId !== null) cancelAnimationFrame(rafId)
            }
          }
        },
        props: {
          handleDOMEvents: {
            mousedown(_view, _event) {
              pointerDown = true
              lastInputWasKeyboard = false
              return false
            },
            mouseup(_view) {
              pointerDown = false
              return false
            },
            keydown(view, event) {
              if (event.key === 'PageUp' || event.key === 'PageDown') {
                lastInputWasKeyboard = false
                return false
              }
              lastInputWasKeyboard = true
              if (userScrolling) {
                userScrolling = false
              }
              if (!isPluginActive(view, extension.storage)) return false
              return false
            }
          },
          handleScrollToSelection(view) {
            if (!isPluginActive(view, extension.storage)) return false
            if (pointerDown || userScrolling) return false
            if (!lastInputWasKeyboard) {
              // Still suppress default edge-scroll when typewriter owns the caret path
              // after a keyboard session; allow default for click-placed carets.
              return false
            }
            schedulePin(view)
            return true
          }
        }
      })
    ]
  }
})
