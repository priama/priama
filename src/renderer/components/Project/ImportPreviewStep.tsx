import { Button } from '@/components/UI/button'
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/UI/dialog'
import { countHtmlWords } from '@shared/manuscriptMeta'
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

function modeHint(detected: ManuscriptSplitMode): string | null {
  if (detected === 'chapter-pattern') {
    return "This file doesn't use Heading 1 styles. We split on chapter titles instead — change the setting if that's wrong."
  }
  if (detected === 'single') {
    return "We couldn't find chapter headings. This will import as one document. You can split it later in Priama."
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
      <DialogHeader>
        <DialogTitle>Preview chapters</DialogTitle>
        <DialogDescription>
          Nothing is created until you finish this wizard. Uncheck anything you don&apos;t want
          (title page, contents, and so on).
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-3 py-2">
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 truncate text-sm text-muted-foreground" title={fileName}>
            {fileName}
          </p>
          <Button type="button" variant="ghost" size="sm" className="shrink-0" onClick={onChooseDifferentFile}>
            Choose different file
          </Button>
        </div>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Split into chapters using</span>
          <select
            value={splitMode}
            onChange={(e) => onSplitModeChange(e.target.value as ManuscriptSplitMode)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          >
            {SPLIT_MODES.map((mode) => (
              <option key={mode.id} value={mode.id}>
                {mode.label}
              </option>
            ))}
          </select>
        </label>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border border-border p-2">
          {chapters.map((chapter, index) => (
            <label
              key={chapter.id}
              className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent/40"
            >
              <input
                type="checkbox"
                className="mt-1"
                checked={chapter.included}
                onChange={() => onToggleChapter(chapter.id)}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">
                  {index + 1}. {chapter.title}
                </span>
                <span className="text-xs text-muted-foreground">
                  {countHtmlWords(chapter.html).toLocaleString()} words
                </span>
              </span>
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {includedCount} of {chapters.length} chapters will be created. Have a Scrivener project?
          Export to Word first.
        </p>
      </div>
      <DialogFooter className="gap-2">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext} disabled={includedCount === 0}>
          Next
        </Button>
      </DialogFooter>
    </>
  )
}
