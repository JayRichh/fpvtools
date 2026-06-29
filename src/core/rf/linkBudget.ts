import type { LinkBudgetInput, LinkBudgetResult } from './types'
import { mwToDbm } from './convert'

export function computeLinkBudget(input: LinkBudgetInput): LinkBudgetResult {
  const txPowerDbm = mwToDbm(input.txPowerMw)
  // ELRS sensitivity approximation based on packet rate
  const baseSensitivity = -130 // dBm at lowest rate
  const rateOffset = 10 * Math.log10(input.packetRateHz / 25)
  const sensitivityDbm = baseSensitivity + rateOffset

  // Free-space path loss: FSPL(dB) = 20*log10(d_km) + 20*log10(f_MHz) + 32.44
  // At max range, received power = sensitivity
  // rxPower = txPower + txGain + rxGain - FSPL = sensitivity
  // FSPL = txPower + txGain + rxGain - sensitivity
  const maxFspl = txPowerDbm + input.txGainDbi + input.rxGainDbi - sensitivityDbm
  // FSPL = 20*log10(d) + 20*log10(f) + 32.44
  // 20*log10(d) = maxFspl - 20*log10(f) - 32.44
  const logD = (maxFspl - 20 * Math.log10(input.frequencyMhz) - 32.44) / 20
  const theoreticalRangeKm = Math.pow(10, logD)

  // Path loss at 1km reference
  const pathLossDb = 20 * Math.log10(1) + 20 * Math.log10(input.frequencyMhz) + 32.44
  const linkMarginDb = txPowerDbm + input.txGainDbi + input.rxGainDbi - pathLossDb - sensitivityDbm

  return { pathLossDb, linkMarginDb, theoreticalRangeKm, sensitivityDbm, txPowerDbm }
}
