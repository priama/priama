import * as ContextMenu from '@radix-ui/react-context-menu'
import { ArrowRightLeft, FolderInput, Info, Pencil, RotateCcw, Trash2 } from 'lucide-react'
import type { TreeNode } from '@shared/types'

type TreeMenuVariant = 'manuscript' | 'wiki' | 'folder' | 'trash' | 'wikiRow'

export interface MoveToFolder {
  id: string
  title: string
  /** Where it sits — shown under the title so a long name can shorten alone. */
  sub?: string
}

interface TreeContextMenuProps {
  variant: TreeMenuVariant
  node?: TreeNode
  onInfo?: () => void
  onRename?: () => void
  onMoveTo?: () => void
  moveToFolders?: MoveToFolder[]
  onMoveToFolder?: (folderId: string) => void
  moveToChapters?: MoveToFolder[]
  onMoveToChapter?: (chapterId: string) => void
  onConvertToSimpleChapter?: () => void
  onConvertToSceneChapter?: () => void
  onConvertSimpleToSceneChapter?: () => void
  onConvertScenesChapterToSimple?: () => void
  onMergeWithNext?: () => void
  onMoveToTrash?: () => void
  onRecover?: () => void
  onPermanentDelete?: () => void
  children: React.ReactNode
}

export function TreeContextMenu({
  variant,
  node,
  onInfo,
  onRename,
  onMoveTo,
  moveToFolders,
  onMoveToFolder,
  moveToChapters,
  onMoveToChapter,
  onConvertToSimpleChapter,
  onConvertToSceneChapter,
  onConvertSimpleToSceneChapter,
  onConvertScenesChapterToSimple,
  onMergeWithNext,
  onMoveToTrash,
  onRecover,
  onPermanentDelete,
  children
}: TreeContextMenuProps): React.JSX.Element {
  const isScene = node?.type === 'scene'
  const isTrash = variant === 'trash'
  const hasFolderSubmenu = moveToFolders && moveToFolders.length > 0 && onMoveToFolder
  const hasChapterSubmenu = moveToChapters && moveToChapters.length > 0 && onMoveToChapter
  const hasConvertSubmenu = isScene && (onConvertToSimpleChapter || onConvertToSceneChapter)

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className="z-50 min-w-[180px] rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md">
          {isTrash ? (
            <>
              <ContextMenu.Item
                className="flex cursor-pointer items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent"
                onSelect={onRecover}
              >
                <RotateCcw className="mr-2 h-3.5 w-3.5" />
                Recover
              </ContextMenu.Item>
              <ContextMenu.Separator className="my-1 h-px bg-border" />
              <ContextMenu.Item
                className="flex cursor-pointer items-center rounded-sm px-2 py-1.5 text-sm text-destructive outline-none hover:bg-accent"
                onSelect={onPermanentDelete}
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                Delete permanently
              </ContextMenu.Item>
            </>
          ) : (
            <>
              {onInfo && (
                <ContextMenu.Item
                  className="flex cursor-pointer items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent"
                  onSelect={onInfo}
                >
                  <Info className="mr-2 h-3.5 w-3.5" />
                  Info
                </ContextMenu.Item>
              )}
              {onRename && (
                <ContextMenu.Item
                  className="flex cursor-pointer items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent"
                  onSelect={onRename}
                >
                  <Pencil className="mr-2 h-3.5 w-3.5" />
                  Rename
                </ContextMenu.Item>
              )}
              {hasFolderSubmenu && (
                <ContextMenu.Sub>
                  <ContextMenu.SubTrigger className="flex cursor-pointer items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent data-[state=open]:bg-accent">
                    <FolderInput className="mr-2 h-3.5 w-3.5" />
                    Move to folder
                  </ContextMenu.SubTrigger>
                  <ContextMenu.Portal>
                    <ContextMenu.SubContent className="z-50 min-w-[160px] rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md">
                      {moveToFolders!.map((f, i) => {
                        const isRoot = f.id === '__root__'
                        const nextIsFolder = i + 1 < moveToFolders!.length && moveToFolders![i + 1].id !== '__root__'
                        return (
                          <span key={f.id}>
                            <ContextMenu.Item
                              className="flex cursor-pointer items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent"
                              onSelect={() => onMoveToFolder!(f.id)}
                            >
                              {f.title}
                            </ContextMenu.Item>
                            {isRoot && nextIsFolder && <ContextMenu.Separator className="my-1 h-px bg-border" />}
                          </span>
                        )
                      })}
                    </ContextMenu.SubContent>
                  </ContextMenu.Portal>
                </ContextMenu.Sub>
              )}
              {hasChapterSubmenu && (
                <ContextMenu.Sub>
                  <ContextMenu.SubTrigger className="flex cursor-pointer items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent data-[state=open]:bg-accent">
                    <FolderInput className="mr-2 h-3.5 w-3.5" />
                    Move to chapter
                  </ContextMenu.SubTrigger>
                  <ContextMenu.Portal>
                    <ContextMenu.SubContent className="z-50 w-[216px] max-w-[216px] rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md">
                      {moveToChapters!.map((c) => (
                        <ContextMenu.Item
                          key={c.id}
                          className="flex min-w-0 cursor-pointer flex-col items-start rounded-sm px-2 py-1 outline-none hover:bg-accent"
                          onSelect={() => onMoveToChapter!(c.id)}
                        >
                          <span className="w-full truncate text-sm" title={c.title}>
                            {c.title}
                          </span>
                          {c.sub && (
                            <span className="w-full truncate text-[10.5px] text-muted-foreground">
                              {c.sub}
                            </span>
                          )}
                        </ContextMenu.Item>
                      ))}
                    </ContextMenu.SubContent>
                  </ContextMenu.Portal>
                </ContextMenu.Sub>
              )}
              {isScene && onMoveTo && !hasChapterSubmenu && (
                <ContextMenu.Item
                  className="flex cursor-pointer items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent"
                  onSelect={onMoveTo}
                >
                  <FolderInput className="mr-2 h-3.5 w-3.5" />
                  Move to…
                </ContextMenu.Item>
              )}
              {hasConvertSubmenu && (
                <ContextMenu.Sub>
                  <ContextMenu.SubTrigger className="flex cursor-pointer items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent data-[state=open]:bg-accent">
                    <ArrowRightLeft className="mr-2 h-3.5 w-3.5" />
                    Turn into a chapter
                  </ContextMenu.SubTrigger>
                  <ContextMenu.Portal>
                    <ContextMenu.SubContent className="z-50 min-w-[160px] rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md">
                      {onConvertToSimpleChapter && (
                        <ContextMenu.Item
                          className="flex cursor-pointer flex-col items-start rounded-sm px-2 py-1 outline-none hover:bg-accent"
                          onSelect={onConvertToSimpleChapter}
                        >
                          <span className="text-sm">One document</span>
                          <span className="text-[10.5px] text-muted-foreground">
                            Write the whole chapter in one go
                          </span>
                        </ContextMenu.Item>
                      )}
                      {onConvertToSceneChapter && (
                        <ContextMenu.Item
                          className="flex cursor-pointer flex-col items-start rounded-sm px-2 py-1 outline-none hover:bg-accent"
                          onSelect={onConvertToSceneChapter}
                        >
                          <span className="text-sm">Scenes</span>
                          <span className="text-[10.5px] text-muted-foreground">
                            Separate documents that export as one
                          </span>
                        </ContextMenu.Item>
                      )}
                    </ContextMenu.SubContent>
                  </ContextMenu.Portal>
                </ContextMenu.Sub>
              )}
              {onConvertSimpleToSceneChapter && (
                <ContextMenu.Item
                  className="flex cursor-pointer items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent"
                  onSelect={onConvertSimpleToSceneChapter}
                >
                  <ArrowRightLeft className="mr-2 h-3.5 w-3.5" />
                  Split into scenes
                </ContextMenu.Item>
              )}
              {onConvertScenesChapterToSimple && (
                <ContextMenu.Item
                  className="flex cursor-pointer items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent"
                  onSelect={onConvertScenesChapterToSimple}
                >
                  <ArrowRightLeft className="mr-2 h-3.5 w-3.5" />
                  Merge into one document
                </ContextMenu.Item>
              )}
              {onMergeWithNext && (
                <ContextMenu.Item
                  className="flex cursor-pointer items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent"
                  onSelect={onMergeWithNext}
                >
                  <ArrowRightLeft className="mr-2 h-3.5 w-3.5" />
                  Merge with Next
                </ContextMenu.Item>
              )}
              {(onRename || onMoveTo) && onMoveToTrash && (
                <ContextMenu.Separator className="my-1 h-px bg-border" />
              )}
              {onMoveToTrash && (
                <ContextMenu.Item
                  className="flex cursor-pointer items-center rounded-sm px-2 py-1.5 text-sm text-destructive outline-none hover:bg-accent"
                  onSelect={onMoveToTrash}
                >
                  <Trash2 className="mr-2 h-3.5 w-3.5" />
                  Move to trash
                </ContextMenu.Item>
              )}
            </>
          )}
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  )
}

interface EmptyAreaContextMenuProps {
  items: { label: string; onSelect: () => void; destructive?: boolean }[]
  children: React.ReactNode
}

export function EmptyAreaContextMenu({
  items,
  children
}: EmptyAreaContextMenuProps): React.JSX.Element {
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className="z-50 min-w-[200px] rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md">
          {items.map((item) => (
            <ContextMenu.Item
              key={item.label}
              className={`flex cursor-pointer items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent ${
                item.destructive ? 'text-destructive' : ''
              }`}
              onSelect={item.onSelect}
            >
              {item.label}
            </ContextMenu.Item>
          ))}
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  )
}
