export type RenameSurface = 'panel' | 'sidebar' | 'container'
export type RenamePhase = 'waiting' | 'editing' | 'committing'

export interface RenameSession {
  requestId: string
  nodeId: string
  originalTitle: string
  draft: string
  preferredSurfaces: RenameSurface[]
  owner: RenameSurface | null
  phase: RenamePhase
  selectAllConsumed: boolean
}

export const RENAME_FOCUS_PRIORITY: RenameSurface[] = ['panel', 'sidebar', 'container']

let nextRequestId = 0

export function createRenameSession(params: {
  nodeId: string
  originalTitle: string
  preferredSurfaces: RenameSurface[]
}): RenameSession {
  nextRequestId += 1
  return {
    requestId: `rename-${nextRequestId}`,
    nodeId: params.nodeId,
    originalTitle: params.originalTitle,
    draft: params.originalTitle,
    preferredSurfaces: [...params.preferredSurfaces],
    owner: null,
    phase: 'waiting',
    selectAllConsumed: false
  }
}

/**
 * Highest-priority surface among those both preferred and mounted.
 * Preference follows the caller's `preferred` order (first = most preferred).
 */
export function pickBestMountedSurface(
  preferred: RenameSurface[],
  mounted: Iterable<RenameSurface>
): RenameSurface | null {
  const available = new Set(mounted)
  for (const surface of preferred) {
    if (available.has(surface)) return surface
  }
  return null
}

export function isRenameOwner(
  session: RenameSession | null,
  surface: RenameSurface,
  nodeId: string
): boolean {
  return (
    !!session &&
    session.nodeId === nodeId &&
    session.preferredSurfaces.includes(surface) &&
    session.owner === surface
  )
}

export function shouldShowRenameEditor(
  session: RenameSession | null,
  surface: RenameSurface,
  nodeId: string
): boolean {
  if (!session || session.nodeId !== nodeId) return false
  if (!session.preferredSurfaces.includes(surface)) return false
  if (session.owner === surface) return true
  // While waiting for a claim, only the first preferred surface may show.
  if (session.owner === null) {
    return session.preferredSurfaces[0] === surface
  }
  return false
}

/** Test helper — reset request id counter. */
export function __resetRenameRequestIds(): void {
  nextRequestId = 0
}
