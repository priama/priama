import { useEffect, useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core'
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  arrayMove
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ChevronLeft, ChevronRight, Folder, GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'
import { countNodeWords, isFolder, isChapterFolder, isSimpleChapter, stripNodeContentPreview } from '@/lib/treeUtils'
import { useAppStore } from '@/store/appStore'
import { useHistoryStore } from '@/store/historyStore'
import { makeRenameCommand } from '@/lib/commands'
import { shouldAutoFocusPendingRename } from '@/lib/pendingRename'
import { TreeContextMenu, EmptyAreaContextMenu, type MoveToFolder } from '@/components/Tree/TreeContextMenu'
import { ConfirmDialog } from '@/components/UI/ConfirmDialog'
import type { TreeNode } from '@shared/types'
import {
  parseMetadata,
  DEFAULT_CHARACTER_META,
  DEFAULT_LOCATION_META,
  DEFAULT_LORE_META,
  DEFAULT_BESTIARY_META
} from '@shared/types'
import type { CharacterMeta, LocationMeta, LoreMeta, BestiaryMeta } from '@shared/types'
import { OPTIONAL_BESTIARY_CATEGORY_ID } from '@shared/categoryIds'

interface ContainerViewProps {
  title: string
  subtitle?: string
  breadcrumb?: string
  canGoBack?: boolean
  canGoForward?: boolean
  onGoBack?: () => void
  onGoForward?: () => void
  items: TreeNode[]
  emptyMessage: string
  selectedNodeId: string | null
  onSelect: (node: TreeNode) => void
  onReorder?: (items: TreeNode[]) => void
  readOnly?: boolean
  menuVariant?: 'manuscript' | 'wiki' | 'trash'
  onRename?: (node: TreeNode) => void
  onMoveTo?: (node: TreeNode) => void
  moveToFolders?: MoveToFolder[]
  onMoveToFolder?: (node: TreeNode, folderId: string) => void
  moveToChapters?: MoveToFolder[]
  onMoveToChapter?: (node: TreeNode, chapterId: string) => void
  onConvertToSimpleChapter?: (node: TreeNode) => void
  onConvertToSceneChapter?: (node: TreeNode) => void
  onConvertSimpleToSceneChapter?: (node: TreeNode) => void
  onOpenNewWindow?: (node: TreeNode) => void
  onMoveToTrash?: (node: TreeNode) => void
  onRecover?: (node: TreeNode) => void
  onPermanentDelete?: (node: TreeNode) => void
  emptyMenuItems?: { label: string; onSelect: () => void }[]
}

interface ConfirmState {
  title: string
  description: string
  destructive?: boolean
  confirmLabel?: string
  onConfirm: () => void | Promise<void>
}

function MetaTag({ value }: { value: string }): React.JSX.Element | null {
  if (!value) return null
  return <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{value}</span>
}

function CardBody({
  node,
  allNodes,
  sceneChapter
}: {
  node: TreeNode
  allNodes: TreeNode[]
  sceneChapter: boolean
}): React.JSX.Element {
  if (sceneChapter) {
    const scenes = allNodes.filter((n) => !n.deletedAt && n.parentId === node.id && n.type === 'scene')
    const totalWords = scenes.reduce((sum, s) => sum + countNodeWords(s), 0)
    return (
      <div className="mt-2 flex-1">
        <p className="text-sm text-muted-foreground">
          {scenes.length} {scenes.length === 1 ? 'scene' : 'scenes'} · {totalWords.toLocaleString()} {totalWords === 1 ? 'word' : 'words'}
        </p>
      </div>
    )
  }

  if (node.type === 'character') {
    const meta = parseMetadata<CharacterMeta>(node.metadata, DEFAULT_CHARACTER_META)
    const tags = [meta.age, meta.race, meta.gender].filter(Boolean)
    return (
      <div className="mt-2 flex-1 space-y-2">
        {tags.length > 0 && <div className="flex flex-wrap gap-1">{tags.map((t) => <MetaTag key={t} value={t} />)}</div>}
        {meta.general && <p className="text-sm text-muted-foreground line-clamp-2">{meta.general}</p>}
      </div>
    )
  }

  if (node.type === 'location') {
    const meta = parseMetadata<LocationMeta>(node.metadata, DEFAULT_LOCATION_META)
    return (
      <div className="mt-2 flex-1 space-y-2">
        {meta.type && <div className="flex flex-wrap gap-1"><MetaTag value={meta.type} /></div>}
        {meta.general && <p className="text-sm text-muted-foreground line-clamp-2">{meta.general}</p>}
      </div>
    )
  }

  if (node.type === 'lore') {
    const meta = parseMetadata<LoreMeta>(node.metadata, DEFAULT_LORE_META)
    return (
      <div className="mt-2 flex-1 space-y-2">
        {meta.category && <div className="flex flex-wrap gap-1"><MetaTag value={meta.category} /></div>}
        {meta.general && <p className="text-sm text-muted-foreground line-clamp-2">{meta.general}</p>}
      </div>
    )
  }

  if (node.type === 'entry' && node.categoryId === OPTIONAL_BESTIARY_CATEGORY_ID) {
    const meta = parseMetadata<BestiaryMeta>(node.metadata, DEFAULT_BESTIARY_META)
    const tags = [meta.species, meta.type].filter(Boolean)
    return (
      <div className="mt-2 flex-1 space-y-2">
        {tags.length > 0 && <div className="flex flex-wrap gap-1">{tags.map((t) => <MetaTag key={t} value={t} />)}</div>}
        {meta.general && <p className="text-sm text-muted-foreground line-clamp-2">{meta.general}</p>}
      </div>
    )
  }

  const preview = stripNodeContentPreview(node)
  const words = countNodeWords(node)
  return (
    <>
      <p className="mt-2 flex-1 text-sm text-muted-foreground line-clamp-3">{preview}</p>
      {words > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          {words.toLocaleString()} {words === 1 ? 'word' : 'words'}
        </p>
      )}
    </>
  )
}

