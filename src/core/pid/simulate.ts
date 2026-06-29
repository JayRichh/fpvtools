import { mulberry32, gaussianNoise } from '@core/shared/prng'
import { radToDeg } from '@core/shared/units'
import type { SimConfig, SimResult, SimSample } from './types'
import { createFilterBank } from './filters'
import { createPlantState, stepPlant } from './plant'
import { createControllerState, stepController } from './controller'
import { generateSetpoint } from './setpoint'
import { computeMetrics } from './metrics'

export function simulate(config: SimConfig): SimResult {
  const { controller: ctrlConfig, plant, noise, setpoint: spProfile, disturbances, durationMs } = config

  const fs = ctrlConfig.loopRateHz
  const dt = 1 / fs
  const totalSteps = Math.round((durationMs / 1000) * fs)

  // Decimation: output ~1000 samples/second
  const outputRateHz = Math.min(1000, fs)
  const decimateEvery = Math.max(1, Math.round(fs / outputRateHz))

  const plantState = createPlantState(plant)
  const ctrlState = createControllerState(ctrlConfig)
  const filterBank = createFilterBank(ctrlConfig.filters, fs)

  const rng = mulberry32(noise.seed)
  const noiseStd = noise.kind === 'gaussian' ? (noise.gaussianStdDegS ?? 0) : 0

  const samples: SimSample[] = []

  for (let step = 0; step < totalSteps; step++) {
    const tMs = step * dt * 1000

    // 1. Generate setpoint (deg/s)
    const setpointDegS = generateSetpoint(spProfile, tMs)

    // 2. Sum active disturbance torques
    let disturbanceTorque = 0
    for (const d of disturbances) {
      const active = tMs >= d.startMs && tMs < d.startMs + d.durationMs
      if (active) {
        disturbanceTorque += d.torqueNm
      }
    }

    // 3. Read true gyro (rad/s → deg/s)
    const gyroDegS = radToDeg(plantState.omega)

    // 4. Add noise
    const noiseVal = noiseStd > 0 ? gaussianNoise(rng) * noiseStd : 0
    const gyroMeasuredDegS = gyroDegS + noiseVal

    // 5. Filter gyro through gyro lowpass, then optional notch
    let gyroFiltered = filterBank.gyro.process(gyroMeasuredDegS)
    if (filterBank.notch) {
      gyroFiltered = filterBank.notch.process(gyroFiltered)
    }

    // 6. Step controller
    const ctrlOut = stepController(ctrlState, ctrlConfig, setpointDegS, gyroFiltered, dt)

    // 7. Step plant
    stepPlant(plantState, plant, ctrlOut.output, disturbanceTorque, dt)

    // 8. Record sample (decimated)
    if (step % decimateEvery === 0) {
      samples.push({
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
      })
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
