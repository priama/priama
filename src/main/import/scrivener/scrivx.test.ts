import { describe, expect, it } from 'vitest'
import { parseScrivx, ScrivenerFormatError } from './scrivx'

/** The older hand-built shape (FileFormat, ID + UUID, MetaDataTable). Still accepted. */
function scrivx(overrides: {
  fileFormat?: string
  title?: string
  author?: string
  binder?: string
  meta?: string
} = {}): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<ScrivenerProject FileFormat="${overrides.fileFormat ?? '3.0'}" ModDate="2026-11-13 09:00:00 +0000">
  <Binder>
    ${
      overrides.binder ?? `
    <BinderItem ID="1" UUID="AAAA-1" Type="DraftFolder" Created="2026-01-01" Modified="2026-01-02">
      <Title>Manuscript</Title>
      <BinderItem ID="5" UUID="AAAA-5" Type="Folder" Created="2026-01-01" Modified="2026-01-02">
        <Title>Chapter One</Title>
        <BinderItem ID="6" UUID="AAAA-6" Type="TextDocument" Created="2026-01-01" Modified="2026-01-02">
          <Title>Scene A</Title>
        </BinderItem>
        <BinderItem ID="7" UUID="AAAA-7" Type="TextDocument" Created="2026-01-01" Modified="2026-01-02">
          <Title>Scene B</Title>
        </BinderItem>
      </BinderItem>
      <BinderItem ID="8" UUID="AAAA-8" Type="TextDocument" Created="2026-01-01" Modified="2026-01-02">
        <Title>Loose Doc</Title>
      </BinderItem>
    </BinderItem>
    <BinderItem ID="2" UUID="AAAA-2" Type="ResearchFolder" Created="2026-01-01" Modified="2026-01-02">
      <Title>Research</Title>
      <BinderItem ID="9" UUID="AAAA-9" Type="TextDocument" Created="2026-01-01" Modified="2026-01-02">
        <Title>Notes</Title>
      </BinderItem>
    </BinderItem>
    <BinderItem ID="3" UUID="AAAA-3" Type="TrashFolder" Created="2026-01-01" Modified="2026-01-02">
      <Title>Trash</Title>
      <BinderItem ID="10" UUID="AAAA-10" Type="TextDocument" Created="2026-01-01" Modified="2026-01-02">
        <Title>Deleted Scene</Title>
      </BinderItem>
    </BinderItem>`
    }
  </Binder>
  <ProjectProperties>
    <Title>${overrides.title ?? 'Fixture Novel'}</Title>
    <Author>${overrides.author ?? 'Rene'}</Author>
  </ProjectProperties>
  <MetaDataTable>
    ${
      overrides.meta ?? `
    <MetaData ID="5" Type="Folder">
      <Synopsis>A chapter about beginnings.</Synopsis>
      <IncludeInCompile>Yes</IncludeInCompile>
    </MetaData>
    <MetaData ID="6" Type="TextDocument">
      <Synopsis>Scene A synopsis.</Synopsis>
      <IncludeInCompile>Yes</IncludeInCompile>
    </MetaData>
    <MetaData ID="8" Type="TextDocument">
      <IncludeInCompile>No</IncludeInCompile>
    </MetaData>`
    }
  </MetaDataTable>
