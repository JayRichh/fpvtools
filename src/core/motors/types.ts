export interface MotorSpec {
  name: string
  kv: number
  maxCurrentA: number
  weightG: number
  recommendedProps: string[]
}

export interface PropSpec {
  name: string
  diameterInch: number
  pitchInch: number
}

export interface SizingConfig {
  motor: MotorSpec
  prop: PropSpec
  cellCount: number
  auwG: number
  motorCount: number
  /** Nominal cell voltage; 3.7 (LiPo) if omitted, use 3.6 for Li-ion */
  cellNominalV?: number
}

export interface SizingResult {
  maxRpm: number
  nominalV: number
  thrustPerMotorG: number
  totalThrustG: number
  thrustToWeight: number
  hoverThrottlePct: number
  hoverCurrentPerMotorA: number
  totalHoverCurrentA: number
  efficiencyGPerW: number
  recommendedPropRange: string
}
