import { createPortal } from 'react-dom'

interface EntityNamePopoverProps {
  x: number
  y: number
  title: string
  typeLabel: string
  onOpen: () => void
}

export function EntityNamePopover({
  x,
  y,
  title,
  typeLabel,
  onOpen
}: EntityNamePopoverProps): React.JSX.Element {
  const style: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(x, window.innerWidth - 220),
    top: Math.min(y + 8, window.innerHeight - 80),
    zIndex: 9998
  }

  return createPortal(
    <div
      style={style}
      className="pointer-events-auto min-w-[180px] rounded-md border border-border bg-popover px-3 py-2 shadow-md"
    >
      <div className="text-sm font-medium text-foreground">{title}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{typeLabel}</div>
      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault()
          onOpen()
        }}
        className="mt-2 text-xs font-medium text-primary hover:underline"
      >
        Open in panel
      </button>
    </div>,
    document.body
  )
}
