import { useMemo, useState } from 'react'
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
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ChevronRight, GripVertical, MoreHorizontal, Plus } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/UI/dialog'
import { Button } from '@/components/UI/button'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/appStore'
import { captureProjectUiState } from '@/lib/projectUiState'
import { CATEGORY_ICON_MAP } from '@/components/Sidebar/categoryIcons'
import { CategoryBuilderSheet } from '@/components/Sidebar/CategoryBuilderSheet'
import {
  cloneCategoryPreset,
  countCategoryEntries,
  getAddableCategoryPresets,
  nodeKindForCategory
} from '@shared/categoryPresets'
import type { CategoryDefinition } from '@shared/types'

interface CategoryManagerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** A category whose entries are plain 'entry' nodes can be removed; the others own a node type. */
function isRemovable(category: CategoryDefinition): boolean {
  return nodeKindForCategory(category) === 'entry'
}

function presetSummary(preset: CategoryDefinition): string {
  const blocks = (preset.panelBlocks ?? []).filter((b) => b.type !== 'heading')
  if (blocks.length === 0) return 'A blank category, ready to shape'
  const first = blocks.slice(0, 3).map((b) => b.label).join(', ')
  return `${blocks.length} fields, ready to edit: ${first}${blocks.length > 3 ? '…' : ''}`
}

