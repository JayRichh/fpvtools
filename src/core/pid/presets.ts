import type { PIDGains, PlantModel, SimConfig, ControllerConfig, FilterConfig } from './types'

// --- Gain presets (Betaflight 4.4-style, version-pinned) ---
export const GAIN_PRESETS: Record<string, PIDGains> = {
  'BF 4.4 Default': { kp: 45, ki: 80, kd: 40, kff: 0 },
  '5" Freestyle':   { kp: 55, ki: 85, kd: 45, kff: 100 },
  '5" Race':        { kp: 65, ki: 90, kd: 35, kff: 120 },
  '7" Long Range':  { kp: 35, ki: 60, kd: 30, kff: 80 },
  '10" Cine':       { kp: 25, ki: 50, kd: 25, kff: 60 },
}

// --- Plant presets (illustrative physical models) ---
export const PLANT_PRESETS: Record<string, PlantModel> = {
  '5" Freestyle': {
    inertiaKgM2: 0.0008,
    motorTimeConstantMs: 4,
    dragCoeff: 0.008,
    maxTorqueNm: 0.6,
  },
  '5" Race': {
    inertiaKgM2: 0.0007,
    motorTimeConstantMs: 3,
    dragCoeff: 0.007,
    maxTorqueNm: 0.75,
  },
  '7" Long Range': {
    inertiaKgM2: 0.0015,
    motorTimeConstantMs: 8,
    dragCoeff: 0.015,
    maxTorqueNm: 0.4,
  },
  '10" Cine': {
    inertiaKgM2: 0.003,
    motorTimeConstantMs: 12,
    dragCoeff: 0.025,
    maxTorqueNm: 0.35,
  },
  '2.5" Tiny': {
    inertiaKgM2: 0.0002,
    motorTimeConstantMs: 2,
    dragCoeff: 0.003,
    maxTorqueNm: 0.15,
  },
}

// --- Default filter config ---
const DEFAULT_FILTERS: FilterConfig = {
  gyroLowpassHz: 100,
  dtermLowpassHz: 70,
}

// --- Scenario presets ---
export const SCENARIO_PRESETS: Record<string, SimConfig> = {
  'Over-tuned': {
    controller: {
      gains: { kp: 90, ki: 80, kd: 10, kff: 0 },
      filters: DEFAULT_FILTERS,
      loopRateHz: 4000,
      iTermLimitNm: 0.3,
      iTermRelax: false,
    },
    plant: PLANT_PRESETS['5" Freestyle'],
    noise: { kind: 'gaussian', gaussianStdDegS: 2, seed: 42 },
    setpoint: { kind: 'step', amplitudeDegS: 200, startMs: 100 },
    disturbances: [],
    durationMs: 500,
  },

  'Propwash Recovery': {
    controller: {
      gains: GAIN_PRESETS['5" Freestyle'],
      filters: DEFAULT_FILTERS,
      loopRateHz: 4000,
      iTermLimitNm: 0.3,
      iTermRelax: true,
    },
    plant: PLANT_PRESETS['5" Freestyle'],
    noise: { kind: 'gaussian', gaussianStdDegS: 1, seed: 7 },
    setpoint: { kind: 'step', amplitudeDegS: 0, startMs: 0 },
    disturbances: [
      { torqueNm: 0.3, startMs: 500, durationMs: 20, kind: 'impulse' },
    ],
    durationMs: 1000,
  },

  'Filter Tradeoff': {
    controller: {
      gains: GAIN_PRESETS['BF 4.4 Default'],
      filters: { gyroLowpassHz: 60, dtermLowpassHz: 40 },
      loopRateHz: 4000,
      iTermLimitNm: 0.3,
      iTermRelax: false,
    },
    plant: PLANT_PRESETS['5" Freestyle'],
    noise: { kind: 'gaussian', gaussianStdDegS: 8, seed: 99 },
    setpoint: { kind: 'step', amplitudeDegS: 200, startMs: 100 },
    disturbances: [],
    durationMs: 500,
  },
}

// --- Helper: build a ControllerConfig from gain preset name + optional overrides ---
export function makeControllerConfig(
  gainPresetName: keyof typeof GAIN_PRESETS,
  overrides?: Partial<ControllerConfig>,
): ControllerConfig {
  return {
    gains: { ...GAIN_PRESETS[gainPresetName] },
    filters: DEFAULT_FILTERS,
    loopRateHz: 4000,
    iTermLimitNm: 0.3,
    iTermRelax: true,
    ...overrides,
  }
}
