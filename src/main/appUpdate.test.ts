import { describe, expect, it } from 'vitest'
import {
  checkForAppUpdate,
  compareSemanticVersions,
  selectArm64DmgAsset,
  type GitHubReleaseAsset
} from './appUpdate'

const ARM64_URL =
  'https://github.com/andyrpr/priama/releases/download/v0.0.2/Priama-0.0.2-mac-arm64.dmg'

describe('compareSemanticVersions', () => {
  it('compares numeric versions rather than lexicographic strings', () => {
    expect(compareSemanticVersions('0.0.10', '0.0.9')).toBe(1)
    expect(compareSemanticVersions('1.2.3', '1.2.3')).toBe(0)
    expect(compareSemanticVersions('1.1.9', '1.2.0')).toBe(-1)
  })

  it('accepts release tags and follows prerelease precedence', () => {
    expect(compareSemanticVersions('v1.0.0', '1.0.0')).toBe(0)
    expect(compareSemanticVersions('1.0.0', '1.0.0-beta.2')).toBe(1)
    expect(compareSemanticVersions('1.0.0-beta.10', '1.0.0-beta.2')).toBe(1)
  })

  it('rejects malformed versions', () => {
    expect(compareSemanticVersions('latest', '0.0.1')).toBeNull()
  })
})

describe('selectArm64DmgAsset', () => {
  it('prefers a trusted Apple Silicon dmg', () => {
    const assets: GitHubReleaseAsset[] = [
      {
        name: 'Priama-0.0.2-mac-x64.dmg',
        browser_download_url:
          'https://github.com/andyrpr/priama/releases/download/v0.0.2/Priama-0.0.2-mac-x64.dmg'
      },
      {
        name: 'Priama-0.0.2-mac-arm64.dmg',
        browser_download_url: ARM64_URL
      }
    ]

    expect(selectArm64DmgAsset(assets)?.browser_download_url).toBe(ARM64_URL)
  })

  it('does not return an installer from an untrusted host', () => {
    expect(
      selectArm64DmgAsset([
        {
          name: 'Priama-0.0.2-mac-arm64.dmg',
          browser_download_url: 'https://example.com/Priama.dmg'
        }
      ])
    ).toBeNull()
  })
})

describe('checkForAppUpdate', () => {
  it('returns an available update from the public release feed', async () => {
    const fetchLatest = async (): Promise<Response> =>
      new Response(
        JSON.stringify({
          tag_name: 'v0.0.2',
          html_url: 'https://github.com/andyrpr/priama/releases/tag/v0.0.2',
          assets: [
            {
              name: 'Priama-0.0.2-mac-arm64.dmg',
              browser_download_url: ARM64_URL
            }
          ]
        }),
        { status: 200 }
      )

    await expect(
      checkForAppUpdate('0.0.1', fetchLatest as typeof fetch)
    ).resolves.toEqual({
      state: 'available',
      currentVersion: '0.0.1',
      latestVersion: '0.0.2',
      downloadUrl: ARM64_URL,
      releaseUrl: 'https://github.com/andyrpr/priama/releases/tag/v0.0.2'
    })
  })

  it('stays silent when GitHub has no published release', async () => {
    const fetchLatest = async (): Promise<Response> => new Response(null, { status: 404 })

    await expect(
      checkForAppUpdate('0.0.1', fetchLatest as typeof fetch)
    ).resolves.toEqual({
      state: 'unavailable',
      currentVersion: '0.0.1'
    })
  })
})
