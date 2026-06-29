// scripts/check-translations.ts
// Run: npx tsx scripts/check-translations.ts
import { readFileSync, readdirSync } from 'node:fs'
import { resolve, join } from 'node:path'

const localeDir = resolve('src/locales')

function flatKeys(obj: unknown, prefix = ''): string[] {
  if (typeof obj !== 'object' || obj === null) return [prefix].filter(Boolean)
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    flatKeys(v, prefix ? `${prefix}.${k}` : k)
  )
}

function checkEmptyValues(obj: unknown, prefix = ''): string[] {
  if (typeof obj === 'string') return obj.trim() === '' ? [prefix] : []
  if (typeof obj !== 'object' || obj === null) return []
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    checkEmptyValues(v, prefix ? `${prefix}.${k}` : k)
  )
}

const en = JSON.parse(readFileSync(join(localeDir, 'en.json'), 'utf8'))
const enKeys = new Set(flatKeys(en))

console.log(`[en]  ${enKeys.size} keys (source of truth)\n`)

let hasError = false

for (const file of readdirSync(localeDir).filter(f => f.endsWith('.json') && f !== 'en.json')) {
  const locale = file.replace('.json', '')
  const messages = JSON.parse(readFileSync(join(localeDir, file), 'utf8'))
  const keys = new Set(flatKeys(messages))

  const missing = [...enKeys].filter(k => !keys.has(k))
  const extra = [...keys].filter(k => !enKeys.has(k))
  const empty = checkEmptyValues(messages)

  if (missing.length || extra.length || empty.length) {
    hasError = true
    console.error(`[${locale}]  ${missing.length} missing  ${extra.length} extra  ${empty.length} empty`)
    missing.forEach(k => console.error(`  - MISSING  ${k}`))
    extra.forEach(k => console.error(`  + EXTRA    ${k}`))
    empty.forEach(k => console.error(`  ! EMPTY    ${k}`))
  } else {
    console.log(`[${locale}]  OK (${enKeys.size} keys)`)
  }
}

if (hasError) process.exit(1)
