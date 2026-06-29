import { describe, it, expect } from 'vitest'
import { parseBlackboxCsv } from '../../../src/core/blackbox/parse'

// ─── Fixture CSV ──────────────────────────────────────────────────────────────
// time is in microseconds; dt = 250 µs → loopRateHz = 4 000 Hz

const SIMPLE_CSV = `loopIteration,time,gyroADC[0],setpoint[0]
0,0,0.5,100
1,250,0.6,100
2,500,0.7,100
3,750,0.8,100`

const PID_CSV = `loopIteration,time,axisP[0],axisI[0],axisD[0],gyroADC[0],setpoint[0]
0,0,10,2,3,0.5,100
1,250,11,2,3,0.6,100
2,500,12,2,3,0.7,100`

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('parseBlackboxCsv', () => {
  it('infers loop rate from the time column', () => {
    const log = parseBlackboxCsv(SIMPLE_CSV)
    // median dt = 250 µs → 1e6 / 250 = 4 000 Hz
    expect(log.loopRateHz).toBe(4000)
  })

  it('returns the correct number of samples', () => {
    const log = parseBlackboxCsv(SIMPLE_CSV)
    expect(log.channels.gyro.length).toBe(4)
    expect(log.channels.setpoint.length).toBe(4)
  })

  it('parses gyro and setpoint values correctly', () => {
    const log = parseBlackboxCsv(SIMPLE_CSV)
    expect(log.channels.gyro[0]).toBeCloseTo(0.5, 5)
    expect(log.channels.gyro[3]).toBeCloseTo(0.8, 5)
    expect(log.channels.setpoint[0]).toBeCloseTo(100, 5)
  })

  it('computes duration in seconds', () => {
    const log = parseBlackboxCsv(SIMPLE_CSV)
    // (750 - 0) µs = 0.00075 s
    expect(log.duration).toBeCloseTo(0.00075, 8)
  })

  it('builds pidSum channel from axisP + axisI + axisD when present', () => {
    const log = parseBlackboxCsv(PID_CSV)
    expect(log.channels.pidSum).toBeDefined()
    // row 0: 10 + 2 + 3 = 15
    expect(log.channels.pidSum![0]).toBeCloseTo(15, 5)
  })

  it('returns an empty log for an empty string', () => {
    const log = parseBlackboxCsv('')
    expect(log.loopRateHz).toBe(0)
    expect(log.channels.gyro.length).toBe(0)
    expect(log.channels.setpoint.length).toBe(0)
  })

  it('returns an empty log when required columns are missing', () => {
    const csv = `loopIteration,time\n0,0\n1,250`
    const log = parseBlackboxCsv(csv)
    expect(log.channels.gyro.length).toBe(0)
  })
})
