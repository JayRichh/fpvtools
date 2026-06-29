import { describe, it, expect } from 'vitest'
import { BiquadFilter } from '../../../src/core/shared/biquad'

const SAMPLE_RATE = 48000

/**
 * Feed `n` samples of value `x` through a filter and return the last output.
 * Enough iterations let the filter settle to its steady-state response.
 */
function driveConstant(filter: BiquadFilter, x: number, n = 4000): number {
  let y = 0
  for (let i = 0; i < n; i++) y = filter.process(x)
  return y
}

/**
 * Drive the filter with a sine wave at `freq` Hz and return the peak output
 * amplitude measured over the last full cycle.
 */
function sineAmplitude(filter: BiquadFilter, freq: number, cycles = 50): number {
  const period = Math.round(SAMPLE_RATE / freq)
  const total  = cycles * period
  let peak = 0
  for (let i = 0; i < total; i++) {
    const x = Math.sin(2 * Math.PI * freq * i / SAMPLE_RATE)
    const y = filter.process(x)
    // Only measure the last cycle (steady state)
    if (i >= total - period) peak = Math.max(peak, Math.abs(y))
  }
  return peak
}

describe('BiquadFilter — lowpass', () => {
  it('passes DC (0 Hz) at unity gain', () => {
    const lp = BiquadFilter.lowpass(1000, SAMPLE_RATE, 0.707)
    const out = driveConstant(lp, 1.0)
    // DC should be within 1% of 1.0
    expect(out).toBeCloseTo(1.0, 2)
  })

  it('attenuates a high-frequency sine well above the cutoff', () => {
    // fc = 100 Hz; test sine at 10 000 Hz — should be very small
    const lp = BiquadFilter.lowpass(100, SAMPLE_RATE, 0.707)
    const amp = sineAmplitude(lp, 10000)
    expect(amp).toBeLessThan(0.01)
  })
})

describe('BiquadFilter — notch', () => {
  it('heavily attenuates a sine at the notch centre frequency', () => {
    const fc = 1000
    const notch = BiquadFilter.notch(fc, SAMPLE_RATE, 5) // narrow notch
    const amp = sineAmplitude(notch, fc, 200)
    // The notch should reduce amplitude to less than 5 % of the input peak (1.0)
    expect(amp).toBeLessThan(0.05)
  })

  it('passes a sine well away from the notch with near-unity amplitude', () => {
    const notch = BiquadFilter.notch(1000, SAMPLE_RATE, 5)
    // Test at 100 Hz — far from the 1 000 Hz notch
    const amp = sineAmplitude(notch, 100)
    expect(amp).toBeGreaterThan(0.9)
  })
})

describe('BiquadFilter — reset', () => {
  it('zeroes internal state so output restarts cleanly', () => {
    const lp = BiquadFilter.lowpass(1000, SAMPLE_RATE, 0.707)
    // Charge up the filter state
    for (let i = 0; i < 200; i++) lp.process(1.0)
    lp.reset()
    // Immediately after reset, an impulse should produce only b0 * 1
    // (both delay lines are zero, so the first output = b0*x[0])
    const first = lp.process(0)
    expect(first).toBe(0)
  })
})

describe('BiquadFilter — peaking', () => {
  it('boosts at centre frequency when gainDb > 0', () => {
    const fc = 1000
    const flat  = sineAmplitude(BiquadFilter.lowpass(20000, SAMPLE_RATE, 0.5), fc)
    const peak  = sineAmplitude(BiquadFilter.peaking(fc, SAMPLE_RATE, 1, 6), fc, 100)
    // With +6 dB, output should be roughly double the flat reference
    expect(peak).toBeGreaterThan(flat * 1.5)
  })
})
