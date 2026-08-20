import { useState } from 'react'
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
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  arrayMove
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { formatDistanceToNow } from 'date-fns'
import { ChevronLeft, ChevronRight, Folder, GripVertical, LayoutGrid, List } from 'lucide-react'
import { cn } from '@/lib/utils'
import { countNodeWords, isFolder, isChapterFolder, isSimpleChapter, stripNodeContentPreview } from '@/lib/treeUtils'
import { canMergeWithNext } from '@/lib/splitMerge'
import { useAppStore } from '@/store/appStore'
import { useHistoryStore } from '@/store/historyStore'
import { makeRenameCommand } from '@/lib/commands'
import { useRenameInput } from '@/hooks/useRenameInput'
import { TreeContextMenu, EmptyAreaContextMenu, type MoveToFolder } from '@/components/Tree/TreeContextMenu'
import { ConfirmDialog } from '@/components/UI/ConfirmDialog'
import type { ContainerViewMode, TreeNode } from '@shared/types'
import {
  parseMetadata,
  DEFAULT_CHARACTER_META,
  DEFAULT_LOCATION_META,
  DEFAULT_LORE_META,
  DEFAULT_BESTIARY_META
} from '@shared/types'
import type { CharacterMeta, LocationMeta, LoreMeta, BestiaryMeta } from '@shared/types'
import { OPTIONAL_BESTIARY_CATEGORY_ID } from '@shared/categoryIds'

export type ListVariant =
  | 'default'
  | 'manuscript'
  | 'chapterScenes'
  | 'characters'
  | 'locations'
  | 'lore'

const LIST_GRID_COLS =
  'grid-cols-[minmax(0,2fr)_minmax(0,7rem)_9rem_9rem_minmax(0,1.5fr)_1.75rem]'

