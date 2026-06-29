export interface BlackboxLog {
  loopRateHz: number
  channels: {
    setpoint: Float32Array
    gyro: Float32Array
    pidSum?: Float32Array
    motorRpm?: Float32Array[]
  }
  gains?: { kp: number; ki: number; kd: number; kff: number }
  filters?: { gyroLowpassHz: number; dtermLowpassHz: number }
  duration: number  // seconds
}

export interface StepEvent {
  startIdx: number
  samples: Float32Array  // gyro response after the step
  amplitude: number       // step size in deg/s
}
