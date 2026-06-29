import type { VtxRuleQuery, VtxRuleResult } from './types'
import { mwToDbm } from './convert'

interface VtxRule { band: string; maxPowerMw: number; note: string }

const RULES: Record<string, VtxRule[]> = {
  'USA (FCC)': [
    { band: '5.8', maxPowerMw: 1000, note: 'FCC Part 87 — 1W max EIRP on 5.8GHz for amateur radio' },
    { band: '2.4', maxPowerMw: 1000, note: 'FCC Part 15 — 1W max' },
    { band: '915', maxPowerMw: 1000, note: 'FCC Part 15 — 1W max ISM band' },
  ],
  'EU': [
    { band: '5.8', maxPowerMw: 25, note: 'ETSI EN 302 502 — 25mW max EIRP (most countries)' },
    { band: '2.4', maxPowerMw: 100, note: 'ETSI EN 300 328 — 100mW max EIRP' },
    { band: '915', maxPowerMw: 25, note: '868MHz band — 25mW max, duty cycle restricted' },
  ],
  'UK': [
    { band: '5.8', maxPowerMw: 25, note: 'Ofcom — 25mW max EIRP, licence exempt' },
    { band: '2.4', maxPowerMw: 100, note: 'Ofcom — 100mW EIRP' },
    { band: '915', maxPowerMw: 25, note: '868MHz — 25mW' },
  ],
  'Australia': [
    { band: '5.8', maxPowerMw: 1000, note: 'ACMA — 1W max on 5.8GHz with amateur licence' },
    { band: '2.4', maxPowerMw: 1000, note: 'ACMA — 1W max EIRP' },
    { band: '915', maxPowerMw: 1000, note: 'ACMA — 1W max ISM 915-928MHz' },
  ],
  'New Zealand': [
    { band: '5.8', maxPowerMw: 1000, note: 'RSM GURL — 1W max EIRP' },
    { band: '2.4', maxPowerMw: 1000, note: 'RSM GURL — 1W max EIRP' },
    { band: '915', maxPowerMw: 1000, note: 'RSM — 1W max' },
  ],
  'Canada': [
    { band: '5.8', maxPowerMw: 1000, note: 'ISED RSS-210 — 1W max' },
    { band: '2.4', maxPowerMw: 1000, note: 'ISED RSS-247 — 1W max EIRP' },
    { band: '915', maxPowerMw: 1000, note: 'ISED RSS-210 — 1W max ISM' },
  ],
  'Japan': [
    { band: '5.8', maxPowerMw: 10, note: 'MIC — 10mW max, amateur licence required for FPV' },
    { band: '2.4', maxPowerMw: 10, note: 'MIC — 10mW max EIRP' },
    { band: '915', maxPowerMw: 1, note: 'MIC — 920MHz band, 1mW, highly restricted' },
  ],
}

export const COUNTRIES = Object.keys(RULES)

export function checkVtxRules(query: VtxRuleQuery): VtxRuleResult {
  const countryRules = RULES[query.country]
  if (!countryRules) return { compliant: false, limitMw: 0, limitDbm: 0, note: 'Country not found' }
  const rule = countryRules.find(r => r.band === query.band)
  if (!rule) return { compliant: false, limitMw: 0, limitDbm: 0, note: 'Band not regulated in this region' }
  return {
    compliant: query.powerMw <= rule.maxPowerMw,
    limitMw: rule.maxPowerMw,
    limitDbm: mwToDbm(rule.maxPowerMw),
    note: rule.note,
  }
}
