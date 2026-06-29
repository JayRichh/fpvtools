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
})
