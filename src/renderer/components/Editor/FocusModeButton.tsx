import { Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/UI/button'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/UI/tooltip'
import { useAppStore } from '@/store/appStore'
import { useWritingSurfaceOpen } from '@/hooks/useFocusMode'
import { cn } from '@/lib/utils'

const isMac =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

function focusShortcutLabel(): string {
  return isMac ? '⌥⌘F' : 'Alt+Ctrl+F'
}

interface FocusModeButtonProps {
  className?: string
  /** Compact floating control used while the status bar is hidden. */
  floating?: boolean
}

export function FocusModeButton({
  className,
  floating = false
}: FocusModeButtonProps): React.JSX.Element {
  const focusMode = useAppStore((s) => s.focusMode)
  const toggleFocusMode = useAppStore((s) => s.toggleFocusMode)
  const writingSurfaceOpen = useWritingSurfaceOpen()
  const disabled = !writingSurfaceOpen && !focusMode

  const Icon = focusMode ? EyeOff : Eye
  const label = focusMode
    ? `Exit Focus Mode (${focusShortcutLabel()})`
    : `Focus Mode (${focusShortcutLabel()})`

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              floating ? 'h-7 w-7 bg-background/80 shadow-sm backdrop-blur-sm' : 'h-6 w-6',
              className
            )}
            disabled={disabled}
            onClick={() => {
              if (!writingSurfaceOpen && !focusMode) return
              toggleFocusMode()
            }}
            title={label}
            aria-label={label}
            aria-pressed={focusMode}
          >
            <Icon className={floating ? 'h-3.5 w-3.5' : 'h-3 w-3'} />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
