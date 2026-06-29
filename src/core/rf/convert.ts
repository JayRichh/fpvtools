export function mwToDbm(mw: number): number { return 10 * Math.log10(mw) }
export function dbmToMw(dbm: number): number { return Math.pow(10, dbm / 10) }
export function mahToWh(mah: number, voltage: number): number { return mah * voltage / 1000 }
export function whToMah(wh: number, voltage: number): number { return wh * 1000 / voltage }
export function kvToRpm(kv: number, voltage: number): number { return kv * voltage }
export function rpmToHz(rpm: number): number { return rpm / 60 }
export function hzToRpm(hz: number): number { return hz * 60 }
export function rpmToRadS(rpm: number): number { return rpm * 2 * Math.PI / 60 }
export function awgToMm2(awg: number): number { return 0.012668 * Math.pow(92, (36 - awg) / 19.5) }
export function awgAmpacity(awg: number): number {
  const table: Record<number, number> = { 30: 0.52, 28: 0.83, 26: 1.3, 24: 2.1, 22: 3.0, 20: 5.0, 18: 7.5, 16: 10, 14: 15, 12: 20, 10: 30 }
  return table[awg] ?? 0
}
export function voltageDropV(currentA: number, awg: number, lengthM: number): number {
  const resistivityOhmPerM = 0.0175 / awgToMm2(awg)
  return 2 * currentA * resistivityOhmPerM * lengthM
}
