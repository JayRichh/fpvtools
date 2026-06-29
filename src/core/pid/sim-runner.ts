import { mulberry32 } from '@core/shared/prng'
import { createPlantState } from './plant'
import { createControllerState } from './controller'
import { createFilterBank } from './filters'
import { stepSim, type StepContext } from './simulate'
import type { SimConfig, SimSample } from './types'

export class SimRunner {
  private _ctx: StepContext
  private _step = 0
  private _decimateEvery: number

  constructor(config: SimConfig) {
    const fs = config.controller.loopRateHz
    const dt = 1 / fs
    const noiseStd = config.noise.kind === 'gaussian' ? (config.noise.gaussianStdDegS ?? 0) : 0

    this._decimateEvery = Math.max(1, Math.round(fs / 1000))
    this._ctx = {
      plantState: createPlantState(config.plant),
      ctrlState: createControllerState(config.controller),
      filterBank: createFilterBank(config.controller.filters, fs),
      ctrlConfig: config.controller,
      plant: config.plant,
      spProfile: config.setpoint,
      disturbances: config.disturbances,
      noiseStd,
      rng: mulberry32(config.noise.seed),
      dt,
    }
  }

  /**
   * Advance the simulation by wallMs of real time.
   * Returns only the newly produced (decimated) samples.
   *
   * At 4 kHz with 16ms wall time: 64 steps, ~16 output samples.
   */
  tick(wallMs: number): SimSample[] {
    const nSteps = Math.round((wallMs / 1000) * (1 / this._ctx.dt))
    const newSamples: SimSample[] = []

    for (let i = 0; i < nSteps; i++) {
      const tMs = this._step * this._ctx.dt * 1000
      const sample = stepSim(this._ctx, this._step, tMs)

      if (this._step % this._decimateEvery === 0) {
        newSamples.push(sample)
      }
      this._step++
    }

    return newSamples
  }

  /** Current simulation time in milliseconds. */
  get elapsedMs(): number {
    return this._step * this._ctx.dt * 1000
  }

  /** Re-create all internal state from the given config. */
  reset(config: SimConfig): void {
    const fs = config.controller.loopRateHz
    const dt = 1 / fs
    const noiseStd = config.noise.kind === 'gaussian' ? (config.noise.gaussianStdDegS ?? 0) : 0

    this._decimateEvery = Math.max(1, Math.round(fs / 1000))
    this._step = 0
    this._ctx = {
      plantState: createPlantState(config.plant),
      ctrlState: createControllerState(config.controller),
      filterBank: createFilterBank(config.controller.filters, fs),
      ctrlConfig: config.controller,
      plant: config.plant,
      spProfile: config.setpoint,
      disturbances: config.disturbances,
      noiseStd,
      rng: mulberry32(config.noise.seed),
      dt,
    }
  }
}
