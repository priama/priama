import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fse from 'fs-extra'
import { join } from 'path'
import { tmpdir } from 'os'
import { v4 as uuidv4 } from 'uuid'
import { writeFileAtomic } from './writeFileAtomic'

let dir: string

beforeEach(async () => {
  dir = join(tmpdir(), `priama-atomic-${uuidv4()}`)
  await fse.ensureDir(dir)
})

afterEach(async () => {
  await fse.remove(dir)
})

describe('writeFileAtomic', () => {
  it('writes complete content and leaves no temp file', async () => {
    const dest = join(dir, 'chapter-01.txd')
    await writeFileAtomic(dest, '{"ok":true}')

    expect(await fse.readFile(dest, 'utf-8')).toBe('{"ok":true}')
    const leftovers = (await fse.readdir(dir)).filter((name) => name.endsWith('.tmp'))
    expect(leftovers).toEqual([])
  })

  it('replaces existing content', async () => {
    const dest = join(dir, 'chapter-01.txd')
    await fse.writeFile(dest, 'old-complete', 'utf-8')
    await writeFileAtomic(dest, 'new-complete')
    expect(await fse.readFile(dest, 'utf-8')).toBe('new-complete')
  })

  it('leaves the destination unchanged if the temp write fails', async () => {
    const dest = join(dir, 'chapter-01.txd')
    await fse.writeFile(dest, 'old-complete', 'utf-8')

    const spy = vi.spyOn(fse, 'writeFile').mockRejectedValueOnce(new Error('disk full'))
    await expect(writeFileAtomic(dest, 'new-complete')).rejects.toThrow('disk full')
    spy.mockRestore()

    expect(await fse.readFile(dest, 'utf-8')).toBe('old-complete')
  })
})
