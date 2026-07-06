import { useMemo, useState } from 'react'
import {
  ChevronRight,
  BookOpen,
  Plus,
  GripVertical,
  Trash2,
  Settings2
} from 'lucide-react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip'
import { ChapterStructureModal } from '@/components/Project/ChapterStructureModal'
import { CategoryManagerModal } from '@/components/Sidebar/CategoryManagerModal'
import { SidebarTree } from '@/components/Sidebar/SidebarTree'
import { UndoRedoButtons } from '@/components/Sidebar/UndoRedoButtons'
import { resolveIcon } from '@/components/Sidebar/categoryIcons'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/UI/dialog'
import { useAppStore } from '@/store/appStore'
import { useHistoryStore } from '@/store/historyStore'
import { makeCreateChapterCommand, makeCreateNodeCommand } from '@/lib/commands'
import { createCategoryItem } from '@/lib/categoryNavigation'
import { requestSidebarRenameAfterCreate } from '@/lib/pendingRename'
import { useResizeHandle, usePersistLayout } from '@/hooks/useResize'
import { captureProjectUiState } from '@/lib/projectUiState'
import { cn } from '@/lib/utils'
import {
  getTrashCategories,
  hasTrashItems,
  trashContainerId
} from '@/lib/treeUtils'
import { folderScopeForCategory } from '@shared/categoryPresets'
import type { CategoryDefinition, ChapterStructure, TrashCategory } from '@shared/types'
import { SIDEBAR_MAX_WIDTH, SIDEBAR_MIN_WIDTH, TRASH_CATEGORY_LABELS } from '@shared/types'

const SIDEBAR_TITLEBAR_INSET = 78
const SIDEBAR_ICON_ONLY_THRESHOLD = SIDEBAR_MIN_WIDTH + 16

function SortableSection({
  id,
  children,
  iconOnly
}: {
  id: string
  children: React.ReactNode
  iconOnly: boolean
}): React.JSX.Element {
  if (iconOnly) return <div>{children}</div>

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && 'opacity-35')}
    >
      <div className="group/section flex items-start">
        <button className="mt-1.5 shrink-0 p-0.5 opacity-0 group-hover/section:opacity-100 cursor-grab touch-none" {...attributes} {...listeners}>
          <GripVertical className="h-3 w-3 text-muted-foreground" />
        </button>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  )
}

function SidebarSectionBody({
  open,
  children
}: {
  open: boolean
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div
      className={cn(
        'grid transition-[grid-template-rows] duration-200 ease-in-out',
        open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
      )}
    >
      <div
        className={cn(
          'overflow-hidden transition-opacity duration-200 ease-in-out',
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
      >
        {children}
      </div>
    </div>
  )
}

function SectionHeader({
  label,
  icon: Icon,
  isExpanded,
  iconOnly,
  isContainerSelected,
  onToggle,
  onSelectContainer,
  onAdd,
  addOnHover = false
}: {
  label: string
  icon: React.ComponentType<{ className?: string }>
  isExpanded: boolean
  iconOnly: boolean
  isContainerSelected?: boolean
  onToggle: () => void
  onSelectContainer?: () => void
  onAdd?: () => void
  addOnHover?: boolean
}): React.JSX.Element {
  if (iconOnly) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onSelectContainer}
            className={cn(
              'mx-auto mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md',
              isContainerSelected ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
            )}
            aria-label={label}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    )
  }

  return (
    <div className={cn('mx-1 flex min-w-0 items-center gap-1 rounded-md px-2 py-1.5', isContainerSelected && 'bg-accent text-accent-foreground')}>
      <button type="button" onClick={(e) => { e.stopPropagation(); onToggle() }} className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground">
        <ChevronRight className={cn('h-3 w-3 transition-transform duration-200 ease-in-out', isExpanded && 'rotate-90')} />
      </button>
      <button
        type="button"
        onClick={onSelectContainer}
        className={cn(
          'flex min-w-0 flex-1 items-center gap-1.5 text-left text-sm font-semibold',
          isContainerSelected ? 'text-accent-foreground' : 'text-foreground hover:text-foreground'
        )}
      >
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{label}</span>
      </button>
      {onAdd && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onAdd() }}
          className={cn('shrink-0 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground', addOnHover && 'opacity-0 transition-opacity group-hover/section:opacity-100')}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}

