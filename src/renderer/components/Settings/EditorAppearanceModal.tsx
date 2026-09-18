import { useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/UI/dialog'
import { Label } from '@/components/UI/label'
import { Button } from '@/components/UI/button'
import { useAppStore } from '@/store/appStore'
import {
  DEFAULT_EDITOR_APPEARANCE,
  EDITOR_FONT_CSS,
  EDITOR_FONT_IDS,
  EDITOR_LEADING_MAX,
  EDITOR_LEADING_MIN,
  EDITOR_LEADING_STEP,
  EDITOR_MEASURE_MAX,
  EDITOR_MEASURE_MIN,
  EDITOR_SIZE_MAX,
  EDITOR_SIZE_MIN,
  type EditorFontId
} from '@shared/editorAppearance'
import { cn } from '@/lib/utils'
import { loadEditorFont } from '@/lib/editorFonts'

interface EditorAppearanceModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function FieldRow({
  label,
  value,
  children
}: {
  label: string
  value?: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="grid gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        {value !== undefined && (
          <span className="text-xs tabular-nums text-muted-foreground">{value}</span>
        )}
      </div>
      {children}
    </div>
  )
}

export function EditorAppearanceModal({
  open,
  onOpenChange
}: EditorAppearanceModalProps): React.JSX.Element {
  const appearance = useAppStore((s) => s.editorAppearance)
  const setEditorAppearance = useAppStore((s) => s.setEditorAppearance)
  const spellCheckOnline = useAppStore((s) => s.spellCheckOnline)
  const setSpellCheckOnline = useAppStore((s) => s.setSpellCheckOnline)

  // Each font button previews its own face.
  useEffect(() => {
    if (!open) return
    for (const id of EDITOR_FONT_IDS) void loadEditorFont(id)
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent presentation="sheet" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editor Appearance</DialogTitle>
          <DialogDescription>
            How the writing surface looks on screen. Does not change manuscript HTML or export.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 pt-2">
          <FieldRow label="Font">
            <div className="flex flex-wrap gap-2">
              {EDITOR_FONT_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setEditorAppearance({ font: id })}
                  className={cn(
                    'no-drag rounded-md border px-3 py-2 text-sm transition-colors',
                    appearance.font === id
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border hover:bg-accent/50'
                  )}
                  style={{ fontFamily: EDITOR_FONT_CSS[id as EditorFontId] }}
                >
                  {id}
                </button>
              ))}
            </div>
          </FieldRow>

          <FieldRow label="Size" value={`${appearance.size}px`}>
            <input
              type="range"
              min={EDITOR_SIZE_MIN}
              max={EDITOR_SIZE_MAX}
              step={1}
              value={appearance.size}
              onChange={(e) => setEditorAppearance({ size: Number(e.target.value) })}
              className="no-drag w-full accent-foreground"
            />
          </FieldRow>

          <FieldRow label="Line height" value={String(appearance.leading)}>
            <input
              type="range"
              min={EDITOR_LEADING_MIN}
              max={EDITOR_LEADING_MAX}
              step={EDITOR_LEADING_STEP}
              value={appearance.leading}
              onChange={(e) => setEditorAppearance({ leading: Number(e.target.value) })}
              className="no-drag w-full accent-foreground"
            />
          </FieldRow>

          <FieldRow label="Measure" value={`${appearance.measure}ch`}>
            <input
              type="range"
              min={EDITOR_MEASURE_MIN}
              max={EDITOR_MEASURE_MAX}
              step={1}
              value={appearance.measure}
              onChange={(e) => setEditorAppearance({ measure: Number(e.target.value) })}
              className="no-drag w-full accent-foreground"
            />
          </FieldRow>

          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEditorAppearance({ ...DEFAULT_EDITOR_APPEARANCE })}
            >
              Reset to defaults
            </Button>
          </div>

          <div className="grid gap-2 border-t border-border pt-4">
            <Label className="text-xs text-muted-foreground">Spelling</Label>
            <label className="no-drag flex cursor-pointer items-start gap-2.5">
              <input
                type="checkbox"
                checked={spellCheckOnline}
                onChange={(e) => setSpellCheckOnline(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-foreground"
              />
              <span className="grid gap-0.5">
                <span className="text-sm">Check spelling online</span>
                <span className="text-xs text-muted-foreground">
                  Adds grammar suggestions from LanguageTool by sending the paragraph you are
                  writing to languagetool.org. When off, spelling is checked on this computer.
                </span>
              </span>
            </label>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
