import type { SizingConfig, SizingResult, MotorSpec, PropSpec } from './types.js'

export type { MotorSpec, PropSpec, SizingConfig, SizingResult }

// ── Libraries ────────────────────────────────────────────────────────────────

export const MOTOR_LIBRARY: Record<string, MotorSpec> = {
  // Whoop / micro
  'BetaFPV 1103 11000KV': {
    name: 'BetaFPV 1103 11000KV',
    kv: 11000,
    maxCurrentA: 5,
    weightG: 3.4,
    recommendedProps: ['1636', '2023'],
  },
  'T-Motor M1105 6000KV': {
    name: 'T-Motor M1105 6000KV',
    kv: 6000,
    maxCurrentA: 9,
    weightG: 6.5,
    recommendedProps: ['2023', '2540'],
  },
  // Toothpick / micro long-range
  'BetaFPV 1404 3800KV': {
    name: 'BetaFPV 1404 3800KV',
    kv: 3800,
    maxCurrentA: 12,
    weightG: 10,
    recommendedProps: ['3018', '3025'],
  },
  'iFlight XING 1507 3600KV': {
    name: 'iFlight XING 1507 3600KV',
    kv: 3600,
    maxCurrentA: 22,
    weightG: 15,
    recommendedProps: ['3520', '4023'],
  },
  // 5" freestyle / race
  'EMAX ECO II 2004 3000KV': {
    name: 'EMAX ECO II 2004 3000KV',
    kv: 3000,
    maxCurrentA: 17,
    weightG: 15.5,
    recommendedProps: ['4023', '5043'],
  },
  'EMAX RS2205 2300KV': {
    name: 'EMAX RS2205 2300KV',
    kv: 2300,
    maxCurrentA: 30,
    weightG: 30,
    recommendedProps: ['5045', '5043'],
  },
  'iFlight 2207 1750KV': {
    name: 'iFlight 2207 1750KV',
    kv: 1750,
    maxCurrentA: 36,
    weightG: 30,
    recommendedProps: ['5143', '5051'],
  },
  'T-Motor F40 2306 2450KV': {
    name: 'T-Motor F40 2306 2450KV',
    kv: 2450,
    maxCurrentA: 46,
    weightG: 34,
    recommendedProps: ['5045', '5143'],
  },
  // 7" long-range
  'iFlight 2806.5 1300KV': {
    name: 'iFlight 2806.5 1300KV',
    kv: 1300,
    maxCurrentA: 42,
    weightG: 38,
    recommendedProps: ['7040', '7035'],
  },
  // Cinelifter / X-class
  'iFlight XING 2814 880KV': {
    name: 'iFlight XING 2814 880KV',
    kv: 880,
    maxCurrentA: 45,
    weightG: 60,
    recommendedProps: ['8040', '7040'],
  },
  'T-Motor U5 400KV': {
    name: 'T-Motor U5 400KV',
    kv: 400,
    maxCurrentA: 30,
    weightG: 95,
    recommendedProps: ['1555', '1547'],
  },
}

export const PROP_LIBRARY: Record<string, PropSpec> = {
  'Gemfan 1636 (whoop)': { name: 'Gemfan 1636 (whoop)', diameterInch: 1.6, pitchInch: 1.0 },
  'Gemfan 2023': { name: 'Gemfan 2023', diameterInch: 2, pitchInch: 2.3 },
  'HQProp 2540': { name: 'HQProp 2540', diameterInch: 2.5, pitchInch: 4 },
  'HQProp 3018': { name: 'HQProp 3018', diameterInch: 3, pitchInch: 1.8 },
  'Avan 3025': { name: 'Avan 3025', diameterInch: 3, pitchInch: 2.5 },
  'Gemfan 3520': { name: 'Gemfan 3520', diameterInch: 3.5, pitchInch: 2 },
  'Gemfan 4023': { name: 'Gemfan 4023', diameterInch: 4, pitchInch: 2.3 },
  'HQProp 5043': { name: 'HQProp 5043', diameterInch: 5, pitchInch: 4.3 },
  'HQProp 5045': { name: 'HQProp 5045', diameterInch: 5, pitchInch: 4.5 },
  'Gemfan 5143': { name: 'Gemfan 5143', diameterInch: 5.1, pitchInch: 4.3 },
  'HQProp 6045': { name: 'HQProp 6045', diameterInch: 6, pitchInch: 4.5 },
  'Gemfan 7040': { name: 'Gemfan 7040', diameterInch: 7, pitchInch: 4 },
  'Gemfan 8040 (cine)': { name: 'Gemfan 8040 (cine)', diameterInch: 8, pitchInch: 4 },
  'T-Motor 1555': { name: 'T-Motor 1555', diameterInch: 15, pitchInch: 5.5 },
}

// ── computeSizing ─────────────────────────────────────────────────────────────
//
// NOTE: thrust values are estimated using a simplified empirical model and
// should be verified against manufacturer dyno data before use in a real build.

export function computeSizing(config: SizingConfig): SizingResult {
  const { motor, prop, cellCount, auwG, motorCount } = config

  // Chemistry-specific nominal cell voltage (LiPo 3.7 V default; Li-ion 3.6 V)
  const nominalV = cellCount * (config.cellNominalV ?? 3.7)

  // RPM at full throttle
  const maxRpm = motor.kv * nominalV

  // Simplified static thrust per motor (estimated — verify against manufacturer data)
  // thrustPerMotorG ≈ 0.70 × diameter² × pitch × (maxRpm / 10000)^1.5
  const rpmFactor = Math.pow(maxRpm / 10000, 1.5)
  const thrustPerMotorG = 0.70 * prop.diameterInch ** 2 * prop.pitchInch * rpmFactor

  const totalThrustG = thrustPerMotorG * motorCount
  const thrustToWeight = totalThrustG / auwG

  // Hover: static thrust ∝ RPM² ∝ throttle², so the throttle fraction for a
  // given thrust fraction is its square root
  const hoverThrustFraction = auwG / totalThrustG
  const hoverThrottleFrac = Math.min(1, Math.sqrt(hoverThrustFraction))
  const hoverThrottlePct = hoverThrottleFrac * 100

  // Electrical power ∝ RPM³, so current at fixed voltage ∝ throttle³
  const hoverCurrentPerMotorA = motor.maxCurrentA * Math.pow(hoverThrottleFrac, 3)
  const totalHoverCurrentA = hoverCurrentPerMotorA * motorCount

  // Efficiency at hover: total supported weight per total electrical watt
  const efficiencyGPerW = auwG / (totalHoverCurrentA * nominalV)

  const recommendedPropRange = motor.recommendedProps.join(', ')

  return {
    maxRpm: Math.round(maxRpm),
    nominalV,
    thrustPerMotorG: Math.round(thrustPerMotorG * 10) / 10,
    totalThrustG: Math.round(totalThrustG * 10) / 10,
    thrustToWeight: Math.round(thrustToWeight * 100) / 100,
    hoverThrottlePct: Math.round(hoverThrottlePct * 10) / 10,
    hoverCurrentPerMotorA: Math.round(hoverCurrentPerMotorA * 10) / 10,
    totalHoverCurrentA: Math.round(totalHoverCurrentA * 10) / 10,
    efficiencyGPerW: Math.round(efficiencyGPerW * 100) / 100,
    recommendedPropRange,
  }
}
