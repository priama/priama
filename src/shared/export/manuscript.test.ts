import { describe, expect, it } from 'vitest'
import {
  chapterSections,
  collectSections,
  formatChapterLabel,
  resolveChapterNumber
} from './manuscript'
import { buildEpubChapterEntries } from './epubChapters'
import {
  DEFAULT_BOOK_SETTINGS,
  DEFAULT_EXPORT_FORMATTING,
  type BookSettings,
  type TreeNode
} from '../types'

function makeChapter(
  id: string,
  title: string,
  content: string,
  structure: 'simple' | 'scenes' = 'simple'
): TreeNode {
  return {
    id,
    parentId: null,
    type: 'chapter',
    title,
    sortOrder: 0,
    content,
    metadata: JSON.stringify({ structure }),
    createdAt: '',
    updatedAt: ''
  }
}

function makeScene(id: string, chapterId: string, title: string, content: string, sortOrder: number): TreeNode {
  return {
    id,
    parentId: chapterId,
    type: 'scene',
    title,
    sortOrder,
    content,
    metadata: '{}',
    createdAt: '',
    updatedAt: ''
  }
}

const baseSettings: BookSettings = { ...DEFAULT_BOOK_SETTINGS }

describe('buildEpubChapterEntries cover page', () => {
  it('prepends a cover entry when coverImageSrc is provided', () => {
    const ch = makeChapter('c1', 'Alpha', '<p>Body</p>')
    const entries = buildEpubChapterEntries(
      [ch],
      { scope: 'manuscript', formatting: { ...DEFAULT_EXPORT_FORMATTING, fontFamily: 'serif', fontSize: 12 }, title: 'Book', author: 'Author' },
      baseSettings,
      'file:///tmp/project/assets/cover.png'
    )
    expect(entries[0].title).toBe('Cover')
    expect(entries[0].content).toContain('file:///tmp/project/assets/cover.png')
    expect(entries[1].title).toBe('Book')
  })
})

describe('formatChapterLabel', () => {
  it('returns null for none style', () => {
    expect(
      formatChapterLabel(1, 'Opening', { ...baseSettings, chapterLabelStyle: 'none' })
    ).toBeNull()
  })

  it('returns title only for title-only style', () => {
    expect(
      formatChapterLabel(1, 'Opening', { ...baseSettings, chapterLabelStyle: 'title-only' })
    ).toBe('Opening')
  })

  it('returns number only', () => {
    expect(
      formatChapterLabel(3, 'Opening', { ...baseSettings, chapterLabelStyle: 'number-only' })
    ).toBe('Chapter 3')
  })

  it('returns number and title', () => {
    expect(
      formatChapterLabel(3, 'Opening', { ...baseSettings, chapterLabelStyle: 'number-and-title' })
    ).toBe('Chapter 3: Opening')
  })

  it('uses word format', () => {
    expect(
      formatChapterLabel(3, 'Opening', {
        ...baseSettings,
        chapterNumberFormat: 'words',
        chapterLabelStyle: 'number-only'
      })
    ).toBe('Chapter Three')
  })

  it('uses roman format', () => {
    expect(
      formatChapterLabel(3, 'Opening', {
        ...baseSettings,
        chapterNumberFormat: 'roman',
        chapterLabelStyle: 'number-only'
      })
    ).toBe('Chapter III')
  })

  it('omits prefix when none', () => {
    expect(
      formatChapterLabel(3, 'Opening', {
        ...baseSettings,
        chapterLabelPrefix: '',
        chapterLabelStyle: 'number-only'
      })
    ).toBe('3')
  })
})

describe('resolveChapterNumber', () => {
  const all = [
    { id: 'c1', title: 'Ch 1', pathLabel: 'Ch 1' },
    { id: 'c2', title: 'Ch 2', pathLabel: 'Ch 2' },
    { id: 'c3', title: 'Ch 3', pathLabel: 'Ch 3' }
  ]

  it('uses manuscript-global position', () => {
    expect(resolveChapterNumber(all[2], all, 0, baseSettings)).toBe(3)
  })

  it('uses export-relative position', () => {
    expect(
      resolveChapterNumber(all[2], all, 0, {
        ...baseSettings,
        chapterNumberingScope: 'export-relative'
      })
    ).toBe(1)
  })
})

