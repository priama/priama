import { basename, dirname, join, relative, resolve } from 'path'
import fse from 'fs-extra'
import type {
  FolderMeta,
  FolderScope,
  NodeType,
  TomesIndexEntry,
  TomesManifest,
  TreeNode,
  TxDFile
} from '@shared/types'
import {
  DEFAULT_FOLDER_META,
  TRASH_RETENTION_DAYS,
  TXD_EXT,
  parseMetadata,
  serializeMetadata
} from '@shared/types'
import { getNodeDir, getRecoveryDir, getWikiDir } from './paths'
import { writeFileAtomic } from './writeFileAtomic'

export interface ScanDir {
  dir: string
  itemTypes: NodeType[]
  folderScope?: FolderScope
  alias?: boolean
}

export interface ReconcileResult {
  nodes: TreeNode[]
  recovered: number
  broken: number
  quarantined: number
  indexMutated: boolean
}

export interface ReconcileContext {
  projectRoot: string
  manifest: TomesManifest
  nodeCache: Map<string, TreeNode>
}

interface ParsedTxd {
  id: string
  parentId: string | null
  type: string
  title: string
  sortOrder: number
  content: string
  metadata: string
  createdAt: string
  updatedAt: string
  deletedAt?: string | null
  originalParentId?: string | null
  categoryId?: string | null
}

interface FoundTxd {
  filePath: string
  parsed: ParsedTxd
  scanDir: ScanDir
  type: NodeType
  folderScope?: FolderScope
}

const NODE_TYPES: NodeType[] = [
  'folder',
  'chapter',
  'scene',
  'character',
  'location',
  'lore',
  'note',
  'entry'
]

const FOLDER_SCOPES: FolderScope[] = [
  'manuscript',
  'characters',
  'locations',
  'lore',
  'notes',
  'entry'
]

const INDEX_KEYS: (keyof TomesManifest['index'])[] = [
  'folders',
  'chapters',
  'scenes',
  'characters',
  'locations',
  'lore',
  'notes',
  'entries'
]

const PROCESS_RANK: Record<NodeType, number> = {
  folder: 0,
  chapter: 1,
  character: 2,
  location: 3,
  lore: 4,
  note: 5,
  entry: 6,
  scene: 7
}

function now(): string {
  return new Date().toISOString()
}

function isNodeType(value: unknown): value is NodeType {
  return typeof value === 'string' && NODE_TYPES.includes(value as NodeType)
}

function isFolderScope(value: unknown): value is FolderScope {
  return typeof value === 'string' && FOLDER_SCOPES.includes(value as FolderScope)
}

export function isSkippableTxdFilename(file: string): boolean {
  if (!file.endsWith(TXD_EXT)) return true
  if (file.startsWith('._')) return true
  return false
}

export function indexKeyForType(type: NodeType): keyof TomesManifest['index'] {
  switch (type) {
    case 'folder':
      return 'folders'
    case 'chapter':
      return 'chapters'
    case 'scene':
      return 'scenes'
    case 'character':
      return 'characters'
    case 'location':
      return 'locations'
    case 'lore':
      return 'lore'
    case 'note':
      return 'notes'
    case 'entry':
      return 'entries'
  }
}

export function folderScopeForItemType(type: NodeType): FolderScope {
  switch (type) {
    case 'character':
      return 'characters'
    case 'location':
      return 'locations'
    case 'lore':
      return 'lore'
    case 'note':
      return 'notes'
    case 'entry':
      return 'entry'
    default:
      return 'manuscript'
  }
}

