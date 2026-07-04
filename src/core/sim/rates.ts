// src/core/sim/rates.ts — Pure TS, zero DOM, zero framework
//
// Betaflight "Actual Rates": the modern default rates model. Values transfer
// 1:1 from a real quad's Betaflight configuration.

export interface ActualRates {
  /** deg/s per full stick around center (linear region) */
  centerSensitivityDegS: number
  /** deg/s at full deflection */
  maxRateDegS: number
  /** 0..1 — pushes the extra rate toward the stick ends */
  expo: number
}

/**
 * Betaflight actual-rates curve. Matches the flight-firmware formula:
 *   expof      = |x| · (x⁵·expo + x·(1 − expo))
 *   angleRate  = x·centerSensitivity + max(0, maxRate − centerSensitivity)·expof
 * Odd-symmetric; f(±1) = ±maxRate; slope at center = centerSensitivity.
 */
export function actualRateCurve(stick: number, r: ActualRates): number {
  const x = Math.max(-1, Math.min(1, stick))
  const ax = Math.abs(x)
  const expof = ax * (Math.pow(x, 5) * r.expo + x * (1 - r.expo))
  const stickMovement = Math.max(0, r.maxRateDegS - r.centerSensitivityDegS)
  return x * r.centerSensitivityDegS + stickMovement * expof
}
