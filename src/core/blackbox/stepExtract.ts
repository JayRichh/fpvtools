import type { BlackboxLog, StepEvent } from './types.js'

/**
 * Detect stick-step events in a blackbox log and return the gyro response
 * for each event.
 *
 * Algorithm:
 * 1. Compute the sample-to-sample derivative of the setpoint channel.
 * 2. Flag samples where |Δsetpoint / Δt| exceeds `threshold` (deg/s per sec).
 * 3. For each flagged sample extract 200 ms of subsequent gyro data.
 * 4. Suppress events within 100 ms of a previous event.
 *
 * @param log   Parsed blackbox log
 * @param axis  Accepted for API compatibility; the single stored channel is
 *              always used regardless of the value.
 */
export function extractStepEvents(log: BlackboxLog, _axis?: number): StepEvent[] {
  const { setpoint, gyro } = log.channels
  const fs = log.loopRateHz > 0 ? log.loopRateHz : 1000

  // Minimum separation between events and post-step capture window (in samples)
  const minSeparation  = Math.round(0.1  * fs)  // 100 ms
  const captureWindow  = Math.round(0.2  * fs)  // 200 ms
  const threshold      = 500                    // deg/s²

  const events: StepEvent[] = []
  let lastEventIdx = -minSeparation

  for (let i = 1; i < setpoint.length; i++) {
    // First-difference derivative scaled to deg/s per sec
    const dSetpointDt = (setpoint[i] - setpoint[i - 1]) * fs

    if (
      Math.abs(dSetpointDt) >= threshold &&
      i - lastEventIdx >= minSeparation
    ) {
      const endIdx  = Math.min(i + captureWindow, gyro.length)
      const samples = gyro.slice(i, endIdx)

      events.push({
        startIdx:  i,
        samples,
        amplitude: setpoint[i] - setpoint[i - 1],
      })

      lastEventIdx = i
    }
  }

  return events
}
