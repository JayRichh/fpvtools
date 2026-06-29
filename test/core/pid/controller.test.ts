import { describe, it, expect } from 'vitest'
import { createControllerState, stepController } from '../../../src/core/pid/controller'
import type { ControllerConfig } from '../../../src/core/pid/types'

const baseConfig: ControllerConfig = {
  gains: { kp: 1.0, ki: 0, kd: 0, kff: 0 },
  filters: { gyroLowpassHz: 100, dtermLowpassHz: 70 },
  loopRateHz: 1000,
  iTermLimitNm: 1.0,
  iTermRelax: false,
}

describe('stepController', () => {
  it('P-only output proportional to error', () => {
    const config: ControllerConfig = { ...baseConfig, gains: { kp: 2.0, ki: 0, kd: 0, kff: 0 } }
    const state = createControllerState(config)
    const result = stepController(state, config, 10, 4, 0.001)
    // error = 10 - 4 = 6, pTerm = 2 * 6 = 12, but clamped to 1
    expect(result.pTerm).toBeCloseTo(12, 3)
    expect(result.output).toBe(1.0) // clamped
    expect(result.saturated).toBe(true)
  })

  it('P-only proportionality holds when in range', () => {
    const config: ControllerConfig = { ...baseConfig, gains: { kp: 0.1, ki: 0, kd: 0, kff: 0 } }
    const state = createControllerState(config)
    const r1 = stepController(state, config, 5, 0, 0.001)
    const state2 = createControllerState(config)
    const r2 = stepController(state2, config, 10, 0, 0.001)
    expect(r2.pTerm / r1.pTerm).toBeCloseTo(2, 3)
  })

  it('I-term accumulates over time', () => {
    const config: ControllerConfig = { ...baseConfig, gains: { kp: 0, ki: 1.0, kd: 0, kff: 0 } }
    const state = createControllerState(config)
    const dt = 0.001
    let last
    for (let i = 0; i < 10; i++) last = stepController(state, config, 5, 0, dt)
    // After 10 steps, integral = ki * error * dt * n = 1.0 * 5 * 0.001 * 10 = 0.05
    expect(last!.iTerm).toBeCloseTo(0.05, 4)
  })

  it('anti-windup clamps I-term to iTermLimitNm', () => {
    const config: ControllerConfig = {
      ...baseConfig,
      gains: { kp: 0, ki: 10, kd: 0, kff: 0 },
      iTermLimitNm: 0.5,
    }
    const state = createControllerState(config)
    let last
    for (let i = 0; i < 1000; i++) last = stepController(state, config, 10, 0, 0.001)
    expect(last!.iTerm).toBeLessThanOrEqual(0.5)
    expect(last!.iTerm).toBeGreaterThan(0)
  })

  it('output clamped to [-1, 1] positive', () => {
    const config: ControllerConfig = { ...baseConfig, gains: { kp: 100, ki: 0, kd: 0, kff: 0 } }
    const state = createControllerState(config)
    const r = stepController(state, config, 10, 0, 0.001)
    expect(r.output).toBe(1.0)
    expect(r.saturated).toBe(true)
  })

  it('output clamped to [-1, 1] negative', () => {
    const config: ControllerConfig = { ...baseConfig, gains: { kp: 100, ki: 0, kd: 0, kff: 0 } }
    const state = createControllerState(config)
    const r = stepController(state, config, -10, 0, 0.001)
    expect(r.output).toBe(-1.0)
    expect(r.saturated).toBe(true)
  })

  it('output not saturated for small error', () => {
    const config: ControllerConfig = { ...baseConfig, gains: { kp: 0.01, ki: 0, kd: 0, kff: 0 } }
    const state = createControllerState(config)
    const r = stepController(state, config, 1, 0, 0.001)
    expect(r.saturated).toBe(false)
    expect(Math.abs(r.output)).toBeLessThan(1)
  })

  it('FF term responds to setpoint rate of change', () => {
    const config: ControllerConfig = { ...baseConfig, gains: { kp: 0, ki: 0, kd: 0, kff: 1.0 } }
    const state = createControllerState(config)
    const dt = 0.001
    // prevSetpoint = 0 (initial), setpoint = 10 → dSetpoint/dt = 10000
    stepController(state, config, 0, 0, dt) // prime prevSetpoint = 0
    const r = stepController(state, config, 10, 0, dt)
    // dSetpoint = (10 - 0) / 0.001 = 10000, ffTerm = 1.0 * 10000
    expect(r.ffTerm).toBeCloseTo(10000, -1)
  })

  it('D-term is zero when gyro is constant', () => {
    const config: ControllerConfig = { ...baseConfig, gains: { kp: 0, ki: 0, kd: 1.0, kff: 0 } }
    const state = createControllerState(config)
    const dt = 0.001
    // Prime extensively so the dterm filter fully settles to its steady state (gyro constant → dGyro=0)
    for (let i = 0; i < 500; i++) stepController(state, config, 0, 5, dt)
    const r = stepController(state, config, 0, 5, dt)
    expect(r.dTerm).toBeCloseTo(0, 1)
  })
})
