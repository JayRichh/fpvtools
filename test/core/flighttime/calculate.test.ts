import { describe, it, expect } from 'vitest'
import { computeFlightTime, FLIGHTTIME_DEFAULTS, cellNominalV } from '../../../src/core/flighttime/calculate'

describe('computeFlightTime', () => {
  it('derives hover current from AUW × efficiency → power → current', () => {
    const r = computeFlightTime(FLIGHTTIME_DEFAULTS)
    // 1200 g / 5.5 g/W = 218.18 W; 6S Li-ion nominal = 21.6 V → 10.1 A
    const expectedA = (1200 / 5.5) / (6 * 3.6)
    expect(r.hoverCurrentA).toBeCloseTo(expectedA, 3)
  })

  it('heavier craft → shorter hover time (auwG is wired)', () => {
    const light = computeFlightTime({ ...FLIGHTTIME_DEFAULTS, auwG: 800 })
    const heavy = computeFlightTime({ ...FLIGHTTIME_DEFAULTS, auwG: 1600 })
    expect(heavy.hoverCurrentA).toBeGreaterThan(light.hoverCurrentA)
    expect(heavy.hoverTimeMin).toBeLessThan(light.hoverTimeMin)
  })

  it('better efficiency → longer hover time (efficiency is wired)', () => {
    const poor = computeFlightTime({ ...FLIGHTTIME_DEFAULTS, hoverEfficiencyGPerW: 3 })
    const good = computeFlightTime({ ...FLIGHTTIME_DEFAULTS, hoverEfficiencyGPerW: 8 })
    expect(good.hoverTimeMin).toBeGreaterThan(poor.hoverTimeMin)
  })

  it('LiPo uses 3.7 V/cell, Li-ion 3.6 V/cell', () => {
    expect(cellNominalV('lipo')).toBe(3.7)
    expect(cellNominalV('liion')).toBe(3.6)
    const lipo = computeFlightTime({ ...FLIGHTTIME_DEFAULTS, chemistry: 'lipo' })
    const liion = computeFlightTime({ ...FLIGHTTIME_DEFAULTS, chemistry: 'liion' })
    // Same power at higher voltage → less current
    expect(lipo.hoverCurrentA).toBeLessThan(liion.hoverCurrentA)
  })

  it('usable capacity subtracts reserve from the usable fraction', () => {
    const r = computeFlightTime(FLIGHTTIME_DEFAULTS)
    // 4200 mAh × 0.8 − 4200 × 0.2 = 2520 mAh
    expect(r.usableCapacityMah).toBeCloseTo(2520, 5)
  })

  it('hover time arithmetic: mAh / (A × 1000/60)', () => {
    const r = computeFlightTime(FLIGHTTIME_DEFAULTS)
    expect(r.hoverTimeMin).toBeCloseTo(r.usableCapacityMah / (r.hoverCurrentA * 1000 / 60), 6)
  })

  it('matches power/pack physics chain for the same setup', () => {
    // Cross-check: same AUW/efficiency/voltage should give same hover current
    const r = computeFlightTime({ ...FLIGHTTIME_DEFAULTS, chemistry: 'liion', cellCount: 6, auwG: 1200, hoverEfficiencyGPerW: 5 })
    const hoverW = 1200 / 5
    expect(r.hoverCurrentA).toBeCloseTo(hoverW / 21.6, 6)
  })
})
