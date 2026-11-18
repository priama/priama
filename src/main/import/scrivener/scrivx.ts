import { XMLParser } from 'fast-xml-parser'

/**
 * Reader for a Scrivener 3 project's <Name>.scrivx.
 *
 * The binder is a recursive <BinderItem> tree. Two layouts are accepted:
 *
 * - What Scrivener 3 writes (checked against projects saved by Scrivener
 *   3.5.2 for macOS on 2026-11-18): root `Version="2.0"` with a `Creator` such
 *   as `SCRMAC-3.5.2-…` and no `FileFormat`; items carry a `UUID` but no `ID`;
 *   children sit under <Children>; documents are `Type="Text"`; Include in
 *   Compile is in each item's own <MetaData>; the author is a root attribute.
 *   Synopses are not in the XML (they live in Files/Data/<UUID>/synopsis.txt,
 *   read by parseScrivener.ts).
 * - The older hand-built shape: `FileFormat="3.0"`, `ID` + `UUID`, children
 *   directly inside the item, `Type="TextDocument"`, and synopsis + Include in
 *   Compile in a flat <MetaDataTable> keyed by ID, which wins when present.
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
  if (type === 'Text' || type === 'TextDocument') return 'document'
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

function binderItems(node: unknown): Record<string, unknown>[] {
  if (typeof node !== 'object' || node === null) return []
  return ((node as Record<string, unknown>)['BinderItem'] ?? []) as Record<string, unknown>[]
}

function readBinderItem(
  raw: Record<string, unknown>,
  meta: Map<string, MetaRow>
): ScrivenerBinderItem {
  const uuid = attr(raw, 'UUID')
  // Scrivener 3 writes no ID; the UUID is the item's identity.
  const id = attr(raw, 'ID') || uuid
  const row = meta.get(attr(raw, 'ID'))
  const children = [...binderItems(raw), ...binderItems(raw['Children'])]
    .filter((c) => typeof c === 'object' && c !== null)
    .map((c) => readBinderItem(c, meta))
  const ownMeta = (raw['MetaData'] as unknown[] | undefined)?.[0]
  const ownInclude = text(ownMeta, 'IncludeInCompile')

  return {
    id,
    uuid,
    type: attr(raw, 'Type'),
    title: text(raw, 'Title'),
    kind: kindForType(attr(raw, 'Type')),
    // Absent means included — that is Scrivener's own default.
    includeInCompile: row?.includeInCompile ?? ownInclude.toLowerCase() !== 'no',
    synopsis: row?.synopsis ?? '',
    children
  }
}

/**
 * The project's format, or a ScrivenerFormatError. Older files say
 * `FileFormat="3.0"`; Scrivener 3 itself writes no FileFormat, only
 * `Version="2.0"` and a `Creator` naming the app version.
 */
function readFormat(root: Record<string, unknown>): string {
  const unsupported = (major: string): ScrivenerFormatError =>
    new ScrivenerFormatError(
      `Scrivener ${major} projects are not supported yet — open the project in Scrivener 3 and save it again`
    )

  const fileFormat = attr(root, 'FileFormat')
  if (fileFormat) {
    if (!fileFormat.startsWith('3')) throw unsupported(fileFormat.split('.')[0])
    return fileFormat
  }

  const creatorMajor = /^SCR[A-Z]*-(\d+)/i.exec(attr(root, 'Creator'))?.[1]
  if (creatorMajor) {
    if (Number(creatorMajor) < 3) throw unsupported(creatorMajor)
    return attr(root, 'Version') || creatorMajor
  }

  // No Creator: Scrivener 3 is the format whose binder items carry UUIDs.
  const version = attr(root, 'Version')
  const first = binderItems(root['Binder'])[0]
  if (version.startsWith('2') && first && attr(first, 'UUID')) return version
  throw new ScrivenerFormatError('Unrecognized Scrivener project format')
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
    throw new ScrivenerFormatError('The .scrivx file is not valid XML')
  }

  const root = parsed['ScrivenerProject'] as Record<string, unknown> | undefined
  if (!root) throw new ScrivenerFormatError('Not a Scrivener project file')

  const fileFormat = readFormat(root)

  const meta = readMetaTable(root)

  const topLevel = binderItems(root['Binder'])
    .filter((c) => typeof c === 'object' && c !== null)
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
    author: (text(props, 'Author') || attr(root, 'Author')).trim(),
    draftItems,
    researchCount,
    trashCount
  }
}
