import type { PersistedBuild, BuildDefinition, BuildUserState } from './types.js'
import { seed7LR, SEED_7LR_SLUG } from './seed-7lr.js'

export { SEED_7LR_SLUG }

const STORAGE_KEY = 'fpv-builds-v1'

export function emptyUserState(): BuildUserState {
  return { bought: {}, notes: {}, checks: {} }
}

export function loadAllBuilds(): Record<string, PersistedBuild> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as Record<string, PersistedBuild>
  } catch {
    return {}
  }
}

export function saveAllBuilds(builds: Record<string, PersistedBuild>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(builds))
}

export function seedIfAbsent(): Record<string, PersistedBuild> {
  const builds = loadAllBuilds()
  if (!builds[SEED_7LR_SLUG]) {
    builds[SEED_7LR_SLUG] = { definition: seed7LR(), userState: emptyUserState() }
    saveAllBuilds(builds)
  }
  return builds
}

export function getBuild(slug: string): PersistedBuild | undefined {
  return loadAllBuilds()[slug]
}

export function saveBuild(slug: string, build: PersistedBuild): void {
  const builds = loadAllBuilds()
  builds[slug] = build
  saveAllBuilds(builds)
}

export function deleteBuild(slug: string): void {
  const builds = loadAllBuilds()
  delete builds[slug]
  saveAllBuilds(builds)
}

export function duplicateBuild(slug: string, newSlug: string, newName: string): PersistedBuild | null {
  const builds = loadAllBuilds()
  const src = builds[slug]
  if (!src) return null
  const now = Date.now()
  const copy: PersistedBuild = {
    definition: {
      ...src.definition,
      meta: { ...src.definition.meta, slug: newSlug, name: newName, createdAt: now, updatedAt: now },
    },
    userState: emptyUserState(),
  }
  builds[newSlug] = copy
  saveAllBuilds(builds)
  return copy
}

export function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function uniqueSlug(base: string, existing: Record<string, unknown>): string {
  let slug = base
  let n = 2
  while (existing[slug]) { slug = `${base}-${n++}` }
  return slug
}

export function resetDefinition(slug: string): void {
  if (slug !== SEED_7LR_SLUG) return
  const builds = loadAllBuilds()
  const build = builds[slug]
  if (!build) return
  builds[slug] = { definition: seed7LR(), userState: build.userState }
  saveAllBuilds(builds)
}

export function exportBuild(slug: string): void {
  const builds = loadAllBuilds()
  const build = builds[slug]
  if (!build) return
  const json = JSON.stringify(build, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${slug}.fpv-build.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function importBuild(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const build = JSON.parse(e.target!.result as string) as PersistedBuild
        const slug = build.definition?.meta?.slug
        if (!slug) { reject(new Error('Invalid build file: missing slug')); return }
        saveBuild(slug, build)
        resolve(slug)
      } catch (err) {
        reject(err)
      }
    }
    reader.readAsText(file)
  })
}

export function buildTotal(def: BuildDefinition): number {
  return def.items.reduce((s, i) => s + i.price, 0)
}

export function buildSpent(def: BuildDefinition, userState: BuildUserState): number {
  return def.items.filter(i => userState.bought[i.id]).reduce((s, i) => s + i.price, 0)
}