interface ContainerViewProps {
  title: string
  subtitle?: string
  breadcrumb?: string
  canGoBack?: boolean
  canGoForward?: boolean
  onGoBack?: () => void
  onGoForward?: () => void
  viewMode: ContainerViewMode
  onViewModeChange: (mode: ContainerViewMode) => void
  listVariant?: ListVariant
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
  onConvertScenesChapterToSimple?: (node: TreeNode) => void
  onMergeWithNext?: (node: TreeNode) => void
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

type ItemMenuProps = {
  node: TreeNode
  isSelected: boolean
  readOnly?: boolean
  menuVariant?: 'manuscript' | 'wiki' | 'trash'
  listVariant?: ListVariant
  /** Manual (context-menu) rename — session rename is handled inside the item. */
  renaming?: boolean
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
  onConvertScenesChapterToSimple?: () => void
  onMergeWithNext?: () => void
  onMoveToTrash?: () => void
  onRecover?: () => void
  onPermanentDelete?: () => void
  onConfirm: (state: ConfirmState) => void
}

function MetaTag({ value }: { value: string }): React.JSX.Element | null {
  if (!value) return null
  return <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{value}</span>
}

function formatNodeTypeLabel(type: TreeNode['type']): string {
  if (!type) return ''
  return type.charAt(0).toUpperCase() + type.slice(1)
}

function formatRelativeDate(iso: string | undefined): string {
  if (!iso) return '—'
  return formatDistanceToNow(new Date(iso), { addSuffix: true })
}

function listTypeColumnLabel(variant: ListVariant): string {
  return variant === 'lore' ? 'Category' : 'Type'
}

function listTypeCell(
  node: TreeNode,
  variant: ListVariant
): { text: string; title?: string } {
  if (variant === 'locations' && node.type === 'location') {
    const meta = parseMetadata<LocationMeta>(node.metadata, DEFAULT_LOCATION_META)
    const text = meta.type.trim()
    return text ? { text, title: text } : { text: '—' }
  }
  if (variant === 'lore' && node.type === 'lore') {
    const meta = parseMetadata<LoreMeta>(node.metadata, DEFAULT_LORE_META)
    const text = meta.category.trim()
    return text ? { text, title: text } : { text: '—' }
  }
  return { text: formatNodeTypeLabel(node.type) || '—' }
}

function listContentsSummary(
  node: TreeNode,
  allNodes: TreeNode[],
  sceneChapter: boolean
): string {
  if (sceneChapter) {
    const scenes = allNodes.filter((n) => !n.deletedAt && n.parentId === node.id && n.type === 'scene')
    const totalWords = scenes.reduce((sum, s) => sum + countNodeWords(s), 0)
    return `${scenes.length} ${scenes.length === 1 ? 'scene' : 'scenes'} · ${totalWords.toLocaleString()} ${totalWords === 1 ? 'word' : 'words'}`
  }

  if (isFolder(node)) {
    const children = allNodes.filter((n) => !n.deletedAt && n.parentId === node.id)
    if (children.length === 0) return 'Empty'
    return `${children.length} ${children.length === 1 ? 'item' : 'items'}`
  }

  const words = countNodeWords(node)
  if (words > 0) {
    return `${words.toLocaleString()} ${words === 1 ? 'word' : 'words'}`
  }
  return ''
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
    return (
      <div className="mt-2 flex-1">
        <p className="text-sm text-muted-foreground">
          {listContentsSummary(node, allNodes, sceneChapter)}
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

function wrapItemMenu(
  props: ItemMenuProps,
  children: React.JSX.Element
): React.JSX.Element {
  const {
    node,
    readOnly,
    menuVariant = 'manuscript',
    renaming,
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
    onConfirm
  } = props

  if (renaming) return children

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
        {children}
      </TreeContextMenu>
    )
  }

  if (readOnly) return children

  const nodes = useAppStore.getState().nodes

  return (
    <TreeContextMenu
      variant={menuVariant}
      node={node}
      onRename={onRename}
      onMoveTo={node.type === 'scene' ? onMoveTo : undefined}
      moveToFolders={
        node.type === 'scene'
          ? undefined
          : moveToFolders?.filter(
              (f) => f.id !== node.id && (node.parentId ? f.id !== node.parentId : f.id !== '__root__')
            )
      }
      onMoveToFolder={node.type === 'scene' ? undefined : onMoveToFolder}
      moveToChapters={node.type === 'scene' ? moveToChapters?.filter((c) => c.id !== node.parentId) : undefined}
      onMoveToChapter={node.type === 'scene' ? onMoveToChapter : undefined}
      onConvertToSimpleChapter={node.type === 'scene' ? onConvertToSimpleChapter : undefined}
      onConvertToSceneChapter={node.type === 'scene' ? onConvertToSceneChapter : undefined}
      onConvertSimpleToSceneChapter={node.type === 'chapter' && isSimpleChapter(node) ? onConvertSimpleToSceneChapter : undefined}
      onConvertScenesChapterToSimple={
        node.type === 'chapter' && isChapterFolder(node) ? onConvertScenesChapterToSimple : undefined
      }
      onMergeWithNext={canMergeWithNext(node, nodes) ? onMergeWithNext : undefined}
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
      {children}
    </TreeContextMenu>
  )
}

function SortableCard(props: ItemMenuProps): React.JSX.Element {
  const {
    node,
    isSelected,
    readOnly,
    renaming: localRenaming,
    renameValue,
    onRenameValueChange,
    onRenameCommit,
    onRenameCancel,
    onSelect
  } = props

  const sessionRename = useRenameInput('container', node.id)
  const renaming = sessionRename.isEditing || !!localRenaming

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
        {sessionRename.isEditing ? (
          <input
            ref={sessionRename.inputRef}
            value={sessionRename.draft}
            onFocus={sessionRename.onFocus}
            onChange={sessionRename.onChange}
            onBlur={sessionRename.onBlur}
            onKeyDown={sessionRename.onKeyDown}
            onClick={(e) => e.stopPropagation()}
            className="w-full rounded border border-input bg-background px-2 py-1 text-sm font-medium"
          />
        ) : localRenaming ? (
          <input
            autoFocus
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

  return wrapItemMenu(props, card)
}

function SortableListRow(props: ItemMenuProps): React.JSX.Element {
  const {
    node,
    isSelected,
    readOnly,
    listVariant = 'default',
    renaming: localRenaming,
    renameValue,
    onRenameValueChange,
    onRenameCommit,
    onRenameCancel,
    onSelect
  } = props

  const sessionRename = useRenameInput('container', node.id)
  const renaming = sessionRename.isEditing || !!localRenaming

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
  const contents = listContentsSummary(node, allNodes, sceneChapter)
  const typeCell = listTypeCell(node, listVariant)
  const created = formatRelativeDate(node.createdAt)
  const lastEdited = formatRelativeDate(node.updatedAt)

  const row = (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'no-drag group grid items-center gap-3 border-b border-border px-3 py-2.5 text-sm transition-colors',
        LIST_GRID_COLS,
        renaming ? 'cursor-default' : 'cursor-pointer',
        isSelected ? 'bg-accent/50' : 'hover:bg-accent/30',
        isDragging && 'opacity-50 z-10 bg-card'
      )}
      onClick={renaming ? undefined : onSelect}
    >
      <div className="flex min-w-0 items-center gap-2">
        {folderNode && <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />}
        {sessionRename.isEditing ? (
          <input
            ref={sessionRename.inputRef}
            value={sessionRename.draft}
            onFocus={sessionRename.onFocus}
            onChange={sessionRename.onChange}
            onBlur={sessionRename.onBlur}
            onKeyDown={sessionRename.onKeyDown}
            onClick={(e) => e.stopPropagation()}
            className="w-full rounded border border-input bg-background px-2 py-1 text-sm font-medium"
          />
        ) : localRenaming ? (
          <input
            autoFocus
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
          <span className="truncate font-medium">{node.title}</span>
        )}
      </div>
      <span className="truncate text-muted-foreground" title={typeCell.title}>
        {typeCell.text}
      </span>
      <span className="truncate text-muted-foreground">{created}</span>
      <span className="truncate text-muted-foreground">{lastEdited}</span>
      <span className="truncate text-muted-foreground">{contents || '—'}</span>
      {!readOnly && !renaming ? (
        <button
          type="button"
          className="justify-self-end rounded p-1 opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100 cursor-grab touch-none"
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
      ) : (
        <span />
      )}
    </div>
  )

  return wrapItemMenu(props, row)
}

export function ContainerView({
  title,
  subtitle,
  breadcrumb,
  canGoBack,
  canGoForward,
  onGoBack,
  onGoForward,
  viewMode,
  onViewModeChange,
  listVariant = 'default',
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
  onConvertScenesChapterToSimple,
  onMergeWithNext,
  onMoveToTrash,
  onRecover,
  onPermanentDelete,
  emptyMenuItems
}: ContainerViewProps): React.JSX.Element {
  const [confirm, setConfirm] = useState<ConfirmState | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const nodes = useAppStore((s) => s.nodes)

  const startRename = (node: TreeNode): void => {
    setRenamingId(node.id)
    setRenameValue(node.title)
  }

  const handleRenameCommit = async (id: string): Promise<void> => {
    const trimmed = renameValue.trim()
    if (!trimmed) {
      setRenamingId(null)
      return
    }
    const node = nodes.find((n) => n.id === id)
    if (!node || trimmed === node.title) {
      setRenamingId(null)
      return
    }
    await useHistoryStore.getState().push(
      makeRenameCommand({ id, oldTitle: node.title, newTitle: trimmed })
    )
    setRenamingId(null)
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

  const itemProps = (node: TreeNode): ItemMenuProps => {
    const showRename = renamingId === node.id
    return {
      node,
      isSelected: selectedNodeId === node.id,
      readOnly,
      menuVariant,
      listVariant,
      renaming: showRename,
      renameValue,
      onRenameValueChange: setRenameValue,
      onRenameCommit: () => void handleRenameCommit(node.id),
      onRenameCancel: () => setRenamingId(null),
      onSelect: () => onSelect(node),
      onRename: onRename ? () => onRename(node) : () => startRename(node),
      onMoveTo: onMoveTo ? () => onMoveTo(node) : undefined,
      moveToFolders,
      onMoveToFolder: onMoveToFolder ? (folderId) => onMoveToFolder(node, folderId) : undefined,
      moveToChapters,
      onMoveToChapter: onMoveToChapter ? (chapterId) => onMoveToChapter(node, chapterId) : undefined,
      onConvertToSimpleChapter: onConvertToSimpleChapter ? () => onConvertToSimpleChapter(node) : undefined,
      onConvertToSceneChapter: onConvertToSceneChapter ? () => onConvertToSceneChapter(node) : undefined,
      onConvertSimpleToSceneChapter: onConvertSimpleToSceneChapter
        ? () => onConvertSimpleToSceneChapter(node)
        : undefined,
      onConvertScenesChapterToSimple: onConvertScenesChapterToSimple
        ? () => onConvertScenesChapterToSimple(node)
        : undefined,
      onMergeWithNext: onMergeWithNext ? () => onMergeWithNext(node) : undefined,
      onMoveToTrash: onMoveToTrash ? () => onMoveToTrash(node) : undefined,
      onRecover: onRecover ? () => onRecover(node) : undefined,
      onPermanentDelete: onPermanentDelete ? () => onPermanentDelete(node) : undefined,
      onConfirm: setConfirm
    }
  }

  const content = (
    <div className="flex-1 overflow-y-auto px-8 py-6">
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={items.map((n) => n.id)}
            strategy={viewMode === 'list' ? verticalListSortingStrategy : rectSortingStrategy}
          >
            {viewMode === 'list' ? (
              <div className="mx-auto max-w-5xl overflow-hidden rounded-lg border border-border">
                <div
                  className={cn(
                    'grid gap-3 border-b border-border bg-muted/40 px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground',
                    LIST_GRID_COLS
                  )}
                >
                  <span>Name</span>
                  <span>{listTypeColumnLabel(listVariant)}</span>
                  <span>Created</span>
                  <span>Last edited</span>
                  <span>Contents</span>
                  <span />
                </div>
                {items.map((node) => (
                  <SortableListRow key={node.id} {...itemProps(node)} />
                ))}
              </div>
            ) : (
              <div className="mx-auto grid max-w-5xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((node) => (
                  <SortableCard key={node.id} {...itemProps(node)} />
                ))}
              </div>
            )}
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
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => onViewModeChange(viewMode === 'cards' ? 'list' : 'cards')}
              className="rounded p-1 hover:bg-muted"
              aria-label={viewMode === 'cards' ? 'Switch to list view' : 'Switch to cards view'}
              aria-pressed={viewMode === 'list'}
            >
              {viewMode === 'cards' ? (
                <LayoutGrid className="h-4 w-4" />
              ) : (
                <List className="h-4 w-4" />
              )}
            </button>
            {(canGoBack || canGoForward) && (
              <>
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
              </>
            )}
          </div>
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
