import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextStyle from '@tiptap/extension-text-style'
import FontFamily from '@tiptap/extension-font-family'
import Color from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import { isSupportedFamily } from '@shared/types'
import { EntityMention } from './EntityMention'
import { BlockStyle } from './BlockStyle'
import { EditorToolbar } from './EditorToolbar'
import { SearchBar } from './SearchBar'
import SearchAndReplace from './searchAndReplace'
import { SpellCheckExtension, spellCheckPluginKey } from '@/extensions/SpellCheckExtension'
import { TypewriterScroll } from '@/extensions/TypewriterScroll'
import { EntityNamePopover } from './EntityNamePopover'
import { SpellSuggestions } from './SpellSuggestions'
import { PasteMenu } from './PasteMenu'
import { FocusWordCount } from './FocusWordCount'
import { FocusModeButton } from './FocusModeButton'
import { addCustomWord, removeCustomWord, isCustomWord, onSpellCheckLangChange } from '@/lib/spellCheck'
import { useAppStore } from '@/store/appStore'
import { markContentDirty, registerActiveEditor } from '@/lib/contentPersistence'
import { clearEditorHistory, registerActiveEditorInstance } from '@/lib/activeEditor'
import { syncWritingMenuState } from '@/lib/writingMenuSync'
import { splitDocumentAtCaret } from '@/lib/documentActions'
import { canSplitAtCaret, canSplitNode } from '@/lib/splitMerge'
import { openIndexedEntry } from '@/lib/categoryNavigation'
import { panelEntryFingerprint } from '@/lib/entryTitleIndex'
import { countWords } from '@/lib/utils'
import { isWritingSurfaceNode, entityHighlightsVisible } from '@/lib/writingSurface'
import { useBlockStyleShortcuts } from '@/hooks/useBlockStyleShortcuts'
import { useFocusChromeActive } from '@/hooks/useFocusMode'
import { findCategory } from '@shared/categoryView'
import type { TreeNode } from '@shared/types'

import {
  DEFAULT_CHARACTER_META,
  DEFAULT_LOCATION_META,
  DEFAULT_LORE_META,
  parseMetadata
} from '@shared/types'
import type { CharacterMeta, LocationMeta, LoreMeta } from '@shared/types'

function sanitizePastedHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT)
  let el = walker.currentNode as HTMLElement
  while (el) {
    if (el.style?.fontFamily && !isSupportedFamily(el.style.fontFamily)) {
      el.style.removeProperty('font-family')
    }
    el = walker.nextNode() as HTMLElement
  }
  return doc.body.innerHTML
}

interface RichTextEditorProps {
  node: TreeNode | null
}

function buildEntityNames(nodes: TreeNode[]): Map<string, { id: string; type: string; name: string }> {
  const map = new Map<string, { id: string; type: string; name: string }>()

  for (const node of nodes) {
    if (node.type === 'character') {
      map.set(node.title.toLowerCase(), { id: node.id, type: 'character', name: node.title })
      const meta = parseMetadata<CharacterMeta>(node.metadata, DEFAULT_CHARACTER_META)
      for (const alias of meta.aliases) {
        if (alias) map.set(alias.toLowerCase(), { id: node.id, type: 'character', name: node.title })
      }
    } else if (node.type === 'location') {
      map.set(node.title.toLowerCase(), { id: node.id, type: 'location', name: node.title })
    } else if (node.type === 'lore') {
      map.set(node.title.toLowerCase(), { id: node.id, type: 'lore', name: node.title })
    }
  }

  return map
}

function entityTypeLabel(
  type: string,
  categoryId: string | null,
  categories: ReturnType<typeof useAppStore.getState>['categories']
): string {
  if (type === 'entry' && categoryId) {
    return findCategory(categories, categoryId)?.name ?? 'Entry'
  }
  const labels: Record<string, string> = {
    character: 'Character',
    location: 'Location',
    lore: 'Lore',
    note: 'Note'
  }
  return labels[type] ?? 'Entry'
}

