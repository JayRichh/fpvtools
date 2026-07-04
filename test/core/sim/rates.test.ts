import { describe, it, expect } from 'vitest'
import { actualRateCurve } from '../../../src/core/sim/rates'
import type { ActualRates } from '../../../src/core/sim/rates'

const r: ActualRates = { centerSensitivityDegS: 200, maxRateDegS: 900, expo: 0.54 }

describe('actualRateCurve (Betaflight Actual Rates)', () => {
  it('reaches exactly maxRate at full deflection, both directions', () => {
    expect(actualRateCurve(1, r)).toBeCloseTo(900, 6)
    expect(actualRateCurve(-1, r)).toBeCloseTo(-900, 6)
  })

  it('is zero at center and odd-symmetric', () => {
    expect(actualRateCurve(0, r)).toBe(0)
    for (const x of [0.1, 0.35, 0.7, 0.95]) {
      expect(actualRateCurve(-x, r)).toBeCloseTo(-actualRateCurve(x, r), 9)
    }
  })

  it('center slope matches centerSensitivity (linear region)', () => {
    const eps = 1e-4
    const slope = actualRateCurve(eps, r) / eps
    expect(slope).toBeCloseTo(r.centerSensitivityDegS, 1)
  })

  it('is monotonically increasing over the stick range', () => {
    let prev = actualRateCurve(-1, r)
    for (let x = -0.99; x <= 1.0001; x += 0.01) {
      const v = actualRateCurve(x, r)
      expect(v).toBeGreaterThanOrEqual(prev - 1e-9)
      prev = v
    }
  })

  it('more expo → softer mid-stick at the same endpoints', () => {
    const soft: ActualRates = { ...r, expo: 0.9 }
    const hard: ActualRates = { ...r, expo: 0 }
    expect(actualRateCurve(0.5, soft)).toBeLessThan(actualRateCurve(0.5, hard))
    expect(actualRateCurve(1, soft)).toBeCloseTo(actualRateCurve(1, hard), 6)
  })

  it('clamps stick input beyond ±1', () => {
    expect(actualRateCurve(1.5, r)).toBeCloseTo(900, 6)
    expect(actualRateCurve(-2, r)).toBeCloseTo(-900, 6)
  })

  it('centerSensitivity above maxRate does not overshoot maxRate contribution', () => {
    const odd: ActualRates = { centerSensitivityDegS: 500, maxRateDegS: 400, expo: 0 }
    // stickMovement clamps at 0 → pure linear centerSensitivity curve
    expect(actualRateCurve(1, odd)).toBeCloseTo(500, 6)
    expect(actualRateCurve(0.5, odd)).toBeCloseTo(250, 6)
  })
})
