import { describe, it, expect } from 'vitest'
import { PT1Filter, createFilterBank } from '../../../src/core/pid/filters'

describe('PT1Filter', () => {
  it('converges to DC input over time', () => {
    const filter = PT1Filter.fromCutoff(100, 1000) // 100 Hz cutoff, 1 kHz sample rate
    const target = 5.0
    let out = 0
    for (let i = 0; i < 500; i++) out = filter.process(target)
    // After many samples it should be very close to the target
    expect(out).toBeCloseTo(target, 2)
  })

  it('attenuates high-frequency input significantly', () => {
    // Low cutoff, high frequency input → large attenuation
    const filter = PT1Filter.fromCutoff(10, 1000) // 10 Hz cutoff at 1 kHz
    // Drive with a sine at 100 Hz (10x cutoff) — steady-state amplitude should be much smaller
    const amplitude = 10
    const freq = 100 // Hz
    const fs = 1000
    let sumSq = 0
    const burnIn = 500
    const measure = 200
    // Burn in
    for (let i = 0; i < burnIn; i++) {
      filter.process(amplitude * Math.sin(2 * Math.PI * freq * i / fs))
    }
    // Measure
    for (let i = burnIn; i < burnIn + measure; i++) {
      const y = filter.process(amplitude * Math.sin(2 * Math.PI * freq * i / fs))
      sumSq += y * y
    }
    const rmsOut = Math.sqrt(sumSq / measure)
    // Theoretical attenuation at f=fc*10: 1/sqrt(1+(10)^2) ≈ 0.0995
    // So rms output should be well below amplitude * 0.5
    expect(rmsOut).toBeLessThan(amplitude * 0.5)
  })

  it('reset returns state to zero', () => {
    const f = new PT1Filter(0.5)
    f.process(100)
    f.reset()
    expect(f.process(0)).toBe(0)
  })

  it('fromCutoff produces alpha between 0 and 1', () => {
    const f = PT1Filter.fromCutoff(100, 2000)
    // Verify it actually processes without NaN
    const out = f.process(1.0)
    expect(out).toBeGreaterThan(0)
    expect(out).toBeLessThanOrEqual(1)
    expect(isNaN(out)).toBe(false)
  })
})

describe('createFilterBank', () => {
  it('creates a bank without notch when not configured', () => {
    const bank = createFilterBank({ gyroLowpassHz: 100, dtermLowpassHz: 70 }, 4000)
    expect(bank.notch).toBeNull()
    // Both filters should work
    expect(bank.gyro.process(1)).toBeGreaterThan(0)
    expect(bank.dterm.process(1)).toBeGreaterThan(0)
  })

  it('creates a bank with notch when configured', () => {
    const bank = createFilterBank(
      { gyroLowpassHz: 100, dtermLowpassHz: 70, notch: { centerHz: 200, q: 2 } },
      4000,
    )
    expect(bank.notch).not.toBeNull()
  })
})
