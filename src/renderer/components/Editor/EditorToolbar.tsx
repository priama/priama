import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Type,
  Highlighter,
  List,
  ListOrdered,
  Search,
  Settings
} from 'lucide-react'
import type { Editor } from '@tiptap/react'
import { Button } from '@/components/UI/button'
import { Separator } from '@/components/UI/separator'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/UI/tooltip'
import { useAppStore } from '@/store/appStore'
import { SIDEBAR_MIN_WIDTH } from '@shared/types'
import { StyleDropdown } from './StyleDropdown'
import { ColorPickerButton, TEXT_COLORS, HIGHLIGHT_COLORS } from './ColorPicker'
import { cn } from '@/lib/utils'

interface EditorToolbarProps {
  editor: Editor | null
  wordCount: number
  onOpenSearch?: () => void
}

const SIDEBAR_ICON_ONLY_THRESHOLD = SIDEBAR_MIN_WIDTH + 16

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

export function EditorToolbar({ editor, wordCount, onOpenSearch }: EditorToolbarProps): React.JSX.Element {
  const { sidebarWidth, setShowBookSettingsModal } = useAppStore()
  const isSidebarContracted = sidebarWidth <= SIDEBAR_ICON_ONLY_THRESHOLD

  if (!editor) return <div className="h-10 border-b border-border" />

  return (
    <TooltipProvider delayDuration={300}>
      <div
        className={cn(
          'no-drag flex items-center gap-0.5 border-b border-border px-3 py-1.5',
          isSidebarContracted && 'pl-14'
        )}
      >
        <StyleDropdown editor={editor} />

        <Separator orientation="vertical" className="mx-1 h-6" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive('bold')}
          tooltip="Bold (⌘B)"
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive('italic')}
          tooltip="Italic (⌘I)"
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          isActive={editor.isActive('underline')}
          tooltip="Underline (⌘U)"
        >
          <UnderlineIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          isActive={editor.isActive('strike')}
          tooltip="Strikethrough"
        >
          <Strikethrough className="h-4 w-4" />
        </ToolbarButton>

        <Separator orientation="vertical" className="mx-1 h-6" />

        <ColorPickerButton
          currentColor={editor.getAttributes('textStyle').color ?? ''}
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
          currentColor={editor.getAttributes('highlight').color ?? ''}
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
          isActive={editor.isActive('bulletList')}
          tooltip="Bullet List"
        >
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive('orderedList')}
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
          <ToolbarButton
            onClick={() => setShowBookSettingsModal(true)}
            tooltip="Book Settings"
          >
            <Settings className="h-4 w-4" />
          </ToolbarButton>
          <div className="text-xs text-muted-foreground">
            {wordCount.toLocaleString()} {wordCount === 1 ? 'word' : 'words'}
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
