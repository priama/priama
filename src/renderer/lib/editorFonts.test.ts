import { beforeEach, describe, expect, it, vi } from 'vitest'

const imported = vi.hoisted(() => new Set<string>())

vi.mock('@fontsource/merriweather/400.css', () => (imported.add('Merriweather'), {}))
vi.mock('@fontsource/merriweather/400-italic.css', () => ({}))
vi.mock('@fontsource/merriweather/700.css', () => ({}))
vi.mock('@fontsource/lora/400.css', () => (imported.add('Lora'), {}))
vi.mock('@fontsource/lora/400-italic.css', () => ({}))
vi.mock('@fontsource/lora/600.css', () => ({}))
vi.mock('@fontsource/lora/700.css', () => ({}))
vi.mock('@fontsource/inter/400.css', () => (imported.add('Inter'), {}))
vi.mock('@fontsource/inter/500.css', () => ({}))
vi.mock('@fontsource/inter/600.css', () => ({}))
vi.mock('@fontsource/inter/700.css', () => ({}))

describe('editor fonts', () => {
  beforeEach(() => {
    vi.resetModules()
    imported.clear()
  })

  it('loads a face only when asked, and only once', async () => {
    const { loadEditorFont } = await import('@/lib/editorFonts')
    expect(imported.size).toBe(0)

    await Promise.all([loadEditorFont('Lora'), loadEditorFont('Lora')])
    await loadEditorFont('Literata')
    await loadEditorFont('Georgia')

    expect([...imported]).toEqual(['Lora'])
  })

  it('loads faces that older documents name in inline styles', async () => {
    const { loadEditorFontsUsedIn } = await import('@/lib/editorFonts')

    loadEditorFontsUsedIn(
      '<p><span style="font-family: Merriweather, serif">a</span> Inter-war history,' +
        ' <span style="font-family: &quot;Inter&quot;, system-ui">b</span></p>'
    )

    await vi.waitFor(() => expect([...imported].sort()).toEqual(['Inter', 'Merriweather']))
  })
})