function SortableCard({
  node,
  isSelected,
  readOnly,
  menuVariant = 'manuscript',
  renaming,
  renameAutoFocus = true,
  renameValue,
  onRenameValueChange,
  onRenameCommit,
  onRenameCancel,
  onSelect,
  onRename,
  onMoveTo,
  moveToFolders,
  onMoveToFolder,
  moveToChapters,
  onMoveToChapter,
  onConvertToSimpleChapter,
  onConvertToSceneChapter,
  onConvertSimpleToSceneChapter,
  onOpenNewWindow,
  onMoveToTrash,
  onRecover,
  onPermanentDelete,
  onConfirm
}: {
  node: TreeNode
  isSelected: boolean
  readOnly?: boolean
  menuVariant?: 'manuscript' | 'wiki' | 'trash'
  renaming?: boolean
  renameAutoFocus?: boolean
  renameValue?: string
  onRenameValueChange?: (value: string) => void
  onRenameCommit?: () => void
  onRenameCancel?: () => void
  onSelect: () => void
  onRename?: () => void
  onMoveTo?: () => void
  moveToFolders?: MoveToFolder[]
  onMoveToFolder?: (folderId: string) => void
  moveToChapters?: MoveToFolder[]
  onMoveToChapter?: (chapterId: string) => void
  onConvertToSimpleChapter?: () => void
  onConvertToSceneChapter?: () => void
  onConvertSimpleToSceneChapter?: () => void
  onOpenNewWindow?: () => void
  onMoveToTrash?: () => void
  onRecover?: () => void
  onPermanentDelete?: () => void
  onConfirm: (state: ConfirmState) => void
}): React.JSX.Element {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: node.id,
    disabled: readOnly
  })
  const allNodes = useAppStore((s) => s.nodes)

  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  }

  const folderNode = isFolder(node)
  const sceneChapter = isChapterFolder(node)

  const card = (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'no-drag group relative flex flex-col rounded-lg border bg-card p-4 shadow-sm transition-colors',
        renaming ? 'cursor-default' : 'cursor-pointer',
        isSelected ? 'border-primary ring-1 ring-primary' : 'border-border hover:border-primary/50 hover:bg-accent/30',
        isDragging && 'opacity-50 z-10',
        sceneChapter && 'border-dashed'
      )}
      onClick={renaming ? undefined : onSelect}
    >
      {!readOnly && !renaming && (
        <button
          type="button"
          className="absolute right-2 top-2 rounded p-1 opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100 cursor-grab touch-none"
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
      )}
      <div className="flex items-start gap-2 pr-8">
        {folderNode && <Folder className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
        {renaming ? (
          <input
            autoFocus={renameAutoFocus}
            value={renameValue ?? node.title}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => onRenameValueChange?.(e.target.value)}
            onBlur={() => onRenameCommit?.()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onRenameCommit?.()
              if (e.key === 'Escape') onRenameCancel?.()
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-full rounded border border-input bg-background px-2 py-1 text-sm font-medium"
          />
        ) : (
          <h3 className="font-medium leading-snug">{node.title}</h3>
        )}
      </div>
      {!renaming && <CardBody node={node} allNodes={allNodes} sceneChapter={sceneChapter} />}
    </div>
  )

  if (renaming) return card

  if (readOnly && menuVariant === 'trash') {
    return (
      <TreeContextMenu
        variant="trash"
        node={node}
        onRecover={onRecover}
        onPermanentDelete={() =>
          onConfirm({
            title: 'Delete permanently?',
            description: `This will permanently delete "${node.title}". This action cannot be undone.`,
            destructive: true,
            confirmLabel: 'Delete permanently',
            onConfirm: () => onPermanentDelete?.()
          })
        }
      >
        {card}
      </TreeContextMenu>
    )
  }

  if (readOnly) return card

  return (
    <TreeContextMenu
      variant={menuVariant}
      node={node}
      onRename={onRename}
      onMoveTo={node.type === 'scene' ? onMoveTo : undefined}
      moveToFolders={moveToFolders?.filter((f) => f.id !== node.id && (node.parentId ? f.id !== node.parentId : f.id !== '__root__'))}
      onMoveToFolder={onMoveToFolder}
      moveToChapters={node.type === 'scene' ? moveToChapters?.filter((c) => c.id !== node.parentId) : undefined}
      onMoveToChapter={node.type === 'scene' ? onMoveToChapter : undefined}
      onConvertToSimpleChapter={node.type === 'scene' ? onConvertToSimpleChapter : undefined}
      onConvertToSceneChapter={node.type === 'scene' ? onConvertToSceneChapter : undefined}
      onConvertSimpleToSceneChapter={node.type === 'chapter' && isSimpleChapter(node) ? onConvertSimpleToSceneChapter : undefined}
      onOpenNewWindow={folderNode ? undefined : onOpenNewWindow}
      onMoveToTrash={() =>
        onConfirm({
          title: 'Move to trash?',
          description: `Are you sure you want to move "${node.title}" to trash? You can recover it within 50 days.`,
          destructive: true,
          confirmLabel: 'Move to trash',
          onConfirm: () => onMoveToTrash?.()
        })
      }
    >
      {card}
    </TreeContextMenu>
  )
}

