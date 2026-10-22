import { useState } from 'react'
import { Menu as MenuIcon, Check, ChevronRight } from 'lucide-react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import type { WritingMenuState } from '@shared/types'
import { computeWritingMenuState } from '@/lib/writingMenuSync'
import { cn } from '@/lib/utils'

/**
 * The app menu for platforms with no system menu bar.
 *
 * macOS puts File/Edit/View in the system menu bar; Windows and Linux would
 * otherwise draw it as a strip above the UI. This renders the same commands in
 * the sidebar's top row — the band macOS reserves for its traffic lights — so
 * the chrome costs no extra height.
 *
 * Items fire the very same `menu:*` channels as the native menu items, so every
 * existing renderer listener handles them unchanged and the two menus can never
 * drift apart in behaviour.
 */

const TRIGGER_CLASS =
  'rounded px-2 py-1 text-xs text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring data-[state=open]:bg-accent data-[state=open]:text-foreground'

const CONTENT_CLASS =
  'z-50 max-h-[70vh] min-w-[230px] overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-md'

const ITEM_CLASS =
  'flex cursor-pointer select-none items-center justify-between gap-6 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent focus:bg-accent data-[disabled]:pointer-events-none data-[disabled]:opacity-40'

const SEPARATOR_CLASS = '-mx-1 my-1 h-px bg-border'
const GROUP_LABEL_CLASS = 'px-2 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground'

function invoke(channel: string, arg?: unknown): void {
  void window.electronAPI.app.invokeMenuAction(channel, arg)
}

interface ItemProps {
  label: string
  shortcut?: string
  channel: string
  arg?: unknown
  disabled?: boolean
  /** Supply only for checkbox/radio items; plain commands leave the tick column blank. */
  checked?: boolean
  checkable?: boolean
}

function Item({
  label,
  shortcut,
  channel,
  arg,
  disabled,
  checked,
  checkable
}: ItemProps): React.JSX.Element {
  return (
    <DropdownMenu.Item
      className={ITEM_CLASS}
      disabled={disabled}
      onSelect={() => invoke(channel, arg)}
    >
      <span className="flex min-w-0 items-center gap-2">
        {checkable && (
          <Check className={cn('h-3.5 w-3.5 shrink-0', !checked && 'invisible')} aria-hidden />
        )}
        <span className="truncate">{label}</span>
      </span>
      {shortcut && (
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{shortcut}</span>
      )}
    </DropdownMenu.Item>
  )
}

interface AppMenuBarProps {
  /** A collapsed sidebar is 56px wide, too narrow for three labels. */
  iconOnly?: boolean
}

