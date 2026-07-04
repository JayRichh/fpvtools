// src/core/setup/store.ts — cross-tool "active setup" store.
//
// One lightweight, localStorage-backed record of the craft being planned, so
// numbers flow between Motors → Power → Flight Time → RF instead of being
// re-typed per tool. Follows the fpvI18n singleton pattern (subscribe/notify;
// localStorage is the only side effect).

export interface ActiveSetup {
  auwG?: number
  chemistry?: 'lipo' | 'liion'
  cellCount?: number
  parallelCount?: number
  capacityPerCellMah?: number
  hoverEfficiencyGPerW?: number
  motorName?: string
  propName?: string
  vtxPowerMw?: number
  updatedAt: number
}

const STORAGE_KEY = 'fpv-active-setup'

type Callback = () => void

class ActiveSetupStore {
  private _setup: ActiveSetup | null = null
  private _loaded = false
  private _subs = new Set<Callback>()

  get(): ActiveSetup | null {
    if (!this._loaded) {
      this._loaded = true
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw) this._setup = JSON.parse(raw) as ActiveSetup
      } catch {
        this._setup = null
      }
    }
    return this._setup
  }

  /** True when at least one field besides updatedAt is set. */
  hasData(): boolean {
    const s = this.get()
    if (!s) return false
    return Object.keys(s).some(k => k !== 'updatedAt' && s[k as keyof ActiveSetup] !== undefined)
  }

  /** Merge fields into the setup (undefined values are ignored). */
  update(partial: Omit<Partial<ActiveSetup>, 'updatedAt'>): void {
    const base = this.get() ?? { updatedAt: 0 }
    const next: ActiveSetup = { ...base, updatedAt: Date.now() }
    for (const [k, v] of Object.entries(partial)) {
      if (v !== undefined) (next as unknown as Record<string, unknown>)[k] = v
    }
    this._setup = next
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch { /* storage full/blocked: keep in-memory state */ }
    this._notify()
  }

  clear(): void {
    this._setup = null
    this._loaded = true
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch { /* ignore */ }
    this._notify()
  }

  subscribe(cb: Callback): () => void {
    this._subs.add(cb)
    return () => this._subs.delete(cb)
  }

  private _notify(): void {
    this._subs.forEach(cb => cb())
  }
}

export const activeSetup = new ActiveSetupStore()
