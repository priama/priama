import type {
  BookSettings,
  ChapterMeta,
  ExportSection,
  FolderMeta,
  ManuscriptChapterRef,
  TreeNode
} from '../types'
import { DEFAULT_CHAPTER_META, DEFAULT_FOLDER_META, parseMetadata } from '../types'

const NUMBER_WORDS = [
  'Zero',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
  'Twenty',
  'Twenty-One',
  'Twenty-Two',
  'Twenty-Three',
  'Twenty-Four',
  'Twenty-Five',
  'Twenty-Six',
  'Twenty-Seven',
  'Twenty-Eight',
  'Twenty-Nine',
  'Thirty',
  'Thirty-One',
  'Thirty-Two',
  'Thirty-Three',
  'Thirty-Four',
  'Thirty-Five',
  'Thirty-Six',
  'Thirty-Seven',
  'Thirty-Eight',
  'Thirty-Nine',
  'Forty',
  'Forty-One',
  'Forty-Two',
  'Forty-Three',
  'Forty-Four',
  'Forty-Five',
  'Forty-Six',
  'Forty-Seven',
  'Forty-Eight',
  'Forty-Nine',
  'Fifty'
]

function numberToWords(n: number): string {
  if (n >= 0 && n < NUMBER_WORDS.length) return NUMBER_WORDS[n]
  return String(n)
}

function numberToRoman(n: number): string {
  if (n <= 0 || n > 3999) return String(n)

  const values = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1]
  const symbols = ['M', 'CM', 'D', 'CD', 'C', 'XC', 'L', 'XL', 'X', 'IX', 'V', 'IV', 'I']

  let result = ''
  let remaining = n

  for (let i = 0; i < values.length; i++) {
    while (remaining >= values[i]) {
      result += symbols[i]
      remaining -= values[i]
    }
  }

  return result
}

export function formatChapterLabel(
  chapterNumber: number,
  title: string,
  settings: BookSettings
): string | null {
  if (settings.chapterLabelStyle === 'none') return null
  if (settings.chapterLabelStyle === 'title-only') return title

  const number =
    settings.chapterNumberFormat === 'words'
      ? numberToWords(chapterNumber)
      : settings.chapterNumberFormat === 'roman'
        ? numberToRoman(chapterNumber)
        : String(chapterNumber)
  const numbered = `${settings.chapterLabelPrefix} ${number}`.trim()

  if (settings.chapterLabelStyle === 'number-only') return numbered
  return title ? `${numbered}: ${title}` : numbered
}

export function resolveChapterNumber(
  ref: ManuscriptChapterRef,
  allChapters: ManuscriptChapterRef[],
  exportIndex: number,
  settings: BookSettings
): number {
  if (settings.chapterNumberingScope === 'export-relative') {
    return exportIndex + 1
  }
  return allChapters.findIndex((c) => c.id === ref.id) + 1
}

function isActive(node: TreeNode): boolean {
  return !node.deletedAt
}

function getFolderScope(node: TreeNode): string | null {
  if (node.type !== 'folder') return null
  const meta = parseMetadata<FolderMeta>(node.metadata, DEFAULT_FOLDER_META)
  return meta.scope
}

function isSimpleChapter(node: TreeNode): boolean {
  const meta = parseMetadata<ChapterMeta>(node.metadata, DEFAULT_CHAPTER_META)
  return node.type === 'chapter' && meta.structure === 'simple'
}

function isChapterFolder(node: TreeNode): boolean {
  if (node.type !== 'chapter') return false
  const meta = parseMetadata<ChapterMeta>(node.metadata, DEFAULT_CHAPTER_META)
  return meta.structure === 'scenes'
}

function getManuscriptChildren(nodes: TreeNode[], parentId: string | null): TreeNode[] {
  return nodes
    .filter((n) => {
      if (!isActive(n)) return false
      if ((n.parentId ?? null) !== parentId) return false
      if (n.type === 'folder') return getFolderScope(n) === 'manuscript'
      return n.type === 'chapter'
    })
    .sort((a, b) => a.sortOrder - b.sortOrder)
}

function getScenes(nodes: TreeNode[], chapterId: string): TreeNode[] {
  return nodes
    .filter((n) => isActive(n) && n.parentId === chapterId && n.type === 'scene')
    .sort((a, b) => a.sortOrder - b.sortOrder)
}