</ScrivenerProject>`
}

describe('parseScrivx', () => {
  it('reads project title and author', () => {
    const info = parseScrivx(scrivx())
    expect(info.title).toBe('Fixture Novel')
    expect(info.author).toBe('Rene')
    expect(info.fileFormat).toBe('3.0')
  })

  it('returns the draft tree in binder order, skipping research and trash', () => {
    const info = parseScrivx(scrivx())
    expect(info.draftItems.map((i) => i.title)).toEqual(['Chapter One', 'Loose Doc'])
    expect(info.draftItems[0].children.map((i) => i.title)).toEqual(['Scene A', 'Scene B'])
    expect(info.researchCount).toBe(1)
    expect(info.trashCount).toBe(1)
  })

  it('classifies item kinds', () => {
    const info = parseScrivx(scrivx())
    expect(info.draftItems[0].kind).toBe('folder')
    expect(info.draftItems[1].kind).toBe('document')
  })

  it('carries synopsis and compile flags from the meta table', () => {
    const info = parseScrivx(scrivx())
    expect(info.draftItems[0].synopsis).toBe('A chapter about beginnings.')
    expect(info.draftItems[0].children[0].synopsis).toBe('Scene A synopsis.')
    // Loose Doc has IncludeInCompile=No.
    expect(info.draftItems[1].includeInCompile).toBe(false)
    // Scene B has no MetaData row → included by default.
    expect(info.draftItems[0].children[1].includeInCompile).toBe(true)
  })

  it('keeps UUIDs and IDs for RTF file lookup', () => {
    const info = parseScrivx(scrivx())
    expect(info.draftItems[0].children[0]).toMatchObject({ id: '6', uuid: 'AAAA-6' })
  })

  it('rejects Scrivener 2 projects with an actionable message', () => {
    expect(() => parseScrivx(scrivx({ fileFormat: '2.0' }))).toThrow(ScrivenerFormatError)
    expect(() => parseScrivx(scrivx({ fileFormat: '2.0' }))).toThrow(/Scrivener 2/)
  })

  it('rejects non-Scrivener XML', () => {
    expect(() => parseScrivx('<html><body>hi</body></html>')).toThrow(ScrivenerFormatError)
    expect(() => parseScrivx('not xml at all <<>>')).toThrow(ScrivenerFormatError)
  })

  it('tolerates a single binder child (XML array-of-one)', () => {
    const info = parseScrivx(
      scrivx({
        binder: `
      <BinderItem ID="1" UUID="A-1" Type="DraftFolder">
        <Title>Manuscript</Title>
        <BinderItem ID="4" UUID="A-4" Type="TextDocument">
          <Title>Only Scene</Title>
        </BinderItem>
      </BinderItem>`
      })
    )
    expect(info.draftItems.map((i) => i.title)).toEqual(['Only Scene'])
  })
})

/**
 * The shape Scrivener 3 itself writes, taken from projects saved by Scrivener
 * 3.5.2 for macOS (titles and UUIDs made up): no FileFormat, UUID without ID,
 * <Children>, Type="Text", Include in Compile in each item's own <MetaData>.
 */
const REAL_SCRIVX = `<?xml version="1.0" encoding="UTF-8"?>
<ScrivenerProject Identifier="0000" Version="2.0" Creator="SCRMAC-3.5.2-17487" Device="Mac" Author="Ana Writer" Modified="2026-11-13 21:52:12 +0300" ModID="1111">
    <Binder>
        <BinderItem UUID="D-1" Type="DraftFolder" Created="2026-11-13 21:00:00 +0300" Modified="2026-11-13 21:00:00 +0300">
            <Title>Draft</Title>
            <MetaData>
                <IncludeInCompile>Yes</IncludeInCompile>
            </MetaData>
            <Children>
                <BinderItem UUID="P-1" Type="Folder" Created="2026-11-13 21:00:00 +0300" Modified="2026-11-13 21:00:00 +0300">
                    <Title>Part One</Title>
                    <MetaData>
                        <IncludeInCompile>Yes</IncludeInCompile>
                    </MetaData>
                    <Children>
                        <BinderItem UUID="T-1" Type="Text" Created="2026-11-13 21:00:00 +0300" Modified="2026-11-13 21:00:00 +0300">
                            <Title>Opening</Title>
                            <MetaData>
                                <IncludeInCompile>Yes</IncludeInCompile>
                            </MetaData>
                            <TextSettings>
                                <TextSelection>0,0</TextSelection>
                            </TextSettings>
                        </BinderItem>
                        <BinderItem UUID="T-2" Type="Text" Created="2026-11-13 21:00:00 +0300" Modified="2026-11-13 21:00:00 +0300">
                            <Title>Cut</Title>
                            <MetaData>
                                <IncludeInCompile>No</IncludeInCompile>
                            </MetaData>
                        </BinderItem>
                        <BinderItem UUID="I-1" Type="Image" Created="2026-11-13 21:00:00 +0300" Modified="2026-11-13 21:00:00 +0300">
                            <Title>Map</Title>
                        </BinderItem>
                    </Children>
                </BinderItem>
            </Children>
        </BinderItem>
        <BinderItem UUID="R-1" Type="ResearchFolder" Created="2026-11-13 21:00:00 +0300" Modified="2026-11-13 21:00:00 +0300">
            <Title>Research</Title>
            <Children>
                <BinderItem UUID="R-2" Type="Text" Created="2026-11-13 21:00:00 +0300" Modified="2026-11-13 21:00:00 +0300">
                    <Title>Notes</Title>
                </BinderItem>
            </Children>
        </BinderItem>
        <BinderItem UUID="X-1" Type="TrashFolder" Created="2026-11-13 21:00:00 +0300" Modified="2026-11-13 21:00:00 +0300">
            <Title>Trash</Title>
        </BinderItem>
    </Binder>
    <Collections/>
</ScrivenerProject>`

describe('parseScrivx on the layout Scrivener 3 writes', () => {
  it('accepts Version="2.0" with a Scrivener 3 Creator and no FileFormat', () => {
    const info = parseScrivx(REAL_SCRIVX)
    expect(info.fileFormat).toBe('2.0')
    expect(info.author).toBe('Ana Writer')
    expect(info.title).toBe('')
  })

  it('reads children under <Children> and Type="Text" as documents', () => {
    const info = parseScrivx(REAL_SCRIVX)
    expect(info.draftItems.map((i) => [i.title, i.kind])).toEqual([['Part One', 'folder']])
    expect(info.draftItems[0].children.map((i) => [i.title, i.kind])).toEqual([
      ['Opening', 'document'],
      ['Cut', 'document'],
      ['Map', 'other']
    ])
    expect(info.researchCount).toBe(1)
    expect(info.trashCount).toBe(0)
  })

  it('uses the UUID as the id and reads Include in Compile from the item', () => {
    const [opening, cut, map] = parseScrivx(REAL_SCRIVX).draftItems[0].children
    expect(opening).toMatchObject({ id: 'T-1', uuid: 'T-1', includeInCompile: true })
    expect(cut.includeInCompile).toBe(false)
    // No <MetaData> → included by default.
    expect(map.includeInCompile).toBe(true)
  })

  it('rejects a Scrivener 2 Creator', () => {
    const old = REAL_SCRIVX.replace('SCRMAC-3.5.2-17487', 'SCRMAC-2.9-1234')
    expect(() => parseScrivx(old)).toThrow(/Scrivener 2/)
  })

  it('accepts a missing Creator when items carry UUIDs, rejects it otherwise', () => {
    const noCreator = REAL_SCRIVX.replace(' Creator="SCRMAC-3.5.2-17487"', '')
    expect(parseScrivx(noCreator).draftItems).toHaveLength(1)
    expect(() => parseScrivx(noCreator.replace(/ UUID="[^"]*"/g, ''))).toThrow(
      /Unrecognized Scrivener project format/
    )
  })
})
