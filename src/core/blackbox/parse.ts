import type { BlackboxLog } from './types.js'

/**
 * Parse a Betaflight Blackbox Explorer CSV export into a BlackboxLog.
 *
 * Expected header columns (at minimum):
 *   time          – loop timestamp in microseconds
 *   gyroADC[0]   – roll-axis gyro in deg/s
 *   setpoint[0]  – roll-axis setpoint in deg/s
 *
 * Optional columns used when present:
 *   axisP[0], axisI[0], axisD[0] – PID terms (summed into pidSum channel)
 *
 * Handles: empty file, missing columns, non-numeric values.
 */
export function parseBlackboxCsv(csvText: string): BlackboxLog {
  const empty: BlackboxLog = {
    loopRateHz: 0,
    channels: { setpoint: new Float32Array(0), gyro: new Float32Array(0) },
    duration: 0,
  }

  if (!csvText || csvText.trim().length === 0) return empty

  const lines = csvText.trim().split(/\r?\n/)
  if (lines.length < 2) return empty

  // ── Parse header ────────────────────────────────────────────────────────────
  const headers = lines[0].split(',').map(h => h.trim())

  const idx = (names: string[]): number => {
    for (const n of names) {
      const i = headers.findIndex(h => h === n || h.startsWith(n))
      if (i >= 0) return i
    }
    return -1
  }

  const timeIdx     = idx(['time'])
  const gyroIdx     = idx(['gyroADC[0]'])
  const setpointIdx = idx(['setpoint[0]'])
  const axisPIdx    = idx(['axisP[0]'])
  const axisIIdx    = idx(['axisI[0]'])
  const axisDIdx    = idx(['axisD[0]'])

  // Without gyro + setpoint we can't produce a useful log
  if (gyroIdx < 0 || setpointIdx < 0) return empty

  // ── Parse data rows ──────────────────────────────────────────────────────────
  const gyroVals: number[]     = []
  const setpointVals: number[] = []
  const timeVals: number[]     = []
  const pidSumVals: number[]   = []
  const hasPid = axisPIdx >= 0 && axisIIdx >= 0 && axisDIdx >= 0

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const parts = line.split(',')

    const gyro     = parseFloat(parts[gyroIdx]     ?? '')
    const setpoint = parseFloat(parts[setpointIdx] ?? '')
    if (!isFinite(gyro) || !isFinite(setpoint)) continue

    gyroVals.push(gyro)
    setpointVals.push(setpoint)

    const t = timeIdx >= 0 ? parseFloat(parts[timeIdx] ?? '') : NaN
    timeVals.push(isFinite(t) ? t : 0)

    if (hasPid) {
      const p  = parseFloat(parts[axisPIdx] ?? '') || 0
      const iv = parseFloat(parts[axisIIdx] ?? '') || 0
      const d  = parseFloat(parts[axisDIdx] ?? '') || 0
      pidSumVals.push(p + iv + d)
    }
  }

  if (gyroVals.length === 0) return empty

  // ── Determine loop rate from time column (microseconds) ─────────────────────
  let loopRateHz = 0
  let duration   = 0

  if (timeVals.length >= 2) {
    const dts: number[] = []
    for (let i = 1; i < timeVals.length; i++) {
      const dt = timeVals[i] - timeVals[i - 1]
      if (dt > 0) dts.push(dt)
    }
    if (dts.length > 0) {
      dts.sort((a, b) => a - b)
      const medianDt = dts[Math.floor(dts.length / 2)]
      loopRateHz = Math.round(1e6 / medianDt)
    }
    duration = (timeVals[timeVals.length - 1] - timeVals[0]) / 1e6
  }

  // ── Assemble log ─────────────────────────────────────────────────────────────
  const log: BlackboxLog = {
    loopRateHz,
    channels: {
      setpoint: new Float32Array(setpointVals),
      gyro:     new Float32Array(gyroVals),
    },
    duration,
  }

  if (pidSumVals.length > 0) {
    log.channels.pidSum = new Float32Array(pidSumVals)
  }

  return log
}
