export type StockStatus = 'in' | 'out' | 'check'
export type ItemCategory = 'Airframe' | 'Ground Station' | 'Power' | 'Consumables' | 'QOL'

export interface BuildItem {
  id: string
  name: string
  cat: ItemCategory
  price: number
  confirmed: boolean
  store: string
  url: string
  stock: StockStatus
  verified: boolean
  backups: { label: string; url: string }[]
  note: string
}

export interface ChecklistItem {
  text: string
  phase: 'Bench' | 'Setup' | 'Field'
}

export interface StoreMeta {
  url: string
  ship: string
  hue: number
}

export interface BuildMeta {
  slug: string
  name: string
  description: string
  createdAt: number
  updatedAt: number
}

export interface BuildDefinition {
  meta: BuildMeta
  items: BuildItem[]
  checklist: ChecklistItem[]
  firmware: { name: string; url: string }[]
  refs: { name: string; url: string }[]
  storesMeta: Record<string, StoreMeta>
  catOrder: ItemCategory[]
  storeOrder: string[]
}

export interface BuildUserState {
  bought: Record<string, boolean>
  notes: Record<string, string>
  checks: Record<number, boolean>
}

export interface PersistedBuild {
  definition: BuildDefinition
  userState: BuildUserState
}
