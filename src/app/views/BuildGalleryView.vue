<template>
  <div class="gallery">
    <div class="gallery-header">
      <h1>{{ t('build.gallery_title') }}</h1>
      <div class="gallery-actions">
        <button class="btn-secondary" @click="triggerImport">{{ t('build.btn_import_json') }}</button>
        <input ref="importInput" type="file" accept=".json" style="display:none" @change="onImport" />
        <button class="btn-primary" @click="showNewForm = !showNewForm">{{ t('build.btn_new_build') }}</button>
      </div>
    </div>

    <!-- New build inline form -->
    <div v-if="showNewForm" class="new-build-form card">
      <h3>{{ t('build.form_title_new') }}</h3>
      <div class="form-row">
        <label>{{ t('build.label_name') }} <span class="required">*</span></label>
        <input v-model="newName" type="text" :placeholder="t('build.placeholder_name')" class="input" @keydown.enter="createBuild" @keydown.esc="cancelNew" />
      </div>
      <div class="form-row">
        <label>{{ t('build.label_description') }}</label>
        <input v-model="newDesc" type="text" :placeholder="t('build.placeholder_description')" class="input" />
      </div>
      <div class="form-row">
        <label>{{ t('build.label_duplicate_from') }}</label>
        <select v-model="newDupSlug" class="select">
          <option value="">{{ t('build.option_start_empty') }}</option>
          <option v-for="(b, slug) in builds" :key="slug" :value="slug">{{ b.definition.meta.name }}</option>
        </select>
      </div>
      <div class="form-actions">
        <button class="btn-primary" :disabled="!newName.trim()" @click="createBuild">{{ t('build.btn_create') }}</button>
        <button class="btn-ghost" @click="cancelNew">{{ t('common.cancel') }}</button>
      </div>
    </div>

    <!-- Build cards -->
    <div v-if="Object.keys(builds).length === 0" class="empty-state">
      <p>{{ t('build.empty_state') }}</p>
    </div>
    <div class="card-grid">
      <div v-for="(build, slug) in builds" :key="slug" class="build-card card">
        <div class="card-top">
          <div class="card-title-row">
            <span class="card-name">{{ build.definition.meta.name }}</span>
            <span v-if="slug === SEED_SLUG" class="badge badge-seed">{{ t('build.badge_seeded') }}</span>
          </div>
          <p v-if="build.definition.meta.description" class="card-desc">{{ build.definition.meta.description }}</p>
        </div>
        <div class="card-stats">
          <div class="stat">
            <span class="stat-label">{{ t('build.label_items') }}</span>
            <span class="stat-value">{{ build.definition.items.length }}</span>
          </div>
          <div class="stat">
            <span class="stat-label">{{ t('common.total') }}</span>
            <span class="stat-value mono">NZD ${{ total(build).toFixed(2) }}</span>
          </div>
          <div class="stat">
            <span class="stat-label">{{ t('build.label_spent') }}</span>
            <span class="stat-value mono">NZD ${{ spent(build).toFixed(2) }}</span>
          </div>
          <div class="stat">
            <span class="stat-label">{{ t('build.label_remaining') }}</span>
            <span class="stat-value mono">NZD ${{ (total(build) - spent(build)).toFixed(2) }}</span>
          </div>
        </div>
        <div class="progress-bar-wrap">
          <div class="progress-bar" :style="{ width: progressPct(build) + '%' }"></div>
        </div>
        <div class="card-meta">
          {{ t('build.label_updated') }} {{ timeAgo(build.definition.meta.updatedAt) }}
        </div>

        <!-- Actions or delete confirm -->
        <div v-if="deleteConfirm !== slug" class="card-actions">
          <router-link :to="`/build/${slug}/store`" class="btn-primary btn-sm">{{ t('build.btn_open') }}</router-link>
          <button class="btn-secondary btn-sm" @click="duplicate(slug)">{{ t('build.btn_duplicate') }}</button>
          <button class="btn-secondary btn-sm" @click="exportBuild(slug)">{{ t('build.btn_export') }}</button>
          <button v-if="slug === SEED_SLUG" class="btn-ghost btn-sm" @click="resetDef(slug)">{{ t('build.btn_reset_definition') }}</button>
          <button class="btn-danger btn-sm" @click="deleteConfirm = slug">{{ t('common.delete') }}</button>
        </div>
        <div v-else class="card-actions delete-confirm">
          <span>{{ t('build.confirm_delete_build') }}</span>
          <button class="btn-danger btn-sm" @click="confirmDelete(slug)">{{ t('common.confirm') }}</button>
          <button class="btn-ghost btn-sm" @click="deleteConfirm = ''">{{ t('common.cancel') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from '@/app/composables/useI18n'
import {
  seedIfAbsent, loadAllBuilds, saveAllBuilds, buildTotal, buildSpent,
  duplicateBuild, deleteBuild, exportBuild as exportBuildFn, importBuild,
  resetDefinition, slugify, uniqueSlug, SEED_7LR_SLUG as SEED_SLUG,
} from '@core/builds/storage'
import type { PersistedBuild } from '@core/builds/types'

const router = useRouter()
const { t } = useI18n()

const builds = ref<Record<string, PersistedBuild>>({})
const showNewForm = ref(false)
const newName = ref('')
const newDesc = ref('')
const newDupSlug = ref('')
const deleteConfirm = ref('')
const importInput = ref<HTMLInputElement | null>(null)

onMounted(() => { builds.value = seedIfAbsent() })

function refresh() { builds.value = loadAllBuilds() }

function total(b: PersistedBuild) { return buildTotal(b.definition) }
function spent(b: PersistedBuild) { return buildSpent(b.definition, b.userState) }
function progressPct(b: PersistedBuild) {
  const tot = total(b)
  return tot > 0 ? Math.min(100, (spent(b) / tot) * 100) : 0
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60000)
  if (m < 1) return t('build.time_just_now')
  if (m < 60) return t('build.time_minutes_ago', { n: m })
  const h = Math.floor(m / 60)
  if (h < 24) return t('build.time_hours_ago', { n: h })
  return t('build.time_days_ago', { n: Math.floor(h / 24) })
}

function createBuild() {
  if (!newName.value.trim()) return
  const base = slugify(newName.value.trim())
  const slug = uniqueSlug(base, builds.value)
  const now = Date.now()
  if (newDupSlug.value && builds.value[newDupSlug.value]) {
    duplicateBuild(newDupSlug.value, slug, newName.value.trim())
  } else {
    const newBuild: PersistedBuild = {
      definition: {
        meta: { slug, name: newName.value.trim(), description: newDesc.value.trim(), createdAt: now, updatedAt: now },
        items: [], checklist: [], firmware: [], refs: [],
        storesMeta: {}, catOrder: ['Airframe', 'Ground Station', 'Power', 'Consumables', 'QOL'], storeOrder: [],
      },
      userState: { bought: {}, notes: {}, checks: {} },
    }
    const all = loadAllBuilds()
    all[slug] = newBuild
    saveAllBuilds(all)
  }
  cancelNew()
  router.push(`/build/${slug}/store`)
}

function cancelNew() {
  showNewForm.value = false
  newName.value = ''
  newDesc.value = ''
  newDupSlug.value = ''
}

function duplicate(slug: string) {
  const src = builds.value[slug]
  if (!src) return
  const base = slugify(`${src.definition.meta.name} copy`)
  const all = loadAllBuilds()
  const newSlug = uniqueSlug(base, all)
  duplicateBuild(slug, newSlug, `${src.definition.meta.name} (copy)`)
  refresh()
}

function exportBuild(slug: string) { exportBuildFn(slug) }

function resetDef(slug: string) {
  resetDefinition(slug)
  refresh()
}

function confirmDelete(slug: string) {
  deleteBuild(slug)
  deleteConfirm.value = ''
  refresh()
}

function triggerImport() { importInput.value?.click() }

async function onImport(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  try {
    await importBuild(file)
    refresh()
  } catch (err) {
    alert(t('build.error_import_failed', { message: err }))
  }
}
</script>

<style scoped>
.gallery {
  max-width: 1400px;
  margin: 0 auto;
}

.gallery-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--fpv-space-lg);
  gap: var(--fpv-space-md);
  flex-wrap: wrap;
}

