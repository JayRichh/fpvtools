import { describe, it, expect } from 'vitest'
import { computeLinkBudget } from '../../../src/core/rf/linkBudget'
import type { LinkBudgetInput } from '../../../src/core/rf/types'

const baseInput: LinkBudgetInput = {
  txPowerMw: 100,
  txGainDbi: 2,
  rxGainDbi: 2,
  frequencyMhz: 2400,
  packetRateHz: 50,
}

describe('computeLinkBudget', () => {
  it('returns expected shape', () => {
    const result = computeLinkBudget(baseInput)
    expect(result).toHaveProperty('pathLossDb')
    expect(result).toHaveProperty('linkMarginDb')
    expect(result).toHaveProperty('theoreticalRangeKm')
    expect(result).toHaveProperty('sensitivityDbm')
    expect(result).toHaveProperty('txPowerDbm')
  })

  it('txPowerDbm matches mwToDbm(100) ≈ 20', () => {
    const result = computeLinkBudget(baseInput)
    expect(result.txPowerDbm).toBeCloseTo(20, 2)
  })

  it('higher TX power gives longer range', () => {
    const low = computeLinkBudget({ ...baseInput, txPowerMw: 25 })
    const high = computeLinkBudget({ ...baseInput, txPowerMw: 1000 })
    expect(high.theoreticalRangeKm).toBeGreaterThan(low.theoreticalRangeKm)
  })

  it('915MHz gives longer range than 2.4GHz at same power', () => {
    const result915 = computeLinkBudget({ ...baseInput, frequencyMhz: 915 })
    const result2400 = computeLinkBudget({ ...baseInput, frequencyMhz: 2400 })
    expect(result915.theoreticalRangeKm).toBeGreaterThan(result2400.theoreticalRangeKm)
  })

  it('915MHz gives longer range than 5.8GHz at same power', () => {
    const result915 = computeLinkBudget({ ...baseInput, frequencyMhz: 915 })
    const result5800 = computeLinkBudget({ ...baseInput, frequencyMhz: 5800 })
    expect(result915.theoreticalRangeKm).toBeGreaterThan(result5800.theoreticalRangeKm)
  })

  it('lower packet rate gives better sensitivity (lower dBm value)', () => {
    const slow = computeLinkBudget({ ...baseInput, packetRateHz: 25 })
    const fast = computeLinkBudget({ ...baseInput, packetRateHz: 500 })
    // sensitivity is more negative (better) at lower rate
    expect(slow.sensitivityDbm).toBeLessThan(fast.sensitivityDbm)
  })

  it('lower packet rate gives longer range', () => {
    const slow = computeLinkBudget({ ...baseInput, packetRateHz: 25 })
    const fast = computeLinkBudget({ ...baseInput, packetRateHz: 500 })
    expect(slow.theoreticalRangeKm).toBeGreaterThan(fast.theoreticalRangeKm)
  })

  it('higher antenna gain increases link margin', () => {
    const base = computeLinkBudget(baseInput)
    const highGain = computeLinkBudget({ ...baseInput, txGainDbi: 6, rxGainDbi: 6 })
    expect(highGain.linkMarginDb).toBeGreaterThan(base.linkMarginDb)
  })

  it('theoretical range is a positive finite number', () => {
    const result = computeLinkBudget(baseInput)
    expect(result.theoreticalRangeKm).toBeGreaterThan(0)
    expect(isFinite(result.theoreticalRangeKm)).toBe(true)
  })

  it('link margin is evaluated at the user distance, not pinned to 1 km', () => {
    const near = computeLinkBudget({ ...baseInput, distanceKm: 1 })
    const far = computeLinkBudget({ ...baseInput, distanceKm: 10 })
    expect(far.linkMarginDb).toBeLessThan(near.linkMarginDb)
    // FSPL doubles distance → +6 dB: 10× distance → +20 dB
    expect(near.linkMarginDb - far.linkMarginDb).toBeCloseTo(20, 1)
  })

  it('cable and connector losses reduce margin and range', () => {
    const lossless = computeLinkBudget(baseInput)
    const lossy = computeLinkBudget({ ...baseInput, cableLossDb: 2, connectorLossDb: 1 })
    expect(lossy.linkMarginDb).toBeCloseTo(lossless.linkMarginDb - 3, 5)
    expect(lossy.theoreticalRangeKm).toBeLessThan(lossless.theoreticalRangeKm)
  })

  it('usable range with a fade margin target is shorter than theoretical', () => {
    const r = computeLinkBudget({ ...baseInput, targetMarginDb: 12 })
    expect(r.usableRangeKm).toBeLessThan(r.theoreticalRangeKm)
    // 12 dB target → range factor 10^(−12/20) ≈ 0.251
    expect(r.usableRangeKm / r.theoreticalRangeKm).toBeCloseTo(Math.pow(10, -12 / 20), 3)
  })

  it('Fresnel radius: r = 8.657·√(d_km/f_GHz)', () => {
    const r = computeLinkBudget({ ...baseInput, distanceKm: 4, frequencyMhz: 2400 })
    expect(r.fresnelRadiusM).toBeCloseTo(8.657 * Math.sqrt(4 / 2.4), 3)
  })

  it('defaults keep prior behavior (distance 1 km, no losses)', () => {
    const r = computeLinkBudget(baseInput)
    const explicit = computeLinkBudget({ ...baseInput, distanceKm: 1, cableLossDb: 0, connectorLossDb: 0, targetMarginDb: 0 })
    expect(r.pathLossDb).toBeCloseTo(explicit.pathLossDb, 6)
    expect(r.linkMarginDb).toBeCloseTo(explicit.linkMarginDb, 6)
    expect(r.usableRangeKm).toBeCloseTo(r.theoreticalRangeKm, 6)
  })
})
