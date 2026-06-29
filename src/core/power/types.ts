export interface CellSpec {
  name: string; capacityMah: number; maxContinuousA: number
  weightG: number; internalResistanceMohm: number; nominalV: number
}
export interface PackConfig {
  cell: CellSpec; series: number; parallel: number; wiringOverheadPct: number
}
export interface FlightModel {
  auwG: number; hoverEfficiencyGPerW: number; cruiseFactor: number
  cruiseSpeedMs: number; usableCapacityPct: number
}
export interface PackResult {
  nominalV: number; capacityMah: number; energyWh: number; weightG: number
  maxContinuousA: number; packIRmohm: number
  hoverCurrentA: number; cruiseCurrentA: number
  hoverTimeMin: number; cruiseTimeMin: number
  voltageSagV: number; sagWarning: boolean
  cRateOk: boolean; cRateMargin: number; rangeKm: number
}