function CategoryRow({
  category,
  entryCount,
  onOpen,
  onDuplicate,
  onRemove
}: {
  category: CategoryDefinition
  entryCount: number
  onOpen: () => void
  onDuplicate: () => void
  onRemove: () => void
}): React.JSX.Element {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: category.id
  })
  const [menuOpen, setMenuOpen] = useState(false)
  const Icon = CATEGORY_ICON_MAP[category.icon] ?? CATEGORY_ICON_MAP.Tag!
  const removable = isRemovable(category)

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'relative flex min-w-0 items-center gap-2 rounded-md border border-border bg-card px-2 py-2',
        isDragging && 'opacity-50 shadow-lg'
      )}
    >
      <button
        type="button"
        className="shrink-0 cursor-grab touch-none text-muted-foreground/50 hover:text-muted-foreground"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>

      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />

      <button
        type="button"
        onClick={onOpen}
        className="min-w-0 flex-1 truncate text-left text-sm hover:underline"
      >
        {category.name}
      </button>

      {!removable && (
        <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
          Built in
        </span>
      )}

      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{entryCount}</span>

      <button
        type="button"
        aria-label={`More for ${category.name}`}
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((v) => !v)}
        className={cn(
          'shrink-0 rounded p-0.5 text-muted-foreground/60 hover:bg-accent hover:text-foreground',
          menuOpen && 'bg-accent text-foreground'
        )}
      >
        <MoreHorizontal className="h-3.5 w-3.5" />
      </button>

      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open ${category.name}`}
        className="shrink-0 text-muted-foreground/50 hover:text-foreground"
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </button>

      {menuOpen && (
        <>
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            className="fixed inset-0 z-20 cursor-default"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute right-6 top-8 z-30 min-w-[180px] rounded-md border border-border bg-popover p-1 shadow-md">
            <button
              type="button"
              className="block w-full rounded-sm px-2 py-1.5 text-left text-xs hover:bg-accent"
              onClick={() => {
                setMenuOpen(false)
                onOpen()
              }}
            >
              Name, icon and fields…
            </button>
            <button
              type="button"
              className="block w-full rounded-sm px-2 py-1.5 text-left text-xs hover:bg-accent"
              onClick={() => {
                setMenuOpen(false)
                onDuplicate()
              }}
            >
              Duplicate, empty
            </button>
            {removable && (
              <>
                <div className="my-1 h-px bg-border" />
                <button
                  type="button"
                  className="block w-full rounded-sm px-2 py-1.5 text-left text-xs text-destructive hover:bg-accent"
                  onClick={() => {
                    setMenuOpen(false)
                    onRemove()
                  }}
                >
                  Remove…
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export function CategoryManagerModal({
  open,
  onOpenChange
}: CategoryManagerModalProps): React.JSX.Element {
  const categories = useAppStore((s) => s.categories)
  const sectionOrder = useAppStore((s) => s.sectionOrder)
  const nodes = useAppStore((s) => s.nodes)
  const setSectionOrder = useAppStore((s) => s.setSectionOrder)
  const updateCategories = useAppStore((s) => s.updateCategories)
  const setNodes = useAppStore((s) => s.setNodes)

  const [builderFor, setBuilderFor] = useState<CategoryDefinition | null>(null)
  const [builderOpen, setBuilderOpen] = useState(false)
  const [removing, setRemoving] = useState<CategoryDefinition | null>(null)
  const [keepEntries, setKeepEntries] = useState(true)
  const [moveTo, setMoveTo] = useState<string>('')
  const [working, setWorking] = useState(false)

  const addablePresets = useMemo(() => getAddableCategoryPresets(categories), [categories])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const orderedIds = [
    ...sectionOrder,
    ...categories.filter((c) => !sectionOrder.includes(c.id)).map((c) => c.id)
  ]
  const orderedCategories = orderedIds
    .map((id) => categories.find((c) => c.id === id))
    .filter((c): c is CategoryDefinition => !!c)

  const persist = async (next: CategoryDefinition[], nextOrder: string[]): Promise<void> => {
    setSectionOrder(nextOrder)
    await updateCategories(next)
    await window.electronAPI.tomes.updateUiState(captureProjectUiState())
  }

  const addCategoryToProject = async (cat: CategoryDefinition): Promise<void> => {
    const cloned = cloneCategoryPreset(cat)
    await persist(
      [...categories, { ...cloned, sortOrder: categories.length }],
      [...sectionOrder, cloned.id]
    )
  }

  const handleDragEnd = async (event: DragEndEvent): Promise<void> => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = orderedIds.indexOf(String(active.id))
    const newIdx = orderedIds.indexOf(String(over.id))
    if (oldIdx === -1 || newIdx === -1) return

    const nextIds = arrayMove(orderedIds, oldIdx, newIdx)
    const reordered = nextIds
      .map((id, i) => {
        const cat = categories.find((c) => c.id === id)
        return cat ? { ...cat, sortOrder: i } : null
      })
      .filter((c): c is CategoryDefinition => !!c)

    await persist(reordered, nextIds)
  }

  const handleSaveCategory = async (next: CategoryDefinition): Promise<void> => {
    const exists = categories.some((c) => c.id === next.id)
    if (exists) {
      await persist(
        categories.map((c) => (c.id === next.id ? next : c)),
        sectionOrder
      )
    } else {
      await persist([...categories, next], [...sectionOrder, next.id])
    }
  }

  const handleDuplicate = async (category: CategoryDefinition): Promise<void> => {
    const copy: CategoryDefinition = {
      ...category,
      id: `custom-${crypto.randomUUID()}`,
      name: `${category.name} copy`,
      builtIn: false,
      sortOrder: categories.length,
      panelBlocks: category.panelBlocks ? JSON.parse(JSON.stringify(category.panelBlocks)) : []
    }
    await persist([...categories, copy], [...sectionOrder, copy.id])
  }

  // Only entry-kind categories can receive entries: a built-in owns its own node type.
  const moveTargets = removing
    ? categories.filter((c) => c.id !== removing.id && nodeKindForCategory(c) === 'entry')
    : []

  const openRemove = (category: CategoryDefinition): void => {
    setRemoving(category)
    const first = categories.find(
      (c) => c.id !== category.id && nodeKindForCategory(c) === 'entry'
    )
    setKeepEntries(Boolean(first))
    setMoveTo(first?.id ?? '')
  }

  const confirmRemove = async (): Promise<void> => {
    if (!removing) return
    setWorking(true)
    try {
      const entries = nodes.filter(
        (n) => !n.deletedAt && n.type === 'entry' && n.categoryId === removing.id
      )

      if (keepEntries && moveTo) {
        for (const entry of entries) {
          await window.electronAPI.tree.update(entry.id, { categoryId: moveTo })
        }
      } else {
        for (const entry of entries) {
          await window.electronAPI.tree.moveToTrash(entry.id)
        }
      }
      if (entries.length > 0) {
        setNodes(await window.electronAPI.tree.getAll())
      }

      await persist(
        categories.filter((c) => c.id !== removing.id),
        sectionOrder.filter((id) => id !== removing.id)
      )
      setRemoving(null)
    } finally {
      setWorking(false)
    }
  }

  const removingCount = removing ? countCategoryEntries(nodes, removing) : 0

  return (
    <>
      <Dialog open={open && !builderOpen && !removing} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg max-h-[calc(100vh-4rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Categories</DialogTitle>
            <DialogDescription>
              Drag to reorder. Open one to change its name, its icon or its fields.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              In this book
            </span>
            {orderedCategories.length === 0 ? (
              <p className="py-2 text-center text-sm text-muted-foreground">
                No categories yet. Add a preset below or make your own.
              </p>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={(e) => void handleDragEnd(e)}
              >
                <SortableContext
                  items={orderedCategories.map((c) => c.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-1.5">
                    {orderedCategories.map((cat) => (
                      <CategoryRow
                        key={cat.id}
                        category={cat}
                        entryCount={countCategoryEntries(nodes, cat)}
                        onOpen={() => {
                          setBuilderFor(cat)
                          setBuilderOpen(true)
                        }}
                        onDuplicate={() => void handleDuplicate(cat)}
                        onRemove={() => openRemove(cat)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>

          {addablePresets.length > 0 && (
            <div className="grid gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Ready to add
              </span>
              <div className="space-y-1.5">
                {addablePresets.map((preset) => {
                  const Icon = CATEGORY_ICON_MAP[preset.icon] ?? CATEGORY_ICON_MAP.Tag!
                  return (
                    <div
                      key={preset.id}
                      className="flex min-w-0 items-center gap-2.5 rounded-md border border-dashed border-border px-2 py-2"
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-medium">{preset.name}</span>
                        <span className="truncate text-xs text-muted-foreground">
                          {presetSummary(preset)}
                        </span>
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 shrink-0 px-2 text-xs"
                        onClick={() => void addCategoryToProject(preset)}
                      >
                        Add
                      </Button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              setBuilderFor(null)
              setBuilderOpen(true)
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            New category
          </Button>
        </DialogContent>
      </Dialog>

      <CategoryBuilderSheet
        open={builderOpen}
        onOpenChange={setBuilderOpen}
        category={builderFor}
        entryCount={builderFor ? countCategoryEntries(nodes, builderFor) : 0}
        onSave={handleSaveCategory}
        onRemove={
          builderFor && isRemovable(builderFor)
            ? () => {
                const target = builderFor
                setBuilderOpen(false)
                openRemove(target)
              }
            : undefined
        }
      />

      <Dialog open={!!removing} onOpenChange={(v) => !v && !working && setRemoving(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Remove &ldquo;{removing?.name}&rdquo;?</DialogTitle>
            <DialogDescription>
              {removingCount === 0
                ? 'Nothing belongs to it, so nothing else changes.'
                : `${removingCount} ${removingCount === 1 ? 'entry belongs' : 'entries belong'} to it. The category goes; they don’t have to.`}
            </DialogDescription>
          </DialogHeader>

          {removingCount > 0 && (
            <div className="grid gap-2">
              {moveTargets.length > 0 && (
                <label
                  className={cn(
                    'flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2.5',
                    keepEntries ? 'border-primary bg-primary/5' : 'border-border'
                  )}
                >
                  <input
                    type="radio"
                    name="remove-entries"
                    checked={keepEntries}
                    onChange={() => setKeepEntries(true)}
                    className="shrink-0 accent-foreground"
                  />
                  <span className="min-w-0 flex-1 text-[13px]">Keep the entries, move them to</span>
                  <select
                    aria-label="Move the entries to"
                    value={moveTo}
                    onChange={(e) => {
                      setMoveTo(e.target.value)
                      setKeepEntries(true)
                    }}
                    className="h-7 shrink-0 rounded-md border border-input bg-background px-2 text-[13px] shadow-sm outline-none"
                  >
                    {moveTargets.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label
                className={cn(
                  'flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2.5',
                  !keepEntries ? 'border-primary bg-primary/5' : 'border-border'
                )}
              >
                <input
                  type="radio"
                  name="remove-entries"
                  checked={!keepEntries}
                  onChange={() => setKeepEntries(false)}
                  className="shrink-0 accent-foreground"
                />
                <span className="text-[13px]">Move them to the trash</span>
              </label>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setRemoving(null)} disabled={working}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void confirmRemove()}
              disabled={working}
            >
              {working ? 'Removing…' : 'Remove'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
