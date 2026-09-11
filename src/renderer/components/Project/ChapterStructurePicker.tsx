import { useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { FileText, Files, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ChapterStructure } from '@shared/types'

const OPTIONS = [
  {
    id: 'simple' as const,
    icon: FileText,
    title: 'Simple Chapter',
    description: 'One continuous document. Best for linear writers and short chapters.'
  },
  {
    id: 'scenes' as const,
    icon: Files,
    title: 'Chapter with Scenes',
    description: 'A chapter folder containing multiple scene documents. Best for beats and POV shifts.'
  }
]

interface ChapterStructurePickerProps {
  onSelect: (structure: ChapterStructure) => void
  className?: string
}

export function ChapterStructurePicker({
  onSelect,
  className
}: ChapterStructurePickerProps): React.JSX.Element {
  const [open, setOpen] = useState(false)

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={open ? 'Close chapter picker' : 'Add chapter'}
          aria-expanded={open}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'shrink-0 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground',
            className
          )}
        >
          <Plus
            className={cn(
              'h-3.5 w-3.5 transition-transform duration-200 ease-in-out motion-reduce:transition-none',
              open && 'rotate-45'
            )}
          />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="right"
          align="center"
          sideOffset={4}
          collisionPadding={8}
          className="chapter-picker-content no-drag z-[200] w-[min(20rem,calc(100vw-2rem))] outline-none"
        >
          <div className="chapter-picker-shell rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-lg">
            <div className="chapter-picker-cards">
              <p className="text-sm font-semibold leading-none">Chapter Structure</p>
              <p className="mt-1.5 text-xs text-muted-foreground">
                Choose how this chapter is organized before creating it.
              </p>
              <div className="mt-3 grid gap-2">
                {OPTIONS.map((opt) => {
                  const Icon = opt.icon
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setOpen(false)
                        onSelect(opt.id)
                      }}
                      className="no-drag flex gap-3 rounded-md border border-border p-3 text-left transition-colors hover:border-primary hover:bg-accent/50"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{opt.title}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{opt.description}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