.gallery-actions {
  display: flex;
  gap: var(--fpv-space-sm);
}

.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: var(--fpv-space-md);
}

.card {
  background: var(--fpv-surface-2);
  border: 1px solid var(--fpv-border);
  border-radius: var(--fpv-radius-md);
  padding: var(--fpv-space-md);
  display: flex;
  flex-direction: column;
  gap: var(--fpv-space-sm);
}

.card-title-row {
  display: flex;
  align-items: center;
  gap: var(--fpv-space-sm);
}

.card-name {
  font-size: 1rem;
  font-weight: 600;
  color: var(--fpv-text);
}

.badge {
  font-size: 11px;
  padding: 2px 7px;
  border-radius: 99px;
  font-weight: 500;
}

.badge-seed {
  background: color-mix(in srgb, var(--fpv-primary) 15%, transparent);
  color: var(--fpv-primary);
  border: 1px solid color-mix(in srgb, var(--fpv-primary) 40%, transparent);
}

.card-desc {
  font-size: var(--fpv-font-label);
  color: var(--fpv-text-muted);
  margin: 0;
}

.card-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--fpv-space-xs);
}

.stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stat-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--fpv-text-muted);
}

.stat-value {
  font-size: var(--fpv-font-label);
  color: var(--fpv-text);
}

