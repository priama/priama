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
import { GripVertical, Trash2, Plus, ChevronLeft } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/UI/dialog'
import { Button } from '@/components/UI/button'
import { Input } from '@/components/UI/input'
import { Label } from '@/components/UI/label'
import { ScrollArea } from '@/components/UI/scroll-area'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/appStore'
import { captureProjectUiState } from '@/lib/projectUiState'
import { CATEGORY_ICON_MAP } from '@/components/Sidebar/categoryIcons'
import { cloneCategoryPreset, countCategoryEntries, getAddableCategoryPresets, nodeKindForCategory } from '@shared/categoryPresets'
import type { CategoryDefinition, CategoryMode } from '@shared/types'

const ICON_NAMES = Object.keys(CATEGORY_ICON_MAP)

function IconPicker({
  value,
  onChange
}: {
  value: string
  onChange: (name: string) => void
}): React.JSX.Element {
  return (
    <div className="grid grid-cols-8 gap-1">
      {ICON_NAMES.map((name) => {
        const Icon = CATEGORY_ICON_MAP[name]!
        return (
          <button
            key={name}
            type="button"
            title={name}
            onClick={() => onChange(name)}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-md border transition-colors',
              value === name
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-transparent text-muted-foreground hover:border-border hover:bg-accent/50'
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        )
      })}
    </div>
  )
}

function SortableCategoryRow({
  category,
  entryCount,
  onRemove
}: {
  category: CategoryDefinition
  entryCount: number
  onRemove: () => void
}): React.JSX.Element {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: category.id
  })

  const Icon = CATEGORY_ICON_MAP[category.icon] ?? CATEGORY_ICON_MAP.Tag!

  const handleRemove = (): void => {
    if (entryCount > 0) {
      const confirmed = window.confirm(
        `"${category.name}" has ${entryCount} ${entryCount === 1 ? 'entry' : 'entries'}. ` +
          'Removing this category will move those entries to the trash. Continue?'
      )
      if (!confirmed) return
    }
    onRemove()
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'flex items-center gap-2 rounded-md border border-border bg-background px-2 py-2',
        isDragging && 'opacity-50 shadow-lg'
      )}
    >
      <button
        type="button"
        className="shrink-0 cursor-grab touch-none text-muted-foreground/50 hover:text-muted-foreground"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>

      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate text-sm">{category.name}</span>

      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
        {category.mode === 'editor' ? 'Editor' : 'Panel'}
      </span>

      <button
        type="button"
        onClick={handleRemove}
        title="Remove category"
        className="shrink-0 rounded p-0.5 text-muted-foreground/50 hover:text-destructive"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

function TemplateCategoryRow({
  category,
  onAdd
}: {
  category: CategoryDefinition
  onAdd: () => void
}): React.JSX.Element {
  const Icon = CATEGORY_ICON_MAP[category.icon] ?? CATEGORY_ICON_MAP.Tag!

  return (
    <div className="flex items-center gap-2 rounded-md border border-dashed border-border bg-muted/30 px-2 py-2">
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate text-sm">{category.name}</span>
      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
        {category.mode === 'editor' ? 'Editor' : 'Panel'}
      </span>
      <Button type="button" variant="ghost" size="sm" className="h-7 shrink-0 px-2" onClick={onAdd}>
        <Plus className="mr-1 h-3.5 w-3.5" />
        Add
      </Button>
    </div>
  )
}

interface AddCategoryFormProps {
  onAdd: (cat: Omit<CategoryDefinition, 'sortOrder' | 'builtIn' | 'panelBlocks'>) => void
  onCancel: () => void
}

function AddCategoryForm({ onAdd, onCancel }: AddCategoryFormProps): React.JSX.Element {
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('Tag')
  const [mode, setMode] = useState<CategoryMode>('panel')

  const handleSubmit = (): void => {
    if (!name.trim()) return
    onAdd({
      id: `custom-${crypto.randomUUID()}`,
      name: name.trim(),
      icon,
      mode
    })
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="cat-name">Name</Label>
        <Input
          id="cat-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Factions, Vehicles, Timeline…"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit()
            if (e.key === 'Escape') onCancel()
          }}
        />
      </div>

      <div className="space-y-1.5">
        <Label>Icon</Label>
        <IconPicker value={icon} onChange={setIcon} />
      </div>

      <div className="space-y-1.5">
        <Label>Mode</Label>
        <div className="grid grid-cols-2 gap-2">
          {(['panel', 'editor'] as CategoryMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                'rounded-md border p-3 text-left text-sm transition-colors',
                mode === m ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent/30'
              )}
            >
              <p className="font-medium capitalize">{m === 'panel' ? 'Panel' : 'Editor'}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {m === 'panel'
                  ? 'Items open in the right panel with structured fields'
                  : 'Items open in the main editor — write freely'}
              </p>
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleSubmit} disabled={!name.trim()}>
          Add category
        </Button>
      </div>
    </div>
  )
}

