import { formatDistanceToNow } from 'date-fns'
import * as ContextMenu from '@radix-ui/react-context-menu'
import { AlertCircle } from 'lucide-react'
import type { RecentProjectWithStatus } from '@shared/types'
import { truncatePath } from '@shared/pathUtils'
import { cn } from '@/lib/utils'

const menuItemClass =
  'flex cursor-pointer rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent'
const menuItemDestructiveClass = `${menuItemClass} text-destructive`

interface ProjectCardProps {
  project: RecentProjectWithStatus
  onOpen: () => void
  onRename: () => void
  onStats: () => void
  onShowInFolder: () => void
  onRemove: () => void
  onDelete: () => void
  onLocate: () => void
}

export function ProjectCard({
  project,
  onOpen,
  onRename,
  onStats,
  onShowInFolder,
  onRemove,
  onDelete,
  onLocate
}: ProjectCardProps): React.JSX.Element {
  const isMac = navigator.platform.toLowerCase().includes('mac')
  const lastOpened = formatDistanceToNow(new Date(project.lastOpened), { addSuffix: true })

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <button
          onClick={() => project.exists && onOpen()}
          disabled={!project.exists}
          className={cn(
            'group relative flex h-full min-h-[116px] flex-col rounded-[10px] border border-[var(--launch-hairline)] bg-[var(--launch-bg-card)] px-[18px] pb-4 pt-[18px] text-left transition-[background,border-color,transform] duration-100 hover:-translate-y-px hover:border-[var(--launch-card-hover-border)] hover:bg-[var(--launch-bg-card-hover)]',
            !project.exists && 'cursor-not-allowed opacity-60'
          )}
        >
          <div
            className="absolute bottom-[14px] left-0 top-[14px] w-[3px] rounded-[2px]"
            style={{ backgroundColor: project.coverColor }}
          />
          <div className="flex min-w-0 flex-col gap-[3px] pl-[14px]">
            <h3 className="truncate font-serif text-[17px] font-bold leading-tight text-[var(--launch-ink)]">
              {project.title}
            </h3>
            <p className="truncate text-[12.5px] text-[var(--launch-ink-dim)]">
              {project.author || 'Unknown author'}
            </p>
            <span className="text-[11.5px] text-[var(--launch-ink-faint)]">{lastOpened}</span>
            <span className="truncate font-mono text-[10.5px] text-[var(--launch-ink-faint)]">
              {truncatePath(project.primaryPath, 28)}
            </span>
          </div>
          {!project.exists && (
            <div className="absolute right-2 top-2 flex items-center gap-1 rounded bg-destructive/90 px-2 py-0.5 text-xs text-white">
              <AlertCircle className="h-3 w-3" />
              Not Found
            </div>
          )}
        </button>
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className="z-50 min-w-[180px] rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md">
          {project.exists ? (
            <>
              <ContextMenu.Item className={menuItemClass} onSelect={onOpen}>
                Open
              </ContextMenu.Item>
              <ContextMenu.Item className={menuItemClass} onSelect={onRename}>
                Rename
              </ContextMenu.Item>
              <ContextMenu.Item className={menuItemClass} onSelect={onStats}>
                Stats
              </ContextMenu.Item>
              <ContextMenu.Item className={menuItemClass} onSelect={onShowInFolder}>
                {isMac ? 'Show in Finder' : 'Show in Explorer'}
              </ContextMenu.Item>
              <ContextMenu.Separator className="my-1 h-px bg-border" />
              <ContextMenu.Item className={menuItemDestructiveClass} onSelect={onDelete}>
                Delete Project…
              </ContextMenu.Item>
              <ContextMenu.Separator className="my-1 h-px bg-border" />
              <ContextMenu.Item className={menuItemDestructiveClass} onSelect={onRemove}>
                Remove from Recent
              </ContextMenu.Item>
            </>
          ) : (
            <>
              <ContextMenu.Item className={menuItemClass} onSelect={onLocate}>
                Locate Project
              </ContextMenu.Item>
              <ContextMenu.Separator className="my-1 h-px bg-border" />
              <ContextMenu.Item className={menuItemDestructiveClass} onSelect={onRemove}>
                Remove from Recent
              </ContextMenu.Item>
            </>
          )}
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  )
}
