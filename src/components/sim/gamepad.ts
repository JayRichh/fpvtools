import type { StickInput } from '@core/sim/types'

export type StickAxis = 'throttle' | 'roll' | 'pitch' | 'yaw'

export interface AxisMap {
  index: number
  invert: boolean
}

export type GamepadMapping = Record<StickAxis, AxisMap>

/**
 * Standard-gamepad Mode 2: left stick = throttle (y, up = +) / yaw (x),
 * right stick = pitch (y, up = +) / roll (x). Browser y-axes are −1 up.
 */
export const DEFAULT_MAPPING: GamepadMapping = {
  yaw:      { index: 0, invert: false },
  throttle: { index: 1, invert: true },
  roll:     { index: 2, invert: false },
  pitch:    { index: 3, invert: true },
}

const STORAGE_KEY = 'fpv-sim-gamepad-map'
const DEADZONE = 0.05
/** Axis travel that counts as a deliberate movement during learn. */
const LEARN_THRESHOLD = 0.55

function applyDeadzone(v: number): number {
  if (Math.abs(v) < DEADZONE) return 0
  // Rescale so the usable range still reaches ±1
  return (v - Math.sign(v) * DEADZONE) / (1 - DEADZONE)
}

/**
 * Gamepad API poller for the simulator. Works with standard controllers out
 * of the box and with USB FPV radios (which enumerate arbitrary axis orders)
 * via the per-axis learn flow. Mapping persists to localStorage.
 */
export class GamepadInput {
  mapping: GamepadMapping

  constructor() {
    this.mapping = { ...DEFAULT_MAPPING }
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) this.mapping = { ...DEFAULT_MAPPING, ...(JSON.parse(raw) as Partial<GamepadMapping>) }
    } catch { /* keep defaults */ }
  }

  /** First connected gamepad, or null. */
  pad(): Gamepad | null {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return null
    for (const p of navigator.getGamepads()) {
      if (p && p.connected) return p
    }
    return null
  }

  /**
   * Read the mapped sticks. Throttle maps stick-up → 1, stick-down → 0;
   * axes are deadzone-rescaled. Returns null when no gamepad is connected.
   */
  read(): StickInput | null {
    const p = this.pad()
    if (!p) return null
    const axis = (m: AxisMap): number => {
      const raw = p.axes[m.index] ?? 0
      return applyDeadzone(m.invert ? -raw : raw)
    }
    return {
      throttle: (axis(this.mapping.throttle) + 1) / 2,
      roll: axis(this.mapping.roll),
      pitch: axis(this.mapping.pitch),
      yaw: axis(this.mapping.yaw),
    }
  }

  /**
   * Learn one axis: resolves with the mapping once any axis moves more than
   * LEARN_THRESHOLD from its baseline (instruct the user to move the stick
   * fully up / right). Rejects on abort or if no gamepad is connected.
   */
  learn(stick: StickAxis, signal?: AbortSignal): Promise<AxisMap> {
    return new Promise((resolve, reject) => {
      const p0 = this.pad()
      if (!p0) {
        reject(new Error('no gamepad'))
        return
      }
      const baseline = [...p0.axes]
      let rafId = 0
      const cancel = () => {
        cancelAnimationFrame(rafId)
        reject(new Error('aborted'))
      }
      signal?.addEventListener('abort', cancel, { once: true })

      const poll = () => {
        if (signal?.aborted) return
        const p = this.pad()
        if (p) {
          for (let i = 0; i < p.axes.length; i++) {
            const delta = p.axes[i] - (baseline[i] ?? 0)
            if (Math.abs(delta) > LEARN_THRESHOLD) {
              // "Up/right" is positive in sim terms; browser axes may be flipped
              const map: AxisMap = { index: i, invert: delta < 0 }
              this.mapping = { ...this.mapping, [stick]: map }
              this._persist()
              signal?.removeEventListener('abort', cancel)
              resolve(map)
              return
            }
          }
        }
        rafId = requestAnimationFrame(poll)
      }
      poll()
    })
  }

  resetMapping(): void {
    this.mapping = { ...DEFAULT_MAPPING }
    this._persist()
  }

  private _persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.mapping))
    } catch { /* ignore */ }
  }
}
