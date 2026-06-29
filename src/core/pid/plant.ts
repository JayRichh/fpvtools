import { BiquadFilter } from '@core/shared/biquad'
import { clamp } from '@core/shared/math'
import type { PlantModel } from './types'

export interface PlantState {
  omega: number          // rad/s
  tauApplied: number     // N*m currently applied by motor
  resonanceFilter: BiquadFilter | null
}

export function createPlantState(plant?: PlantModel): PlantState {
  return {
    omega: 0,
    tauApplied: 0,
    resonanceFilter: plant?.resonance
      ? BiquadFilter.peaking(plant.resonance.freqHz, 1000, plant.resonance.q, plant.resonance.gain)
      : null,
  }
}

export function stepPlant(
  state: PlantState,
  plant: PlantModel,
  command: number,
  disturbanceTorque: number,
  dt: number,
): void {
  const clampedCmd = clamp(command, -1, 1)
  const tauCmd = plant.maxTorqueNm * clampedCmd

  // First-order motor lag: dtau/dt = (tau_cmd - tau_applied) / tau_m
  const tauM = plant.motorTimeConstantMs / 1000
  const dTau = (tauCmd - state.tauApplied) / tauM
  state.tauApplied += dTau * dt

  // Angular acceleration: I * dw/dt = tau_applied - b*w + tau_dist
  const dOmega = (state.tauApplied - plant.dragCoeff * state.omega + disturbanceTorque) / plant.inertiaKgM2
  state.omega += dOmega * dt
}
