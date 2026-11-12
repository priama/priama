import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { SIDEBAR_EXPANDED_MIN_WIDTH } from '@shared/types'

const setMenuStateMock = vi.fn()

type SyncModule = typeof import('@/lib/writingMenuSync')
type StoreModule = typeof import('@/store/appStore')

let syncWritingMenuState: SyncModule['syncWritingMenuState']
let useAppStore: StoreModule['useAppStore']

beforeEach(async () => {
  // Fresh module graph per test: the sync layer keeps `lastSent` at module scope.
  vi.resetModules()
  ;[{ syncWritingMenuState }, { useAppStore }] = await Promise.all([
    import('@/lib/writingMenuSync'),
    import('@/store/appStore')
  ])

  setMenuStateMock.mockReset()
  vi.stubGlobal('window', {
    electronAPI: { app: { setWritingMenuState: setMenuStateMock } }
  })
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('syncWritingMenuState', () => {
  it('coalesces the per-keystroke calls of a typing burst into one IPC', () => {
    for (let i = 0; i < 20; i++) syncWritingMenuState()
    expect(setMenuStateMock).not.toHaveBeenCalled()

    vi.advanceTimersByTime(200)
    expect(setMenuStateMock).toHaveBeenCalledTimes(1)
  })

  it('skips the IPC when nothing the menu renders has changed', () => {
    syncWritingMenuState()
    vi.advanceTimersByTime(200)
    expect(setMenuStateMock).toHaveBeenCalledTimes(1)

    // Caret move / pause: called again, state identical → no second send.
    syncWritingMenuState()
    vi.advanceTimersByTime(200)
    expect(setMenuStateMock).toHaveBeenCalledTimes(1)
  })

  it('sends again when the computed state differs', () => {
    syncWritingMenuState()
    vi.advanceTimersByTime(200)
    expect(setMenuStateMock).toHaveBeenCalledTimes(1)

    useAppStore.setState({ sidebarWidth: SIDEBAR_EXPANDED_MIN_WIDTH - 140 })
    syncWritingMenuState()
    vi.advanceTimersByTime(200)
    expect(setMenuStateMock).toHaveBeenCalledTimes(2)
  })
})
