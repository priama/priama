import type { AppUpdateStatus } from '@shared/types'

export const PRIAMA_LATEST_RELEASE_URL =
  'https://api.github.com/repos/andyrpr/priama/releases/latest'

export interface GitHubReleaseAsset {
  name: string
  browser_download_url: string
}

interface GitHubLatestRelease {
  tag_name: string
  html_url?: string
  assets: GitHubReleaseAsset[]
}

interface SemanticVersion {
  major: number
  minor: number
  patch: number
  prerelease: string[]
}

const SEMVER_PATTERN =
  /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/

function parseSemanticVersion(value: string): SemanticVersion | null {
  const match = SEMVER_PATTERN.exec(value.trim())
  if (!match) return null

  const numericParts = match.slice(1, 4).map(Number)
  if (numericParts.some((part) => !Number.isSafeInteger(part))) return null

  return {
    major: numericParts[0],
    minor: numericParts[1],
    patch: numericParts[2],
    prerelease: match[4]?.split('.') ?? []
  }
}

function comparePrerelease(left: string[], right: string[]): number {
  if (left.length === 0 && right.length === 0) return 0
  if (left.length === 0) return 1
  if (right.length === 0) return -1

  const length = Math.max(left.length, right.length)
  for (let index = 0; index < length; index += 1) {
    const leftPart = left[index]
    const rightPart = right[index]
    if (leftPart === undefined) return -1
    if (rightPart === undefined) return 1
    if (leftPart === rightPart) continue

    const leftNumeric = /^\d+$/.test(leftPart)
    const rightNumeric = /^\d+$/.test(rightPart)
    if (leftNumeric && rightNumeric) {
      const leftNumber = Number(leftPart)
      const rightNumber = Number(rightPart)
      if (leftNumber !== rightNumber) return leftNumber > rightNumber ? 1 : -1
      continue
    }
    if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1
    return leftPart > rightPart ? 1 : -1
  }

  return 0
}

export function compareSemanticVersions(leftValue: string, rightValue: string): number | null {
  const left = parseSemanticVersion(leftValue)
  const right = parseSemanticVersion(rightValue)
  if (!left || !right) return null

  for (const key of ['major', 'minor', 'patch'] as const) {
    if (left[key] !== right[key]) return left[key] > right[key] ? 1 : -1
  }

  return comparePrerelease(left.prerelease, right.prerelease)
}

function isTrustedGitHubUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.hostname === 'github.com'
  } catch {
    return false
  }
}

export function selectArm64DmgAsset(
  assets: GitHubReleaseAsset[]
): GitHubReleaseAsset | null {
  const dmgs = assets.filter(
    (asset) =>
      typeof asset.name === 'string' &&
      asset.name.toLowerCase().endsWith('.dmg') &&
      typeof asset.browser_download_url === 'string' &&
      isTrustedGitHubUrl(asset.browser_download_url)
  )

  return dmgs.find((asset) => asset.name.toLowerCase().includes('arm64')) ?? dmgs[0] ?? null
}

function isGitHubLatestRelease(value: unknown): value is GitHubLatestRelease {
  if (!value || typeof value !== 'object') return false
  const release = value as Partial<GitHubLatestRelease>
  return (
    typeof release.tag_name === 'string' &&
    Array.isArray(release.assets)
  )
}

export async function checkForAppUpdate(
  currentVersion: string,
  fetchLatest: typeof fetch = fetch
): Promise<AppUpdateStatus> {
  const unavailable: AppUpdateStatus = {
    state: 'unavailable',
    currentVersion
  }

  try {
    const response = await fetchLatest(PRIAMA_LATEST_RELEASE_URL, {
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': `Priama/${currentVersion}`
      },
      signal: AbortSignal.timeout(10_000)
    })

    if (!response.ok) return unavailable

    const release: unknown = await response.json()
    if (!isGitHubLatestRelease(release)) return unavailable

    const latestVersion = release.tag_name.trim().replace(/^v/i, '')
    const comparison = compareSemanticVersions(latestVersion, currentVersion)
    if (comparison === null) return unavailable

    const releaseUrl =
      typeof release.html_url === 'string' && isTrustedGitHubUrl(release.html_url)
        ? release.html_url
        : undefined

    if (comparison <= 0) {
      return {
        state: 'current',
        currentVersion,
        latestVersion,
        releaseUrl
      }
    }

    const installer = selectArm64DmgAsset(release.assets)
    if (!installer) return unavailable

    return {
      state: 'available',
      currentVersion,
      latestVersion,
      downloadUrl: installer.browser_download_url,
      releaseUrl
    }
  } catch {
    return unavailable
  }
}
