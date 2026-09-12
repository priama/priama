import { FileText, FileUp, Loader2 } from 'lucide-react'
import {
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/UI/dialog'

interface ProjectOriginStepProps {
  error: string | null
  parsing: boolean
  onBlank: () => void
  onImport: () => void
}

export function ProjectOriginStep({
  error,
  parsing,
  onBlank,
  onImport
}: ProjectOriginStepProps): React.JSX.Element {
  return (
    <>
      <DialogHeader>
        <DialogTitle>New Book Project</DialogTitle>
        <DialogDescription>Start a blank book, or bring in a manuscript you already have.</DialogDescription>
      </DialogHeader>
      <div className="space-y-2 py-2">
        <button
          type="button"
          onClick={onBlank}
          disabled={parsing}
          className="w-full rounded-lg border border-border p-4 text-left transition-colors hover:border-border/80 hover:bg-accent/30 disabled:opacity-50"
        >
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
            <div>
              <span className="text-sm font-medium">Start from scratch</span>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Empty manuscript. Add chapters as you write.
              </p>
            </div>
          </div>
        </button>
        <button
          type="button"
          onClick={onImport}
          disabled={parsing}
          className="w-full rounded-lg border border-border p-4 text-left transition-colors hover:border-border/80 hover:bg-accent/30 disabled:opacity-50"
        >
          <div className="flex items-center gap-3">
            {parsing ? (
              <Loader2 className="h-5 w-5 shrink-0 animate-spin text-muted-foreground" />
            ) : (
              <FileUp className="h-5 w-5 shrink-0 text-muted-foreground" />
            )}
            <div>
              <span className="text-sm font-medium">Import a manuscript</span>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {parsing
                  ? 'Reading Word file…'
                  : 'Word .docx. Split into chapters at Heading 1, then preview before creating the book.'}
              </p>
            </div>
          </div>
        </button>
        <p className="pt-1 text-xs text-muted-foreground">
          Have a Scrivener or Google Docs file? Export to Word (.docx) first, then import here.
        </p>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </>
  )
}
