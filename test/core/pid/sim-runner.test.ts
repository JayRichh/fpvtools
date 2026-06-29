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
