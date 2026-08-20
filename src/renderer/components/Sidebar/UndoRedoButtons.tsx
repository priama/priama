import { useSyncExternalStore } from 'react'
import { Undo2, Redo2 } from 'lucide-react'
import { Button } from '@/components/UI/button'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/UI/tooltip'
import { useHistoryStore } from '@/store/historyStore'
import { coordinatedRedo, coordinatedUndo, editorCanUndo, editorCanRedo } from '@/lib/coordinatedUndo'
import { cn } from '@/lib/utils'

function subscribeEditorCapability(onStoreChange: () => void): () => void {
  const id = window.setInterval(onStoreChange, 250)
  return () => window.clearInterval(id)
}

export function UndoRedoButtons({ className }: { className?: string }): React.JSX.Element {
  const { canUndo, canRedo } = useHistoryStore()
  const tipTapCanUndo = useSyncExternalStore(subscribeEditorCapability, editorCanUndo, () => false)
  const tipTapCanRedo = useSyncExternalStore(subscribeEditorCapability, editorCanRedo, () => false)

  return (
    <TooltipProvider delayDuration={300}>
      <div className={cn('flex shrink-0 items-center gap-0.5', className)}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={!tipTapCanUndo && !canUndo}
              onClick={() => void coordinatedUndo()}
              aria-label="Undo"
            >
              <Undo2 className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Undo (⌘Z)</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={!tipTapCanRedo && !canRedo}
              onClick={() => void coordinatedRedo()}
              aria-label="Redo"
            >
              <Redo2 className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Redo (⌘⇧Z)</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  )
}
