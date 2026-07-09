import { useEffect, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { ChevronDown } from 'lucide-react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { cn } from '@/lib/utils'

const FONTS = [
  { id: 'Literata', label: 'Literata', family: 'Literata, serif' },
  { id: 'Georgia', label: 'Georgia', family: 'Georgia, serif' },
  { id: 'Merriweather', label: 'Merriweather', family: 'Merriweather, serif' },
  { id: 'Lora', label: 'Lora', family: 'Lora, serif' },
  { id: 'Inter', label: 'Inter', family: 'Inter, system-ui, sans-serif' }
] as const

type FontId = (typeof FONTS)[number]['id']

const DEFAULT_FONT: FontId = 'Literata'

const SUPPORTED_FAMILIES = new Set(FONTS.map((f) => f.family))

function isSupportedFamily(family: string): boolean {
  if (!family) return true
  return FONTS.some((f) => family.startsWith(f.id))
}

function detectFont(editor: Editor): FontId {
  const attrs = editor.getAttributes('textStyle')
  const family = (attrs.fontFamily as string) ?? ''
  if (!family) return DEFAULT_FONT
  const match = FONTS.find((f) => family.startsWith(f.id))
  return match?.id ?? DEFAULT_FONT
}

interface FontDropdownProps {
  editor: Editor | null
}

function FontDropdown({ editor }: FontDropdownProps): React.JSX.Element | null {
  const [current, setCurrent] = useState<FontId>(DEFAULT_FONT)

  useEffect(() => {
    if (!editor) return
    const update = (): void => setCurrent(detectFont(editor))
    editor.on('selectionUpdate', update)
    editor.on('transaction', update)
    update()
    return () => {
      editor.off('selectionUpdate', update)
      editor.off('transaction', update)
    }
  }, [editor])

  if (!editor) return null

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className="flex h-8 items-center gap-1 rounded-md px-2 text-sm hover:bg-accent">
        <span className="max-w-[110px] truncate">{current}</span>
        <ChevronDown className="h-3.5 w-3.5 opacity-60" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="z-50 min-w-[180px] rounded-md border border-border bg-popover p-1 shadow-md"
          align="start"
        >
          {FONTS.map((font) => (
            <DropdownMenu.Item
              key={font.id}
              className={cn(
                'flex cursor-pointer items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent',
                current === font.id && 'bg-accent'
              )}
              style={{ fontFamily: font.family }}
              onSelect={() => {
                if (font.id === DEFAULT_FONT) {
                  editor.chain().focus().unsetFontFamily().run()
                } else {
                  editor.chain().focus().setFontFamily(font.family).run()
                }
              }}
            >
              {font.label}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

export { FontDropdown, isSupportedFamily }
