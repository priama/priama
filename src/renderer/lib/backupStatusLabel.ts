const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS
const WEEK_MS = 7 * DAY_MS

/** Compact relative age for the status-bar backup line. */
export function formatBackupAge(iso: string, nowMs = Date.now()): string | null {
  const then = Date.parse(iso)
  if (Number.isNaN(then)) return null

  const elapsed = Math.max(0, nowMs - then)
  if (elapsed < MINUTE_MS) return 'just now'
  if (elapsed < HOUR_MS) {
    const mins = Math.floor(elapsed / MINUTE_MS)
    return `${mins} min ago`
  }
  if (elapsed < DAY_MS) {
    const hours = Math.floor(elapsed / HOUR_MS)
    return `${hours} hr ago`
  }
  if (elapsed < WEEK_MS) {
    const days = Math.floor(elapsed / DAY_MS)
    return days === 1 ? '1 day ago' : `${days} days ago`
  }
  const weeks = Math.floor(elapsed / WEEK_MS)
  return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`
}

export function backupStatusLabel(
  lastBackupAt: string | null | undefined,
  backupWarningCount: number,
  nowMs = Date.now()
): string {
  if (backupWarningCount > 0) {
    return `Backup warning: ${backupWarningCount} location${backupWarningCount === 1 ? '' : 's'} unavailable`
  }
  const age = lastBackupAt ? formatBackupAge(lastBackupAt, nowMs) : null
  return `Backup: ${age ?? 'None'}`
}