export function listScanDirectories(projectRoot: string): ScanDir[] {
  return [
    { dir: getNodeDir(projectRoot, 'chapter'), itemTypes: ['chapter', 'scene'] },
    {
      dir: getNodeDir(projectRoot, 'folder', 'manuscript'),
      itemTypes: ['folder'],
      folderScope: 'manuscript'
    },
    { dir: getNodeDir(projectRoot, 'character'), itemTypes: ['character'] },
    {
      dir: getNodeDir(projectRoot, 'folder', 'characters'),
      itemTypes: ['folder'],
      folderScope: 'characters'
    },
    { dir: getNodeDir(projectRoot, 'location'), itemTypes: ['location'] },
    {
      dir: getNodeDir(projectRoot, 'folder', 'locations'),
      itemTypes: ['folder'],
      folderScope: 'locations'
    },
    { dir: getNodeDir(projectRoot, 'lore'), itemTypes: ['lore'] },
    {
      dir: getNodeDir(projectRoot, 'folder', 'lore'),
      itemTypes: ['folder'],
      folderScope: 'lore'
    },
    { dir: getNodeDir(projectRoot, 'note'), itemTypes: ['note'] },
    {
      dir: getNodeDir(projectRoot, 'folder', 'notes'),
      itemTypes: ['folder'],
      folderScope: 'notes'
    },
    { dir: getNodeDir(projectRoot, 'entry'), itemTypes: ['entry'] },
    {
      dir: getNodeDir(projectRoot, 'folder', 'entry'),
      itemTypes: ['folder'],
      folderScope: 'entry'
    },
    {
      dir: join(getWikiDir(projectRoot), 'entries', 'folders'),
      itemTypes: ['folder'],
      folderScope: 'entry',
      alias: true
    }
  ]
}

export function inferNodeType(parsedType: string, scanDir: ScanDir): NodeType | null {
  if (isNodeType(parsedType)) return parsedType
  if (scanDir.itemTypes.length === 1) return scanDir.itemTypes[0]
  return null
}

export function inferFolderScope(parsed: ParsedTxd, scanDir: ScanDir): FolderScope {
  if (scanDir.folderScope) return scanDir.folderScope
  if (scanDir.itemTypes.length === 1 && scanDir.itemTypes[0] !== 'folder') {
    return folderScopeForItemType(scanDir.itemTypes[0])
  }
  if (scanDir.itemTypes.includes('chapter') || scanDir.itemTypes.includes('scene')) {
    return 'manuscript'
  }
  const meta = parseMetadata<FolderMeta>(parsed.metadata, DEFAULT_FOLDER_META)
  if (isFolderScope(meta.scope)) return meta.scope
  return 'manuscript'
}

export function parseTxdRaw(raw: string): ParsedTxd | null {
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return null
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const o = value as Record<string, unknown>
  if (typeof o.id !== 'string' || !o.id.trim()) return null
  const timestamp = now()
  return {
    id: o.id,
    parentId: typeof o.parentId === 'string' ? o.parentId : null,
    type: typeof o.type === 'string' ? o.type : '',
    title: typeof o.title === 'string' ? o.title : '',
    sortOrder: typeof o.sortOrder === 'number' && Number.isFinite(o.sortOrder) ? o.sortOrder : 0,
    content: typeof o.content === 'string' ? o.content : '',
    metadata: typeof o.metadata === 'string' ? o.metadata : '{}',
    createdAt: typeof o.createdAt === 'string' ? o.createdAt : timestamp,
    updatedAt: typeof o.updatedAt === 'string' ? o.updatedAt : timestamp,
    deletedAt: typeof o.deletedAt === 'string' ? o.deletedAt : o.deletedAt === null ? null : undefined,
    originalParentId:
      typeof o.originalParentId === 'string'
        ? o.originalParentId
        : o.originalParentId === null
          ? null
          : undefined,
    categoryId: typeof o.categoryId === 'string' ? o.categoryId : o.categoryId === null ? null : undefined
  }
}

function trashCutoffIso(): string {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - TRASH_RETENTION_DAYS)
  return cutoff.toISOString()
}

export function isExpiredDeletedAt(deletedAt: string | null | undefined, cutoff = trashCutoffIso()): boolean {
  return Boolean(deletedAt && deletedAt < cutoff)
}

