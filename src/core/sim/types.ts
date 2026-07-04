export type SimMode = 'easy' | 'normal'

/** Normalized pilot input: throttle 0..1, axes −1..1 */
export interface StickInput {
  throttle: number
  roll: number
  pitch: number
  yaw: number
}

export interface SimConfig {
  massKg: number
  /** Max static thrust / weight */
  thrustToWeight: number
  /** Linear drag coefficient (1/s) */
  dragK: number
  /** Quadratic drag coefficient (1/m) */
  dragK2: number
  /** Acro: full-deflection rotation rate */
  maxRateDegS: number
  /** Acro stick expo 0..1 */
  expo: number
  /** Rate-response time constant (s) */
  rateTau: number
  /** Easy (angle) mode: max commanded tilt */
  maxTiltDeg: number
  /** Easy mode yaw rate at full deflection */
  yawRateDegS: number
}

/** Quaternion [w, x, y, z], body → world. World is Y-up. */
export type Quat = [number, number, number, number]
export type SimVec3 = [number, number, number]

export interface SimState {
  /** World position (m), Y up */
  pos: SimVec3
  /** World velocity (m/s) */
  vel: SimVec3
  quat: Quat
  /** Body rates (roll, pitch, yaw) in deg/s */
  ratesDegS: SimVec3
  /** Integrated heading used by easy (angle) mode */
  yawDeg: number
  armed: boolean
  crashed: boolean
  timeS: number
}
