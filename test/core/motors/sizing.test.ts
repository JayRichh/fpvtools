import { describe, it, expect } from 'vitest'
import { computeSizing, MOTOR_LIBRARY, PROP_LIBRARY } from '../../../src/core/motors/sizing'

describe('computeSizing', () => {
  it('2806.5 1300KV on 6S with 7040 props, 1200g AUW, 4 motors → thrust-to-weight > 2', () => {
    const result = computeSizing({
      motor: MOTOR_LIBRARY['iFlight 2806.5 1300KV'],
      prop: PROP_LIBRARY['Gemfan 7040'],
      cellCount: 6,
      auwG: 1200,
      motorCount: 4,
    })
    expect(result.thrustToWeight).toBeGreaterThan(2)
  })

  it('higher KV motor produces higher max RPM at equal cell count', () => {
    const low = computeSizing({
      motor: MOTOR_LIBRARY['iFlight 2806.5 1300KV'],   // 1300 KV
      prop: PROP_LIBRARY['Gemfan 5143'],
      cellCount: 4,
      auwG: 700,
      motorCount: 4,
    })
    const high = computeSizing({
      motor: MOTOR_LIBRARY['iFlight 2207 1750KV'],       // 1750 KV
      prop: PROP_LIBRARY['Gemfan 5143'],
      cellCount: 4,
      auwG: 700,
      motorCount: 4,
    })
    expect(high.maxRpm).toBeGreaterThan(low.maxRpm)
  })

  it('hover throttle follows √(thrust fraction): 25% thrust fraction → 50% throttle', () => {
    // Pick a config, then scale AUW so it needs exactly 25% of total thrust
    const cfg = {
      motor: MOTOR_LIBRARY['iFlight 2207 1750KV'],
      prop: PROP_LIBRARY['Gemfan 5143'],
      cellCount: 4,
      auwG: 700,
      motorCount: 4,
    }
    const probe = computeSizing(cfg)
    const auwAtQuarterThrust = probe.totalThrustG * 0.25
    const r = computeSizing({ ...cfg, auwG: auwAtQuarterThrust })
    expect(r.hoverThrottlePct).toBeCloseTo(50, 0)
  })

  it('hover throttle saturates at 100% when AUW exceeds total thrust', () => {
    const r = computeSizing({
      motor: MOTOR_LIBRARY['BetaFPV 1404 3800KV'],
      prop: PROP_LIBRARY['Avan 3025'],
      cellCount: 4,
      auwG: 30000,
      motorCount: 4,
    })
    expect(r.hoverThrottlePct).toBe(100)
  })

  it('efficiency divides AUW by TOTAL electrical power (all motors)', () => {
    const r = computeSizing({
      motor: MOTOR_LIBRARY['iFlight 2806.5 1300KV'],
      prop: PROP_LIBRARY['Gemfan 7040'],
      cellCount: 6,
      auwG: 1200,
      motorCount: 4,
    })
    const totalPowerW = r.totalHoverCurrentA * r.nominalV
    expect(r.efficiencyGPerW).toBeCloseTo(1200 / totalPowerW, 1)
  })

  it('cellNominalV overrides the default 3.7 V/cell (Li-ion 3.6)', () => {
    const base = {
      motor: MOTOR_LIBRARY['iFlight 2806.5 1300KV'],
      prop: PROP_LIBRARY['Gemfan 7040'],
      cellCount: 6,
      auwG: 1200,
      motorCount: 4,
    }
    const liion = computeSizing({ ...base, cellNominalV: 3.6 })
    expect(liion.nominalV).toBeCloseTo(21.6, 5)
    expect(liion.maxRpm).toBeLessThan(computeSizing(base).maxRpm)
  })

  it('more motors → lower per-motor current at hover (same AUW, same motor/prop)', () => {
    const four = computeSizing({
      motor: MOTOR_LIBRARY['iFlight 2207 1750KV'],
      prop: PROP_LIBRARY['Gemfan 5143'],
      cellCount: 4,
      auwG: 700,
      motorCount: 4,
    })
    const eight = computeSizing({
      motor: MOTOR_LIBRARY['iFlight 2207 1750KV'],
      prop: PROP_LIBRARY['Gemfan 5143'],
      cellCount: 4,
      auwG: 700,
      motorCount: 8,
    })
    expect(eight.hoverCurrentPerMotorA).toBeLessThan(four.hoverCurrentPerMotorA)
  })
})
