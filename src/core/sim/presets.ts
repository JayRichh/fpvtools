import type { SimConfig } from './types.js'

export const SIM_PRESETS: Record<string, SimConfig> = {
  'Tiny Whoop': {
    massKg: 0.035,
    thrustToWeight: 2.2,
    dragK: 0.9,
    dragK2: 0.05,
    maxRateDegS: 500,
    expo: 0.6,
    rateTau: 0.08,
    maxTiltDeg: 35,
    yawRateDegS: 220,
  },
  '5" Freestyle': {
    massKg: 0.68,
    thrustToWeight: 5,
    dragK: 0.25,
    dragK2: 0.012,
    maxRateDegS: 900,
    expo: 0.7,
    rateTau: 0.045,
    maxTiltDeg: 50,
    yawRateDegS: 300,
  },
  '7" Long Range': {
    massKg: 1.2,
    thrustToWeight: 3,
    dragK: 0.2,
    dragK2: 0.02,
    maxRateDegS: 500,
    expo: 0.6,
    rateTau: 0.07,
    maxTiltDeg: 40,
    yawRateDegS: 200,
  },
  'Cinelifter': {
    massKg: 3.5,
    thrustToWeight: 2.4,
    dragK: 0.3,
    dragK2: 0.03,
    maxRateDegS: 350,
    expo: 0.5,
    rateTau: 0.1,
    maxTiltDeg: 30,
    yawRateDegS: 150,
  },
}

export const DEFAULT_SIM_PRESET = '5" Freestyle'
