import { describe, expect, it } from 'vitest'
import { parseScrivx, ScrivenerFormatError } from './scrivx'

/** Hand-built in the shape of a Scrivener 3 project.scrivx. VERIFY against a real fixture. */
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
