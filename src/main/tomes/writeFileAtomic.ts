import { randomUUID } from 'node:crypto'
import { open } from 'node:fs/promises'
import { dirname } from 'node:path'
import fse from 'fs-extra'

/**
 * Serialize writes per destination. A temp file shared between two concurrent
 * writers is written from offset 0 by both, so the shorter write leaves the
 * longer one's tail behind and the spliced result gets renamed into place.
 */
const writeChains = new Map<string, Promise<void>>()

async function writeOnce(filePath: string, content: string): Promise<void> {
  // Unique per write: an attempt that dies before rename must never be
  // adopted by the next one.
  const tempPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`

  try {
    await fse.writeFile(tempPath, content, 'utf-8')

    // rename is atomic for the directory entry, but without this the data
    // itself may not have reached disk: a crash can leave the destination
    // zero-length or holding stale blocks.
    const handle = await open(tempPath, 'r+')
    try {
      await handle.sync()
    } finally {
      await handle.close()
    }

    await fse.rename(tempPath, filePath)
  } catch (err) {
    await fse.remove(tempPath).catch(() => {})
    throw err
  }

  // Flush the directory entry too, so the rename survives power loss.
  // Not supported on every platform, so a failure here is not fatal.
  try {
    const dir = await open(dirname(filePath), 'r')
    try {
      await dir.sync()
    } finally {
      await dir.close()
    }
  } catch {
    // Windows cannot fsync a directory handle; the rename is still durable there.
  }
}

/** Write a sibling temp file, then rename over the destination so readers never see a truncated file. */
export async function writeFileAtomic(filePath: string, content: string): Promise<void> {
  const previous = writeChains.get(filePath) ?? Promise.resolve()
  const run = previous.catch(() => undefined).then(() => writeOnce(filePath, content))
  const settled = run.then(
    () => undefined,
    () => undefined
  )

  writeChains.set(filePath, settled)

  try {
    await run
  } finally {
    // Drop the entry once nothing newer has queued behind this write, so the
    // map does not grow for the life of the process.
    if (writeChains.get(filePath) === settled) writeChains.delete(filePath)
  }
}