export function AppMenuBar({ iconOnly = false }: AppMenuBarProps): React.JSX.Element {
  // Read on open rather than subscribing: the menus are only visible while open,
  // and this is the same state the native menu is built from.
  const [s, setS] = useState<WritingMenuState | null>(null)
  const refresh = (open: boolean): void => setS(open ? computeWritingMenuState() : null)

  const fileItems = (
    <>
      <Item label="New Project" shortcut="Ctrl+N" channel="menu:newProject" />
      <Item label="Open Project" shortcut="Ctrl+O" channel="menu:openProject" />
      <DropdownMenu.Separator className={SEPARATOR_CLASS} />
      <Item label="Save" shortcut="Ctrl+S" channel="menu:save" />
      <Item label="Backups…" channel="menu:backups" />
      <Item label="Export…" shortcut="Ctrl+Shift+E" channel="menu:export" />
      <DropdownMenu.Separator className={SEPARATOR_CLASS} />
      <Item label="Close Project" shortcut="Ctrl+W" channel="menu:closeProject" />
    </>
  )

  const editItems = (
    <>
      <Item label="Undo" shortcut="Ctrl+Z" channel="menu:undo" />
      <Item label="Redo" shortcut="Ctrl+Shift+Z" channel="menu:redo" />
      <DropdownMenu.Separator className={SEPARATOR_CLASS} />
      <Item label="Quick Open…" shortcut="Ctrl+P" channel="menu:quickOpen" />
      <Item label="Find in Project" shortcut="Ctrl+Shift+F" channel="menu:findInProject" />
      <DropdownMenu.Separator className={SEPARATOR_CLASS} />
      <Item
        label="Split Document"
        shortcut="Ctrl+\"
        channel="menu:splitDocument"
        disabled={!s?.canSplitDocument}
      />
      <Item
        label="Merge with Next"
        shortcut="Alt+Ctrl+M"
        channel="menu:mergeWithNext"
        disabled={!s?.canMergeWithNext}
      />
    </>
  )

  const viewItems = (
    <>
      <Item
        label="Sidebar"
        shortcut="Alt+Ctrl+1"
        channel="menu:toggleSidebar"
        checkable
        checked={s?.sidebarVisible}
        disabled={!s?.sidebarEnabled}
      />
      <Item
        label="Focus Mode"
        shortcut="Alt+Ctrl+F"
        channel="menu:toggleFocusMode"
        checkable
        checked={s?.focusMode}
        disabled={!s?.focusModeEnabled}
      />
      <DropdownMenu.Separator className={SEPARATOR_CLASS} />

      <DropdownMenu.Label className={GROUP_LABEL_CLASS}>Typewriter Scrolling</DropdownMenu.Label>
      <Item label="Off" channel="menu:setTypewriterScrolling" arg="off" checkable checked={s?.typewriterScrolling === 'off'} />
      <Item label="On" channel="menu:setTypewriterScrolling" arg="on" checkable checked={s?.typewriterScrolling === 'on'} />
      <Item label="In Focus Mode" channel="menu:setTypewriterScrolling" arg="focus" checkable checked={s?.typewriterScrolling === 'focus'} />
      <DropdownMenu.Separator className={SEPARATOR_CLASS} />

      <DropdownMenu.Label className={GROUP_LABEL_CLASS}>Entity Highlights</DropdownMenu.Label>
      <Item label="On" channel="menu:setEntityHighlights" arg="on" checkable checked={s?.entityHighlights === 'on'} />
      <Item label="Off" channel="menu:setEntityHighlights" arg="off" checkable checked={s?.entityHighlights === 'off'} />
      <Item label="Hide in Focus Mode" channel="menu:setEntityHighlights" arg="hide-in-focus" checkable checked={s?.entityHighlights === 'hide-in-focus'} />
      <DropdownMenu.Separator className={SEPARATOR_CLASS} />

      <Item label="Editor Appearance…" channel="menu:editorAppearance" />
      <Item label="Bigger Text" shortcut="Ctrl+=" channel="menu:editorSize" arg="in" />
      <Item label="Smaller Text" shortcut="Ctrl+-" channel="menu:editorSize" arg="out" />
      <Item label="Default Text Size" shortcut="Ctrl+0" channel="menu:editorSize" arg="reset" />
      <DropdownMenu.Separator className={SEPARATOR_CLASS} />
      {/* Device Preview lives in the macOS-only Window menu, so without this it
          is unreachable from any menu on Windows. */}
      <Item label="Device Preview" channel="menu:devicePreview" />
    </>
  )

  // Collapsed: three labels will not fit, so the icon opens a menu listing
  // File/Edit/View, each of which opens its own panel to the side.
  if (iconOnly) {
    const sub = (label: string, items: React.ReactNode): React.JSX.Element => (
      <DropdownMenu.Sub>
        <DropdownMenu.SubTrigger
          className={cn(ITEM_CLASS, 'data-[state=open]:bg-accent')}
        >
          <span>{label}</span>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
        </DropdownMenu.SubTrigger>
        <DropdownMenu.Portal>
          <DropdownMenu.SubContent className={CONTENT_CLASS} sideOffset={4}>
            {items}
          </DropdownMenu.SubContent>
        </DropdownMenu.Portal>
      </DropdownMenu.Sub>
    )

    return (
      <DropdownMenu.Root onOpenChange={refresh}>
        <DropdownMenu.Trigger
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring"
          aria-label="Application menu"
        >
          <MenuIcon className="h-4 w-4" aria-hidden />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content className="z-50 min-w-[160px] rounded-md border border-border bg-popover p-1 shadow-md" align="start" sideOffset={4}>
            {sub('File', fileItems)}
            {sub('Edit', editItems)}
            {sub('View', viewItems)}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    )
  }

  return (
    <nav className="flex items-center gap-0.5" aria-label="Application menu">
      <DropdownMenu.Root onOpenChange={refresh}>
        <DropdownMenu.Trigger className={TRIGGER_CLASS}>File</DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content className={CONTENT_CLASS} align="start" sideOffset={4}>
            {fileItems}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <DropdownMenu.Root onOpenChange={refresh}>
        <DropdownMenu.Trigger className={TRIGGER_CLASS}>Edit</DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content className={CONTENT_CLASS} align="start" sideOffset={4}>
            {editItems}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <DropdownMenu.Root onOpenChange={refresh}>
        <DropdownMenu.Trigger className={TRIGGER_CLASS}>View</DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content className={CONTENT_CLASS} align="start" sideOffset={4}>
            {viewItems}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </nav>
  )
}
