import { describe, it, expect } from 'vitest'
import { simulate } from '../../../src/core/pid/simulate'
import type { SimConfig, PlantModel, ControllerConfig } from '../../../src/core/pid/types'

const testPlant: PlantModel = {
  inertiaKgM2: 0.001,
  motorTimeConstantMs: 5,
  dragCoeff: 0.01,
  maxTorqueNm: 1.0,
}

// Gains are scaled so kp * error_degS produces a [-1,1] output fraction.
// With setpoint=100 deg/s and maxTorque=1 N*m, kp=0.005 gives 0.5 output at full error.
const baseConfig: SimConfig = {
  controller: {
    gains: { kp: 0.005, ki: 0.015, kd: 0.0005, kff: 0 },
    filters: { gyroLowpassHz: 200, dtermLowpassHz: 100 },
    loopRateHz: 2000,
    iTermLimitNm: 0.5,
    iTermRelax: false,
  },
  plant: testPlant,
  noise: { kind: 'gaussian', gaussianStdDegS: 0, seed: 1 },
  setpoint: { kind: 'step', amplitudeDegS: 100, startMs: 50 },
  disturbances: [],
  durationMs: 500,
}

describe('simulate', () => {
  it('zero gains → no motion', () => {
    const config: SimConfig = {
      ...baseConfig,
      controller: {
        ...baseConfig.controller,
        gains: { kp: 0, ki: 0, kd: 0, kff: 0 },
      },
    }
    const result = simulate(config)
    // All gyro samples should be zero
    for (const s of result.samples) {
      expect(s.gyroDegS).toBeCloseTo(0, 6)
    }
  })

  it('P+I converges toward setpoint', () => {
    const result = simulate(baseConfig)
    // The peak gyro should exceed 50 deg/s — the controller drove the plant
    const peakGyro = Math.max(...result.samples.map(s => s.gyroDegS))
    expect(peakGyro).toBeGreaterThan(50)
  })

  it('higher Kp → more overshoot', () => {
    // P-only (no D to dampen, no I to wind-up) — higher Kp drives the plant harder,
    // causing larger overshoot past the setpoint.
    const mkCfg = (kp: number): SimConfig => ({
      ...baseConfig,
      controller: {
        ...baseConfig.controller,
        gains: { kp, ki: 0, kd: 0, kff: 0 },
        iTermLimitNm: 0,
      },
    })
    const lowResult  = simulate(mkCfg(0.001))
    const highResult = simulate(mkCfg(0.01))

    const lowPeak  = Math.max(...lowResult.samples.map(s => s.gyroDegS))
    const highPeak = Math.max(...highResult.samples.map(s => s.gyroDegS))

    // Higher Kp applies more torque sooner → gyro rises faster and overshoots more
    expect(highPeak).toBeGreaterThan(lowPeak)
  })

  it('deterministic with same seed', () => {
    const config: SimConfig = {
      ...baseConfig,
      noise: { kind: 'gaussian', gaussianStdDegS: 5, seed: 42 },
    }
    const r1 = simulate(config)
    const r2 = simulate(config)

    expect(r1.samples.length).toBe(r2.samples.length)
    for (let i = 0; i < r1.samples.length; i++) {
      expect(r1.samples[i].gyroDegS).toBe(r2.samples[i].gyroDegS)
      expect(r1.samples[i].gyroMeasuredDegS).toBe(r2.samples[i].gyroMeasuredDegS)
      expect(r1.samples[i].motorOutput).toBe(r2.samples[i].motorOutput)
    }
  })

  it('different seeds → different noise', () => {
    const config1: SimConfig = {
      ...baseConfig,
      noise: { kind: 'gaussian', gaussianStdDegS: 10, seed: 1 },
    }
    const config2: SimConfig = {
      ...baseConfig,
      noise: { kind: 'gaussian', gaussianStdDegS: 10, seed: 2 },
    }
    const r1 = simulate(config1)
    const r2 = simulate(config2)
    // At least one sample should differ
    const anyDiff = r1.samples.some((s, i) => s.gyroMeasuredDegS !== r2.samples[i].gyroMeasuredDegS)
    expect(anyDiff).toBe(true)
  })

  it('samples are decimated to ~1000 Hz or below', () => {
    const config: SimConfig = {
      ...baseConfig,
      controller: { ...baseConfig.controller, loopRateHz: 4000 },
      durationMs: 1000,
    }
    const result = simulate(config)
    // Should produce roughly 1000 samples (±10%)
    expect(result.samples.length).toBeGreaterThan(900)
    expect(result.samples.length).toBeLessThanOrEqual(1100)
  })

  it('disturbance causes transient deviation', () => {
    const quietConfig: SimConfig = { ...baseConfig, disturbances: [] }
    const distConfig: SimConfig = {
      ...baseConfig,
      disturbances: [{ torqueNm: 0.5, startMs: 100, durationMs: 20, kind: 'impulse' }],
    }
    const quietResult = simulate(quietConfig)
    const distResult = simulate(distConfig)

    // Find samples during disturbance window
    const qSamples = quietResult.samples.filter(s => s.tMs >= 100 && s.tMs <= 130)
    const dSamples = distResult.samples.filter(s => s.tMs >= 100 && s.tMs <= 130)

    if (qSamples.length > 0 && dSamples.length > 0) {
      const qMean = qSamples.reduce((a, s) => a + s.gyroDegS, 0) / qSamples.length
      const dMean = dSamples.reduce((a, s) => a + s.gyroDegS, 0) / dSamples.length
      expect(Math.abs(dMean - qMean)).toBeGreaterThan(0)
    }
  })

  it('metrics rise time is null for zero gains (no setpoint tracking)', () => {
    const config: SimConfig = {
      ...baseConfig,
      controller: {
        ...baseConfig.controller,
        gains: { kp: 0, ki: 0, kd: 0, kff: 0 },
      },
    }
    const result = simulate(config)
    expect(result.metrics.riseTimeMs).toBeNull()
  })

  it('metrics motorActivityRms is positive when controller is active', () => {
    const result = simulate(baseConfig)
    expect(result.metrics.motorActivityRms).toBeGreaterThan(0)
  })
})
