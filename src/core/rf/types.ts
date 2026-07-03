export interface LinkBudgetInput {
  txPowerMw: number; txGainDbi: number; rxGainDbi: number
  frequencyMhz: number; packetRateHz: number
  /** Distance at which pathLossDb / linkMarginDb are evaluated (default 1 km) */
  distanceKm?: number
  /** Coax/feedline loss (default 0) */
  cableLossDb?: number
  /** Connector/adapter losses (default 0) */
  connectorLossDb?: number
  /** Fade margin to retain for usableRangeKm (default 0) */
  targetMarginDb?: number
}
export interface LinkBudgetResult {
  pathLossDb: number; linkMarginDb: number
  theoreticalRangeKm: number
  /** Range that still retains targetMarginDb of fade margin */
  usableRangeKm: number
  sensitivityDbm: number
  txPowerDbm: number
  /** First Fresnel zone radius at the midpoint of distanceKm */
  fresnelRadiusM: number
}
export interface VtxRuleQuery {
  country: string; band: '5.8' | '2.4' | '915'; powerMw: number; channelMhz: number
}
export interface VtxRuleResult {
  compliant: boolean; limitMw: number; limitDbm: number; note: string
}
