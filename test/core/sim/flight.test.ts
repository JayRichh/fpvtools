import { describe, it, expect } from 'vitest'
import {
  createSimState, stepSim, qIdentity, qFromEuler, qRotate, qIntegrate,
} from '../../../src/core/sim/flight'
import type { SimState, StickInput } from '../../../src/core/sim/types'
import { SIM_PRESETS, DEFAULT_SIM_PRESET } from '../../../src/core/sim/presets'

const cfg = SIM_PRESETS[DEFAULT_SIM_PRESET]
const idle: StickInput = { throttle: 0, roll: 0, pitch: 0, yaw: 0 }
const DT = 1 / 120

function run(state: SimState, input: StickInput, mode: 'easy' | 'normal', steps: number): SimState {
  let s = state
  for (let i = 0; i < steps; i++) s = stepSim(s, input, cfg, mode, DT)
  return s
}

describe('quaternion helpers', () => {
  it('identity rotation leaves vectors unchanged', () => {
    expect(qRotate(qIdentity(), [1, 2, 3])).toEqual([1, 2, 3])
  })

  it('90° yaw rotates forward (−Z) to the side', () => {
    const q = qFromEuler(0, 0, 90)
    const v = qRotate(q, [0, 0, -1])
    expect(Math.abs(v[1])).toBeLessThan(1e-9)
    expect(Math.hypot(...v)).toBeCloseTo(1, 9)
    expect(Math.abs(v[0])).toBeCloseTo(1, 6) // now along ±X
  })

  it('integrating a constant roll rate tilts the up vector', () => {
    let q = qIdentity()
    // 90°/s roll for 1 s
    for (let i = 0; i < 120; i++) q = qIntegrate(q, [Math.PI / 2, 0, 0], 1 / 120)
    const up = qRotate(q, [0, 1, 0])
    expect(up[1]).toBeCloseTo(0, 1) // up vector now roughly horizontal
  })
})

describe('stepSim', () => {
  it('disarmed quad on the ground stays put', () => {
    const s = run(createSimState(), { ...idle, throttle: 1 }, 'normal', 240)
    expect(s.pos[1]).toBe(0)
    expect(s.vel).toEqual([0, 0, 0])
  })

  it('armed full throttle climbs (T/W > 1)', () => {
    const s0 = { ...createSimState(), armed: true }
    const s = run(s0, { ...idle, throttle: 1 }, 'normal', 240)
    expect(s.pos[1]).toBeGreaterThan(1)
    expect(s.vel[1]).toBeGreaterThan(0)
  })

  it('easy mode mid-stick throttle roughly holds altitude', () => {
    const s0: SimState = { ...createSimState(), armed: true, pos: [0, 10, 0] }
    const s = run(s0, { ...idle, throttle: 0.5 }, 'easy', 480) // 4 s
    expect(Math.abs(s.pos[1] - 10)).toBeLessThan(0.5)
  })

  it('easy mode pitch stick tilts and produces horizontal motion', () => {
    const s0: SimState = { ...createSimState(), armed: true, pos: [0, 20, 0] }
    const s = run(s0, { ...idle, throttle: 0.5, pitch: 1 }, 'easy', 480)
    const horizontal = Math.hypot(s.pos[0], s.pos[2])
    expect(horizontal).toBeGreaterThan(3)
  })

  it('acro roll input rotates the airframe continuously (flips possible)', () => {
    const s0: SimState = { ...createSimState(), armed: true, pos: [0, 30, 0] }
    const s = run(s0, { ...idle, throttle: 0.6, roll: 1 }, 'normal', 240) // 2 s at high rate
    const up = qRotate(s.quat, [0, 1, 0])
    // After sustained full-rate roll the up vector cannot still be near world-up
    // for the whole run — check it has rotated away at some point via rates
    expect(Math.abs(s.ratesDegS[0])).toBeGreaterThan(cfg.maxRateDegS * 0.8)
    expect(Math.hypot(...up)).toBeCloseTo(1, 6)
  })

  it('hard ground impact crashes; gentle contact lands', () => {
    const falling: SimState = { ...createSimState(), armed: true, pos: [0, 5, 0], vel: [0, -10, 0] }
    const crashed = stepSim({ ...falling, pos: [0, 0.01, 0] }, idle, cfg, 'normal', DT)
    expect(crashed.crashed).toBe(true)

    const gentle: SimState = { ...createSimState(), armed: true, pos: [0, 0.01, 0], vel: [0, -0.5, 0] }
    const landed = run(gentle, idle, 'normal', 5)
    expect(landed.crashed).toBe(false)
    expect(landed.pos[1]).toBe(0)
  })

  it('is deterministic: same inputs → identical trajectories', () => {
    const s0: SimState = { ...createSimState(), armed: true, pos: [0, 10, 0] }
    const input: StickInput = { throttle: 0.7, roll: 0.3, pitch: -0.2, yaw: 0.1 }
    const a = run(s0, input, 'normal', 300)
    const b = run(s0, input, 'normal', 300)
    expect(a).toEqual(b)
  })

  it('does not mutate the input state', () => {
    const s0: SimState = { ...createSimState(), armed: true, pos: [0, 10, 0] }
    const frozen = JSON.parse(JSON.stringify(s0))
    stepSim(s0, { ...idle, throttle: 1, roll: 1 }, cfg, 'normal', DT)
    expect(s0).toEqual(frozen)
  })
})
