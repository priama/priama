/**
 * macOS traffic lights, shared by the main process (window options) and the renderer (insets).
 *
 * Electron's `trafficLightPosition` is the left/top margin of the button frames. AppKit's
 * standard window buttons are 14 × 16 pt frames on a 20 pt pitch, so a top margin of 14
 * centers them at 22 pt — the middle of the 44 pt toolbar band (editor toolbar, Device
 * Preview header) — and inside the 36 pt sidebar and focus-mode title rows.
 */
export const TRAFFIC_LIGHT_POSITION = { x: 16, y: 14 } as const

const BUTTON_WIDTH = 14
const BUTTON_GAP = 6
const CLEARANCE = 8

/** Content that starts left of this x would sit under the traffic lights. */
export const TITLEBAR_BUTTONS_INSET =
  TRAFFIC_LIGHT_POSITION.x + 3 * BUTTON_WIDTH + 2 * BUTTON_GAP + CLEARANCE