describe('chapterSections', () => {
  it('labels simple chapter', () => {
    const ch = makeChapter('c1', 'Alpha', '<p>Body</p>')
    const sections = chapterSections([ch], ch, 2, baseSettings)
    expect(sections).toHaveLength(1)
    expect(sections[0].displayHeading).toBe('Chapter 2: Alpha')
    expect(sections[0].html).toContain('Body')
  })

  it('scene chapter with titles on includes chapter header and scene titles', () => {
    const ch = makeChapter('c1', 'Alpha', '', 'scenes')
    const s1 = makeScene('s1', 'c1', 'Scene A', '<p>A</p>', 0)
    const s2 = makeScene('s2', 'c1', 'Scene B', '<p>B</p>', 1)
    const settings = { ...baseSettings, showSceneTitles: true }
    const sections = chapterSections([ch, s1, s2], ch, 1, settings)
    expect(sections).toHaveLength(3)
    expect(sections[0].level).toBe('chapter')
    expect(sections[0].displayHeading).toBe('Chapter 1: Alpha')
    expect(sections[1].displayHeading).toBe('Scene A')
    expect(sections[2].displayHeading).toBe('Scene B')
  })

  it('scene chapter with titles off uses scene breaks', () => {
    const ch = makeChapter('c1', 'Alpha', '', 'scenes')
    const s1 = makeScene('s1', 'c1', 'Scene A', '<p>A</p>', 0)
    const s2 = makeScene('s2', 'c1', 'Scene B', '<p>B</p>', 1)
    const sections = chapterSections([ch, s1, s2], ch, 1, baseSettings)
    expect(sections).toHaveLength(3)
    expect(sections[0].displayHeading).toBe('Chapter 1: Alpha')
    expect(sections[1].displayHeading).toBeNull()
    expect(sections[1].sceneBreakBefore).toBeFalsy()
    expect(sections[2].displayHeading).toBeNull()
    expect(sections[2].sceneBreakBefore).toBe(true)
  })

  it('scene chapter with no scene break marker skips break output', () => {
    const ch = makeChapter('c1', 'Alpha', '', 'scenes')
    const s1 = makeScene('s1', 'c1', 'Scene A', '<p>A</p>', 0)
    const s2 = makeScene('s2', 'c1', 'Scene B', '<p>B</p>', 1)
    const sections = chapterSections([ch, s1, s2], ch, 1, { ...baseSettings, sceneBreakMarker: '' })
    expect(sections[2].sceneBreakBefore).toBe(true)
  })
})

describe('collectSections numbering scope', () => {
  const c1 = makeChapter('c1', 'One', '<p>1</p>')
  const c2 = makeChapter('c2', 'Two', '<p>2</p>')
  const c3 = makeChapter('c3', 'Three', '<p>3</p>')
  c1.sortOrder = 0
  c2.sortOrder = 1
  c3.sortOrder = 2
  const nodes = [c1, c2, c3]

  it('manuscript-global keeps original numbers in partial export', () => {
    const sections = collectSections(nodes, 'chapters', ['c2', 'c3'], baseSettings)
    const chapterSectionsOnly = sections.filter((s) => s.level === 'chapter')
    expect(chapterSectionsOnly[0].displayHeading).toBe('Chapter 2: Two')
    expect(chapterSectionsOnly[1].displayHeading).toBe('Chapter 3: Three')
  })

  it('export-relative renumbers partial export', () => {
    const sections = collectSections(nodes, 'chapters', ['c2', 'c3'], {
      ...baseSettings,
      chapterNumberingScope: 'export-relative'
    })
    const chapterSectionsOnly = sections.filter((s) => s.level === 'chapter')
    expect(chapterSectionsOnly[0].displayHeading).toBe('Chapter 1: Two')
    expect(chapterSectionsOnly[1].displayHeading).toBe('Chapter 2: Three')
  })
})
