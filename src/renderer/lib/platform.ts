/**
 * The host platform, reported by the main process over the preload bridge.
 *
 * Previously each component sniffed `navigator.platform` or the user agent.
 * That property is deprecated, the three call sites disagreed with each other,
 * and none of them matched what `process.platform` says in the main process —
 * which is what actually decides the window chrome.
 */
function resolvePlatform(): NodeJS.Platform {
  const reported = typeof window !== 'undefined' ? window.electronAPI?.platform : undefined
  if (reported) return reported

  // The bridge should always be there. If it somehow is not, guessing "macOS"
  // would be the worst answer on Windows: no app menu rendered and traffic-light
  // insets applied for buttons that do not exist. Fall back to the old sniff.
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  return /Mac|iPhone|iPad/.test(ua) ? 'darwin' : 'win32'
}

const platform: NodeJS.Platform = resolvePlatform()

export const isMac = platform === 'darwin'
export const isWindows = platform === 'win32'
export const isLinux = platform === 'linux'

/** macOS keeps its commands in the system menu bar; elsewhere the app draws its own. */
export const usesInAppMenu = !isMac
