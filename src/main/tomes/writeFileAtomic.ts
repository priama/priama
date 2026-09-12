import fse from 'fs-extra'

/** Write a sibling temp file, then rename over the destination so readers never see a truncated file. */
export async function writeFileAtomic(filePath: string, content: string): Promise<void> {
  const tempPath = `${filePath}.${process.pid}.tmp`
  await fse.writeFile(tempPath, content, 'utf-8')
  await fse.rename(tempPath, filePath)
}
