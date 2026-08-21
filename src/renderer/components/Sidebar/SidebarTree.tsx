import { useMemo, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type DropAnimation
} from '@dnd-kit/core'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import {
  SortableContext,
  arrayMove,
  defaultAnimateLayoutChanges,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ChevronDown, ChevronRight, Folder, GripVertical, Plus } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { useHistoryStore } from '@/store/historyStore'
import {
  makeMoveToTrashCommand,
  makeRenameCommand,
  makeReorderCommand,
  makeReparentCommand
} from '@/lib/commands'
import { openCategoryItem } from '@/lib/categoryNavigation'
import { buildTreeContextMenuActions, type SidebarMenuActions } from '@/lib/treeNodeMenuActions'
import { TreeContextMenu } from '@/components/Tree/TreeContextMenu'
import { ConfirmDialog } from '@/components/UI/ConfirmDialog'
import { RenameSurfaceSlot } from '@/components/UI/RenameSessionInput'
import { cn } from '@/lib/utils'
import {
  folderContainerId,
  getChildren,
  getScenes,
  isChapterFolder,
  isFolder,
  isWikiEntityType
} from '@/lib/treeUtils'
import type { FolderScope, TreeNode } from '@shared/types'

const TREE_INDENT = 12
// Matches the section header's own left inset (mx-1 + px-2 + chevron button
// padding = 14px) plus a bit, so a top-level tree row's arrow sits clearly
// to the right of its parent section's arrow instead of underneath/left of it.
const TREE_BASE_PADDING = 24
const TREE_MAX_VISUAL_DEPTH = 7

function visualTreeDepth(depth: number): number {
  return Math.min(depth, TREE_MAX_VISUAL_DEPTH)
}

const GUIDE_X = (level: number): number =>
  TREE_BASE_PADDING + visualTreeDepth(level) * TREE_INDENT + 7

function treeRowPadding(depth: number): number {
  return visualTreeDepth(depth) * TREE_INDENT + TREE_BASE_PADDING
}

function TreeIndentGuides({
  depth,
  ancestorContinues,
  isLastSibling
}: {
  depth: number
  ancestorContinues: boolean[]
  isLastSibling: boolean
}): React.JSX.Element | null {
  if (depth === 0) return null

  const currentLevel = depth - 1

  return (
    <div className="pointer-events-none absolute inset-y-0 left-0" aria-hidden>
      {ancestorContinues.map((continues, level) =>
        continues ? (
          <span
            key={`ancestor-${level}`}
            className="absolute top-0 bottom-0 w-px bg-sidebar-border/50"
            style={{ left: GUIDE_X(level) }}
          />
        ) : null
      )}
      <span
        className={cn(
          'absolute top-0 w-px bg-sidebar-border/50',
          isLastSibling ? 'h-1/2' : 'bottom-0'
        )}
        style={{ left: GUIDE_X(currentLevel) }}
      />
    </div>
  )
}

const SORTABLE_TRANSITION = 'transform 220ms cubic-bezier(0.25, 1, 0.5, 1)'

const dropAnimation: DropAnimation = {
  duration: 220,
  easing: 'cubic-bezier(0.25, 1, 0.5, 1)'
}

interface SidebarTreeProps {
  scope: FolderScope
  parentId: string | null
  depth?: number
  ancestorContinues?: boolean[]
  disabled?: boolean
  categoryId?: string
  menuActions: SidebarMenuActions
  onAddScene?: (chapterId: string) => void
  onAddEntity?: () => void
}

interface ConfirmState {
  title: string
  description: string
  destructive?: boolean
  onConfirm: () => void | Promise<void>
}

function HoverAddButton({ onClick, className }: { onClick: () => void; className?: string }): React.JSX.Element {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className={cn(
        'shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground',
        className
      )}
    >
      <Plus className="h-3 w-3" />
    </button>
  )
}

