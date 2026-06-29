import type { SimSample, SimMetrics } from './types'

export function computeMetrics(samples: SimSample[], setpointAmplitude: number): SimMetrics {
  if (samples.length === 0) {
    return {
      riseTimeMs: null, overshootPct: null, settlingTimeMs: null,
      steadyStateErrorDegS: null, oscillationHz: null, motorActivityRms: 0,
    }
  }

  const target = setpointAmplitude
  const absTarget = Math.abs(target)

  // Rise time: first sample where |gyro| >= 90% of |target|
  let riseTimeMs: number | null = null
  if (absTarget > 0) {
    for (const s of samples) {
      if (Math.abs(s.gyroDegS) >= 0.9 * absTarget) {
        riseTimeMs = s.tMs
        break
      }
    }
  }

  // Overshoot: (peak - target) / |target| * 100
  let overshootPct: number | null = null
  if (absTarget > 0) {
    let peak = 0
    for (const s of samples) {
      if (Math.abs(s.gyroDegS) > Math.abs(peak)) peak = s.gyroDegS
    }
    const overshoot = (Math.abs(peak) - absTarget) / absTarget * 100
    overshootPct = overshoot > 0 ? overshoot : 0
  }

  // Settling time: last sample where |gyro - target| > 2% of |target|
  let settlingTimeMs: number | null = null
  if (absTarget > 0) {
    const band = 0.02 * absTarget
    for (let i = samples.length - 1; i >= 0; i--) {
      if (Math.abs(samples[i].gyroDegS - target) > band) {
        settlingTimeMs = samples[i].tMs
        break
      }
    }
  }

  // Steady-state error: target - mean of last 10% of samples
  let steadyStateErrorDegS: number | null = null
  const tail = Math.max(1, Math.floor(samples.length * 0.1))
  const tailSamples = samples.slice(samples.length - tail)
  const meanGyro = tailSamples.reduce((acc, s) => acc + s.gyroDegS, 0) / tailSamples.length
  steadyStateErrorDegS = target - meanGyro

  // Oscillation: zero-crossings of error / (2 * duration in seconds)
  let oscillationHz: number | null = null
  if (samples.length > 1) {
    let crossings = 0
    for (let i = 1; i < samples.length; i++) {
      if (samples[i - 1].errorDegS * samples[i].errorDegS < 0) crossings++
    }
    const durationSec = (samples[samples.length - 1].tMs - samples[0].tMs) / 1000
    oscillationHz = durationSec > 0 ? crossings / (2 * durationSec) : null
  }

  // Motor activity RMS
  let sumSq = 0
  for (const s of samples) sumSq += s.motorOutput * s.motorOutput
  const motorActivityRms = Math.sqrt(sumSq / samples.length)

  return { riseTimeMs, overshootPct, settlingTimeMs, steadyStateErrorDegS, oscillationHz, motorActivityRms }
}
