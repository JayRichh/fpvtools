import type { FlightTimeInput, FlightTimeResult } from './types.js'

export function computeFlightTime(input: FlightTimeInput): FlightTimeResult {
  const {
    cellCount, parallelCount, capacityPerCellMah, usablePct,
    totalHoverCurrentA, auwG, cruiseThrottlePct, cruiseSpeedKmh, reservePct,
  } = input

  const totalCapacityMah = capacityPerCellMah * parallelCount
  const reserveCapacityMah = totalCapacityMah * reservePct
  const usableCapacityMah = totalCapacityMah * usablePct - reserveCapacityMah

  const hoverCurrentA = totalHoverCurrentA
  // Cruise current scales as throttle^1.5 relative to hover current
  const cruiseCurrentA = hoverCurrentA * Math.pow(cruiseThrottlePct, 1.5)

  const hoverTimeMin = usableCapacityMah / (hoverCurrentA * 1000 / 60)
  const cruiseTimeMin = usableCapacityMah / (cruiseCurrentA * 1000 / 60)
  const maxRangeKm = (cruiseTimeMin / 60) * cruiseSpeedKmh

  const packDischargeC = hoverCurrentA / totalCapacityMah * 1000

  return {
    usableCapacityMah,
    hoverCurrentA,
    cruiseCurrentA,
    hoverTimeMin,
    cruiseTimeMin,
    maxRangeKm,
    reserveCapacityMah,
    packDischargeC,
  }
}

export const FLIGHTTIME_DEFAULTS: FlightTimeInput = {
  chemistry: 'liion',
  cellCount: 6,
  parallelCount: 1,
  capacityPerCellMah: 4200,
  usablePct: 0.8,
  hoverEfficiencyGPerW: 5.5,
  totalHoverCurrentA: 18,
  auwG: 1200,
  cruiseThrottlePct: 0.5,
  cruiseSpeedKmh: 60,
  reservePct: 0.2,
}

export function defaultVoltageRange(chemistry: 'lipo' | 'liion'): [number, number] {
  return chemistry === 'lipo' ? [3.0, 4.2] : [2.8, 4.2]
}

export function voltageAtDischarge(chemistry: 'lipo' | 'liion', dischargePct: number): number {
  const [vMin, vMax] = defaultVoltageRange(chemistry)
  return vMax - (vMax - vMin) * dischargePct
}
