import { mulberry32 } from '@core/shared/prng'
import { createPlantState } from './plant'
import { createControllerState } from './controller'
import { createFilterBank, PT1Filter } from './filters'
import { stepSim, type StepContext } from './simulate'
import type { SimConfig, FilterConfig, SimSample } from './types'

/** True when the gyro-path filter coefficients (lowpass or notch) differ by value. */
function gyroFiltersChanged(a: FilterConfig, b: FilterConfig): boolean {
  if (a.gyroLowpassHz !== b.gyroLowpassHz) return true
  const an = a.notch
  const bn = b.notch
  if (Boolean(an) !== Boolean(bn)) return true
  if (an && bn && (an.centerHz !== bn.centerHz || an.q !== bn.q)) return true
  return false
}

export class SimRunner {
  private _ctx: StepContext
  private _step = 0
  private _decimateEvery: number
  private _fs: number
  private _filters: FilterConfig

  constructor(config: SimConfig) {
    const fs = config.controller.loopRateHz
    const dt = 1 / fs
    const noiseStd = config.noise.kind === 'gaussian' ? (config.noise.gaussianStdDegS ?? 0) : 0

    this._decimateEvery = Math.max(1, Math.round(fs / 1000))
    this._fs = fs
    this._filters = config.controller.filters
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

  /**
   * Apply a new config to a *running* sim without restarting it.
   *
   * Integrator, plant and filter STATE (and the elapsed step count) are
   * preserved — the new parameters take effect from the current instant
   * forward, so the scope shows the response smoothly transition instead of
   * clearing. A gain-only change rebuilds nothing; filter-cutoff or loop-rate
   * changes rebuild just the affected filter coefficients.
   */
  updateConfig(config: SimConfig): void {
    const newFs = config.controller.loopRateHz
    const fsChanged = newFs !== this._fs
    const newFilters = config.controller.filters

    // Loop-rate change alters the time base; rescale the step index so elapsed
    // time stays continuous, and update the fs-derived timing.
    if (fsChanged) {
      this._step = Math.round(this._step * (newFs / this._fs))
      this._ctx.dt = 1 / newFs
      this._decimateEvery = Math.max(1, Math.round(newFs / 1000))
      this._fs = newFs
    }

    // Rebuild filter coefficients only when they actually change — a gain-only
    // tweak keeps all filter history, so the response evolves smoothly.
    if (fsChanged || gyroFiltersChanged(this._filters, newFilters)) {
      this._ctx.filterBank = createFilterBank(newFilters, newFs)
    }
    if (fsChanged || this._filters.dtermLowpassHz !== newFilters.dtermLowpassHz) {
      // The D-term filter lives inside the controller state; swap only its
      // coefficient, preserving the integrator and previous-sample values.
      this._ctx.ctrlState.dtermFilter = PT1Filter.fromCutoff(newFilters.dtermLowpassHz, newFs)
    }
    this._filters = newFilters

    // Hot-swap every config-derived field; accumulated state is left intact.
    this._ctx.ctrlConfig = config.controller
    this._ctx.plant = config.plant
    this._ctx.spProfile = config.setpoint
    this._ctx.disturbances = config.disturbances
    this._ctx.noiseStd = config.noise.kind === 'gaussian' ? (config.noise.gaussianStdDegS ?? 0) : 0
  }

  /** Re-create all internal state from the given config. */
  reset(config: SimConfig): void {
    const fs = config.controller.loopRateHz
    const dt = 1 / fs
    const noiseStd = config.noise.kind === 'gaussian' ? (config.noise.gaussianStdDegS ?? 0) : 0

    this._decimateEvery = Math.max(1, Math.round(fs / 1000))
    this._step = 0
    this._fs = fs
    this._filters = config.controller.filters
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
