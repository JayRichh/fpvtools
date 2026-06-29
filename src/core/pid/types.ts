export interface PIDGains {
  kp: number; ki: number; kd: number; kff: number
  dMin?: number; dMax?: number
}
export interface FilterConfig {
  gyroLowpassHz: number; dtermLowpassHz: number
  notch?: { centerHz: number; q: number }
}
export interface ControllerConfig {
  gains: PIDGains; filters: FilterConfig; loopRateHz: number
  iTermLimitNm: number; iTermRelax: boolean
  tpa?: { breakpoint: number; rate: number }
}
export interface PlantModel {
  inertiaKgM2: number; motorTimeConstantMs: number; dragCoeff: number; maxTorqueNm: number
  resonance?: { freqHz: number; q: number; gain: number }
  prop?: { thrustCoeff: number; rpmMax: number }
  coupling?: { iyyKgM2: number; izzKgM2: number }
  battery?: { packIRmohm: number; nominalV: number }
}
export type SetpointProfile =
  | { kind: 'step'; amplitudeDegS: number; startMs: number }
  | { kind: 'ramp'; amplitudeDegS: number; durationMs: number; startMs: number }
  | { kind: 'sine'; amplitudeDegS: number; frequencyHz: number }
  | { kind: 'trace'; samplesDegS: number[]; sampleRateHz: number }
export interface Disturbance {
  torqueNm: number; startMs: number; durationMs: number; kind: 'impulse' | 'step'
}
export interface NoiseModel {
  kind: 'gaussian' | 'spectral'; gaussianStdDegS?: number; seed: number
}
export interface SimConfig {
  controller: ControllerConfig; plant: PlantModel; noise: NoiseModel
  setpoint: SetpointProfile; disturbances: Disturbance[]; durationMs: number
}
export interface SimSample {
  tMs: number; setpointDegS: number; gyroDegS: number; gyroMeasuredDegS: number
  errorDegS: number; pTerm: number; iTerm: number; dTerm: number; ffTerm: number
  motorOutput: number; saturated: boolean
}
export interface SimMetrics {
  riseTimeMs: number | null; overshootPct: number | null; settlingTimeMs: number | null
  steadyStateErrorDegS: number | null; oscillationHz: number | null; motorActivityRms: number
}
export interface SimResult { samples: SimSample[]; metrics: SimMetrics }
