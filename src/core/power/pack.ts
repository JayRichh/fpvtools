import type { PackConfig, FlightModel, PackResult } from './types'

export function computePack(pack: PackConfig, flight: FlightModel): PackResult {
  const { cell, series, parallel, wiringOverheadPct } = pack
  const nominalV = series * cell.nominalV
  const capacityMah = parallel * cell.capacityMah
  const energyWh = nominalV * capacityMah / 1000
  const weightG = series * parallel * cell.weightG * (1 + wiringOverheadPct / 100)
  const maxContinuousA = parallel * cell.maxContinuousA
  const packIRmohm = cell.internalResistanceMohm * series / parallel

  const hoverW = flight.auwG / flight.hoverEfficiencyGPerW
  const hoverCurrentA = hoverW / nominalV
  const cruiseCurrentA = hoverCurrentA * flight.cruiseFactor
  const usableMah = capacityMah * (flight.usableCapacityPct / 100)

  // usableMah (mAh) / hoverCurrentA (A) → hours; * 60 → minutes
  const hoverTimeMin = (usableMah / 1000) / hoverCurrentA * 60
  const cruiseTimeMin = (usableMah / 1000) / cruiseCurrentA * 60

  const voltageSagV = cruiseCurrentA * packIRmohm / 1000
  const sagWarning = voltageSagV > nominalV * 0.1

  const cRateOk = hoverCurrentA < maxContinuousA
  const cRateMargin = maxContinuousA / hoverCurrentA
  const rangeKm = flight.cruiseSpeedMs * cruiseTimeMin * 60 / 1000

  return {
    nominalV, capacityMah, energyWh, weightG, maxContinuousA, packIRmohm,
    hoverCurrentA, cruiseCurrentA, hoverTimeMin, cruiseTimeMin,
    voltageSagV, sagWarning, cRateOk, cRateMargin, rangeKm,
  }
}