function txdToNode(txd: TxDFile, entry?: TomesIndexEntry): TreeNode {
  return {
    id: txd.id,
    parentId: txd.parentId,
    type: txd.type,
    title: txd.title,
    sortOrder: txd.sortOrder,
    content: txd.content,
    metadata: txd.metadata,
    createdAt: txd.createdAt,
    updatedAt: txd.updatedAt,
    deletedAt: txd.deletedAt ?? entry?.deletedAt ?? null,
    originalParentId: txd.originalParentId ?? entry?.originalParentId ?? null,
    categoryId: txd.categoryId ?? entry?.categoryId ?? null
  }
}

function toTxdFile(parsed: ParsedTxd, type: NodeType): TxDFile {
  return {
    id: parsed.id,
    parentId: parsed.parentId,
    type,
    title: parsed.title,
    sortOrder: parsed.sortOrder,
    content: parsed.content,
    metadata: parsed.metadata,
    createdAt: parsed.createdAt,
    updatedAt: parsed.updatedAt,
    deletedAt: parsed.deletedAt ?? null,
    originalParentId: parsed.originalParentId ?? null,
    categoryId: parsed.categoryId ?? null
  }
}

async function writeTxd(filePath: string, txd: TxDFile): Promise<void> {
  await fse.ensureDir(dirname(filePath))
  await writeFileAtomic(filePath, JSON.stringify(txd, null, 2))
}

function getFolderScopeFromNode(node: TreeNode): FolderScope {
  return parseMetadata<FolderMeta>(node.metadata, DEFAULT_FOLDER_META).scope
}

function getEntryScope(
  entry: TomesIndexEntry,
  type: NodeType,
  nodeCache: Map<string, TreeNode>
): FolderScope | undefined {
  if (type !== 'folder') return undefined
  if (entry.folderScope) return entry.folderScope
  const cached = nodeCache.get(entry.id)
  if (cached) return getFolderScopeFromNode(cached)
  return 'manuscript'
}

export function getTxdPathForEntry(
  projectRoot: string,
  entry: TomesIndexEntry,
  type: NodeType,
  nodeCache: Map<string, TreeNode>
): string {
  const scope = getEntryScope(entry, type, nodeCache)
  return join(getNodeDir(projectRoot, type, scope), entry.filename)
}

type ReadClaimable = 'absent' | 'mismatch' | 'skip' | ParsedTxd

async function readClaimableTxd(
  filePath: string,
  entryId: string,
  type: NodeType
): Promise<ReadClaimable> {
  if (!(await fse.pathExists(filePath))) return 'absent'
  try {
    const stat = await fse.stat(filePath)
    if (!stat.isFile()) return 'absent'
  } catch {
    return 'absent'
  }
  let parsed: ParsedTxd | null = null
  try {
    parsed = parseTxdRaw(await fse.readFile(filePath, 'utf-8'))
  } catch {
    return 'skip'
  }
  if (!parsed) return 'skip'
  if (parsed.id !== entryId) return 'mismatch'
  if (!isNodeType(parsed.type) || parsed.type !== type) return 'skip'
  return parsed
}

function folderScopesToProbe(entry: TomesIndexEntry): FolderScope[] {
  const preferred = isFolderScope(entry.folderScope) ? entry.folderScope : undefined
  if (!preferred) return [...FOLDER_SCOPES]
  return [preferred, ...FOLDER_SCOPES.filter((scope) => scope !== preferred)]
}

type LocatedFile =
  | { kind: 'found'; filePath: string; parsed: ParsedTxd; folderScope?: FolderScope }
  | { kind: 'broken' }
  | { kind: 'skip' }

