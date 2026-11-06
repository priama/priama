import { Button } from '@/components/UI/button'
import { DialogFooter } from '@/components/UI/dialog'
import { WizardStepHeader } from '@/components/Project/WizardStepHeader'
import { countHtmlWords } from '@shared/manuscriptMeta'
import { cn } from '@/lib/utils'
import type { ManuscriptImportChapter, ManuscriptSplitMode } from '@shared/types'

export interface PreviewChapterRow extends ManuscriptImportChapter {
  id: string
  included: boolean
}

const SPLIT_MODES: { id: ManuscriptSplitMode; label: string }[] = [
  { id: 'heading1', label: 'Heading 1 styles' },
  { id: 'chapter-pattern', label: 'Chapter 1 / Prologue titles' },
  { id: 'single', label: 'One chapter' }
]

interface ImportPreviewStepProps {
  fileName: string
  splitMode: ManuscriptSplitMode
  detectedMode: ManuscriptSplitMode
  chapters: PreviewChapterRow[]
  onSplitModeChange: (mode: ManuscriptSplitMode) => void
  onToggleChapter: (id: string) => void
  onChooseDifferentFile: () => void
  onBack: () => void
  onNext: () => void
}

/** Only shown when the split fell back to something other than what was asked for. */
function modeHint(detected: ManuscriptSplitMode): string | null {
  if (detected === 'chapter-pattern') {
    return 'This file has no Heading 1 styles, so we split on chapter titles instead.'
  }
  if (detected === 'single') {
    return 'No chapter headings found — this comes in as one document. You can split it later.'
  }
  return null
}

export function ImportPreviewStep({
  fileName,
  splitMode,
  detectedMode,
  chapters,
  onSplitModeChange,
  onToggleChapter,
  onChooseDifferentFile,
  onBack,
  onNext
}: ImportPreviewStepProps): React.JSX.Element {
  const includedCount = chapters.filter((c) => c.included).length
  const hint = modeHint(detectedMode)

  return (
    <>
      <WizardStepHeader
        step={2}
        total={5}
        title={
          chapters.length === 1 ? 'We found 1 chapter' : `We found ${chapters.length} chapters`
        }
      />

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex min-w-0 items-center gap-3 border-b border-border/60 px-3 py-2">
          <span className="min-w-0 flex-1 truncate text-[13px]" title={fileName}>
            {fileName}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 px-2 text-xs"
            onClick={onChooseDifferentFile}
          >
            Choose another
          </Button>
        </div>
        <div className="flex items-center justify-between gap-4 px-3 py-2">
          <label htmlFor="split-mode" className="text-[13px]">
            Split on
          </label>
          <select
            id="split-mode"
            value={splitMode}
            onChange={(e) => onSplitModeChange(e.target.value as ManuscriptSplitMode)}
            className="h-7 shrink-0 rounded-md border border-input bg-background px-2 text-[13px] shadow-sm outline-none"
          >
            {SPLIT_MODES.map((mode) => (
              <option key={mode.id} value={mode.id}>
                {mode.label}
              </option>
            ))}
          </select>
        </div>
        {hint && (
          <p className="border-t border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            {hint}
          </p>
        )}
      </div>

      <div className="max-h-56 overflow-y-auto overflow-x-hidden rounded-lg border border-border bg-card">
        {chapters.map((chapter, index) => (
          <label
            key={chapter.id}
            className={cn(
              'flex min-w-0 cursor-pointer items-center gap-2.5 px-3 py-2 hover:bg-accent/40 [&+label]:border-t [&+label]:border-border/60',
              !chapter.included && 'opacity-55'
            )}
          >
            <input
              type="checkbox"
              className="shrink-0 accent-foreground"
              checked={chapter.included}
              onChange={() => onToggleChapter(chapter.id)}
            />
            <span className="min-w-0 flex-1 truncate text-[13px]">
              {index + 1}. {chapter.title}
            </span>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {countHtmlWords(chapter.html).toLocaleString()} words
            </span>
          </label>
        ))}
      </div>

      <DialogFooter className="items-center gap-2 sm:justify-between">
        <span className="text-xs tabular-nums text-muted-foreground">
          {includedCount} of {chapters.length} will become chapters
        </span>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onBack}>
            Back
          </Button>
          <Button onClick={onNext} disabled={includedCount === 0}>
            Continue
          </Button>
        </div>
      </DialogFooter>
    </>
  )
}