function TreeItemRow({
  node,
  depth,
  ancestorContinues = [],
  isLastSibling = false,
  isSelected,
  isFolderNode,
  isExpandable,
  isExpanded,
  onToggleExpand,
  trailingAction,
  overlay,
  dragHandleProps
}: {
  node: TreeNode
  depth: number
  ancestorContinues?: boolean[]
  isLastSibling?: boolean
  isSelected?: boolean
  isFolderNode?: boolean
  isExpandable?: boolean
  isExpanded?: boolean
  onToggleExpand?: () => void
  trailingAction?: React.ReactNode
  overlay?: boolean
  dragHandleProps?: {
    attributes: ReturnType<typeof useSortable>['attributes']
    listeners: ReturnType<typeof useSortable>['listeners']
  }
}): React.JSX.Element {
  const contentLeft = treeRowPadding(depth)

  return (
    <div
      className={cn(
        'group relative isolate flex min-w-0 items-center gap-0.5 rounded-md py-1 pr-2 select-none',
        isFolderNode || node.type === 'chapter' ? 'text-sm' : 'text-xs',
        !overlay && 'cursor-pointer',
        isSelected ? 'text-accent-foreground' : !overlay && 'text-foreground',
        overlay && 'cursor-grabbing bg-sidebar text-foreground shadow-md ring-1 ring-border'
      )}
      style={{ paddingLeft: `${contentLeft}px` }}
    >
      {!overlay && (
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute top-0.5 bottom-0.5 right-1 -z-10 rounded-md',
            isSelected ? 'bg-accent' : 'bg-transparent group-hover:bg-accent/50'
          )}
          style={{ left: `${contentLeft}px` }}
        />
      )}
      {!overlay && (
        <TreeIndentGuides
          depth={depth}
          ancestorContinues={ancestorContinues}
          isLastSibling={isLastSibling}
        />
      )}
      {isExpandable ? (
        <button
          type="button"
          className="shrink-0 rounded p-0.5"
          onClick={(e) => {
            e.stopPropagation()
            onToggleExpand?.()
          }}
        >
          {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </button>
      ) : (
        <span className="w-4 shrink-0" />
      )}
      {isFolderNode && <Folder className="h-3 w-3 shrink-0 opacity-70" />}
      <span className="min-w-0 flex-1 truncate" title={node.title}>
        {node.title}
      </span>
      <button
        type="button"
        className={cn(
          'shrink-0 p-0.5 touch-none',
          overlay ? 'cursor-grabbing opacity-100' : 'cursor-grab opacity-0 group-hover:opacity-100'
        )}
        {...dragHandleProps?.attributes}
        {...dragHandleProps?.listeners}
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="h-3 w-3 text-muted-foreground" />
      </button>
      {trailingAction}
    </div>
  )
}

function SortableTreeItem({
  node,
  depth,
  ancestorContinues = [],
  isLastSibling = false,
  isSelected,
  isFolderNode,
  isExpandable,
  isExpanded,
  onToggleExpand,
  onSelect,
  onRename,
  onMoveToTrash,
  menuActions,
  trailingAction,
  className
}: {
  node: TreeNode
  depth: number
  ancestorContinues?: boolean[]
  isLastSibling?: boolean
  isSelected: boolean
  isFolderNode?: boolean
  isExpandable?: boolean
  isExpanded?: boolean
  onToggleExpand?: () => void
  onSelect: () => void
  onRename: () => void
  onMoveToTrash: () => void
  menuActions: SidebarMenuActions
  trailingAction?: React.ReactNode
  className?: string
}): React.JSX.Element {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: node.id,
    animateLayoutChanges: defaultAnimateLayoutChanges
  })

  const contextMenuActions = buildTreeContextMenuActions(node, menuActions)

  return (
    <TreeContextMenu
      variant={isFolderNode ? 'folder' : isWikiEntityType(node.type) ? 'wikiRow' : 'manuscript'}
      node={node}
      onInfo={
        node.type === 'chapter' || node.type === 'scene'
          ? () => useAppStore.getState().openManuscriptInfo(node.id)
          : undefined
      }
      onRename={onRename}
      onMoveToTrash={onMoveToTrash}
      {...contextMenuActions}
    >
      <div
        ref={setNodeRef}
        style={{
          transform: CSS.Transform.toString(transform),
          transition: isDragging ? undefined : transition ?? SORTABLE_TRANSITION
        }}
        className={cn(isDragging && 'relative z-0 opacity-35', className)}
        onClick={onSelect}
      >
        <TreeItemRow
          node={node}
          depth={depth}
          ancestorContinues={ancestorContinues}
          isLastSibling={isLastSibling}
          isSelected={isSelected}
          isFolderNode={isFolderNode}
          isExpandable={isExpandable}
          isExpanded={isExpanded}
          onToggleExpand={onToggleExpand}
          trailingAction={trailingAction}
          dragHandleProps={{ attributes, listeners }}
        />
      </div>
    </TreeContextMenu>
  )
}