async function locateIndexedFile(
  projectRoot: string,
  entry: TomesIndexEntry,
  type: NodeType,
  nodeCache: Map<string, TreeNode>,
  claimedPaths: Set<string>,
  claimedIds: Set<string>
): Promise<LocatedFile> {
  if (type === 'folder') {
    let preferredMismatch = false
    const preferred = isFolderScope(entry.folderScope) ? entry.folderScope : undefined
    for (const scope of folderScopesToProbe(entry)) {
      const filePath = join(getNodeDir(projectRoot, 'folder', scope), entry.filename)
      const resolved = resolve(filePath)
      if (claimedPaths.has(resolved)) continue
      const result = await readClaimableTxd(filePath, entry.id, 'folder')
      if (result === 'absent' || result === 'skip') continue
      if (result === 'mismatch') {
        if (preferred === scope) preferredMismatch = true
        continue
      }
      return { kind: 'found', filePath, parsed: result, folderScope: scope }
    }
    return preferredMismatch ? { kind: 'broken' } : { kind: 'skip' }
  }

  const filePath = getTxdPathForEntry(projectRoot, entry, type, nodeCache)
  const resolved = resolve(filePath)
  if (claimedPaths.has(resolved)) {
    return claimedIds.has(entry.id) ? { kind: 'skip' } : { kind: 'broken' }
  }
  const result = await readClaimableTxd(filePath, entry.id, type)
  if (result === 'absent' || result === 'skip') return { kind: 'skip' }
  if (result === 'mismatch') return { kind: 'broken' }
  return { kind: 'found', filePath, parsed: result }
}

function canonicalPath(projectRoot: string, type: NodeType, filename: string, folderScope?: FolderScope): string {
  return join(getNodeDir(projectRoot, type, folderScope), filename)
}

function ensureIndexArrays(manifest: TomesManifest): void {
  for (const key of INDEX_KEYS) {
    if (!manifest.index[key]) manifest.index[key] = []
  }
}

function findIndexHit(
  manifest: TomesManifest,
  id: string
): { key: keyof TomesManifest['index']; entry: TomesIndexEntry } | null {
  for (const key of INDEX_KEYS) {
    const entry = (manifest.index[key] ?? []).find((e) => e.id === id)
    if (entry) return { key, entry }
  }
  return null
}

function indexHasId(manifest: TomesManifest, id: string): boolean {
  return findIndexHit(manifest, id) !== null
}

function removeIdFromIndex(manifest: TomesManifest, id: string): boolean {
  let removed = false
  for (const key of INDEX_KEYS) {
    const before = manifest.index[key]?.length ?? 0
    manifest.index[key] = (manifest.index[key] ?? []).filter((e) => e.id !== id)
    if ((manifest.index[key]?.length ?? 0) !== before) removed = true
  }
  return removed
}

function siblingSortOrder(
  manifest: TomesManifest,
  type: NodeType,
  parentId: string | null
): number {
  const key = indexKeyForType(type)
  return (manifest.index[key] ?? []).filter(
    (e) => !e.deletedAt && (e.parentId ?? null) === parentId
  ).length
}

function alignFolderMetadata(parsed: ParsedTxd, folderScope: FolderScope): boolean {
  const meta = parseMetadata<FolderMeta>(parsed.metadata, DEFAULT_FOLDER_META)
  if (meta.scope === folderScope) return false
  parsed.metadata = serializeMetadata({ ...meta, scope: folderScope })
  return true
}

async function uniqueDestPath(destPath: string): Promise<string> {
  if (!(await fse.pathExists(destPath))) return destPath
  const dir = dirname(destPath)
  const file = basename(destPath)
  const base = file.endsWith(TXD_EXT) ? file.slice(0, -TXD_EXT.length) : file
  let n = 2
  let candidate = join(dir, `${base}-${n}${TXD_EXT}`)
  while (await fse.pathExists(candidate)) {
    n += 1
    candidate = join(dir, `${base}-${n}${TXD_EXT}`)
  }
  return candidate
}

async function relocateToCanonical(
  filePath: string,
  destPath: string
): Promise<string> {
  if (resolve(filePath) === resolve(destPath)) return destPath
  await fse.ensureDir(dirname(destPath))
  const unique = await uniqueDestPath(destPath)
  if (resolve(filePath) === resolve(unique)) return unique
  await fse.move(filePath, unique)
  return unique
}

