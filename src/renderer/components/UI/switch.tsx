import { cn } from '@/lib/utils'

interface SwitchProps {
  checked: boolean
  onChange: (next: boolean) => void
  ariaLabel: string
  disabled?: boolean
  className?: string
}

/** A two-state toggle for settings that take effect immediately — no Save behind it. */
export function Switch({
  checked,
  onChange,
  ariaLabel,
  disabled,
  className
}: SwitchProps): React.JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'no-drag flex h-[22px] w-[38px] shrink-0 items-center rounded-full p-0.5 transition-colors disabled:opacity-50',
        checked ? 'justify-end bg-primary' : 'justify-start bg-border',
        className
      )}
    >
      <span className="block h-[18px] w-[18px] rounded-full bg-background shadow" />
    </button>
  )
}
