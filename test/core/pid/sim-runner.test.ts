import { describe, it, expect } from 'vitest'
import { SimRunner } from '../../../src/core/pid/sim-runner'
import type { SimConfig, PlantModel, ControllerConfig } from '../../../src/core/pid/types'

const testPlant: PlantModel = {
  inertiaKgM2: 0.001,
  motorTimeConstantMs: 5,
  dragCoeff: 0.01,
  maxTorqueNm: 1.0,
}

const baseConfig: SimConfig = {
  controller: {
    gains: { kp: 0.005, ki: 0.015, kd: 0.0005, kff: 0 },
    filters: { gyroLowpassHz: 200, dtermLowpassHz: 100 },
    loopRateHz: 4000,
    iTermLimitNm: 0.5,
    iTermRelax: false,
  },
  plant: testPlant,
  noise: { kind: 'gaussian', gaussianStdDegS: 0, seed: 42 },
  setpoint: { kind: 'step', amplitudeDegS: 200, startMs: 100 },
  disturbances: [],
  durationMs: 1000,
}

describe('SimRunner', () => {
  it('tick(16) returns ~16 samples at 4 kHz (64 steps / 4 decimation)', () => {
    const runner = new SimRunner(baseConfig)
    // At 4 kHz, 16ms = 64 steps. decimateEvery = max(1, round(4000/1000)) = 4
    // So 64 / 4 = 16 output samples
    const samples = runner.tick(16)
    expect(samples.length).toBe(16)
  })

  it('elapsedMs advances correctly after multiple ticks', () => {
    const runner = new SimRunner(baseConfig)
    runner.tick(16)
    runner.tick(16)
    // 2 ticks × 16ms each = 32ms of sim time
    // At 4 kHz, 32ms = 128 steps → 128 * (1/4000) * 1000 = 32ms
    expect(runner.elapsedMs).toBeCloseTo(32, 0)
  })

  it('reset() clears state and elapsedMs returns to 0', () => {
    const runner = new SimRunner(baseConfig)
    runner.tick(100)
    expect(runner.elapsedMs).toBeGreaterThan(0)

    runner.reset(baseConfig)
    expect(runner.elapsedMs).toBe(0)
  })

  it('output samples have correct SimSample structure', () => {
    const runner = new SimRunner(baseConfig)
    const samples = runner.tick(16)
    expect(samples.length).toBeGreaterThan(0)
    const s = samples[0]
    expect(typeof s.tMs).toBe('number')
    expect(typeof s.setpointDegS).toBe('number')
    expect(typeof s.gyroDegS).toBe('number')
    expect(typeof s.gyroMeasuredDegS).toBe('number')
    expect(typeof s.errorDegS).toBe('number')
    expect(typeof s.pTerm).toBe('number')
    expect(typeof s.iTerm).toBe('number')
    expect(typeof s.dTerm).toBe('number')
    expect(typeof s.ffTerm).toBe('number')
    expect(typeof s.motorOutput).toBe('number')
    expect(typeof s.saturated).toBe('boolean')
  })

  it('reset() allows re-simulation from scratch with same results as fresh instance', () => {
    const runner1 = new SimRunner(baseConfig)
    const samples1 = runner1.tick(50)

    const runner2 = new SimRunner(baseConfig)
    runner2.tick(100) // advance past initial state
    runner2.reset(baseConfig)
    const samples2 = runner2.tick(50)

    expect(samples1.length).toBe(samples2.length)
    for (let i = 0; i < samples1.length; i++) {
      expect(samples1[i].tMs).toBeCloseTo(samples2[i].tMs, 5)
      expect(samples1[i].gyroDegS).toBeCloseTo(samples2[i].gyroDegS, 5)
      expect(samples1[i].motorOutput).toBeCloseTo(samples2[i].motorOutput, 5)
    }
  })

  it('accumulated elapsedMs matches sum of tick durations', () => {
    const runner = new SimRunner(baseConfig)
    runner.tick(10)
    runner.tick(20)
    runner.tick(30)
    // 10+20+30 = 60ms
    expect(runner.elapsedMs).toBeCloseTo(60, 0)
  })

  it('errorDegS = setpointDegS - gyroDegS in each sample', () => {
    const runner = new SimRunner(baseConfig)
    const samples = runner.tick(100)
    for (const s of samples) {
      expect(s.errorDegS).toBeCloseTo(s.setpointDegS - s.gyroDegS, 10)
    }
  })
})

