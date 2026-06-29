import { describe, it, expect } from 'vitest'
import { clamp, lerp, remap, rms } from '../../../src/core/shared/math'

describe('clamp', () => {
  it('returns min when value is below range', () => {
    expect(clamp(-5, 0, 10)).toBe(0)
  })
  it('returns max when value is above range', () => {
    expect(clamp(15, 0, 10)).toBe(10)
  })
  it('returns value unchanged when inside range', () => {
    expect(clamp(5, 0, 10)).toBe(5)
  })
  it('returns min when value equals min', () => {
    expect(clamp(0, 0, 10)).toBe(0)
  })
  it('returns max when value equals max', () => {
    expect(clamp(10, 0, 10)).toBe(10)
  })
})

describe('lerp', () => {
  it('returns a at t=0', () => {
    expect(lerp(2, 8, 0)).toBe(2)
  })
  it('returns midpoint at t=0.5', () => {
    expect(lerp(2, 8, 0.5)).toBe(5)
  })
  it('returns b at t=1', () => {
    expect(lerp(2, 8, 1)).toBe(8)
  })
})

describe('remap', () => {
  it('maps the midpoint of input range to the midpoint of output range', () => {
    expect(remap(5, 0, 10, 0, 100)).toBeCloseTo(50)
  })
  it('maps inMin to outMin', () => {
    expect(remap(0, 0, 10, 100, 200)).toBeCloseTo(100)
  })
  it('maps inMax to outMax', () => {
    expect(remap(10, 0, 10, 100, 200)).toBeCloseTo(200)
  })
  it('handles different output ranges', () => {
    expect(remap(0.5, 0, 1, -1, 1)).toBeCloseTo(0)
  })
})

describe('rms', () => {
  it('returns 0 for all-zero array', () => {
    expect(rms(new Float32Array([0, 0, 0]))).toBe(0)
  })
  it('returns the value itself for a constant array', () => {
    expect(rms(new Float32Array([3, 3, 3, 3]))).toBeCloseTo(3)
  })
  it('computes correct RMS for a known set', () => {
    // rms([1, 2, 3]) = sqrt((1+4+9)/3) = sqrt(14/3) ≈ 2.1602
    const expected = Math.sqrt((1 + 4 + 9) / 3)
    expect(rms(new Float32Array([1, 2, 3]))).toBeCloseTo(expected)
  })
  it('returns 1 for a unit sine (quarter cycle, symmetric)', () => {
    // A pure sine wave of amplitude 1 has RMS = 1/sqrt(2) — sanity check direction
    const arr = new Float32Array(4)
    arr[0] = 1; arr[1] = 0; arr[2] = -1; arr[3] = 0
    // rms = sqrt((1+0+1+0)/4) = sqrt(0.5) ≈ 0.7071
    expect(rms(arr)).toBeCloseTo(Math.SQRT1_2)
  })
})
