import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, writeFile, mkdir } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import archiver from 'archiver'
import { createWriteStream } from 'fs'
import { parseScrivenerPath } from './parseScrivener'

const SCRIVX = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<ScrivenerProject FileFormat="3.0" ModDate="2026-11-13 09:00:00 +0000">
  <Binder>
    <BinderItem ID="1" UUID="UUID-DRAFT" Type="DraftFolder">
      <Title>Manuscript</Title>
      <BinderItem ID="5" UUID="UUID-CH1" Type="Folder">
        <Title>Chapter One</Title>
        <BinderItem ID="6" UUID="UUID-SA" Type="TextDocument">
          <Title>Scene A</Title>
        </BinderItem>
        <BinderItem ID="7" UUID="UUID-SB" Type="TextDocument">
          <Title>Scene B</Title>
        </BinderItem>
      </BinderItem>
      <BinderItem ID="8" UUID="UUID-LOOSE" Type="TextDocument">
        <Title>Loose Doc</Title>
      </BinderItem>
      <BinderItem ID="9" UUID="UUID-SKIP" Type="TextDocument">
        <Title>Excluded Doc</Title>
      </BinderItem>
    </BinderItem>
    <BinderItem ID="2" UUID="UUID-RES" Type="ResearchFolder">
      <Title>Research</Title>
      <BinderItem ID="11" UUID="UUID-R1" Type="TextDocument">
        <Title>Research Note</Title>
      </BinderItem>
    </BinderItem>
  </Binder>
  <ProjectProperties>
    <Title>Fixture Novel</Title>
    <Author>Fixture Author</Author>
  </ProjectProperties>
  <MetaDataTable>
    <MetaData ID="5" Type="Folder">
      <Synopsis>Chapter one synopsis.</Synopsis>
      <IncludeInCompile>Yes</IncludeInCompile>
    </MetaData>
    <MetaData ID="9" Type="TextDocument">
      <IncludeInCompile>No</IncludeInCompile>
    </MetaData>
  </MetaDataTable>
</ScrivenerProject>`

function rtf(body: string): string {
  return `{\\rtf1\\ansi\\ansicpg1252\\uc1\\deff0{\\fonttbl{\\f0 Georgia;}}${body}}`
}

let root: string

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'priama-scriv-'))
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

async function writeBundle(): Promise<string> {
  const bundle = join(root, 'Fixture Novel.scriv')
  await mkdir(join(bundle, 'Files', 'Data'), { recursive: true })
  await writeFile(join(bundle, 'project.scrivx'), SCRIVX, 'utf8')
  // Scrivener 3 names RTFs by UUID; Scene B exercises the numeric-ID fallback.
  await writeFile(join(bundle, 'Files', 'Data', 'UUID-SA.rtf'), rtf('{\\pard\\plain Scene \\b one\\b0  text.\\par}'), 'utf8')
  await writeFile(join(bundle, 'Files', 'Data', '7.rtf'), rtf('{\\pard\\plain Scene B via ID.\\par}'), 'utf8')
  await writeFile(join(bundle, 'Files', 'Data', 'UUID-CH1.rtf'), rtf('{\\pard\\plain Chapter intro.\\par}'), 'utf8')
  // Loose Doc has no RTF on disk (never edited).
  return bundle
}

describe('parseScrivenerPath', () => {
  it('flattens the draft binder into preview rows with depth and synopses', async () => {
    const parsed = await parseScrivenerPath(await writeBundle())

    expect(parsed.suggestedTitle).toBe('Fixture Novel')
    expect(parsed.suggestedAuthor).toBe('Fixture Author')
    expect(parsed.fileName).toBe('Fixture Novel')

    expect(parsed.rows.map((r) => [r.title, r.kind, r.depth])).toEqual([
      ['Chapter One', 'folder', 0],
      ['Scene A', 'document', 1],
      ['Scene B', 'document', 1],
      ['Loose Doc', 'document', 0],
      ['Excluded Doc', 'document', 0]
    ])

    const [chapter, sceneA, sceneB, loose, excluded] = parsed.rows
    expect(chapter.synopsis).toBe('Chapter one synopsis.')
    expect(chapter.html).toBe('<p>Chapter intro.</p>')
    expect(sceneA.html).toBe('<p>Scene <strong>one</strong> text.</p>')
    expect(sceneB.html).toBe('<p>Scene B via ID.</p>')
    expect(loose.html).toBe('')
    expect(excluded.includeInCompile).toBe(false)
    expect(sceneA.includeInCompile).toBe(true)

    expect(parsed.stats).toEqual({
      folders: 1,
      documents: 4,
      researchSkipped: 1,
      compileExcluded: 1
    })
  })

  it('reads a zipped project the same way', async () => {
    const bundle = await writeBundle()
    const zipPath = join(root, 'fixture.zip')

    await new Promise<void>((res, rej) => {
      const archive = archiver('zip')
      const out = createWriteStream(zipPath)
      archive.pipe(out)
      out.on('close', res)
      archive.on('error', rej)
      archive.directory(bundle, 'Fixture Novel.scriv')
      void archive.finalize()
    })

    const parsed = await parseScrivenerPath(zipPath)
    // The zip nests everything under the bundle folder; parse still finds it.
    expect(parsed.rows.length).toBe(5)
    expect(parsed.suggestedTitle).toBe('Fixture Novel')
  })

  it('rejects a directory without project.scrivx', async () => {
    await mkdir(join(root, 'empty.scriv'), { recursive: true })
    await expect(parseScrivenerPath(join(root, 'empty.scriv'))).rejects.toThrow(/not a Scrivener project/)
  })

  it('rejects Scrivener 2 bundles', async () => {
    const bundle = join(root, 'old.scriv')
    await mkdir(bundle, { recursive: true })
    await writeFile(join(bundle, 'project.scrivx'), SCRIVX.replace('FileFormat="3.0"', 'FileFormat="2.0"'), 'utf8')
    await expect(parseScrivenerPath(bundle)).rejects.toThrow(/Scrivener 2/)
  })

  it('rejects an empty draft', async () => {
    const bundle = join(root, 'blank.scriv')
    await mkdir(bundle, { recursive: true })
    await writeFile(
      join(bundle, 'project.scrivx'),
      `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<ScrivenerProject FileFormat="3.0">
  <Binder>
    <BinderItem ID="1" UUID="D" Type="DraftFolder"><Title>Manuscript</Title></BinderItem>
  </Binder>
  <ProjectProperties><Title></Title><Author></Author></ProjectProperties>
  <MetaDataTable></MetaDataTable>
</ScrivenerProject>`,
      'utf8'
    )
    await expect(parseScrivenerPath(bundle)).rejects.toThrow(/empty/)
  })
})
