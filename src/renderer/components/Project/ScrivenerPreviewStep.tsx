import { Folder, FileText } from 'lucide-react'
import { Button } from '@/components/UI/button'
import { DialogFooter } from '@/components/UI/dialog'
import { WizardStepHeader } from '@/components/Project/WizardStepHeader'
import { countHtmlWords } from '@shared/manuscriptMeta'
import { includedWordCount } from '@shared/import/buildImportedTree'
import { cn } from '@/lib/utils'
import type { ParsedScrivenerProject, ScrivenerImportRow } from '@shared/types'

interface ScrivenerPreviewStepProps {
  fileName: string
  rows: ScrivenerImportRow[]
  checked: boolean[]
  stats: ParsedScrivenerProject['stats']
  onToggle: (index: number) => void
  onChooseDifferentFile: () => void
  onBack: () => void
  onNext: () => void
}

/**
 * Tree preview for a Scrivener import. Unlike the Word flow there is no split
 * mode to choose — the binder already carries the structure; the writer only
 * decides what to include.
 */
export function ScrivenerPreviewStep({
  fileName,
  rows,
  checked,
  stats,
  onToggle,
  onChooseDifferentFile,
  onBack,
  onNext
}: ScrivenerPreviewStepProps): React.JSX.Element {
  const chapterCount = rows.filter((r) => r.depth === 0).length
  const includedCount = rows.filter((_, i) => checked[i]).length
  const includedWords = includedWordCount(rows, checked)

  return (
    <>
      <WizardStepHeader
        step={2}
        total={5}
        title={
          chapterCount === 1 ? 'We found 1 chapter' : `We found ${chapterCount} chapters`
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
        <p className="border-t border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          Chapters and scenes come from your Scrivener binder. Items excluded from
          compile are unchecked{stats.researchSkipped > 0 && `; ${stats.researchSkipped} research document${stats.researchSkipped === 1 ? '' : 's'} skipped`}.
        </p>
      </div>

      <div className="max-h-56 overflow-y-auto overflow-x-hidden rounded-lg border border-border bg-card">
        {rows.map((row, index) => (
          <label
            key={`${row.id}-${index}`}
            className={cn(
              'flex min-w-0 cursor-pointer items-start gap-2.5 px-3 py-2 hover:bg-accent/40 [&+label]:border-t [&+label]:border-border/60',
              !checked[index] && 'opacity-55'
            )}
            style={{ paddingLeft: 12 + row.depth * 20 }}
          >
            <input
              type="checkbox"
              className="mt-0.5 shrink-0 accent-foreground"
              checked={checked[index]}
              onChange={() => onToggle(index)}
            />
            {row.kind === 'folder' ? (
              <Folder className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            ) : (
              <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px]">{row.title}</span>
              {row.synopsis && (
                <span className="block truncate text-xs text-muted-foreground" title={row.synopsis}>
                  {row.synopsis}
                </span>
              )}
              {!row.includeInCompile && (
                <span className="block text-xs text-muted-foreground/70">
                  excluded from compile in Scrivener
                </span>
              )}
            </span>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {countHtmlWords(row.html).toLocaleString()} words
            </span>
          </label>
        ))}
      </div>

      <DialogFooter className="items-center gap-2 sm:justify-between">
        <span className="text-xs tabular-nums text-muted-foreground">
          {includedCount} of {rows.length} items · {includedWords.toLocaleString()} words
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
