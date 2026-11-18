import { describe, expect, it } from 'vitest'
import { buildImportedTree, includedWordCount } from './buildImportedTree'
import type { ScrivenerImportRow } from '../types'

function row(
  partial: Pick<ScrivenerImportRow, 'id' | 'title' | 'kind' | 'depth'> &
    Partial<ScrivenerImportRow>
): ScrivenerImportRow {
  return { html: '<p>x</p>', synopsis: '', includeInCompile: true, ...partial }
}

const ROWS: ScrivenerImportRow[] = [
  row({ id: 'ch1', title: 'Chapter One', kind: 'folder', depth: 0, synopsis: 'Starts here' }),
  row({ id: 'sa', title: 'Scene A', kind: 'document', depth: 1 }),
  row({ id: 'sb', title: 'Scene B', kind: 'document', depth: 1 }),
  row({ id: 'loose', title: 'Loose Doc', kind: 'document', depth: 0 })
]

describe('buildImportedTree', () => {
  it('nests scene documents under their folder', () => {
    const tree = buildImportedTree(ROWS, [true, true, true, true])
    expect(tree).toHaveLength(2)
    expect(tree[0].title).toBe('Chapter One')
    expect(tree[0].synopsis).toBe('Starts here')
    expect(tree[0].children?.map((c) => c.title)).toEqual(['Scene A', 'Scene B'])
    expect(tree[1]).toMatchObject({ title: 'Loose Doc', children: undefined })
  })

  it('drops an unchecked folder along with its scenes', () => {
    const tree = buildImportedTree(ROWS, [false, true, true, true])
    expect(tree.map((n) => n.title)).toEqual(['Loose Doc'])
  })

  it('keeps the folder but skips an unchecked scene', () => {
    const tree = buildImportedTree(ROWS, [true, false, true, true])
    expect(tree[0].children?.map((c) => c.title)).toEqual(['Scene B'])
  })

  it('drops everything when nothing is checked', () => {
    expect(buildImportedTree(ROWS, [false, false, false, false])).toEqual([])
  })
})

describe('includedWordCount', () => {
  it('keeps the running total across unchecked rows', () => {
    const rows = [
      row({ id: '1', title: 'A', kind: 'document', depth: 0, html: '<p>one two</p>' }),
      row({ id: '2', title: 'B', kind: 'document', depth: 0, html: '<p>three four five</p>' }),
      row({ id: '3', title: 'C', kind: 'document', depth: 0, html: '<p>six</p>' })
    ]
    expect(includedWordCount(rows, [true, false, true])).toBe(3)
    expect(includedWordCount(rows, [true, true, false])).toBe(5)
    expect(includedWordCount(rows, [false, false, false])).toBe(0)
  })
})
