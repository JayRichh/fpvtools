import type { LinkBudgetInput, LinkBudgetResult } from './types'
import { mwToDbm } from './convert'

// Free-space path loss: FSPL(dB) = 20·log10(d_km) + 20·log10(f_MHz) + 32.44
function fsplDb(distanceKm: number, frequencyMhz: number): number {
  return 20 * Math.log10(distanceKm) + 20 * Math.log10(frequencyMhz) + 32.44
}

export function computeLinkBudget(input: LinkBudgetInput): LinkBudgetResult {
  const distanceKm = input.distanceKm ?? 1
  const systemLossDb = (input.cableLossDb ?? 0) + (input.connectorLossDb ?? 0)
  const targetMarginDb = input.targetMarginDb ?? 0

  const txPowerDbm = mwToDbm(input.txPowerMw)
  // ELRS sensitivity approximation based on packet rate (rough estimate)
  const baseSensitivity = -130 // dBm at lowest rate
  const rateOffset = 10 * Math.log10(input.packetRateHz / 25)
  const sensitivityDbm = baseSensitivity + rateOffset

  // Link budget available for path loss (EIRP + RX gain − system losses)
  const budgetDb = txPowerDbm + input.txGainDbi + input.rxGainDbi - systemLossDb

  // Theoretical range: distance at which received power equals sensitivity
  const maxFspl = budgetDb - sensitivityDbm
  const logD = (maxFspl - 20 * Math.log10(input.frequencyMhz) - 32.44) / 20
  const theoreticalRangeKm = Math.pow(10, logD)

  // Usable range: distance that still retains the target fade margin
  const usableFspl = maxFspl - targetMarginDb
  const usableRangeKm = Math.pow(10, (usableFspl - 20 * Math.log10(input.frequencyMhz) - 32.44) / 20)

  // Margin at the user's distance
  const pathLossDb = fsplDb(distanceKm, input.frequencyMhz)
  const linkMarginDb = budgetDb - pathLossDb - sensitivityDbm

  // First Fresnel zone radius at the midpoint of the user's distance:
  // r(m) = 8.657 · √(d_km / f_GHz)
  const fresnelRadiusM = 8.657 * Math.sqrt(distanceKm / (input.frequencyMhz / 1000))

  return {
    pathLossDb, linkMarginDb, theoreticalRangeKm, usableRangeKm,
    sensitivityDbm, txPowerDbm, fresnelRadiusM,
  }
}