export async function quarantineTxd(projectRoot: string, filePath: string): Promise<string | null> {
  const recoveryRoot = getRecoveryDir(projectRoot)
  let rel = relative(projectRoot, filePath)
  if (!rel || rel.startsWith('..') || rel === filePath) {
    rel = basename(filePath)
  }
  const dest = await uniqueDestPath(join(recoveryRoot, rel))
  try {
    await fse.ensureDir(dirname(dest))
    if (resolve(filePath) !== resolve(dest)) {
      await fse.move(filePath, dest)
    }
    return dest
  } catch {
    return null
  }
}

function compactIndexById(
  manifest: TomesManifest,
  nodeCache: Map<string, TreeNode>
): boolean {
  const keep = new Map<string, { key: keyof TomesManifest['index']; entry: TomesIndexEntry }>()
  let mutated = false

  for (const key of INDEX_KEYS) {
    for (const entry of manifest.index[key] ?? []) {
      const existing = keep.get(entry.id)
      if (!existing) {
        keep.set(entry.id, { key, entry })
        continue
      }
      mutated = true
      const node = nodeCache.get(entry.id)
      const preferredKey = node ? indexKeyForType(node.type) : existing.key
      if (key === preferredKey && existing.key !== preferredKey) {
        keep.set(entry.id, { key, entry })
      }
    }
  }

  if (!mutated) return false

  const grouped: Record<keyof TomesManifest['index'], TomesIndexEntry[]> = {
    folders: [],
    chapters: [],
    scenes: [],
    characters: [],
    locations: [],
    lore: [],
    notes: [],
    entries: []
  }
  for (const { key, entry } of keep.values()) {
    grouped[key].push(entry)
  }
  for (const key of INDEX_KEYS) {
    manifest.index[key] = grouped[key]
  }
  return true
}

function isKnownChapter(
  id: string,
  manifest: TomesManifest,
  nodeCache: Map<string, TreeNode>,
  pending: FoundTxd[]
): boolean {
  const cached = nodeCache.get(id)
  if (cached?.type === 'chapter') return true
  if (manifest.index.chapters.some((e) => e.id === id)) return true
  return pending.some((f) => f.parsed.id === id && f.type === 'chapter')
}

function keepParentId(
  parentId: string | null,
  manifest: TomesManifest,
  nodeCache: Map<string, TreeNode>,
  pendingIds: Set<string>
): string | null {
  if (!parentId) return null
  if (nodeCache.has(parentId) || pendingIds.has(parentId) || indexHasId(manifest, parentId)) {
    return parentId
  }
  return null
}

function buildEntry(
  txd: TxDFile,
  filename: string,
  folderScope: FolderScope | undefined,
  sortOrder: number
): TomesIndexEntry {
  return {
    id: txd.id,
    filename,
    title: txd.title,
    sortOrder,
    ...(txd.parentId ? { parentId: txd.parentId } : {}),
    ...(txd.type === 'folder' && folderScope ? { folderScope } : {}),
    ...(txd.categoryId ? { categoryId: txd.categoryId } : {}),
    ...(txd.deletedAt ? { deletedAt: txd.deletedAt } : {}),
    ...(txd.originalParentId ? { originalParentId: txd.originalParentId } : {})
  }
}

function claim(
  nodeCache: Map<string, TreeNode>,
  claimedIds: Set<string>,
  claimedPaths: Set<string>,
  node: TreeNode,
  filePath: string
): void {
  nodeCache.set(node.id, node)
  claimedIds.add(node.id)
  claimedPaths.add(resolve(filePath))
}

/**
 * Reconcile the manifest index with .txd files on disk.
 * After this returns, every recovered file is claimable via getTxdPathForEntry.
 */
