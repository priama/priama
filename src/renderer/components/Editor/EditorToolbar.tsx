import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Type,
  Highlighter,
  List,
  ListOrdered,
  Search
} from 'lucide-react'
import type { Editor } from '@tiptap/react'
import { useEditorState } from '@tiptap/react'
import { Button } from '@/components/UI/button'
import { Separator } from '@/components/UI/separator'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/UI/tooltip'
import { useAppStore } from '@/store/appStore'
import { TITLEBAR_BUTTONS_INSET } from '@shared/windowChrome'
import { isMac } from '@/lib/platform'
import { StyleDropdown } from './StyleDropdown'
import { ColorPickerButton, TEXT_COLORS, HIGHLIGHT_COLORS } from './ColorPicker'
import { useWordCount } from '@/hooks/useWordCount'
import { cn } from '@/lib/utils'

interface EditorToolbarProps {
  editor: Editor | null
  onOpenSearch?: () => void
}

function ToolbarButton({
  onClick,
  isActive,
  tooltip,
  children
}: {
  onClick: () => void
  isActive?: boolean
  tooltip: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn('h-8 w-8', isActive && 'bg-accent text-accent-foreground')}
          onClick={onClick}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  )
}

const TOOLBAR_PADDING_X = 12

/**
 * The toolbar's slice of the editor state. Subscribing here (instead of re-rendering
 * with the whole editor panel per transaction) keeps typing fast: this component only
 * re-renders when one of these derived values actually changes.
 */
function useToolbarState(editor: Editor | null) {
  return useEditorState({
    editor,
    selector: ({ editor: ed }) => {
      if (!ed) return null
      return {
        bold: ed.isActive('bold'),
        italic: ed.isActive('italic'),
        underline: ed.isActive('underline'),
        strike: ed.isActive('strike'),
        bulletList: ed.isActive('bulletList'),
        orderedList: ed.isActive('orderedList'),
        textColor: (ed.getAttributes('textStyle').color as string | undefined) ?? '',
        highlightColor: (ed.getAttributes('highlight').color as string | undefined) ?? ''
      }
    }
  })
}

export function EditorToolbar({ editor, onOpenSearch }: EditorToolbarProps): React.JSX.Element {
  // A collapsed sidebar is narrower than the traffic lights; start the controls
  // past them. Only macOS has them, so elsewhere this is just normal padding.
  const paddingLeft = useAppStore((s) =>
    isMac ? Math.max(TOOLBAR_PADDING_X, TITLEBAR_BUTTONS_INSET - s.sidebarWidth) : TOOLBAR_PADDING_X
  )
  const state = useToolbarState(editor)
  const wordCount = useWordCount(editor)

  if (!editor || !state) return <div className="h-10 border-b border-border" />

  return (
    <TooltipProvider delayDuration={300}>
      {/* Empty toolbar space drags the window, like a native toolbar. */}
      <div
        className="drag-region flex items-center gap-0.5 border-b border-border px-3 py-1.5"
        style={{ paddingLeft }}
      >
        <StyleDropdown editor={editor} />

        <Separator orientation="vertical" className="mx-1 h-6" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={state.bold}
          tooltip="Bold (⌘B)"
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={state.italic}
          tooltip="Italic (⌘I)"
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          isActive={state.underline}
          tooltip="Underline (⌘U)"
        >
          <UnderlineIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          isActive={state.strike}
          tooltip="Strikethrough"
        >
          <Strikethrough className="h-4 w-4" />
        </ToolbarButton>

        <Separator orientation="vertical" className="mx-1 h-6" />

        <ColorPickerButton
          currentColor={state.textColor}
          colors={TEXT_COLORS}
          tooltip="Text Color"
          icon={<Type className="h-4 w-4" />}
          onSelect={(color) => {
            if (color) {
              editor.chain().focus().setColor(color).run()
            } else {
              editor.chain().focus().unsetColor().run()
            }
          }}
        />
        <ColorPickerButton
          currentColor={state.highlightColor}
          colors={HIGHLIGHT_COLORS}
          tooltip="Highlight"
          icon={<Highlighter className="h-4 w-4" />}
          onSelect={(color) => {
            if (color) {
              editor.chain().focus().setHighlight({ color }).run()
            } else {
              editor.chain().focus().unsetHighlight().run()
            }
          }}
        />

        <Separator orientation="vertical" className="mx-1 h-6" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={state.bulletList}
          tooltip="Bullet List"
        >
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={state.orderedList}
          tooltip="Numbered List"
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>

        <div className="ml-auto flex items-center gap-1">
          {onOpenSearch && (
            <ToolbarButton onClick={onOpenSearch} tooltip="Find (⌘F)">
              <Search className="h-4 w-4" />
            </ToolbarButton>
          )}
          <div className="text-xs text-muted-foreground">
            {wordCount.toLocaleString()} {wordCount === 1 ? 'word' : 'words'}
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