export function ContainerView({
  title,
  subtitle,
  breadcrumb,
  canGoBack,
  canGoForward,
  onGoBack,
  onGoForward,
  items,
  emptyMessage,
  selectedNodeId,
  onSelect,
  onReorder,
  readOnly = false,
  menuVariant = 'manuscript',
  onRename,
  onMoveTo,
  moveToFolders,
  onMoveToFolder,
  moveToChapters,
  onMoveToChapter,
  onConvertToSimpleChapter,
  onConvertToSceneChapter,
  onConvertSimpleToSceneChapter,
  onOpenNewWindow,
  onMoveToTrash,
  onRecover,
  onPermanentDelete,
  emptyMenuItems
}: ContainerViewProps): React.JSX.Element {
  const [confirm, setConfirm] = useState<ConfirmState | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const pendingRenameNodeId = useAppStore((s) => s.pendingRenameNodeId)
  const pendingRenameTargets = useAppStore((s) => s.pendingRenameTargets)
  const nodes = useAppStore((s) => s.nodes)

  const isPendingContainerRename = (nodeId: string): boolean =>
    pendingRenameNodeId === nodeId && pendingRenameTargets.includes('container')

  useEffect(() => {
    if (!pendingRenameNodeId || !pendingRenameTargets.includes('container')) return
    const node = nodes.find((n) => n.id === pendingRenameNodeId)
    if (node && items.some((item) => item.id === pendingRenameNodeId)) {
      setRenameValue(node.title)
    }
  }, [pendingRenameNodeId, pendingRenameTargets, nodes, items])

  const startRename = (node: TreeNode): void => {
    setRenamingId(node.id)
    setRenameValue(node.title)
  }

  const handleRenameCommit = async (id: string): Promise<void> => {
    const trimmed = renameValue.trim()
    const store = useAppStore.getState()
    const isPending = store.hasPendingRename('container', id)

    if (!trimmed) {
      setRenamingId(null)
      if (isPending) {
        store.clearPendingRenameTarget('container')
      } else {
        store.clearPendingRename()
      }
      return
    }
    const node = nodes.find((n) => n.id === id)
    if (!node || trimmed === node.title) {
      setRenamingId(null)
      if (isPending) {
        store.clearPendingRenameTarget('container')
      } else {
        store.clearPendingRename()
      }
      return
    }
    await useHistoryStore.getState().push(
      makeRenameCommand({ id, oldTitle: node.title, newTitle: trimmed })
    )
    setRenamingId(null)
    store.clearPendingRename()
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = (event: DragEndEvent): void => {
    if (!onReorder) return
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex((n) => n.id === active.id)
    const newIndex = items.findIndex((n) => n.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    onReorder(arrayMove(items, oldIndex, newIndex))
  }

  const content = (
    <div className="flex-1 overflow-y-auto px-8 py-6">
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((n) => n.id)} strategy={rectSortingStrategy}>
            <div className="mx-auto grid max-w-5xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((node) => {
                const showRename = renamingId === node.id || isPendingContainerRename(node.id)
                return (
                <SortableCard
                  key={node.id}
                  node={node}
                  isSelected={selectedNodeId === node.id}
                  readOnly={readOnly}
                  menuVariant={menuVariant}
                  renaming={showRename}
                  renameAutoFocus={shouldAutoFocusPendingRename('container')}
                  renameValue={renameValue}
                  onRenameValueChange={setRenameValue}
                  onRenameCommit={() => void handleRenameCommit(node.id)}
                  onRenameCancel={() => {
                    setRenamingId(null)
                    useAppStore.getState().clearPendingRename()
                  }}
                  onSelect={() => onSelect(node)}
                  onRename={
                    onRename
                      ? () => onRename(node)
                      : () => startRename(node)
                  }
                  onMoveTo={onMoveTo ? () => onMoveTo(node) : undefined}
                  moveToFolders={moveToFolders}
                  onMoveToFolder={onMoveToFolder ? (folderId) => onMoveToFolder(node, folderId) : undefined}
                  moveToChapters={moveToChapters}
                  onMoveToChapter={onMoveToChapter ? (chapterId) => onMoveToChapter(node, chapterId) : undefined}
                  onConvertToSimpleChapter={onConvertToSimpleChapter ? () => onConvertToSimpleChapter(node) : undefined}
                  onConvertToSceneChapter={onConvertToSceneChapter ? () => onConvertToSceneChapter(node) : undefined}
                  onConvertSimpleToSceneChapter={onConvertSimpleToSceneChapter ? () => onConvertSimpleToSceneChapter(node) : undefined}
                  onOpenNewWindow={onOpenNewWindow ? () => onOpenNewWindow(node) : undefined}
                  onMoveToTrash={onMoveToTrash ? () => onMoveToTrash(node) : undefined}
                  onRecover={onRecover ? () => onRecover(node) : undefined}
                  onPermanentDelete={onPermanentDelete ? () => onPermanentDelete(node) : undefined}
                  onConfirm={setConfirm}
                />
                )
              })}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  )

  return (
    <div className="no-drag flex flex-1 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-border px-8 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <h1 className="shrink-0 text-lg font-semibold">{title}</h1>
            {breadcrumb && (
              <div className="min-w-0 max-w-[70%] overflow-x-auto scrollbar-none">
                <p className="whitespace-nowrap text-sm text-muted-foreground">{breadcrumb}</p>
              </div>
            )}
            {subtitle && <p className="shrink-0 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          {(canGoBack || canGoForward) && (
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                disabled={!canGoBack}
                onClick={onGoBack}
                className="rounded p-1 hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent"
                aria-label="Go back"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={!canGoForward}
                onClick={onGoForward}
                className="rounded p-1 hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent"
                aria-label="Go forward"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
      {emptyMenuItems && emptyMenuItems.length > 0 ? (
        <EmptyAreaContextMenu items={emptyMenuItems}>{content}</EmptyAreaContextMenu>
      ) : (
        content
      )}
      {confirm && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setConfirm(null)}
          title={confirm.title}
          description={confirm.description}
          confirmLabel={confirm.confirmLabel}
          destructive={confirm.destructive}
          onConfirm={confirm.onConfirm}
        />
      )}
    </div>
  )
}
