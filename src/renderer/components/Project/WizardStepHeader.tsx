import { DialogHeader, DialogTitle } from '@/components/UI/dialog'

interface WizardStepHeaderProps {
  step: number
  total: number
  title: string
}

/**
 * Progress, position, title. The wizard says where you are and what this step is —
 * the controls below say the rest.
 */
export function WizardStepHeader({ step, total, title }: WizardStepHeaderProps): React.JSX.Element {
  const pct = Math.round((step / total) * 100)
  return (
    <>
      <div className="-mx-6 -mt-6 h-[3px] bg-muted" aria-hidden>
        <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
      <DialogHeader className="space-y-1">
        <span className="text-[11px] font-semibold uppercase tracking-wider tabular-nums text-muted-foreground">
          Step {step} of {total}
        </span>
        <DialogTitle>{title}</DialogTitle>
      </DialogHeader>
    </>
  )
}