export function Sidebar(): React.JSX.Element {
  const {
    nodes,
    categories,
    selectedContainerId,
    expandedSections,
    sectionOrder,
    sidebarWidth,
    projectMeta,
    selectContainer,
    selectWikiEntity,
    setSelectedNodeId,
    toggleSection,
    setSectionOrder,
    updateCategories,
    setSidebarWidth
  } = useAppStore()

  const [showChapterModal, setShowChapterModal] = useState(false)
  const [chapterParentId, setChapterParentId] = useState<string | null>(null)
  const [showTrashEmpty, setShowTrashEmpty] = useState(false)
  const [showCategoryManager, setShowCategoryManager] = useState(false)

  const iconOnly = sidebarWidth <= SIDEBAR_ICON_ONLY_THRESHOLD
  const width = sidebarWidth
  const trashCategories = getTrashCategories(nodes)

  const { handleProps } = useResizeHandle(sidebarWidth, setSidebarWidth, SIDEBAR_MIN_WIDTH, SIDEBAR_MAX_WIDTH)
  usePersistLayout(sidebarWidth, 'sidebarWidth')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const orderedCategories = useMemo((): CategoryDefinition[] => {
    if (categories.length === 0) return []

    const catById = new Map(categories.map((c) => [c.id, c]))
    const ordered: CategoryDefinition[] = []
    for (const id of sectionOrder) {
      const cat = catById.get(id)
      if (cat) ordered.push(cat)
    }
    for (const cat of categories) {
      if (!ordered.find((c) => c.id === cat.id)) {
        ordered.push(cat)
      }
    }
    return ordered
  }, [categories, sectionOrder])

  const isCategoryExpanded = (categoryId: string): boolean => expandedSections.has(categoryId)

  const handleAddScene = async (chapterId: string): Promise<void> => {
    const createdId = await useHistoryStore.getState().push(
      makeCreateNodeCommand({ parentId: chapterId, type: 'scene', title: 'New Scene' })
    )
    if (createdId) {
      setSelectedNodeId(createdId)
      requestSidebarRenameAfterCreate(createdId)
    }
  }

  const handleAddChapterClick = (): void => {
    setChapterParentId(null)
    setShowChapterModal(true)
  }

  const handleChapterStructure = async (structure: ChapterStructure): Promise<void> => {
    setShowChapterModal(false)
    const chapterId = await useHistoryStore.getState().push(
      makeCreateChapterCommand({ structure, parentId: chapterParentId })
    )
    if (!chapterId) return
    const all = useAppStore.getState().nodes
    if (structure === 'scenes') {
      const scene = all.find((n) => n.parentId === chapterId && n.type === 'scene')
      setSelectedNodeId(scene?.id ?? chapterId)
    } else {
      setSelectedNodeId(chapterId)
    }
    requestSidebarRenameAfterCreate(chapterId)
  }

  const openInNewWindow = (node: import('@shared/types').TreeNode): void => {
    if (node.type === 'note') {
      selectWikiEntity(node.id, node.type)
      void window.electronAPI.windows.openDocument(node.id, node.title)
      return
    }
    void window.electronAPI.windows.openDocument(node.id, node.title)
  }

  const handleSectionDragEnd = async (event: DragEndEvent): Promise<void> => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = sectionOrder.indexOf(String(active.id))
    const newIndex = sectionOrder.indexOf(String(over.id))
    if (oldIndex === -1 || newIndex === -1) return
    const nextOrder = arrayMove(sectionOrder, oldIndex, newIndex)
    setSectionOrder(nextOrder)

    const reorderedCategories = nextOrder
      .map((id, i) => {
        const cat = categories.find((c) => c.id === id)
        return cat ? { ...cat, sortOrder: i } : null
      })
      .filter((c): c is CategoryDefinition => c !== null)

    const inOrder = new Set(nextOrder)
    const remaining = categories.filter((c) => !inOrder.has(c.id))
    const merged = [...reorderedCategories, ...remaining]

    await updateCategories(merged)
    await window.electronAPI.tomes.updateUiState(captureProjectUiState())
  }

  const handleTrashHeaderClick = (): void => {
    if (!hasTrashItems(nodes)) {
      setShowTrashEmpty(true)
      return
    }
    toggleSection('trash')
  }

  const renderTrashCategory = (category: TrashCategory): React.JSX.Element => {
    const containerId = trashContainerId(category)
    return (
      <button
        key={category}
        type="button"
        onClick={() => selectContainer(containerId)}
        className={cn(
          'mx-2 mb-0.5 flex w-[calc(100%-16px)] cursor-pointer items-center rounded-md py-1 pl-6 text-xs',
          selectedContainerId === containerId
            ? 'bg-accent text-accent-foreground'
            : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
        )}
      >
        {TRASH_CATEGORY_LABELS[category]}
      </button>
    )
  }

  return (
    <>
      <TooltipProvider delayDuration={200}>
        <aside className="relative flex h-full shrink-0 flex-col overflow-hidden bg-sidebar transition-[width] duration-150" style={{ width }}>
          <div className="drag-region flex h-9 shrink-0 items-center justify-end border-b border-sidebar-border px-2" style={{ paddingLeft: SIDEBAR_TITLEBAR_INSET }} />

          <div className="relative flex min-h-0 flex-1 flex-col border-r border-sidebar-border">
            <div className={cn('sidebar-scroll flex-1 overflow-x-hidden overflow-y-auto', iconOnly ? 'py-1' : 'py-2')}>
              {!iconOnly && projectMeta && (
                <div className="mb-1 flex min-w-0 items-center gap-2 px-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold leading-tight">{projectMeta.title}</p>
                    {projectMeta.author && (
                      <p className="mt-0.5 truncate text-xs leading-tight text-muted-foreground">{projectMeta.author}</p>
                    )}
                  </div>
                  <UndoRedoButtons />
                </div>
              )}

              <div>
                <SectionHeader
                  label="Manuscript"
                  icon={BookOpen}
                  isExpanded={expandedSections.has('manuscript')}
                  iconOnly={iconOnly}
                  isContainerSelected={selectedContainerId === 'manuscript'}
                  onToggle={() => toggleSection('manuscript')}
                  onSelectContainer={() => {
                    if (!expandedSections.has('manuscript')) toggleSection('manuscript')
                    selectContainer('manuscript')
                  }}
                  onAdd={handleAddChapterClick}
                />
                {!iconOnly && (
                  <SidebarSectionBody open={expandedSections.has('manuscript')}>
                    <SidebarTree
                      scope="manuscript"
                      parentId={null}
                      disabled={showChapterModal}
                      onAddScene={handleAddScene}
                      onOpenNewWindow={openInNewWindow}
                    />
                  </SidebarSectionBody>
                )}
              </div>

              <DndContext sensors={sensors} collisionDetection={closestCorners} modifiers={[restrictToVerticalAxis]} onDragEnd={handleSectionDragEnd}>
                <SortableContext items={orderedCategories.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                  {orderedCategories.map((category) => {
                    const Icon = resolveIcon(category.icon)
                    const scope = folderScopeForCategory(category)

                    return (
                      <SortableSection key={category.id} id={category.id} iconOnly={iconOnly}>
                        <SectionHeader
                          label={category.name}
                          icon={Icon}
                          isExpanded={isCategoryExpanded(category.id)}
                          iconOnly={iconOnly}
                          isContainerSelected={selectedContainerId === category.id}
                          onToggle={() => toggleSection(category.id)}
                          onSelectContainer={() => {
                            if (!isCategoryExpanded(category.id)) toggleSection(category.id)
                            selectContainer(category.id)
                          }}
                          onAdd={() => void createCategoryItem(category.id, null, 'sidebar')}
                          addOnHover
                        />
                        {!iconOnly && (
                          <SidebarSectionBody open={isCategoryExpanded(category.id)}>
                            <SidebarTree
                              scope={scope}
                              parentId={null}
                              categoryId={category.id}
                              onAddEntity={() => void createCategoryItem(category.id, null, 'sidebar')}
                              onOpenNewWindow={openInNewWindow}
                            />
                          </SidebarSectionBody>
                        )}
                      </SortableSection>
                    )
                  })}
                </SortableContext>
              </DndContext>

              <div className="mt-1">
                <SectionHeader
                  label="Trash"
                  icon={Trash2}
                  isExpanded={expandedSections.has('trash')}
                  iconOnly={iconOnly}
                  isContainerSelected={selectedContainerId === 'trash'}
                  onToggle={handleTrashHeaderClick}
                  onSelectContainer={handleTrashHeaderClick}
                />
                {!iconOnly && (
                  <SidebarSectionBody open={expandedSections.has('trash')}>
                    <div>{trashCategories.map(renderTrashCategory)}</div>
                  </SidebarSectionBody>
                )}
              </div>

              {!iconOnly && (
                <div className="mt-2 px-2 pb-1">
                  <button
                    type="button"
                    onClick={() => setShowCategoryManager(true)}
                    className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground/60 transition-colors hover:bg-accent/30 hover:text-muted-foreground"
                  >
                    <Settings2 className="h-3 w-3" />
                    <span>Manage categories</span>
                  </button>
                </div>
              )}

              {iconOnly && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setShowCategoryManager(true)}
                      className="mx-auto mb-1 flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground/60 hover:bg-accent/50 hover:text-muted-foreground"
                    >
                      <Settings2 className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Manage categories</TooltipContent>
                </Tooltip>
              )}
            </div>

            <div {...handleProps} className={cn(handleProps.className, 'right-0')} style={{ right: 0 }} />
          </div>
        </aside>
      </TooltipProvider>

      {showChapterModal && (
        <ChapterStructureModal open={showChapterModal} onOpenChange={setShowChapterModal} onSelect={(s) => void handleChapterStructure(s)} />
      )}

      <CategoryManagerModal open={showCategoryManager} onOpenChange={setShowCategoryManager} />

      <Dialog open={showTrashEmpty} onOpenChange={setShowTrashEmpty}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nothing here</DialogTitle>
            <DialogDescription>Trash is empty. Deleted items will appear here for up to 50 days.</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </>
  )
}
