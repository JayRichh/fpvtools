import { BiquadFilter } from '@core/shared/biquad'
import type { FilterConfig } from './types'

export class PT1Filter {
  private alpha: number
  private state: number = 0

  constructor(alpha: number) {
    this.alpha = alpha
  }

  static fromCutoff(fc: number, fs: number): PT1Filter {
    const rc = 1 / (2 * Math.PI * fc)
    const dt = 1 / fs
    const alpha = dt / (rc + dt)
    return new PT1Filter(alpha)
  }

  process(x: number): number {
    this.state += this.alpha * (x - this.state)
    return this.state
  }

  reset(): void {
    this.state = 0
  }
}

export interface FilterBank {
  gyro: PT1Filter
  dterm: PT1Filter
  notch: BiquadFilter | null
}

export function createFilterBank(config: FilterConfig, fs: number): FilterBank {
  return {
    gyro: PT1Filter.fromCutoff(config.gyroLowpassHz, fs),
    dterm: PT1Filter.fromCutoff(config.dtermLowpassHz, fs),
    notch: config.notch
      ? BiquadFilter.notch(config.notch.centerHz, fs, config.notch.q)
      : null,
  }
}