export async function reconcileIndexedNodes(ctx: ReconcileContext): Promise<ReconcileResult> {
  const { projectRoot, manifest, nodeCache } = ctx
  ensureIndexArrays(manifest)

  const claimedPaths = new Set<string>()
  const claimedIds = new Set<string>()
  const brokenEntries: { indexKey: keyof TomesManifest['index']; id: string }[] = []
  let recovered = 0
  let quarantined = 0
  let indexMutated = false
  const cutoff = trashCutoffIso()

  const categories: { key: keyof TomesManifest['index']; type: NodeType }[] = [
    { key: 'folders', type: 'folder' },
    { key: 'chapters', type: 'chapter' },
    { key: 'scenes', type: 'scene' },
    { key: 'characters', type: 'character' },
    { key: 'locations', type: 'location' },
    { key: 'lore', type: 'lore' },
    { key: 'notes', type: 'note' },
    { key: 'entries', type: 'entry' }
  ]

  for (const { key, type } of categories) {
    const entries = manifest.index[key] ?? []
    for (const entry of entries) {
      if (claimedIds.has(entry.id)) continue

      const located = await locateIndexedFile(
        projectRoot,
        entry,
        type,
        nodeCache,
        claimedPaths,
        claimedIds
      )
      if (located.kind === 'broken') {
        brokenEntries.push({ indexKey: key, id: entry.id })
        continue
      }
      if (located.kind === 'skip') continue

      if (type === 'folder' && located.folderScope && entry.folderScope !== located.folderScope) {
        entry.folderScope = located.folderScope
        indexMutated = true
      }

      const txd = toTxdFile(located.parsed, type)
      claim(nodeCache, claimedIds, claimedPaths, txdToNode(txd, entry), located.filePath)
    }
  }

  const found: FoundTxd[] = []
  for (const scanDir of listScanDirectories(projectRoot)) {
    if (!(await fse.pathExists(scanDir.dir))) continue
    const files = await fse.readdir(scanDir.dir)
    for (const file of files) {
      if (isSkippableTxdFilename(file)) continue
      const filePath = join(scanDir.dir, file)
      if (claimedPaths.has(resolve(filePath))) continue
      try {
        const stat = await fse.stat(filePath)
        if (!stat.isFile()) continue
      } catch {
        continue
      }

      let parsed: ParsedTxd | null = null
      try {
        parsed = parseTxdRaw(await fse.readFile(filePath, 'utf-8'))
      } catch {
        continue
      }
      if (!parsed) continue

      const type = inferNodeType(parsed.type, scanDir)
      if (!type) {
        const moved = await quarantineTxd(projectRoot, filePath)
        if (moved) {
          claimedPaths.add(resolve(filePath))
          quarantined += 1
        }
        continue
      }

      const folderScope = type === 'folder' ? inferFolderScope(parsed, scanDir) : undefined
      found.push({ filePath, parsed, scanDir, type, folderScope })
    }
  }

  const pendingIds = new Set(found.map((f) => f.parsed.id))
  found.sort((a, b) => {
    const rank = PROCESS_RANK[a.type] - PROCESS_RANK[b.type]
    if (rank !== 0) return rank
    const aCanon = Number(
      resolve(dirname(a.filePath)) === resolve(getNodeDir(projectRoot, a.type, a.folderScope))
    )
    const bCanon = Number(
      resolve(dirname(b.filePath)) === resolve(getNodeDir(projectRoot, b.type, b.folderScope))
    )
    if (aCanon !== bCanon) return bCanon - aCanon
    return a.filePath.localeCompare(b.filePath)
  })

  for (const item of found) {
    if (claimedPaths.has(resolve(item.filePath))) continue
    if (!(await fse.pathExists(item.filePath))) continue

    if (isExpiredDeletedAt(item.parsed.deletedAt, cutoff)) {
      await fse.remove(item.filePath).catch(() => {})
      if (removeIdFromIndex(manifest, item.parsed.id)) indexMutated = true
      nodeCache.delete(item.parsed.id)
      claimedPaths.add(resolve(item.filePath))
      continue
    }

    if (claimedIds.has(item.parsed.id)) {
      const moved = await quarantineTxd(projectRoot, item.filePath)
      if (moved) quarantined += 1
      claimedPaths.add(resolve(item.filePath))
      continue
    }

    const parsed = { ...item.parsed }
    if (item.type === 'folder' && item.folderScope) {
      alignFolderMetadata(parsed, item.folderScope)
    }

    let parentId = keepParentId(parsed.parentId, manifest, nodeCache, pendingIds)
    let trashOrphanScene = false
    if (item.type === 'scene') {
      const chapterOk = parsed.parentId
        ? isKnownChapter(parsed.parentId, manifest, nodeCache, found)
        : false
      if (!chapterOk) {
        trashOrphanScene = true
        parsed.originalParentId = parsed.originalParentId ?? parsed.parentId
        parsed.deletedAt = parsed.deletedAt ?? now()
      }
    } else {
      parsed.parentId = parentId
    }

    if (trashOrphanScene && isExpiredDeletedAt(parsed.deletedAt, cutoff)) {
      await fse.remove(item.filePath).catch(() => {})
      if (removeIdFromIndex(manifest, parsed.id)) indexMutated = true
      claimedPaths.add(resolve(item.filePath))
      continue
    }

    const preferredName = basename(item.filePath)
    let destPath = canonicalPath(projectRoot, item.type, preferredName, item.folderScope)

    try {
      destPath = await relocateToCanonical(item.filePath, destPath)
    } catch {
      const moved = await quarantineTxd(projectRoot, item.filePath)
      if (moved) quarantined += 1
      claimedPaths.add(resolve(item.filePath))
      continue
    }

    const filename = basename(destPath)
    const expected = canonicalPath(projectRoot, item.type, filename, item.folderScope)
    if (resolve(destPath) !== resolve(expected)) {
      const moved = await quarantineTxd(projectRoot, destPath)
      if (moved) quarantined += 1
      claimedPaths.add(resolve(item.filePath))
      claimedPaths.add(resolve(destPath))
      continue
    }

    parsed.type = item.type
    const txd = toTxdFile(parsed, item.type)
    const existing = findIndexHit(manifest, txd.id)
    const indexKey = indexKeyForType(item.type)
    const sortOrder = existing
      ? existing.entry.sortOrder
      : siblingSortOrder(manifest, item.type, txd.parentId)
    const isNewId = !existing

    if (existing) {
      if (existing.key !== indexKey) {
        removeIdFromIndex(manifest, txd.id)
        const entry = buildEntry(txd, filename, item.folderScope, sortOrder)
        manifest.index[indexKey].push(entry)
        claim(nodeCache, claimedIds, claimedPaths, txdToNode(txd, entry), destPath)
      } else {
        existing.entry.filename = filename
        existing.entry.title = txd.title
        existing.entry.parentId = txd.parentId
        if (item.folderScope) existing.entry.folderScope = item.folderScope
        if (txd.categoryId) existing.entry.categoryId = txd.categoryId
        if (txd.deletedAt) existing.entry.deletedAt = txd.deletedAt
        else delete existing.entry.deletedAt
        if (txd.originalParentId) existing.entry.originalParentId = txd.originalParentId
        else delete existing.entry.originalParentId
        claim(nodeCache, claimedIds, claimedPaths, txdToNode(txd, existing.entry), destPath)
      }
    } else {
      const entry = buildEntry(
        txd,
        filename,
        item.folderScope,
        trashOrphanScene ? txd.sortOrder : sortOrder
      )
      if (trashOrphanScene && txd.deletedAt) entry.deletedAt = txd.deletedAt
      manifest.index[indexKey].push(entry)
      claim(nodeCache, claimedIds, claimedPaths, txdToNode(txd, entry), destPath)
    }

    await writeTxd(destPath, txd)
    claimedPaths.add(resolve(item.filePath))
    if (isNewId) recovered += 1
    indexMutated = true
  }

  for (const { indexKey, id } of brokenEntries) {
    if (claimedIds.has(id)) continue
    const before = manifest.index[indexKey].length
    manifest.index[indexKey] = manifest.index[indexKey].filter((e) => e.id !== id)
    if (manifest.index[indexKey].length !== before) indexMutated = true
  }

  if (compactIndexById(manifest, nodeCache)) indexMutated = true

  const broken = brokenEntries.filter((b) => !claimedIds.has(b.id)).length
  return {
    nodes: Array.from(nodeCache.values()),
    recovered,
    broken,
    quarantined,
    indexMutated
  }
}
