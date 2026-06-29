import { clamp } from '@core/shared/math'
import { PT1Filter } from './filters'
import type { ControllerConfig } from './types'

export interface ControllerState {
  integral: number
  prevGyro: number
  prevSetpoint: number
  dtermFilter: PT1Filter
}

export interface ControllerOutput {
  output: number
  saturated: boolean
  pTerm: number
  iTerm: number
  dTerm: number
  ffTerm: number
}

export function createControllerState(config: ControllerConfig): ControllerState {
  return {
    integral: 0,
    prevGyro: 0,
    prevSetpoint: 0,
    dtermFilter: PT1Filter.fromCutoff(config.filters.dtermLowpassHz, config.loopRateHz),
  }
}

export function stepController(
  state: ControllerState,
  config: ControllerConfig,
  setpoint: number,    // deg/s
  gyroFiltered: number, // deg/s
  dt: number,
): ControllerOutput {
  const { gains } = config

  const error = setpoint - gyroFiltered

  // P term
  const pTerm = gains.kp * error

  // I term with optional iterm-relax (suppress I when setpoint is changing fast)
  let iTermRelaxFactor = 1.0
  if (config.iTermRelax) {
    const setpointRate = Math.abs(setpoint - state.prevSetpoint) / dt
    // Suppress I when setpoint rate is high (>200 deg/s/s threshold)
    iTermRelaxFactor = Math.max(0, 1 - setpointRate / 200)
  }
  state.integral += gains.ki * error * dt * iTermRelaxFactor
  state.integral = clamp(state.integral, -config.iTermLimitNm, config.iTermLimitNm)
  const iTerm = state.integral

  // D term: Betaflight style — derivative on gyro only (not error), filtered
  const dGyro = (gyroFiltered - state.prevGyro) / dt
  const dGyroFiltered = state.dtermFilter.process(-dGyro)
  const dTerm = gains.kd * dGyroFiltered

  // FF term: derivative of setpoint
  const dSetpoint = (setpoint - state.prevSetpoint) / dt
  const ffTerm = gains.kff * dSetpoint

  state.prevGyro = gyroFiltered
  state.prevSetpoint = setpoint

  const rawOutput = pTerm + iTerm + dTerm + ffTerm
  const output = clamp(rawOutput, -1, 1)
  const saturated = rawOutput !== output

  return { output, saturated, pTerm, iTerm, dTerm, ffTerm }
}