function chapterHeaderSection(
  chapter: TreeNode,
  chapterNumber: number,
  settings: BookSettings
): ExportSection {
  return {
    id: chapter.id,
    title: chapter.title,
    level: 'chapter',
    html: '',
    displayHeading: formatChapterLabel(chapterNumber, chapter.title, settings)
  }
}

export function chapterSections(
  nodes: TreeNode[],
  chapter: TreeNode,
  chapterNumber: number,
  settings: BookSettings
): ExportSection[] {
  if (isSimpleChapter(chapter)) {
    return [
      {
        id: chapter.id,
        title: chapter.title,
        level: 'chapter',
        html: chapter.content,
        displayHeading: formatChapterLabel(chapterNumber, chapter.title, settings)
      }
    ]
  }

  if (isChapterFolder(chapter)) {
    const scenes = getScenes(nodes, chapter.id)
    const header = chapterHeaderSection(chapter, chapterNumber, settings)

    if (scenes.length === 0) {
      return [header]
    }

    if (settings.showSceneTitles) {
      return [
        header,
        ...scenes.map((scene) => ({
          id: scene.id,
          title: scene.title,
          level: 'scene' as const,
          html: scene.content,
          displayHeading: scene.title
        }))
      ]
    }

    return [
      header,
      ...scenes.map((scene, index) => ({
        id: scene.id,
        title: scene.title,
        level: 'scene' as const,
        html: scene.content,
        displayHeading: null,
        sceneBreakBefore: index > 0
      }))
    ]
  }

  return []
}

function collectChaptersDepthFirst(
  nodes: TreeNode[],
  parentId: string | null,
  pathPrefix: string,
  out: ManuscriptChapterRef[]
): void {
  for (const child of getManuscriptChildren(nodes, parentId)) {
    if (child.type === 'folder') {
      const nextPrefix = pathPrefix ? `${pathPrefix} / ${child.title}` : child.title
      collectChaptersDepthFirst(nodes, child.id, nextPrefix, out)
      continue
    }
    if (child.type === 'chapter') {
      out.push({
        id: child.id,
        title: child.title,
        pathLabel: pathPrefix ? `${pathPrefix} / ${child.title}` : child.title
      })
    }
  }
}

export function listManuscriptChapters(nodes: TreeNode[]): ManuscriptChapterRef[] {
  const out: ManuscriptChapterRef[] = []
  collectChaptersDepthFirst(nodes, null, '', out)
  return out
}

export function resolveChapterId(nodes: TreeNode[], nodeId: string | null | undefined): string | null {
  if (!nodeId) return null
  const node = nodes.find((n) => n.id === nodeId && isActive(n))
  if (!node) return null
  if (node.type === 'chapter') return node.id
  if (node.type === 'scene' && node.parentId) return node.parentId
  return null
}

function sectionsForChapterRefs(
  nodes: TreeNode[],
  refs: ManuscriptChapterRef[],
  allChapters: ManuscriptChapterRef[],
  settings: BookSettings
): ExportSection[] {
  const sections: ExportSection[] = []
  refs.forEach((ref, exportIndex) => {
    const chapter = nodes.find((n) => n.id === ref.id && isActive(n))
    if (!chapter || chapter.type !== 'chapter') return
    const chapterNumber = resolveChapterNumber(ref, allChapters, exportIndex, settings)
    sections.push(...chapterSections(nodes, chapter, chapterNumber, settings))
  })
  return sections
}

export function collectSections(
  nodes: TreeNode[],
  scope: 'chapters' | 'manuscript',
  chapterIds: string[] | undefined,
  settings: BookSettings
): ExportSection[] {
  const allChapters = listManuscriptChapters(nodes)

  if (scope === 'manuscript') {
    return sectionsForChapterRefs(nodes, allChapters, allChapters, settings)
  }

  const selected = new Set(chapterIds ?? [])
  const refs = allChapters.filter((ref) => selected.has(ref.id))
  return sectionsForChapterRefs(nodes, refs, allChapters, settings)
}

export function hasExportableContent(sections: ExportSection[]): boolean {
  return sections.some((s) => s.title.trim() || s.html.replace(/<[^>]*>/g, '').trim())
}