interface CategoryManagerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
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
  const [showAddForm, setShowAddForm] = useState(false)

  const addablePresets = useMemo(
    () => getAddableCategoryPresets(categories),
    [categories]
  )

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

  const addCategoryToProject = async (cat: CategoryDefinition): Promise<void> => {
    const cloned = cloneCategoryPreset(cat)
    const updated = [...categories, { ...cloned, sortOrder: categories.length }]
    const nextOrder = [...sectionOrder, cloned.id]
    setSectionOrder(nextOrder)
    await updateCategories(updated)
    await window.electronAPI.tomes.updateUiState(captureProjectUiState())
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

    setSectionOrder(nextIds)
    await updateCategories(reordered)
    await window.electronAPI.tomes.updateUiState(captureProjectUiState())
  }

  const handleRemove = async (categoryId: string): Promise<void> => {
    const cat = categories.find((c) => c.id === categoryId)
    if (cat) {
      const kind = nodeKindForCategory(cat)
      const entriesToTrash = nodes.filter((n) => {
        if (n.deletedAt) return false
        if (kind === 'entry') return n.type === 'entry' && n.categoryId === categoryId
        return n.type === kind
      })
      let updatedNodes = nodes
      for (const entry of entriesToTrash) {
        updatedNodes = await window.electronAPI.tree.moveToTrash(entry.id)
      }
      if (entriesToTrash.length > 0) setNodes(updatedNodes)
    }

    const updated = categories.filter((c) => c.id !== categoryId)
    const nextOrder = sectionOrder.filter((id) => id !== categoryId)
    setSectionOrder(nextOrder)
    await updateCategories(updated)
    await window.electronAPI.tomes.updateUiState(captureProjectUiState())
  }

  const handleAdd = async (
    partial: Omit<CategoryDefinition, 'sortOrder' | 'builtIn' | 'panelBlocks'>
  ): Promise<void> => {
    await addCategoryToProject({
      ...partial,
      sortOrder: categories.length,
      builtIn: false,
      panelBlocks: []
    })
    setShowAddForm(false)
  }

  const handleAddTemplateCategory = async (preset: CategoryDefinition): Promise<void> => {
    await addCategoryToProject(preset)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) setShowAddForm(false)
        onOpenChange(v)
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          {showAddForm ? (
            <>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="rounded p-1 text-muted-foreground hover:bg-accent/50"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <DialogTitle>New category</DialogTitle>
              </div>
              <DialogDescription>Choose a name, icon, and mode for the new category.</DialogDescription>
            </>
          ) : (
            <>
              <DialogTitle>Manage categories</DialogTitle>
              <DialogDescription>
                Reorder your categories, add a preset, or create a custom one.
              </DialogDescription>
            </>
          )}
        </DialogHeader>

        {showAddForm ? (
          <AddCategoryForm onAdd={(cat) => void handleAdd(cat)} onCancel={() => setShowAddForm(false)} />
        ) : (
          <ScrollArea className="max-h-[70vh] pr-3">
            <div className="space-y-5">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Your categories
                </p>
                {orderedCategories.length === 0 ? (
                  <p className="py-2 text-center text-sm text-muted-foreground">
                    No categories yet. Add a preset below or create a custom one.
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
                          <SortableCategoryRow
                            key={cat.id}
                            category={cat}
                            entryCount={countCategoryEntries(nodes, cat)}
                            onRemove={() => void handleRemove(cat.id)}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Add category
                </p>
                {addablePresets.length === 0 ? (
                  <p className="text-sm italic text-muted-foreground/80">
                    All preset categories are already in this project.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {addablePresets.map((cat) => (
                      <TemplateCategoryRow
                        key={cat.id}
                        category={cat}
                        onAdd={() => void handleAddTemplateCategory(cat)}
                      />
                    ))}
                  </div>
                )}
              </div>

              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setShowAddForm(true)}
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Add custom category
              </Button>
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  )
}
