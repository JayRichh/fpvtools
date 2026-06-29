export interface LinkBudgetInput {
  txPowerMw: number; txGainDbi: number; rxGainDbi: number
  frequencyMhz: number; packetRateHz: number
}
export interface LinkBudgetResult {
  pathLossDb: number; linkMarginDb: number
  theoreticalRangeKm: number; sensitivityDbm: number
  txPowerDbm: number
}
export interface VtxRuleQuery {
  country: string; band: '5.8' | '2.4' | '915'; powerMw: number; channelMhz: number
}
export interface VtxRuleResult {
  compliant: boolean; limitMw: number; limitDbm: number; note: string
}