function readEntityRefFromElement(el: HTMLElement): {
  id: string
  type: TreeNode['type']
  categoryId: string | null
  title: string
} | null {
  const id = el.dataset.entityId
  const type = el.dataset.entityType as TreeNode['type'] | undefined
  if (!id || !type) return null
  return {
    id,
    type,
    categoryId: el.dataset.categoryId || null,
    title: el.dataset.entityTitle ?? ''
  }
}

function highlightsAreVisible(): boolean {
  const { entityHighlights, focusMode } = useAppStore.getState()
  return entityHighlightsVisible(entityHighlights, focusMode)
}

export function RichTextEditor({ node }: RichTextEditorProps): React.JSX.Element {
  const { nodes, categories, updateNodeInStore, setSelectedEntity } = useAppStore()
  const focusChrome = useFocusChromeActive()
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchOpenWithReplace, setSearchOpenWithReplace] = useState(false)
  const [searchFocusKey, setSearchFocusKey] = useState(0)
  const [pasteMenu, setPasteMenu] = useState<{
    x: number
    y: number
    html: string
    text: string
  } | null>(null)
  const [spellMenu, setSpellMenu] = useState<{
    x: number
    y: number
    word: string
    suggestions: string[]
    message?: string
    from: number
    to: number
  } | null>(null)
  const [docMenu, setDocMenu] = useState<{ x: number; y: number } | null>(null)
  const [entityHover, setEntityHover] = useState<{
    x: number
    y: number
    id: string
    type: TreeNode['type']
    categoryId: string | null
    title: string
  } | null>(null)
  const entityHoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const entryFingerprint = useMemo(
    () => panelEntryFingerprint(nodes, categories),
    [nodes, categories]
  )
  const prevEntryFingerprintRef = useRef(entryFingerprint)

  const entityMap = useMemo(() => buildEntityNames(nodes), [nodes])
  const isEditable = isWritingSurfaceNode(node, categories)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] }
      }),
      Underline,
      TextStyle,
      FontFamily,
      Color,
      Highlight.configure({ multicolor: true }),
      BlockStyle,
      EntityMention,
      Placeholder.configure({
        placeholder: 'Start writing...'
      }),
      CharacterCount,
      SearchAndReplace.configure({
        searchResultClass: 'search-result',
        disableRegex: true
      }),
      SpellCheckExtension,
      TypewriterScroll
    ],
    content: node?.content ?? '',
    editable: !!isEditable,
    editorProps: {
      attributes: {
        class: 'prose-editor focus:outline-none min-h-full',
        role: 'textbox',
        'aria-autocomplete': 'none',
        autocomplete: 'off',
        autocorrect: 'on',
        autocapitalize: 'sentences',
        spellcheck: 'false',
        'data-form-type': 'other',
        'data-lpignore': 'true',
        'data-1p-ignore': 'true'
      },
      handlePaste: (view, event) => {
        const html = event.clipboardData?.getData('text/html') ?? ''
        const text = event.clipboardData?.getData('text/plain') ?? ''
        if (!html && !text) return false

        const hasRichContent = html.includes('<') && html !== text
        if (!hasRichContent) return false

        event.preventDefault()
        const coords = view.coordsAtPos(view.state.selection.from)
        setPasteMenu({ x: coords.left, y: coords.bottom, html, text })
        return true
      },
      handleDOMEvents: {
        click: (_view, event) => {
          if (!highlightsAreVisible()) return false
          const entityEl = (event.target as HTMLElement).closest('.entity-name-ref') as HTMLElement | null
          if (!entityEl) return false
          const entry = readEntityRefFromElement(entityEl)
          if (!entry) return false
          void openIndexedEntry(entry)
          return true
        }
      },
      handleClickOn: (view, pos, nodeEl) => {
        if (!highlightsAreVisible()) return false
        if (nodeEl.type.name === 'text') {
          const marks = nodeEl.marks
          const mention = marks.find((m) => m.type.name === 'entityMention')
          if (mention) {
            setSelectedEntity(
              mention.attrs.entityId as string,
              mention.attrs.entityType as 'character' | 'location' | 'lore'
            )
            return true
          }
        }

        const pluginState = spellCheckPluginKey.getState(view.state)
        const entityDecos = pluginState
          ? pluginState.decorations.find(pos, pos, (spec) => spec.class === 'entity-name-ref')
          : []
        if (entityDecos.length > 0) {
          const deco = entityDecos[0]
          const spec = deco as typeof deco & {
            'data-entity-id'?: string
            'data-entity-type'?: TreeNode['type']
            'data-category-id'?: string
            'data-entity-title'?: string
          }
          const id = spec['data-entity-id']
          const type = spec['data-entity-type']
          if (id && type) {
            void openIndexedEntry({
              id,
              type,
              categoryId: spec['data-category-id'] || null,
              title: spec['data-entity-title'] ?? ''
            })
            return true
          }
        }

        return false
      }
    },
    onUpdate: ({ editor: ed }) => {
      if (!node) return
      const html = ed.getHTML()
      updateNodeInStore(node.id, { content: html })
      markContentDirty(node.id, html)
    },
    onSelectionUpdate: () => {
      syncWritingMenuState()
    }
  }, [node?.id])

  useEffect(() => {
    if (!editor || !node) {
      registerActiveEditor(null)
      registerActiveEditorInstance(null, null)
      return
    }

    registerActiveEditor(() => ({ nodeId: node.id, content: editor.getHTML() }))
    registerActiveEditorInstance(editor, node.id)
    syncWritingMenuState()

    return () => {
      registerActiveEditor(null)
      registerActiveEditorInstance(null, null)
      syncWritingMenuState()
    }
  }, [editor, node?.id, node])

  useEffect(() => {
    if (editor && node) {
      editor.commands.setContent(node.content, false)
      clearEditorHistory(editor)
      syncWritingMenuState()
    }
  }, [editor, node?.id])

  useEffect(() => {
    if (editor) {
      editor.setEditable(!!isEditable)
    }
  }, [editor, isEditable])

  useEffect(() => {
    if (!editor) return
    return onSpellCheckLangChange(() => {
      editor.commands.refreshSpellCheck()
    })
  }, [editor])

  useEffect(() => {
    if (!editor) return
    if (prevEntryFingerprintRef.current === entryFingerprint) return
    prevEntryFingerprintRef.current = entryFingerprint
    editor.commands.refreshSpellCheck()
  }, [editor, entryFingerprint])

  useEffect(() => {
    if (!editor) return
    editor.storage.typewriterScroll.searchOpen = searchOpen
  }, [editor, searchOpen])

  useBlockStyleShortcuts(editor)

  useEffect(() => {
    if (!highlightsAreVisible()) setEntityHover(null)
  }, [focusChrome])

  useEffect(() => {
    return () => {
      if (entityHoverTimerRef.current) clearTimeout(entityHoverTimerRef.current)
    }
  }, [])

  useEffect(() => {
    setSearchOpen(false)
  }, [node?.id])

  useEffect(() => {
    if (!editor) return

    const handler = (e: KeyboardEvent): void => {
      const mod = e.metaKey || e.ctrlKey
      if (!mod || e.shiftKey) return

      if (e.key.toLowerCase() === 'f') {
        e.preventDefault()
        if (searchOpen) {
          setSearchFocusKey((k) => k + 1)
        } else {
          setSearchOpenWithReplace(false)
          setSearchOpen(true)
        }
      }
      if (e.key.toLowerCase() === 'h') {
        e.preventDefault()
        if (searchOpen) {
          setSearchOpenWithReplace(true)
          setSearchFocusKey((k) => k + 1)
        } else {
          setSearchOpenWithReplace(true)
          setSearchOpen(true)
        }
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [editor, searchOpen])

  const handleCloseSearch = (): void => {
    setSearchOpen(false)
    if (editor) {
      editor.commands.setSearchTerm('')
      editor.commands.setReplaceTerm('')
      editor.commands.focus()
    }
  }

  const handleOpenSearch = (): void => {
    if (searchOpen) {
      setSearchFocusKey((k) => k + 1)
    } else {
      setSearchOpenWithReplace(false)
      setSearchOpen(true)
    }
  }

  const wordCount = editor ? countWords(editor.getHTML()) : 0

  if (!node) {
    return (
      <div className="no-drag flex flex-1 items-center justify-center text-muted-foreground">
        <p className="text-sm">Select a chapter or scene to start writing</p>
      </div>
    )
  }

  if (!isEditable) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          <p className="text-sm">Entity details are shown in the right panel</p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="no-drag flex flex-1 flex-col overflow-hidden"
      onMouseOver={(e) => {
        if (!highlightsAreVisible()) return
        const target = e.target as HTMLElement
        const entityEl = target.closest('.entity-name-ref') as HTMLElement | null
        if (!entityEl) return

        const related = e.relatedTarget as HTMLElement | null
        if (related && entityEl.contains(related)) return

        if (entityHoverTimerRef.current) clearTimeout(entityHoverTimerRef.current)
        const entry = readEntityRefFromElement(entityEl)
        if (!entry) return

        const rect = entityEl.getBoundingClientRect()
        entityHoverTimerRef.current = setTimeout(() => {
          setEntityHover({
            x: rect.left,
            y: rect.bottom,
            ...entry
          })
        }, 150)
      }}
      onMouseOut={(e) => {
        const target = e.target as HTMLElement
        const entityEl = target.closest('.entity-name-ref') as HTMLElement | null
        if (!entityEl) return

        const related = e.relatedTarget as HTMLElement | null
        if (related && entityEl.contains(related)) return

        if (entityHoverTimerRef.current) {
          clearTimeout(entityHoverTimerRef.current)
          entityHoverTimerRef.current = null
        }
        setEntityHover(null)
      }}
      onContextMenu={(e) => {
        const target = e.target as HTMLElement
        const spellEl = target.closest('.spell-error') as HTMLElement | null
        if (spellEl) {
          e.preventDefault()
          setDocMenu(null)

          const word = spellEl.dataset.word ?? ''
          const suggestions: string[] = JSON.parse(spellEl.dataset.suggestions ?? '[]')
          const message = spellEl.dataset.message || undefined

          if (!editor) return
          try {
            const view = editor.view
            const domPos = view.posAtDOM(spellEl, 0)
            if (domPos === null) return

            // posAtDOM resolves to a DOM boundary, which can land a character or two
            // off from the decoration's real span — read the decoration's own from/to
            // instead of trusting that offset, so the replacement can't clip the word
            // or eat the following space.
            const pluginState = spellCheckPluginKey.getState(view.state)
            const candidates = pluginState
              ? pluginState.decorations.find(
                  undefined,
                  undefined,
                  (spec) => spec.class === 'spell-error' && spec['data-word'] === word
                )
              : []
            const deco = candidates.reduce<(typeof candidates)[number] | null>((closest, d) => {
              if (!closest) return d
              return Math.abs(d.from - domPos) < Math.abs(closest.from - domPos) ? d : closest
            }, null)

            setSpellMenu({
              x: e.clientX,
              y: e.clientY,
              word,
              suggestions,
              message,
              from: deco?.from ?? domPos,
              to: deco?.to ?? domPos + word.length
            })
          } catch {
            return
          }
          return
        }

        if (
          node &&
          editor &&
          canSplitNode(node, nodes) &&
          canSplitAtCaret(editor)
        ) {
          e.preventDefault()
          setSpellMenu(null)
          setDocMenu({ x: e.clientX, y: e.clientY })
        }
      }}
    >
      {!focusChrome && (
        <EditorToolbar editor={editor} wordCount={wordCount} onOpenSearch={handleOpenSearch} />
      )}
      {searchOpen && editor && (
        <SearchBar
          key={searchOpenWithReplace ? 'replace' : 'search'}
          editor={editor}
          onClose={handleCloseSearch}
          defaultShowReplace={searchOpenWithReplace}
          focusKey={searchFocusKey}
        />
      )}
      <div className="editor-scroll relative flex-1 overflow-y-auto px-8 py-6">
        <div className="editor-measure mx-auto">
          <EditorContent editor={editor} />
        </div>
        {focusChrome && (
          <div className="pointer-events-none absolute bottom-4 right-4 z-10 flex items-center gap-2">
            <div className="pointer-events-auto">
              <FocusModeButton floating />
            </div>
            <FocusWordCount wordCount={wordCount} />
          </div>
        )}
      </div>

      {pasteMenu && (
        <PasteMenu
          x={pasteMenu.x}
          y={pasteMenu.y}
          onPasteRich={() => {
            if (!editor) return
            const cleaned = sanitizePastedHtml(pasteMenu.html)
            editor.commands.insertContent(cleaned)
            setPasteMenu(null)
          }}
          onPasteClean={() => {
            if (!editor) return
            editor.commands.insertContent(pasteMenu.text)
            setPasteMenu(null)
          }}
          onClose={() => setPasteMenu(null)}
        />
      )}

      {entityHover && (
        <EntityNamePopover
          x={entityHover.x}
          y={entityHover.y}
          title={entityHover.title}
          typeLabel={entityTypeLabel(entityHover.type, entityHover.categoryId, categories)}
          onOpen={() => {
            void openIndexedEntry({
              id: entityHover.id,
              type: entityHover.type,
              categoryId: entityHover.categoryId,
              title: entityHover.title
            })
            setEntityHover(null)
          }}
        />
      )}

      {spellMenu && (
        <SpellSuggestions
          x={spellMenu.x}
          y={spellMenu.y}
          word={spellMenu.word}
          suggestions={spellMenu.suggestions}
          message={spellMenu.message}
          isCustomWord={isCustomWord(spellMenu.word)}
          onSelect={(replacement) => {
            if (!editor) return
            editor.commands.removeSpellDecoration(spellMenu.from, spellMenu.to)
            editor
              .chain()
              .focus()
              .setTextSelection({ from: spellMenu.from, to: spellMenu.to })
              .insertContent(replacement)
              .run()
            setSpellMenu(null)
          }}
          onAddToDictionary={() => {
            addCustomWord(spellMenu.word)
            editor?.commands.removeSpellDecoration(spellMenu.from, spellMenu.to)
            setSpellMenu(null)
          }}
          onRemoveFromDictionary={() => {
            removeCustomWord(spellMenu.word)
            setSpellMenu(null)
            editor?.commands.refreshSpellCheck()
          }}
          onClose={() => setSpellMenu(null)}
        />
      )}

      {docMenu && (
        <DocumentSplitMenu
          x={docMenu.x}
          y={docMenu.y}
          onSplit={() => {
            setDocMenu(null)
            void splitDocumentAtCaret()
          }}
          onClose={() => setDocMenu(null)}
        />
      )}
    </div>
  )
}

function DocumentSplitMenu({
  x,
  y,
  onSplit,
  onClose
}: {
  x: number
  y: number
  onSplit: () => void
  onClose: () => void
}): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const handleKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('mousedown', handleClick)
    window.addEventListener('keydown', handleKey)
    return () => {
      window.removeEventListener('mousedown', handleClick)
      window.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  return createPortal(
    <div
      ref={ref}
      style={{
        position: 'fixed',
        left: Math.min(x, window.innerWidth - 200),
        top: Math.min(y, window.innerHeight - 80),
        zIndex: 9999
      }}
      className="min-w-[180px] rounded-md border border-border bg-popover py-1 shadow-md"
    >
      <button
        type="button"
        className="flex w-full cursor-pointer items-center px-3 py-1.5 text-left text-sm outline-none hover:bg-accent"
        onMouseDown={(e) => {
          e.preventDefault()
          onSplit()
        }}
      >
        Split Document
      </button>
    </div>,
    document.body
  )
}