describe('SimRunner.updateConfig (live in-place adjust)', () => {
  // baseConfig's setpoint steps at 100ms, so ticks must pass 100ms for the
  // controller to actually do anything.
  it('updateConfig with the same config leaves the trajectory unchanged (no reset)', () => {
    const a = new SimRunner(baseConfig)
    a.tick(150)
    const aNext = a.tick(30)

    const b = new SimRunner(baseConfig)
    b.tick(150)
    b.updateConfig(baseConfig)
    const bNext = b.tick(30)

    expect(bNext.length).toBe(aNext.length)
    for (let i = 0; i < aNext.length; i++) {
      expect(bNext[i].motorOutput).toBeCloseTo(aNext[i].motorOutput, 8)
      expect(bNext[i].gyroDegS).toBeCloseTo(aNext[i].gyroDegS, 8)
    }
  })

  it('does not reset elapsed time or step index', () => {
    const runner = new SimRunner(baseConfig)
    runner.tick(100)
    const before = runner.elapsedMs
    expect(before).toBeGreaterThan(0)

    runner.updateConfig({
      ...baseConfig,
      controller: { ...baseConfig.controller, gains: { kp: 0.02, ki: 0.02, kd: 0.001, kff: 0 } },
    })

    expect(runner.elapsedMs).toBeCloseTo(before, 5)
    runner.tick(10)
    expect(runner.elapsedMs).toBeCloseTo(before + 10, 0)
  })

  it('applies new gains to subsequent output (diverges from unchanged runner)', () => {
    const a = new SimRunner(baseConfig)
    a.tick(150)
    const aNext = a.tick(30)

    const b = new SimRunner(baseConfig)
    b.tick(150)
    b.updateConfig({
      ...baseConfig,
      controller: { ...baseConfig.controller, gains: { kp: 0.05, ki: 0.05, kd: 0.005, kff: 0 } },
    })
    const bNext = b.tick(30)

    let maxDiff = 0
    for (let i = 0; i < aNext.length; i++) {
      maxDiff = Math.max(maxDiff, Math.abs(aNext[i].motorOutput - bNext[i].motorOutput))
    }
    expect(maxDiff).toBeGreaterThan(0.01)
  })

  it('preserves integrator state across a gain change (not a fresh restart)', () => {
    // A runner that keeps running and gets updateConfig'd should NOT match a
    // fresh runner started with the new gains — because its integrator/plant
    // state carried over.
    const newGains = { kp: 0.05, ki: 0.05, kd: 0.005, kff: 0 }
    const newConfig = {
      ...baseConfig,
      controller: { ...baseConfig.controller, gains: newGains },
    }

    const live = new SimRunner(baseConfig)
    live.tick(150)
    live.updateConfig(newConfig)
    const liveNext = live.tick(50)

    const fresh = new SimRunner(newConfig)
    fresh.tick(150)
    const freshNext = fresh.tick(50)

    // Same elapsed time, but different trajectory because live carried its
    // accumulated state through the swap.
    let differs = false
    for (let i = 0; i < liveNext.length; i++) {
      if (Math.abs(liveNext[i].motorOutput - freshNext[i].motorOutput) > 1e-6) {
        differs = true
        break
      }
    }
    expect(differs).toBe(true)
  })

  it('with a changed loop rate preserves elapsed time and keeps advancing', () => {
    const runner = new SimRunner(baseConfig) // 4 kHz
    runner.tick(100)
    const before = runner.elapsedMs

    runner.updateConfig({
      ...baseConfig,
      controller: { ...baseConfig.controller, loopRateHz: 8000 },
    })

    expect(runner.elapsedMs).toBeCloseTo(before, 0)
    runner.tick(10)
    expect(runner.elapsedMs).toBeCloseTo(before + 10, 0)
  })
})
