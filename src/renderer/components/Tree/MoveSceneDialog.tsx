import { useState } from 'react'
import { Check } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/UI/dialog'
import { Button } from '@/components/UI/button'
import { useAppStore } from '@/store/appStore'
import { cn } from '@/lib/utils'
import type { TreeNode } from '@shared/types'

interface MoveSceneDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  chapters: TreeNode[]
  onMove: (chapterId: string) => void | Promise<void>
}

export function MoveSceneDialog({
  open,
  onOpenChange,
  chapters,
  onMove
}: MoveSceneDialogProps): React.JSX.Element {
  const nodes = useAppStore((s) => s.nodes)
  const [selectedId, setSelectedId] = useState<string | null>(chapters[0]?.id ?? null)

  // The folder a chapter sits in, so a long title can shorten without losing its place.
  const placeOf = (chapter: TreeNode): string => {
    if (!chapter.parentId) return 'Manuscript'
    return nodes.find((n) => n.id === chapter.parentId)?.title ?? 'Manuscript'
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Move to chapter</DialogTitle>
          <DialogDescription>Only chapters that hold scenes are listed.</DialogDescription>
        </DialogHeader>

        <div className="max-h-60 overflow-y-auto overflow-x-hidden rounded-lg border border-border bg-card">
          {chapters.map((chapter) => {
            const selected = selectedId === chapter.id
            return (
              <button
                key={chapter.id}
                type="button"
                onClick={() => setSelectedId(chapter.id)}
                className={cn(
                  'flex w-full min-w-0 items-center gap-2.5 px-3 py-2 text-left transition-colors [&+&]:border-t [&+&]:border-border/60',
                  selected ? 'bg-accent' : 'hover:bg-accent/50'
                )}
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[13px] leading-snug">{chapter.title}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {placeOf(chapter)}
                  </span>
                </span>
                {selected && <Check className="h-4 w-4 shrink-0 text-foreground" />}
              </button>
            )
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!selectedId}
            onClick={() => {
              if (selectedId) {
                void Promise.resolve(onMove(selectedId)).finally(() => onOpenChange(false))
              }
            }}
          >
            Move
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
