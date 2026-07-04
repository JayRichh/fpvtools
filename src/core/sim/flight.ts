// src/core/sim/flight.ts — Pure TS, zero DOM, zero framework
//
// Simplified 6-DOF quad flight dynamics for the browser simulator.
// Deterministic: stepSim is a pure function of (state, input, config, dt).

import type { Quat, SimConfig, SimMode, SimState, SimVec3, StickInput } from './types.js'

export type { Quat, SimConfig, SimMode, SimState, SimVec3, StickInput }

const G = 9.81
const DEG = Math.PI / 180

// ── Quaternion helpers ────────────────────────────────────────────────────────

export function qIdentity(): Quat {
  return [1, 0, 0, 0]
}

export function qMul(a: Quat, b: Quat): Quat {
  return [
    a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3],
    a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
    a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1],
    a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0],
  ]
}

export function qNormalize(q: Quat): Quat {
  const n = Math.hypot(q[0], q[1], q[2], q[3]) || 1
  return [q[0] / n, q[1] / n, q[2] / n, q[3] / n]
}

/** Rotate a vector from body frame to world frame. */
export function qRotate(q: Quat, v: SimVec3): SimVec3 {
  const [w, x, y, z] = q
  // v' = v + 2·qv × (qv × v + w·v)
  const tx = 2 * (y * v[2] - z * v[1])
  const ty = 2 * (z * v[0] - x * v[2])
  const tz = 2 * (x * v[1] - y * v[0])
  return [
    v[0] + w * tx + y * tz - z * ty,
    v[1] + w * ty + z * tx - x * tz,
    v[2] + w * tz + x * ty - y * tx,
  ]
}

/**
 * Build a quaternion from FPV-style Euler angles (deg): yaw about world Y,
 * then pitch about body X, then roll about body Z (forward = −Z, up = +Y).
 */
export function qFromEuler(rollDeg: number, pitchDeg: number, yawDeg: number): Quat {
  const hy = yawDeg * DEG / 2
  const hp = pitchDeg * DEG / 2
  const hr = rollDeg * DEG / 2
  const qYaw: Quat = [Math.cos(hy), 0, Math.sin(hy), 0]
  const qPitch: Quat = [Math.cos(hp), Math.sin(hp), 0, 0]
  const qRoll: Quat = [Math.cos(hr), 0, 0, Math.sin(hr)]
  return qNormalize(qMul(qMul(qYaw, qPitch), qRoll))
}

/** Integrate body rates (rad/s: roll about Z, pitch about X, yaw about Y). */
export function qIntegrate(q: Quat, ratesRad: SimVec3, dt: number): Quat {
  const [rollR, pitchR, yawR] = ratesRad
  // Body-frame angular velocity → quaternion derivative: dq = ½ q ⊗ [0, ω]
  const omega: Quat = [0, pitchR, yawR, rollR]
  const dq = qMul(q, omega)
  return qNormalize([
    q[0] + 0.5 * dq[0] * dt,
    q[1] + 0.5 * dq[1] * dt,
    q[2] + 0.5 * dq[2] * dt,
    q[3] + 0.5 * dq[3] * dt,
  ])
}

// ── Sim ──────────────────────────────────────────────────────────────────────

export function createSimState(): SimState {
  return {
    pos: [0, 0, 0],
    vel: [0, 0, 0],
    quat: qIdentity(),
    ratesDegS: [0, 0, 0],
    yawDeg: 0,
    armed: false,
    crashed: false,
    timeS: 0,
  }
}

function applyExpo(stick: number, expo: number): number {
  return stick * (1 - expo) + stick * stick * stick * expo
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/** Advance the sim by dt seconds. Pure — returns a new state. */
export function stepSim(
  state: SimState,
  input: StickInput,
  cfg: SimConfig,
  mode: SimMode,
  dt: number,
): SimState {
  if (state.crashed) return { ...state, timeS: state.timeS + dt }

  const throttle = clamp(input.throttle, 0, 1)
  const roll = clamp(input.roll, -1, 1)
  const pitch = clamp(input.pitch, -1, 1)
  const yaw = clamp(input.yaw, -1, 1)

  let quat: Quat
  let yawDeg = state.yawDeg
  let ratesDegS: SimVec3

  if (mode === 'easy') {
    // Angle mode: sticks command attitude directly; yaw integrates heading
    yawDeg += yaw * cfg.yawRateDegS * dt
    const rollTarget = -roll * cfg.maxTiltDeg
    const pitchTarget = pitch * cfg.maxTiltDeg
    quat = qFromEuler(rollTarget, pitchTarget, yawDeg)
    ratesDegS = [roll * cfg.maxTiltDeg, pitch * cfg.maxTiltDeg, yaw * cfg.yawRateDegS]
  } else {
    // Acro: sticks command body rates with expo; first-order rate response
    const target: SimVec3 = [
      -applyExpo(roll, cfg.expo) * cfg.maxRateDegS,
      applyExpo(pitch, cfg.expo) * cfg.maxRateDegS,
      -applyExpo(yaw, cfg.expo) * cfg.maxRateDegS * 0.6,
    ]
    const alpha = 1 - Math.exp(-dt / cfg.rateTau)
    ratesDegS = [
      state.ratesDegS[0] + (target[0] - state.ratesDegS[0]) * alpha,
      state.ratesDegS[1] + (target[1] - state.ratesDegS[1]) * alpha,
      state.ratesDegS[2] + (target[2] - state.ratesDegS[2]) * alpha,
    ]
    quat = qIntegrate(state.quat, [
      ratesDegS[0] * DEG, ratesDegS[1] * DEG, ratesDegS[2] * DEG,
    ], dt)
  }

  // Thrust along body up
  const maxThrustN = cfg.thrustToWeight * cfg.massKg * G
  let thrustN = 0
  if (state.armed) {
    if (mode === 'easy') {
      // Altitude assist: mid-stick hovers
      thrustN = clamp(cfg.massKg * G * (1 + (throttle - 0.5) * 1.6), 0, maxThrustN)
    } else {
      thrustN = throttle * maxThrustN
    }
  }

  const up = qRotate(quat, [0, 1, 0])
  const speed = Math.hypot(...state.vel)
  const acc: SimVec3 = [
    (up[0] * thrustN) / cfg.massKg - state.vel[0] * (cfg.dragK + cfg.dragK2 * speed),
    (up[1] * thrustN) / cfg.massKg - G - state.vel[1] * (cfg.dragK + cfg.dragK2 * speed),
    (up[2] * thrustN) / cfg.massKg - state.vel[2] * (cfg.dragK + cfg.dragK2 * speed),
  ]

  const vel: SimVec3 = [
    state.vel[0] + acc[0] * dt,
    state.vel[1] + acc[1] * dt,
    state.vel[2] + acc[2] * dt,
  ]
  const pos: SimVec3 = [
    state.pos[0] + vel[0] * dt,
    state.pos[1] + vel[1] * dt,
    state.pos[2] + vel[2] * dt,
  ]

  let crashed: boolean = state.crashed
  if (pos[1] <= 0) {
    pos[1] = 0
    if (vel[1] < -6) {
      crashed = true
    }
    // Ground contact: kill motion (simple friction), keep heading
    vel[0] = 0; vel[1] = 0; vel[2] = 0
    if (mode === 'normal') ratesDegS = [0, 0, 0]
  }

  return {
    pos, vel, quat, ratesDegS, yawDeg,
    armed: state.armed,
    crashed,
    timeS: state.timeS + dt,
  }
}
