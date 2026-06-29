import { describe, it, expect } from 'vitest'
import { mwToDbm, dbmToMw, mahToWh, whToMah, kvToRpm, rpmToHz, hzToRpm, rpmToRadS, awgToMm2, awgAmpacity, voltageDropV } from '../../../src/core/rf/convert'

describe('mwToDbm', () => {
  it('1 mW = 0 dBm', () => {
    expect(mwToDbm(1)).toBeCloseTo(0, 5)
  })
  it('1000 mW = 30 dBm', () => {
    expect(mwToDbm(1000)).toBeCloseTo(30, 3)
  })
  it('100 mW = 20 dBm', () => {
    expect(mwToDbm(100)).toBeCloseTo(20, 3)
  })
})

describe('dbmToMw', () => {
  it('0 dBm = 1 mW', () => {
    expect(dbmToMw(0)).toBeCloseTo(1, 5)
  })
  it('30 dBm = 1000 mW', () => {
    expect(dbmToMw(30)).toBeCloseTo(1000, 1)
  })
  it('20 dBm = 100 mW', () => {
    expect(dbmToMw(20)).toBeCloseTo(100, 3)
  })
})

describe('roundtrip mwToDbm / dbmToMw', () => {
  it('mW -> dBm -> mW roundtrip for 25mW', () => {
    expect(dbmToMw(mwToDbm(25))).toBeCloseTo(25, 5)
  })
  it('mW -> dBm -> mW roundtrip for 500mW', () => {
    expect(dbmToMw(mwToDbm(500))).toBeCloseTo(500, 3)
  })
  it('dBm -> mW -> dBm roundtrip for 27 dBm', () => {
    expect(mwToDbm(dbmToMw(27))).toBeCloseTo(27, 5)
  })
})

describe('mahToWh / whToMah', () => {
  it('1300mAh at 11.1V = 14.43Wh', () => {
    expect(mahToWh(1300, 11.1)).toBeCloseTo(14.43, 2)
  })
  it('roundtrip whToMah(mahToWh(mah, v), v) = mah', () => {
    expect(whToMah(mahToWh(2200, 14.8), 14.8)).toBeCloseTo(2200, 3)
  })
})

describe('kvToRpm / rpmToHz / hzToRpm', () => {
  it('2300KV at 14.8V = 34040 RPM', () => {
    expect(kvToRpm(2300, 14.8)).toBeCloseTo(34040, 0)
  })
  it('rpmToHz(60000) = 1000 Hz', () => {
    expect(rpmToHz(60000)).toBeCloseTo(1000, 5)
  })
  it('hzToRpm roundtrip', () => {
    expect(hzToRpm(rpmToHz(30000))).toBeCloseTo(30000, 5)
  })
})

describe('rpmToRadS', () => {
  it('60 RPM = 2*PI rad/s', () => {
    expect(rpmToRadS(60)).toBeCloseTo(2 * Math.PI, 5)
  })
})

describe('awgToMm2', () => {
  it('AWG 24 is approximately 0.205 mm²', () => {
    expect(awgToMm2(24)).toBeCloseTo(0.205, 2)
  })
  it('lower AWG = larger cross-section', () => {
    expect(awgToMm2(12)).toBeGreaterThan(awgToMm2(20))
  })
})

describe('awgAmpacity', () => {
  it('AWG 20 = 5A', () => {
    expect(awgAmpacity(20)).toBe(5.0)
  })
  it('AWG 12 = 20A', () => {
    expect(awgAmpacity(12)).toBe(20)
  })
  it('unknown AWG returns 0', () => {
    expect(awgAmpacity(99)).toBe(0)
  })
})

describe('voltageDropV', () => {
  it('returns a positive voltage drop', () => {
    expect(voltageDropV(10, 18, 0.3)).toBeGreaterThan(0)
  })
  it('voltage drop scales linearly with current', () => {
    const v1 = voltageDropV(5, 16, 0.5)
    const v2 = voltageDropV(10, 16, 0.5)
    expect(v2).toBeCloseTo(v1 * 2, 5)
  })
})
