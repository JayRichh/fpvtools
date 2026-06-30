export interface FlightTimeInput {
  chemistry: 'lipo' | 'liion'
  cellCount: number
  parallelCount: number
  capacityPerCellMah: number
  usablePct: number
  hoverEfficiencyGPerW: number
  totalHoverCurrentA: number
  auwG: number
  cruiseThrottlePct: number
  cruiseSpeedKmh: number
  reservePct: number
}

export interface FlightTimeResult {
  usableCapacityMah: number
  hoverCurrentA: number
  cruiseCurrentA: number
  hoverTimeMin: number
  cruiseTimeMin: number
  maxRangeKm: number
  reserveCapacityMah: number
  packDischargeC: number
}
