import { mulberry32, gaussianNoise } from '@core/shared/prng'
import { radToDeg } from '@core/shared/units'
import type { SimConfig, SimResult, SimSample, ControllerConfig, PlantModel, SetpointProfile, Disturbance } from './types'
import { createFilterBank, type FilterBank } from './filters'
import { createPlantState, stepPlant, type PlantState } from './plant'
import { createControllerState, stepController, type ControllerState } from './controller'
import { generateSetpoint } from './setpoint'
import { computeMetrics } from './metrics'

// ── StepContext & stepSim ─────────────────────────────────────────────────────

export interface StepContext {
  plantState: PlantState
  ctrlState: ControllerState
  filterBank: FilterBank
  ctrlConfig: ControllerConfig
  plant: PlantModel
  spProfile: SetpointProfile
  disturbances: Disturbance[]
  noiseStd: number
  rng: () => number
  dt: number
}

/**
 * Advance the simulation by one controller tick.
 * Returns the sample for this step.
 * Mutates plantState, ctrlState, filterBank in place.
 */
export function stepSim(ctx: StepContext, _step: number, tMs: number): SimSample {
  // 1. Generate setpoint (deg/s)
  const setpointDegS = generateSetpoint(ctx.spProfile, tMs)

  // 2. Sum active disturbance torques
  let disturbanceTorque = 0
  for (const d of ctx.disturbances) {
    if (tMs >= d.startMs && tMs < d.startMs + d.durationMs) {
      disturbanceTorque += d.torqueNm
    }
  }

  // 3. Read true gyro (rad/s → deg/s)
  const gyroDegS = radToDeg(ctx.plantState.omega)

  // 4. Add noise
  const noiseVal = ctx.noiseStd > 0 ? gaussianNoise(ctx.rng) * ctx.noiseStd : 0
  const gyroMeasuredDegS = gyroDegS + noiseVal

  // 5. Filter gyro through gyro lowpass, then optional notch
  let gyroFiltered = ctx.filterBank.gyro.process(gyroMeasuredDegS)
  if (ctx.filterBank.notch) {
    gyroFiltered = ctx.filterBank.notch.process(gyroFiltered)
  }

  // 6. Step controller
  const ctrlOut = stepController(ctx.ctrlState, ctx.ctrlConfig, setpointDegS, gyroFiltered, ctx.dt)

  // 7. Step plant
  stepPlant(ctx.plantState, ctx.plant, ctrlOut.output, disturbanceTorque, ctx.dt)

  return {
    tMs,
    setpointDegS,
    gyroDegS,
    gyroMeasuredDegS,
    errorDegS: setpointDegS - gyroDegS,
    pTerm: ctrlOut.pTerm,
    iTerm: ctrlOut.iTerm,
    dTerm: ctrlOut.dTerm,
    ffTerm: ctrlOut.ffTerm,
    motorOutput: ctrlOut.output,
    saturated: ctrlOut.saturated,
  }
}

// ── simulate (one-shot) ───────────────────────────────────────────────────────

export function simulate(config: SimConfig): SimResult {
  const { controller: ctrlConfig, plant, noise, setpoint: spProfile, disturbances, durationMs } = config

  const fs = ctrlConfig.loopRateHz
  const dt = 1 / fs
  const totalSteps = Math.round((durationMs / 1000) * fs)

  // Decimation: output ~1000 samples/second
  const outputRateHz = Math.min(1000, fs)
  const decimateEvery = Math.max(1, Math.round(fs / outputRateHz))

  const noiseStd = noise.kind === 'gaussian' ? (noise.gaussianStdDegS ?? 0) : 0

  const ctx: StepContext = {
    plantState: createPlantState(plant),
    ctrlState: createControllerState(ctrlConfig),
    filterBank: createFilterBank(ctrlConfig.filters, fs),
    ctrlConfig,
    plant,
    spProfile,
    disturbances,
    noiseStd,
    rng: mulberry32(noise.seed),
    dt,
  }

  const samples: SimSample[] = []

  for (let step = 0; step < totalSteps; step++) {
    const tMs = step * dt * 1000
    const sample = stepSim(ctx, step, tMs)

    // Record sample (decimated)
    if (step % decimateEvery === 0) {
      samples.push(sample)
    }
  }

  // Determine setpoint amplitude for metrics
  let spAmplitude = 0
  if (spProfile.kind === 'step' || spProfile.kind === 'ramp' || spProfile.kind === 'sine') {
    spAmplitude = spProfile.amplitudeDegS
  } else if (spProfile.kind === 'trace') {
    const max = spProfile.samplesDegS.reduce((m, v) => Math.max(m, Math.abs(v)), 0)
    spAmplitude = max
  }

  const metrics = computeMetrics(samples, spAmplitude)

  return { samples, metrics }
}