export function SidebarTree({
  scope,
  parentId,
  depth = 0,
  ancestorContinues,
  disabled = false,
  categoryId,
  menuActions,
  onAddScene,
  onAddEntity
}: SidebarTreeProps): React.JSX.Element {
  const {
    nodes,
    selectedNodeId,
    selectedEntityId,
    selectedEntryId,
    selectedContainerId,
    categories,
    expandedSections,
    setSelectedNodeId,
    selectContainer,
    toggleSection,
    setNodes,
  } = useAppStore()

  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<ConfirmState | null>(null)
  const renameSession = useAppStore((s) => s.renameSession)

  const children = useMemo(() => {
    const raw = getChildren(nodes, parentId, scope)
    if (scope === 'entry' && categoryId) {
      return raw.filter((n) => n.type === 'folder' || n.categoryId === categoryId)
    }
    return raw
  }, [nodes, parentId, scope, categoryId])
  const activeDragNode = activeDragId ? (nodes.find((n) => n.id === activeDragId) ?? null) : null

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const confirmTrash = (node: TreeNode, onConfirm: () => Promise<void>): void => {
    const label = node.type === 'folder' ? 'folder and its contents' : `"${node.title}"`
    setConfirm({
      title: 'Move to trash?',
      description: `Are you sure you want to move ${label} to trash? You can recover it within 50 days.`,
      destructive: true,
      onConfirm: async () => {
        await useHistoryStore.getState().push(makeMoveToTrashCommand({ node }))
        await onConfirm()
      }
    })
  }

  const handleRename = async (id: string): Promise<void> => {
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

  const startRename = (node: TreeNode): void => {
    setRenamingId(node.id)
    setRenameValue(node.title)
  }

  const handleSelect = (node: TreeNode): void => {
    if (isFolder(node)) {
      selectContainer(folderContainerId(node.id))
      return
    }
    if (node.type === 'chapter' || node.type === 'scene') {
      setSelectedNodeId(node.id)
      return
    }
    void openCategoryItem(node.id)
  }

  const isNodeSelected = (node: TreeNode): boolean => {
    if (isFolder(node)) return selectedContainerId === folderContainerId(node.id)
    if (node.type === 'entry') {
      return selectedEntryId === node.id || selectedNodeId === node.id
    }
    if (isWikiEntityType(node.type)) return selectedEntityId === node.id
    return selectedNodeId === node.id
  }

  const handleDragEnd = async (event: DragEndEvent): Promise<void> => {
    setActiveDragId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return

    const activeNode = nodes.find((n) => n.id === active.id)
    const overNode = nodes.find((n) => n.id === over.id)
    if (!activeNode || !overNode) return

    const activeParent = activeNode.parentId ?? null
    const overParent = overNode.parentId ?? null

    if (isFolder(overNode) && getChildren(nodes, overNode.id, scope).length >= 0) {
      await useHistoryStore.getState().push(
        makeReparentCommand({
          nodeId: activeNode.id,
          oldParentId: activeNode.parentId ?? null,
          newParentId: overNode.id
        })
      )
      return
    }

    if (activeParent !== overParent || activeNode.type !== overNode.type) return

    const siblings = getChildren(nodes, activeParent, scope).filter((n) => n.type === activeNode.type)
    const oldIndex = siblings.findIndex((n) => n.id === active.id)
    const newIndex = siblings.findIndex((n) => n.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove(siblings, oldIndex, newIndex)
    const items = reordered.map((n, i) => ({ id: n.id, parentId: n.parentId, sortOrder: i }))
    const nodesBefore = [...nodes]
    const orderMap = new Map(items.map((item) => [item.id, item.sortOrder]))
    setNodes(nodes.map((n) => (orderMap.has(n.id) ? { ...n, sortOrder: orderMap.get(n.id)! } : n)))
    await useHistoryStore.getState().push(makeReorderCommand({ previousNodes: nodesBefore, newItems: items }))
  }

  const renderLocalRenameInput = (id: string): React.JSX.Element => {
    const renameNode = nodes.find((n) => n.id === id)
    const largeRename =
      renameNode?.type === 'folder' || renameNode?.type === 'chapter'
    return (
      <input
        autoFocus
        value={renameValue}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => setRenameValue(e.target.value)}
        onBlur={() => void handleRename(id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void handleRename(id)
          if (e.key === 'Escape') setRenamingId(null)
        }}
        className={cn(
          'mx-2 mb-1 w-[calc(100%-16px)] rounded border border-input bg-background px-2 py-1',
          largeRename ? 'text-sm' : 'text-xs'
        )}
        style={{ marginLeft: `${treeRowPadding(depth)}px` }}
      />
    )
  }

  return (
    <>
      <DndContext
        sensors={disabled ? [] : sensors}
        collisionDetection={closestCorners}
        modifiers={[restrictToVerticalAxis]}
        onDragStart={({ active }: DragStartEvent) => setActiveDragId(String(active.id))}
        onDragEnd={(event) => void handleDragEnd(event)}
        onDragCancel={() => setActiveDragId(null)}
      >
        <SortableContext items={children.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {children.map((node, index) => {
            const isLast = index === children.length - 1
            const rowAncestors = ancestorContinues ?? []
            const childAncestors = [...rowAncestors, !isLast]
            const folderNode = isFolder(node)
            const sceneChapter = node.type === 'chapter' && isChapterFolder(node)
            const isExpandable = folderNode || sceneChapter
            const expanded = expandedSections.has(node.id)
            const scenes = sceneChapter ? getScenes(nodes, node.id) : []

            const needsRenameSlot =
              renamingId === node.id ||
              (renameSession?.nodeId === node.id &&
                renameSession.preferredSurfaces.includes('sidebar'))

            if (renamingId === node.id) {
              return (
                <div key={node.id}>
                  <RenameSurfaceSlot
                    surface="sidebar"
                    nodeId={node.id}
                    enabled={!disabled}
                    inputClassName={cn(
                      'mx-2 mb-1 w-[calc(100%-16px)]',
                      isFolder(node) || node.type === 'chapter' ? 'text-sm' : 'text-xs'
                    )}
                    inputStyle={{ marginLeft: `${treeRowPadding(depth)}px` }}
                    localEditor={renderLocalRenameInput(node.id)}
                  >
                    {null}
                  </RenameSurfaceSlot>
                </div>
              )
            }

            const treeItem = (
                <SortableTreeItem
                  node={node}
                  depth={depth}
                  ancestorContinues={rowAncestors}
                  isLastSibling={isLast}
                  isSelected={isNodeSelected(node)}
                  isFolderNode={folderNode}
                  isExpandable={isExpandable}
                  isExpanded={expanded}
                  onToggleExpand={() => toggleSection(node.id)}
                  onSelect={() => handleSelect(node)}
                  onRename={() => startRename(node)}
                  onMoveToTrash={() =>
                    confirmTrash(node, async () => {
                      /* selection cleared by store sync */
                    })
                  }
                  menuActions={menuActions}
                  className={isLast && scenes.length === 0 ? 'mb-1' : undefined}
                  trailingAction={
                    folderNode ? undefined : scenes.length === 0 && sceneChapter && onAddScene ? (
                      <HoverAddButton
                        className="group-hover/chapter:opacity-100"
                        onClick={() => onAddScene(node.id)}
                      />
                    ) : !folderNode && (isWikiEntityType(node.type) || node.type === 'entry') && isLast && onAddEntity ? (
                      <HoverAddButton className="group-hover/folder:opacity-100" onClick={onAddEntity} />
                    ) : undefined
                  }
                />
            )

            return (
              <div key={node.id} className={cn(folderNode ? 'group/folder' : 'group/chapter')}>
                {needsRenameSlot ? (
                  <RenameSurfaceSlot
                    surface="sidebar"
                    nodeId={node.id}
                    enabled={!disabled}
                    inputClassName={cn(
                      'mx-2 mb-1 w-[calc(100%-16px)]',
                      folderNode || node.type === 'chapter' ? 'text-sm' : 'text-xs'
                    )}
                    inputStyle={{ marginLeft: `${treeRowPadding(depth)}px` }}
                  >
                    {treeItem}
                  </RenameSurfaceSlot>
                ) : (
                  treeItem
                )}
                {folderNode && (
                  <div
                    className={cn(
                      'grid transition-[grid-template-rows] duration-200 ease-in-out',
                      expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                    )}
                  >
                    <div
                      className={cn(
                        'overflow-hidden transition-opacity duration-200 ease-in-out',
                        expanded ? 'opacity-100' : 'pointer-events-none opacity-0'
                      )}
                    >
                      <SidebarTree
                        scope={scope}
                        parentId={node.id}
                        depth={depth + 1}
                        ancestorContinues={childAncestors}
                        disabled={disabled}
                        categoryId={categoryId}
                        menuActions={menuActions}
                        onAddScene={onAddScene}
                        onAddEntity={onAddEntity}
                      />
                    </div>
                  </div>
                )}
                {sceneChapter && scenes.length > 0 && (
                  <div className={cn(
                    'grid transition-[grid-template-rows] duration-200 ease-in-out',
                    expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                  )}>
                    <div className={cn(
                      'overflow-hidden transition-opacity duration-200 ease-in-out',
                      expanded ? 'opacity-100' : 'pointer-events-none opacity-0'
                    )}>
                      <SceneList
                        chapterId={node.id}
                        scenes={scenes}
                        depth={depth + 1}
                        ancestorContinues={childAncestors}
                        isLastChapter={isLast}
                        menuActions={menuActions}
                        renamingId={renamingId}
                        renameValue={renameValue}
                        setRenameValue={setRenameValue}
                        onRename={(id) => void handleRename(id)}
                        setRenamingId={setRenamingId}
                        startRename={startRename}
                        confirmTrash={confirmTrash}
                        onAddScene={onAddScene}
                        disabled={disabled}
                      />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </SortableContext>
        <DragOverlay dropAnimation={dropAnimation}>
          {activeDragNode ? (
            <TreeItemRow
              node={activeDragNode}
              depth={depth}
              isSelected={isNodeSelected(activeDragNode)}
              isFolderNode={isFolder(activeDragNode)}
              overlay
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      {confirm && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setConfirm(null)}
          title={confirm.title}
          description={confirm.description}
          confirmLabel="Move to trash"
          destructive={confirm.destructive}
          onConfirm={confirm.onConfirm}
        />
      )}
    </>
  )
}

function SceneList({
  chapterId,
  scenes,
  depth,
  ancestorContinues = [],
  isLastChapter,
  menuActions,
  renamingId,
  renameValue,
  setRenameValue,
  onRename,
  setRenamingId,
  startRename,
  confirmTrash,
  onAddScene,
  disabled
}: {
  chapterId: string
  scenes: TreeNode[]
  depth: number
  ancestorContinues?: boolean[]
  isLastChapter: boolean
  menuActions: SidebarMenuActions
  renamingId: string | null
  renameValue: string
  setRenameValue: (v: string) => void
  onRename: (id: string) => void
  setRenamingId: (id: string | null) => void
  startRename: (node: TreeNode) => void
  confirmTrash: (node: TreeNode, onConfirm: () => Promise<void>) => void
  onAddScene?: (chapterId: string) => void
  disabled?: boolean
}): React.JSX.Element {
  const { selectedNodeId, setSelectedNodeId, setNodes, nodes, renameSession } = useAppStore()
  const [activeDragId, setActiveDragId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = async (event: DragEndEvent): Promise<void> => {
    setActiveDragId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = scenes.findIndex((n) => n.id === active.id)
    const newIndex = scenes.findIndex((n) => n.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const reordered = arrayMove(scenes, oldIndex, newIndex)
    const items = reordered.map((n, i) => ({ id: n.id, parentId: chapterId, sortOrder: i }))
    const nodesBefore = [...nodes]
    const orderMap = new Map(items.map((item) => [item.id, item.sortOrder]))
    setNodes(nodes.map((n) => (orderMap.has(n.id) ? { ...n, sortOrder: orderMap.get(n.id)! } : n)))
    await useHistoryStore.getState().push(makeReorderCommand({ previousNodes: nodesBefore, newItems: items }))
  }

  return (
    <DndContext
      sensors={disabled ? [] : sensors}
      collisionDetection={closestCorners}
      modifiers={[restrictToVerticalAxis]}
      onDragStart={({ active }) => setActiveDragId(String(active.id))}
      onDragEnd={(e) => void handleDragEnd(e)}
      onDragCancel={() => setActiveDragId(null)}
    >
      <SortableContext items={scenes.map((s) => s.id)} strategy={verticalListSortingStrategy}>
      {scenes.map((scene, sceneIndex) => {
        const isLastScene = sceneIndex === scenes.length - 1
        const needsRenameSlot =
          renamingId === scene.id ||
          (renameSession?.nodeId === scene.id &&
            renameSession.preferredSurfaces.includes('sidebar'))
        const localEditor =
          renamingId === scene.id ? (
            <input
              autoFocus
              value={renameValue}
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={() => onRename(scene.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onRename(scene.id)
                if (e.key === 'Escape') setRenamingId(null)
              }}
              className="mx-2 mb-1 w-[calc(100%-16px)] rounded border border-input bg-background px-2 py-1 text-xs"
              style={{ marginLeft: `${treeRowPadding(depth)}px` }}
            />
          ) : undefined

        const item = (
            <SortableTreeItem
              node={scene}
              depth={depth}
              ancestorContinues={ancestorContinues}
              isLastSibling={isLastScene}
              isSelected={selectedNodeId === scene.id}
              onSelect={() => setSelectedNodeId(scene.id)}
              onRename={() => startRename(scene)}
              onMoveToTrash={() =>
                confirmTrash(scene, async () => {
                  /* selection cleared by store sync */
                })
              }
              menuActions={menuActions}
              className={isLastChapter && sceneIndex === scenes.length - 1 ? 'mb-1' : undefined}
              trailingAction={
                sceneIndex === scenes.length - 1 && onAddScene ? (
                  <HoverAddButton
                    className="group-hover/chapter:opacity-100"
                    onClick={() => onAddScene(chapterId)}
                  />
                ) : undefined
              }
            />
        )

        if (!needsRenameSlot) return <div key={scene.id}>{item}</div>

        return (
          <RenameSurfaceSlot
            key={scene.id}
            surface="sidebar"
            nodeId={scene.id}
            enabled={!disabled}
            inputClassName="mx-2 mb-1 w-[calc(100%-16px)] text-xs"
            inputStyle={{ marginLeft: `${treeRowPadding(depth)}px` }}
            localEditor={localEditor}
          >
            {item}
          </RenameSurfaceSlot>
        )
      })}
      </SortableContext>
    </DndContext>
  )
}
