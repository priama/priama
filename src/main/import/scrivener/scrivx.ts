import { XMLParser } from 'fast-xml-parser'

/**
 * Reader for Scrivener 3's project.scrivx.
 *
 * The binder is a recursive <BinderItem> tree (Type: DraftFolder, Folder,
 * TextDocument, ResearchFolder, TrashFolder, ...). Per-document metadata —
 * synopsis and the Include-in-Compile flag — lives in a flat <MetaDataTable>
 * keyed by binder ID.
 */

export type ScrivenerItemKind = 'folder' | 'document' | 'other'

export interface ScrivenerBinderItem {
  id: string
  uuid: string
  type: string
  title: string
  kind: ScrivenerItemKind
  includeInCompile: boolean
  synopsis: string
  children: ScrivenerBinderItem[]
}

export interface ScrivenerProjectInfo {
  fileFormat: string
  title: string
  author: string
  /** Children of the Draft folder, in binder order. */
  draftItems: ScrivenerBinderItem[]
  /** Documents inside Research/Trash (never imported, counted for the preview). */
  researchCount: number
  trashCount: number
}

export class ScrivenerFormatError extends Error {}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  // Titles/synopses must stay strings even when they look numeric.
  parseTagValue: false,
  trimValues: false,
  isArray: (name) => name === 'BinderItem' || name === 'MetaData'
})

function attr(node: unknown, name: string): string {
  if (typeof node !== 'object' || node === null) return ''
  const value = (node as Record<string, unknown>)[`@_${name}`]
  return typeof value === 'string' ? value : value != null ? String(value) : ''
}

function text(node: unknown, tag: string): string {
  if (typeof node !== 'object' || node === null) return ''
  const value = (node as Record<string, unknown>)[tag]
  if (typeof value === 'string') return value
  if (value != null && typeof value === 'object') return text(value, '#text')
  return ''
}

function kindForType(type: string): ScrivenerItemKind {
  if (type === 'TextDocument') return 'document'
  if (type === 'Folder' || type === 'DraftFolder' || type === 'ResearchFolder') return 'folder'
  return 'other'
}

interface MetaRow {
  synopsis: string
  includeInCompile: boolean
}

function readMetaTable(root: Record<string, unknown>): Map<string, MetaRow> {
  const table = new Map<string, MetaRow>()
  const metaTable = root['MetaDataTable'] as Record<string, unknown> | undefined
  const rows = (metaTable?.['MetaData'] ?? []) as unknown[]
  for (const row of rows) {
    if (typeof row !== 'object' || row === null) continue
    const id = attr(row, 'ID')
    if (!id) continue
    const includeRaw = text(row, 'IncludeInCompile')
    table.set(id, {
      synopsis: text(row, 'Synopsis').trim(),
      // Absent means included — that is Scrivener's own default.
      includeInCompile: includeRaw === '' || includeRaw.toLowerCase() !== 'no'
    })
  }
  return table
}

function readBinderItem(
  raw: Record<string, unknown>,
  meta: Map<string, MetaRow>
): ScrivenerBinderItem {
  const id = attr(raw, 'ID')
  const row = meta.get(id)
  const children = ((raw['BinderItem'] ?? []) as unknown[])
    .filter((c): c is Record<string, unknown> => typeof c === 'object' && c !== null)
    .map((c) => readBinderItem(c, meta))

  return {
    id,
    uuid: attr(raw, 'UUID'),
    type: attr(raw, 'Type'),
    title: text(raw, 'Title'),
    kind: kindForType(attr(raw, 'Type')),
    includeInCompile: row?.includeInCompile ?? true,
    synopsis: row?.synopsis ?? '',
    children
  }
}

function countDocuments(items: ScrivenerBinderItem[]): number {
  let n = 0
  for (const item of items) {
    if (item.kind === 'document') n += 1
    n += countDocuments(item.children)
  }
  return n
}

export function parseScrivx(xml: string): ScrivenerProjectInfo {
  let parsed: Record<string, unknown>
  try {
    parsed = parser.parse(xml) as Record<string, unknown>
  } catch {
    throw new ScrivenerFormatError('project.scrivx is not valid XML')
  }

  const root = parsed['ScrivenerProject'] as Record<string, unknown> | undefined
  if (!root) throw new ScrivenerFormatError('Not a Scrivener project file')

  const fileFormat = attr(root, 'FileFormat')
  if (!fileFormat.startsWith('3')) {
    throw new ScrivenerFormatError(
      fileFormat
        ? `Scrivener ${fileFormat.split('.')[0]} projects are not supported yet — open the project in Scrivener 3 and save it again`
        : 'Unrecognized Scrivener project format'
    )
  }

  const meta = readMetaTable(root)

  const binder = root['Binder'] as Record<string, unknown> | undefined
  const topLevel = ((binder?.['BinderItem'] ?? []) as unknown[])
    .filter((c): c is Record<string, unknown> => typeof c === 'object' && c !== null)
    .map((c) => readBinderItem(c, meta))

  let researchCount = 0
  let trashCount = 0
  const draftItems: ScrivenerBinderItem[] = []

  for (const item of topLevel) {
    if (item.type === 'ResearchFolder') {
      researchCount += countDocuments(item.children)
      continue
    }
    if (item.type === 'TrashFolder') {
      trashCount += countDocuments(item.children)
      continue
    }
    if (item.type === 'DraftFolder') {
      draftItems.push(...item.children)
      continue
    }
    // Some projects keep loose items at the top level; treat like draft content.
    draftItems.push(item)
  }

  const props = root['ProjectProperties'] as Record<string, unknown> | undefined

  return {
    fileFormat,
    title: text(props, 'Title').trim(),
    author: text(props, 'Author').trim(),
    draftItems,
    researchCount,
    trashCount
  }
}
