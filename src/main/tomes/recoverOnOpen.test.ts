import { describe, expect, it } from 'vitest'
import { join } from 'path'
import {
  inferFolderScope,
  inferNodeType,
  isExpiredDeletedAt,
  isSkippableTxdFilename,
  listScanDirectories,
  parseTxdRaw
} from './recoverOnOpen'
import { getNodeDir, getWikiDir } from './paths'

describe('recoverOnOpen helpers', () => {
  it('lists canonical dirs from getNodeDir plus the entries/folders alias', () => {
    const root = '/tmp/book'
    const dirs = listScanDirectories(root)
    expect(dirs.map((d) => d.dir)).toContain(getNodeDir(root, 'chapter'))
    expect(dirs.map((d) => d.dir)).toContain(getNodeDir(root, 'folder', 'entry'))
    expect(dirs.map((d) => d.dir)).toContain(join(getWikiDir(root), 'entries', 'folders'))
    expect(dirs.filter((d) => d.alias)).toHaveLength(1)
    expect(dirs.some((d) => d.dir === join(getWikiDir(root), 'entries', 'folders') && !d.alias)).toBe(
      false
    )
  })

  it('skips AppleDouble and non-txd names', () => {
    expect(isSkippableTxdFilename('chapter-01.txd')).toBe(false)
    expect(isSkippableTxdFilename('._chapter-01.txd')).toBe(true)
    expect(isSkippableTxdFilename('chapter-01.txt')).toBe(true)
  })

  it('parses a txd object and rejects junk', () => {
    expect(parseTxdRaw('not json')).toBeNull()
    expect(parseTxdRaw('[]')).toBeNull()
    expect(parseTxdRaw('{"title":"x"}')).toBeNull()
    const parsed = parseTxdRaw(JSON.stringify({ id: 'abc', type: 'chapter', title: 'Hi' }))
    expect(parsed?.id).toBe('abc')
    expect(parsed?.type).toBe('chapter')
    expect(parsed?.title).toBe('Hi')
  })

  it('trusts a valid type and infers from a single-type folder', () => {
    const notes = { dir: '/n', itemTypes: ['note' as const] }
    const manuscript = { dir: '/m', itemTypes: ['chapter' as const, 'scene' as const] }
    expect(inferNodeType('chapter', notes)).toBe('chapter')
    expect(inferNodeType('nope', notes)).toBe('note')
    expect(inferNodeType('nope', manuscript)).toBeNull()
  })

  it('infers folder scope from the scan dir', () => {
    const parsed = {
      id: 'f',
      parentId: null,
      type: 'folder',
      title: 'F',
      sortOrder: 0,
      content: '',
      metadata: '{}',
      createdAt: '',
      updatedAt: ''
    }
    expect(
      inferFolderScope(parsed, { dir: '/x', itemTypes: ['folder'], folderScope: 'characters' })
    ).toBe('characters')
    expect(inferFolderScope(parsed, { dir: '/x', itemTypes: ['note'] })).toBe('notes')
    expect(inferFolderScope(parsed, { dir: '/x', itemTypes: ['chapter', 'scene'] })).toBe(
      'manuscript'
    )
  })

  it('treats deletedAt older than the cutoff as expired', () => {
    const cutoff = '2026-01-01T00:00:00.000Z'
    expect(isExpiredDeletedAt('2025-01-01T00:00:00.000Z', cutoff)).toBe(true)
    expect(isExpiredDeletedAt('2026-06-01T00:00:00.000Z', cutoff)).toBe(false)
    expect(isExpiredDeletedAt(null, cutoff)).toBe(false)
  })
})
