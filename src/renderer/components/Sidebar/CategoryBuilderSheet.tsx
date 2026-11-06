import { useEffect, useMemo, useState } from 'react'
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
import { GripVertical, ImageIcon, Lock, Plus, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/UI/dialog'
import { Button } from '@/components/UI/button'
import { Switch } from '@/components/UI/switch'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/appStore'
import { CATEGORY_ICON_MAP } from '@/components/Sidebar/categoryIcons'
import { BUILTIN_CATEGORY_IDS } from '@shared/categoryIds'
import type { CategoryDefinition, CategoryMode, PanelBlock } from '@shared/types'

const ICON_NAMES = Object.keys(CATEGORY_ICON_MAP)

/** Types a writer can pick for a field. Images are the cover switch; headings are their own row. */
const FIELD_TYPES = [
  { id: 'text', label: 'Text', hint: 'One line' },
  { id: 'textarea', label: 'Long text', hint: 'Grows as you write' },
  { id: 'status', label: 'Choice', hint: '' },
  { id: 'tags', label: 'Tags', hint: 'Words you can filter by' },
  { id: 'relationships', label: 'Links', hint: '' },
  { id: 'number', label: 'Number', hint: 'Whole numbers' },
  { id: 'date', label: 'Date', hint: '' },
  { id: 'url', label: 'Web link', hint: '' }
] as const

type FieldTypeId = (typeof FIELD_TYPES)[number]['id']

const ANY = '__any'
const MANY = '__many'

function newId(): string {
  return `f-${crypto.randomUUID().slice(0, 8)}`
}

function SectionLabel({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </span>
  )
}

function IconPicker({
  value,
  onChange
}: {
  value: string
  onChange: (name: string) => void
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const Icon = CATEGORY_ICON_MAP[value] ?? CATEGORY_ICON_MAP.Tag!

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        aria-label="Choose an icon"
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-11 items-center justify-center gap-1 rounded-md border border-input bg-background shadow-sm"
      >
        <Icon className="h-4 w-4" />
        <span className="text-[9px] text-muted-foreground">▾</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 grid w-[272px] grid-cols-8 gap-1 rounded-md border border-border bg-popover p-2 shadow-md">
          {ICON_NAMES.map((name) => {
            const Each = CATEGORY_ICON_MAP[name]!
            return (
              <button
                key={name}
                type="button"
                title={name}
                onClick={() => {
                  onChange(name)
                  setOpen(false)
                }}
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-md border transition-colors',
                  value === name
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-transparent text-muted-foreground hover:border-border hover:bg-accent/50'
                )}
              >
                <Each className="h-3.5 w-3.5" />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function FieldRow({
  block,
  categories,
  onChange,
  onRemove
}: {
  block: PanelBlock
  categories: CategoryDefinition[]
  onChange: (next: PanelBlock) => void
  onRemove: () => void
}): React.JSX.Element {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id
  })
  const style = { transform: CSS.Transform.toString(transform), transition }

  const isHeading = block.type === 'heading'
  const allowed = block.type === 'relationships' ? (block.allowedCategoryIds ?? []) : []
  const linkValue = allowed.length === 0 ? ANY : allowed.length === 1 ? allowed[0] : MANY

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex min-w-0 items-center gap-2 px-2 py-1.5 [&+div]:border-t [&+div]:border-border/60',
        isHeading && 'bg-muted/50',
        isDragging && 'opacity-50'
      )}
    >
      <button
        type="button"
        className="shrink-0 cursor-grab touch-none text-muted-foreground/50"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>

      <input
        type="text"
        value={block.label}
        aria-label={isHeading ? 'Heading' : 'Field name'}
        onChange={(e) => onChange({ ...block, label: e.target.value })}
        className={cn(
          'h-6 shrink-0 rounded border border-border/80 bg-background px-1.5 outline-none',
          isHeading
            ? 'w-[150px] text-[11px] font-semibold uppercase tracking-wider'
            : 'w-[150px] text-[13px]'
        )}
      />

      {!isHeading && (
        <select
          aria-label="What this field holds"
          value={block.type}
          onChange={(e) => {
            const type = e.target.value as FieldTypeId
            const base = { id: block.id, label: block.label }
            if (type === 'status') onChange({ ...base, type, options: [] })
            else if (type === 'relationships') onChange({ ...base, type, allowedCategoryIds: [] })
            else onChange({ ...base, type } as PanelBlock)
          }}
          className="h-6 shrink-0 rounded border border-border/80 bg-muted/60 px-1 text-[11.5px] outline-none"
        >
          {FIELD_TYPES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      )}

      {/* The one extra thing a type needs, inline. */}
      {block.type === 'status' && (
        <input
          type="text"
          aria-label="Choices"
          placeholder="Rising, Holding, Broken"
          value={block.options.join(', ')}
          onChange={(e) =>
            onChange({
              ...block,
              options: e.target.value
                .split(',')
                .map((o) => o.trim())
                .filter(Boolean)
            })
          }
          className="h-6 min-w-0 flex-1 rounded border border-border/80 bg-background px-1.5 text-[11.5px] outline-none"
        />
      )}

      {block.type === 'relationships' && (
        <select
          aria-label="What this links to"
          value={linkValue}
          onChange={(e) => {
            const v = e.target.value
            if (v === MANY) return
            onChange({ ...block, allowedCategoryIds: v === ANY ? [] : [v] })
          }}
          className="h-6 min-w-0 flex-1 rounded border border-border/80 bg-background px-1 text-[11.5px] outline-none"
        >
          <option value={ANY}>To anything</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              To {c.name}
            </option>
          ))}
          {linkValue === MANY && <option value={MANY}>To several</option>}
        </select>
      )}

      {block.type !== 'status' && block.type !== 'relationships' && (
        <span className="min-w-0 flex-1 truncate text-[11.5px] text-muted-foreground">
          {isHeading
            ? 'Groups the fields under it'
            : (FIELD_TYPES.find((t) => t.id === block.type)?.hint ?? '')}
        </span>
      )}

      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${block.label}`}
        className="shrink-0 text-muted-foreground/60 hover:text-destructive"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

/** The shape on the left, as an entry — same order, same grouping. */
function PanelPreview({
  name,
  icon,
  blocks,
  cover
}: {
  name: string
  icon: string
  blocks: PanelBlock[]
  cover: boolean
}): React.JSX.Element {
  const Icon = CATEGORY_ICON_MAP[icon] ?? CATEGORY_ICON_MAP.Tag!
  return (
    <div className="grid min-w-0 gap-2">
      <SectionLabel>The same words, as an entry</SectionLabel>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex items-center gap-1.5 border-b border-border px-3 py-2 text-[11.5px] text-muted-foreground">
          <Icon className="h-3 w-3 shrink-0" />
          <span className="truncate">{name || 'Untitled category'}</span>
        </div>
        <div className="max-h-[320px] space-y-2.5 overflow-y-auto p-3">
          {cover && (
            <div className="grid h-20 place-items-center rounded bg-muted text-muted-foreground">
              <ImageIcon className="h-4 w-4" />
            </div>
          )}
          <p className="m-0 text-[15px] font-semibold leading-snug">A new entry</p>
          {blocks.length === 0 ? (
            <p className="m-0 text-xs text-muted-foreground">
              Nothing else yet — every line here comes from the list on the left.
            </p>
          ) : (
            blocks.map((b) =>
              b.type === 'heading' ? (
                <p
                  key={b.id}
                  className="m-0 pt-1 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  {b.label || 'Section'}
                </p>
              ) : (
                <div key={b.id} className="grid gap-1">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {b.label || 'Untitled field'}
                  </span>
                  <span
                    className={cn(
                      'rounded border border-border bg-background',
                      b.type === 'textarea' ? 'h-10' : 'h-6'
                    )}
                  />
                </div>
              )
            )
          )}
        </div>
      </div>
    </div>
  )
}

interface CategoryBuilderSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** null means a new category. */
  category: CategoryDefinition | null
  entryCount?: number
  onSave: (category: CategoryDefinition) => Promise<void> | void
  onRemove?: () => void
}

export function CategoryBuilderSheet({
  open,
  onOpenChange,
  category,
  entryCount = 0,
  onSave,
  onRemove
}: CategoryBuilderSheetProps): React.JSX.Element {
  const categories = useAppStore((s) => s.categories)

  const [name, setName] = useState('')
  const [icon, setIcon] = useState('Tag')
  const [mode, setMode] = useState<CategoryMode>('panel')
  const [blocks, setBlocks] = useState<PanelBlock[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(category?.name ?? '')
    setIcon(category?.icon ?? 'Tag')
    setMode(category?.mode ?? 'panel')
    setBlocks(category?.panelBlocks ? [...category.panelBlocks] : [])
    setSaving(false)
  }, [open, category])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  // The cover is one images block; the switch adds or drops it.
  const coverOn = blocks.some((b) => b.type === 'images')
  const fieldBlocks = useMemo(() => blocks.filter((b) => b.type !== 'images'), [blocks])

  const setCover = (next: boolean): void => {
    setBlocks((prev) => {
      if (next) {
        if (prev.some((b) => b.type === 'images')) return prev
        return [{ id: newId(), label: 'Images', type: 'images' }, ...prev]
      }
      return prev.filter((b) => b.type !== 'images')
    })
  }

  const updateBlock = (id: string, next: PanelBlock): void => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? next : b)))
  }

  const removeBlock = (id: string): void => {
    setBlocks((prev) => prev.filter((b) => b.id !== id))
  }

  const addField = (): void => {
    setBlocks((prev) => [...prev, { id: newId(), label: 'New field', type: 'text' }])
  }

  const addHeading = (): void => {
    setBlocks((prev) => [...prev, { id: newId(), label: 'New section', type: 'heading' }])
  }

  const handleDragEnd = (event: DragEndEvent): void => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setBlocks((prev) => {
      const ids = prev.map((b) => b.id)
      const from = ids.indexOf(String(active.id))
      const to = ids.indexOf(String(over.id))
      if (from === -1 || to === -1) return prev
      return arrayMove(prev, from, to)
    })
  }

  const isNotes = category?.id === BUILTIN_CATEGORY_IDS.notes

  const handleSave = async (): Promise<void> => {
    if (!name.trim()) return
    setSaving(true)
    const next: CategoryDefinition = {
      id: category?.id ?? `custom-${crypto.randomUUID()}`,
      name: name.trim(),
      icon,
      mode,
      sortOrder: category?.sortOrder ?? categories.length,
      builtIn: category?.builtIn ?? false,
      panelBlocks: blocks
    }
    try {
      await onSave(next)
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[calc(100vh-4rem)] overflow-y-auto">
        <DialogHeader className="space-y-0">
          <div className="flex items-center gap-2.5">
            <IconPicker value={icon} onChange={setIcon} />
            <input
              type="text"
              value={name}
              placeholder="Name this category"
              aria-label="Category name"
              onChange={(e) => setName(e.target.value)}
              className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-lg font-semibold tracking-tight outline-none hover:border-border focus:border-border"
            />
            {category && (
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {entryCount} {entryCount === 1 ? 'entry' : 'entries'}
              </span>
            )}
          </div>
          <DialogTitle className="sr-only">
            {category ? `Edit ${category.name}` : 'New category'}
          </DialogTitle>
          <DialogDescription className="pt-1.5">
            A section of your wiki. Nothing here is decided for good — change the name, the icon,
            the fields or where entries open, whenever you like.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between gap-4 px-3 py-2">
            <span className="text-[13px]">Entries open in</span>
            <div
              className="flex gap-0.5 rounded-md bg-muted p-0.5"
              role="group"
              aria-label="Entries open in"
            >
              {(
                [
                  { id: 'panel' as CategoryMode, label: 'The side panel' },
                  { id: 'editor' as CategoryMode, label: 'A page of their own' }
                ]
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  aria-pressed={mode === opt.id}
                  disabled={isNotes}
                  onClick={() => setMode(opt.id)}
                  className={cn(
                    'rounded px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50',
                    mode === opt.id
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          {mode === 'panel' && (
            <div className="flex items-center justify-between gap-4 border-t border-border/60 px-3 py-2">
              <span className="text-[13px]">Cover image</span>
              <Switch ariaLabel="Cover image" checked={coverOn} onChange={setCover} />
            </div>
          )}
        </div>

        {mode === 'editor' ? (
          <p className="text-[13px] leading-5 text-muted-foreground">
            Entries in this category open as a page you write on. They have a title and your
            writing — no fields. Switch back to the side panel at any time; nothing is lost either
            way.
          </p>
        ) : (
          <div className="grid grid-cols-[minmax(0,1fr)_280px] items-start gap-5">
            <div className="grid min-w-0 gap-2">
              <div className="flex items-baseline justify-between gap-3">
                <SectionLabel>Fields</SectionLabel>
                <span className="text-[11.5px] text-muted-foreground">
                  Drag to reorder · a heading groups what follows it
                </span>
              </div>

              <div className="overflow-hidden rounded-lg border border-border bg-card">
                <div className="flex items-center gap-2 border-b border-border/60 px-2 py-1.5">
                  <Lock className="ml-0.5 h-3 w-3 shrink-0 text-muted-foreground/60" />
                  <span className="w-[150px] shrink-0 px-1.5 text-[13px]">Name</span>
                  <span className="min-w-0 flex-1 truncate text-[11.5px] italic text-muted-foreground">
                    Priama&rsquo;s — every entry has one, and it is the title
                  </span>
                </div>

                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={fieldBlocks.map((b) => b.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {fieldBlocks.map((b) => (
                      <FieldRow
                        key={b.id}
                        block={b}
                        categories={categories}
                        onChange={(next) => updateBlock(b.id, next)}
                        onRemove={() => removeBlock(b.id)}
                      />
                    ))}
                  </SortableContext>
                </DndContext>

                <div className="flex gap-1 border-t border-border/60 bg-muted/30 px-2 py-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={addField}
                  >
                    <Plus className="h-3 w-3" />
                    Add a field
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={addHeading}
                  >
                    <Plus className="h-3 w-3" />
                    Add a heading
                  </Button>
                </div>
              </div>

              <p className="text-[11.5px] leading-snug text-muted-foreground">
                Renaming a field keeps everything written in it. Removing one hides it without
                erasing what it held.
              </p>
            </div>

            <PanelPreview name={name} icon={icon} blocks={fieldBlocks} cover={coverOn} />
          </div>
        )}

        <div className="flex items-center gap-2">
          {category && onRemove && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs text-destructive hover:text-destructive"
              onClick={onRemove}
            >
              Remove category…
            </Button>
          )}
          <span className="flex-1" />
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} disabled={!name.trim() || saving}>
            {category ? 'Save' : 'Create category'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
