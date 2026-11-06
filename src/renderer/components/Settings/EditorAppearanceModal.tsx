import { useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/UI/dialog'
import { Button } from '@/components/UI/button'
import { Switch } from '@/components/UI/switch'
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

/** What each face is, in plain words — the names alone say nothing. */
const FONT_NOTES: Record<EditorFontId, string> = {
  Literata: 'Serif · the default',
  Georgia: 'Serif · already on your computer',
  Merriweather: 'Serif · a little heavier',
  Lora: 'Serif · brushed, warmer',
  Inter: 'Sans-serif · no serifs at all'
}

const SAMPLE =
  'The tide went out of Ys for the last time on a Tuesday, and took the bells with it. Hallow counted nine of them in the mud.'

function SectionLabel({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </span>
  )
}

function Card({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <div className="overflow-hidden rounded-lg border border-border bg-card">{children}</div>
}

function SliderRow({
  id,
  label,
  value,
  min,
  max,
  step,
  display,
  onChange
}: {
  id: string
  label: string
  value: number
  min: number
  max: number
  step: number
  display: string
  onChange: (next: number) => void
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-3 px-3 py-2 [&+&]:border-t [&+&]:border-border/60">
      <label htmlFor={id} className="w-[86px] shrink-0 text-[13px]">
        {label}
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="no-drag min-w-0 flex-1 accent-foreground"
      />
      <span className="w-12 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
        {display}
      </span>
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

  // Each font row previews its own face, and so does the sample.
  useEffect(() => {
    if (!open) return
    for (const id of EDITOR_FONT_IDS) void loadEditorFont(id)
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[calc(100vh-4rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editor Appearance</DialogTitle>
          <DialogDescription>
            How your words look while you write. Nothing here changes the file or the export.
          </DialogDescription>
        </DialogHeader>

        {/* The settings below, applied to real sentences. */}
        <div className="overflow-hidden rounded-lg border border-border bg-card px-4 py-4">
          <p
            className="m-0 text-foreground"
            style={{
              fontFamily: EDITOR_FONT_CSS[appearance.font],
              fontSize: `${appearance.size}px`,
              lineHeight: appearance.leading,
              maxWidth: `${appearance.measure}ch`
            }}
          >
            {SAMPLE}
          </p>
        </div>

        <div className="grid gap-2">
          <SectionLabel>Typeface</SectionLabel>
          <Card>
            {EDITOR_FONT_IDS.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setEditorAppearance({ font: id })}
                className={cn(
                  'flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors [&+button]:border-t [&+button]:border-border/60',
                  appearance.font === id ? 'bg-accent' : 'hover:bg-accent/50'
                )}
              >
                <span
                  className="text-[15px]"
                  style={{ fontFamily: EDITOR_FONT_CSS[id as EditorFontId] }}
                >
                  {id}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {FONT_NOTES[id as EditorFontId]}
                </span>
              </button>
            ))}
          </Card>
        </div>

        <div className="grid gap-2">
          <SectionLabel>Set the page</SectionLabel>
          <Card>
            <SliderRow
              id="editor-size"
              label="Text size"
              value={appearance.size}
              min={EDITOR_SIZE_MIN}
              max={EDITOR_SIZE_MAX}
              step={1}
              display={`${appearance.size} px`}
              onChange={(size) => setEditorAppearance({ size })}
            />
            <SliderRow
              id="editor-leading"
              label="Line spacing"
              value={appearance.leading}
              min={EDITOR_LEADING_MIN}
              max={EDITOR_LEADING_MAX}
              step={EDITOR_LEADING_STEP}
              display={String(appearance.leading)}
              onChange={(leading) => setEditorAppearance({ leading })}
            />
            <SliderRow
              id="editor-measure"
              label="Line width"
              value={appearance.measure}
              min={EDITOR_MEASURE_MIN}
              max={EDITOR_MEASURE_MAX}
              step={1}
              display={`${appearance.measure} ch`}
              onChange={(measure) => setEditorAppearance({ measure })}
            />
          </Card>
        </div>

        <div className="grid gap-2">
          <SectionLabel>Spelling</SectionLabel>
          <Card>
            <div className="flex items-start justify-between gap-4 px-3 py-2.5">
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-[13px]">Check grammar online</span>
                <span className="text-[11.5px] leading-snug text-muted-foreground">
                  Sends the paragraph you are writing to languagetool.org. Off by default; spelling
                  is always checked on this computer.
                </span>
              </span>
              <Switch
                ariaLabel="Check grammar online"
                checked={spellCheckOnline}
                onChange={setSpellCheckOnline}
                className="mt-0.5"
              />
            </div>
          </Card>
        </div>

        <div className="flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs"
            onClick={() => setEditorAppearance({ ...DEFAULT_EDITOR_APPEARANCE })}
          >
            Reset to defaults
          </Button>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
