import { describe, it, expect } from 'vitest'
import { createPlantState, stepPlant } from '../../../src/core/pid/plant'
import type { PlantModel } from '../../../src/core/pid/types'

const testPlant: PlantModel = {
  inertiaKgM2: 0.001,
  motorTimeConstantMs: 5,
  dragCoeff: 0.01,
  maxTorqueNm: 1.0,
}

describe('stepPlant', () => {
  it('zero command → stays at rest', () => {
    const state = createPlantState(testPlant)
    for (let i = 0; i < 1000; i++) stepPlant(state, testPlant, 0, 0, 0.001)
    expect(state.omega).toBeCloseTo(0, 6)
  })

  it('constant positive command → accelerates', () => {
    const state = createPlantState(testPlant)
    const dt = 0.001
    // After a short time with full command, omega should be positive
    for (let i = 0; i < 50; i++) stepPlant(state, testPlant, 1.0, 0, dt)
    expect(state.omega).toBeGreaterThan(0)
  })

  it('reaches steady state (drag balances torque)', () => {
    const state = createPlantState(testPlant)
    const dt = 0.001
    // Run for a long time with constant command
    for (let i = 0; i < 5000; i++) stepPlant(state, testPlant, 1.0, 0, dt)
    const omega1 = state.omega
    for (let i = 0; i < 1000; i++) stepPlant(state, testPlant, 1.0, 0, dt)
    const omega2 = state.omega
    // Omega should not be growing significantly anymore
    expect(Math.abs(omega2 - omega1)).toBeLessThan(1.0)
    // Steady state: tau_applied ≈ maxTorque, drag*omega ≈ tau, so omega ≈ maxTorque/drag
    const expectedSS = testPlant.maxTorqueNm / testPlant.dragCoeff
    expect(state.omega).toBeCloseTo(expectedSS, -1) // within ~10
  })

  it('passive decay toward zero when command removed', () => {
    const state = createPlantState(testPlant)
    const dt = 0.001
    // Spin up
    for (let i = 0; i < 2000; i++) stepPlant(state, testPlant, 1.0, 0, dt)
    const peakOmega = state.omega
    expect(peakOmega).toBeGreaterThan(0)
    // Remove command — should decay
    for (let i = 0; i < 2000; i++) stepPlant(state, testPlant, 0, 0, dt)
    expect(state.omega).toBeLessThan(peakOmega * 0.5)
  })

  it('negative command → negative omega', () => {
    const state = createPlantState(testPlant)
    const dt = 0.001
    for (let i = 0; i < 200; i++) stepPlant(state, testPlant, -1.0, 0, dt)
    expect(state.omega).toBeLessThan(0)
  })

  it('command clamped to [-1, 1]', () => {
    const state1 = createPlantState(testPlant)
    const state2 = createPlantState(testPlant)
    const dt = 0.001
    for (let i = 0; i < 100; i++) stepPlant(state1, testPlant, 1.0, 0, dt)
    for (let i = 0; i < 100; i++) stepPlant(state2, testPlant, 5.0, 0, dt)
    expect(state1.omega).toBeCloseTo(state2.omega, 3)
  })
})
