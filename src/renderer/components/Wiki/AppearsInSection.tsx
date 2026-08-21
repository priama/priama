import type { AppearanceRow } from '@/lib/manuscriptAppearances'
import { cn } from '@/lib/utils'

export function AppearsInSection({
  rows,
  onOpen,
  className
}: {
  rows: AppearanceRow[]
  onOpen: (nodeId: string) => void
  className?: string
}): React.JSX.Element {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label className="text-xs font-medium text-muted-foreground">Appears in</label>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No mentions in the manuscript yet.</p>
      ) : (
        <ul className="space-y-0.5">
          {rows.map((row) => (
            <li key={row.nodeId}>
              <button
                type="button"
                onClick={() => onOpen(row.nodeId)}
                className={cn(
                  'flex w-full items-baseline justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm',
                  'hover:bg-accent hover:text-accent-foreground',
                  'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
                )}
              >
                <span className="min-w-0 truncate">{row.label}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{row.countLabel}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