.stat-value.mono {
  font-family: var(--fpv-font-mono);
}

.progress-bar-wrap {
  height: 3px;
  background: var(--fpv-border);
  border-radius: 2px;
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background: var(--fpv-primary);
  border-radius: 2px;
  transition: width 0.3s ease;
}

.card-meta {
  font-size: 11px;
  color: var(--fpv-text-muted);
}

.card-actions {
  display: flex;
  gap: var(--fpv-space-xs);
  flex-wrap: wrap;
  align-items: center;
  margin-top: var(--fpv-space-xs);
}

.delete-confirm {
  background: color-mix(in srgb, var(--fpv-error) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--fpv-error) 30%, transparent);
  border-radius: var(--fpv-radius-sm);
  padding: var(--fpv-space-xs) var(--fpv-space-sm);
}

.empty-state {
  color: var(--fpv-text-muted);
  padding: var(--fpv-space-xl);
  text-align: center;
}

.new-build-form {
  margin-bottom: var(--fpv-space-md);
}

.new-build-form h3 {
  margin-bottom: var(--fpv-space-sm);
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: var(--fpv-space-sm);
}

.form-row label {
  font-size: var(--fpv-font-label);
  color: var(--fpv-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.required { color: var(--fpv-error); }

.input, .select {
  background: var(--fpv-surface);
  border: 1px solid var(--fpv-border);
  border-radius: var(--fpv-radius-sm);
  color: var(--fpv-text);
  padding: 8px 10px;
  font-size: var(--fpv-font-body);
  font-family: var(--fpv-font-sans);
  min-height: 44px;
  width: 100%;
}

.input:focus, .select:focus {
  outline: none;
  border-color: var(--fpv-primary);
}

.form-actions {
  display: flex;
  gap: var(--fpv-space-sm);
}

/* Shared button styles */
.btn-primary, .btn-secondary, .btn-ghost, .btn-danger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 0 var(--fpv-space-md);
  border-radius: var(--fpv-radius-sm);
  font-size: var(--fpv-font-body);
  font-family: var(--fpv-font-sans);
  cursor: pointer;
  border: 1px solid transparent;
  transition: background 0.15s, color 0.15s;
  white-space: nowrap;
  text-decoration: none;
}

.btn-sm { min-height: 36px; padding: 0 var(--fpv-space-sm); font-size: var(--fpv-font-label); }

.btn-primary {
  background: var(--fpv-primary);
  color: var(--fpv-surface);
  font-weight: 600;
}
.btn-primary:hover { opacity: 0.85; }
.btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }

.btn-secondary {
  background: var(--fpv-surface);
  border-color: var(--fpv-border);
  color: var(--fpv-text);
}
.btn-secondary:hover { border-color: var(--fpv-primary); color: var(--fpv-primary); }

.btn-ghost {
  background: transparent;
  color: var(--fpv-text-muted);
}
.btn-ghost:hover { color: var(--fpv-text); }

.btn-danger {
  background: transparent;
  border-color: color-mix(in srgb, var(--fpv-error) 40%, transparent);
  color: var(--fpv-error);
}
.btn-danger:hover { background: color-mix(in srgb, var(--fpv-error) 12%, transparent); }

@media (max-width: 600px) {
  .card-stats { grid-template-columns: repeat(2, 1fr); }
  .gallery-header { flex-direction: column; align-items: flex-start; }
}
</style>
