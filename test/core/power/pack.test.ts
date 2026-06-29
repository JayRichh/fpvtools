import { describe, it, expect } from 'vitest'
import { computePack } from '../../../src/core/power/pack'
import { CELL_LIBRARY } from '../../../src/core/power/cells'
import type { PackConfig, FlightModel } from '../../../src/core/power/types'

const p42a = CELL_LIBRARY['Molicel P42A']

const pack6S1P: PackConfig = {
  cell: p42a,
  series: 6,
  parallel: 1,
  wiringOverheadPct: 5,
}

const flightLongRange: FlightModel = {
  auwG: 1200,
  hoverEfficiencyGPerW: 5,
  cruiseFactor: 0.7,
  cruiseSpeedMs: 15,
  usableCapacityPct: 80,
}

describe('computePack — 6S1P P42A, long-range build', () => {
  const r = computePack(pack6S1P, flightLongRange)

  it('nominalV is 21.6 V (6 × 3.6)', () => {
    expect(r.nominalV).toBeCloseTo(21.6, 5)
  })

  it('capacityMah is 4200 (1P)', () => {
    expect(r.capacityMah).toBe(4200)
  })

  it('energyWh is 90.72 Wh', () => {
    expect(r.energyWh).toBeCloseTo(90.72, 2)
  })

  it('maxContinuousA is 45 A (1P × 45)', () => {
    expect(r.maxContinuousA).toBe(45)
  })

  it('packIRmohm is 72 mΩ (12 mΩ × 6S / 1P)', () => {
    expect(r.packIRmohm).toBeCloseTo(72, 5)
  })

  it('hoverCurrentA ≈ 11.11 A (240 W / 21.6 V)', () => {
    expect(r.hoverCurrentA).toBeCloseTo(11.11, 1)
  })

  it('cruiseCurrentA ≈ 7.78 A (hoverA × 0.7)', () => {
    expect(r.cruiseCurrentA).toBeCloseTo(r.hoverCurrentA * 0.7, 3)
  })

  it('hoverTimeMin is reasonable for long range (> 10 min)', () => {
    // 3360 mAh / 11.11 A / 1000 * 60 ≈ 18.1 min
    expect(r.hoverTimeMin).toBeGreaterThan(10)
    expect(r.hoverTimeMin).toBeLessThan(60)
  })

  it('cruiseTimeMin is greater than hoverTimeMin (lower current)', () => {
    expect(r.cruiseTimeMin).toBeGreaterThan(r.hoverTimeMin)
  })

  it('hoverTimeMin matches formula: (usableMah/1000) / hoverCurrentA * 60', () => {
    const usableMah = 4200 * 0.8
    const expected = (usableMah / 1000) / r.hoverCurrentA * 60
    expect(r.hoverTimeMin).toBeCloseTo(expected, 6)
  })

  it('C-rate check passes — hoverCurrent well below max continuous', () => {
    expect(r.cRateOk).toBe(true)
    expect(r.cRateMargin).toBeGreaterThan(3)
  })

  it('no sag warning — voltage sag is small relative to pack voltage', () => {
    expect(r.sagWarning).toBe(false)
    expect(r.voltageSagV).toBeLessThan(r.nominalV * 0.1)
  })

  it('range is positive and plausible', () => {
    expect(r.rangeKm).toBeGreaterThan(5)
  })
})

describe('computePack — parallel cells increase capacity', () => {
  it('2P doubles capacity vs 1P', () => {
    const r1 = computePack({ ...pack6S1P, parallel: 1 }, flightLongRange)
    const r2 = computePack({ ...pack6S1P, parallel: 2 }, flightLongRange)
    expect(r2.capacityMah).toBe(r1.capacityMah * 2)
    expect(r2.maxContinuousA).toBe(r1.maxContinuousA * 2)
  })

  it('2P pack IR is halved vs 1P', () => {
    const r1 = computePack({ ...pack6S1P, parallel: 1 }, flightLongRange)
    const r2 = computePack({ ...pack6S1P, parallel: 2 }, flightLongRange)
    expect(r2.packIRmohm).toBeCloseTo(r1.packIRmohm / 2, 5)
  })
})
