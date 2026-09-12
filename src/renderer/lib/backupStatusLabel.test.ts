import { describe, expect, it } from 'vitest'
import { backupStatusLabel, formatBackupAge } from './backupStatusLabel'

const NOW = Date.parse('2026-09-12T12:00:00.000Z')

describe('formatBackupAge', () => {
  it('returns just now under a minute', () => {
    expect(formatBackupAge('2026-09-12T11:59:30.000Z', NOW)).toBe('just now')
  })

  it('returns minutes under an hour', () => {
    expect(formatBackupAge('2026-09-12T11:45:00.000Z', NOW)).toBe('15 min ago')
  })

  it('returns hours under a day', () => {
    expect(formatBackupAge('2026-09-12T09:00:00.000Z', NOW)).toBe('3 hr ago')
  })

  it('returns days under a week', () => {
    expect(formatBackupAge('2026-09-11T12:00:00.000Z', NOW)).toBe('1 day ago')
    expect(formatBackupAge('2026-09-09T12:00:00.000Z', NOW)).toBe('3 days ago')
  })

  it('returns weeks for older ages', () => {
    expect(formatBackupAge('2026-09-05T12:00:00.000Z', NOW)).toBe('1 week ago')
    expect(formatBackupAge('2026-08-15T12:00:00.000Z', NOW)).toBe('4 weeks ago')
  })

  it('returns null for invalid timestamps', () => {
    expect(formatBackupAge('not-a-date', NOW)).toBeNull()
  })
})

describe('backupStatusLabel', () => {
  it('prefers the warning when locations are unavailable', () => {
    expect(backupStatusLabel('2026-09-12T11:59:00.000Z', 2, NOW)).toBe(
      'Backup warning: 2 locations unavailable'
    )
  })

  it('shows None when there is no backup', () => {
    expect(backupStatusLabel(null, 0, NOW)).toBe('Backup: None')
  })

  it('shows the compact age when a backup exists', () => {
    expect(backupStatusLabel('2026-09-12T11:59:30.000Z', 0, NOW)).toBe('Backup: just now')
  })
})
