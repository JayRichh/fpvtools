<template>
  <div class="detail">
    <!-- Sticky header -->
    <header class="detail-header">
      <router-link to="/build" class="back-btn" aria-label="Back to builds">← Builds</router-link>
      <div class="detail-title-group">
        <span
          v-if="!editingName"
          class="detail-name"
          @click="startEditName"
          title="Click to edit"
        >{{ build?.definition.meta.name }}</span>
        <input
          v-else
          ref="nameInput"
          v-model="editName"
          class="detail-name-input"
          @blur="saveName"
          @keydown.enter="saveName"
          @keydown.esc="cancelEditName"
        />
        <span
          v-if="!editingDesc"
          class="detail-desc"
          :class="{ placeholder: !build?.definition.meta.description }"
          @click="startEditDesc"
        >{{ build?.definition.meta.description || 'Add description…' }}</span>
        <input
          v-else
          ref="descInput"
          v-model="editDesc"
          class="detail-desc-input"
          placeholder="Description"
          @blur="saveDesc"
          @keydown.enter="saveDesc"
          @keydown.esc="cancelEditDesc"
        />
      </div>
    </header>

    <template v-if="build">
      <!-- Budget summary -->
      <div class="budget-card">
        <build-progress
          :total="total"
          :spent="spent"
          :item-count="build.definition.items.length"
          :bought-count="boughtCount"
        ></build-progress>
        <div class="budget-stats">
          <div class="bstat">
            <span class="bstat-label">Total</span>
            <span class="bstat-value">NZD ${{ total.toFixed(2) }}</span>
          </div>
          <div class="bstat">
            <span class="bstat-label">Spent</span>
            <span class="bstat-value primary">NZD ${{ spent.toFixed(2) }}</span>
          </div>
          <div class="bstat">
            <span class="bstat-label">Remaining</span>
            <span class="bstat-value muted">NZD ${{ (total - spent).toFixed(2) }}</span>
          </div>
        </div>
        <div class="budget-legend">
          <span class="legend-dot confirmed"></span><span class="legend-label">Price confirmed</span>
          <span class="legend-dot estimate"></span><span class="legend-label">Estimate</span>
        </div>
      </div>

      <!-- Tab nav -->
      <nav class="tab-nav">
        <router-link :to="`/build/${slug}/store`">Store</router-link>
        <router-link :to="`/build/${slug}/items`">Items</router-link>
        <router-link :to="`/build/${slug}/check`">Checklist</router-link>
        <router-link :to="`/build/${slug}/links`">Links</router-link>
      </nav>

      <!-- Tab content -->
      <router-view :build="build" @update="onBuildUpdate" />
    </template>
    <div v-else class="not-found">
      <p>Build not found. <router-link to="/build">← Back to builds</router-link></p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { useRoute } from 'vue-router'
import { seedIfAbsent, getBuild, saveBuild, buildTotal, buildSpent } from '@core/builds/storage'
import type { PersistedBuild } from '@core/builds/types'
import '@components/builds/build-progress.js'

const route = useRoute()
const slug = computed(() => route.params.slug as string)

const build = ref<PersistedBuild | null>(null)

onMounted(() => {
  seedIfAbsent()
  build.value = getBuild(slug.value) ?? null
})

watch(slug, () => {
  build.value = getBuild(slug.value) ?? null
})

const total = computed(() => build.value ? buildTotal(build.value.definition) : 0)
const spent = computed(() => build.value ? buildSpent(build.value.definition, build.value.userState) : 0)
const boughtCount = computed(() => build.value ? Object.values(build.value.userState.bought).filter(Boolean).length : 0)

// Name editing
const editingName = ref(false)
const editName = ref('')
const nameInput = ref<HTMLInputElement | null>(null)

function startEditName() {
  editName.value = build.value?.definition.meta.name ?? ''
  editingName.value = true
  nextTick(() => nameInput.value?.select())
}
function saveName() {
  if (build.value && editName.value.trim()) {
    build.value.definition.meta.name = editName.value.trim()
    build.value.definition.meta.updatedAt = Date.now()
    saveBuild(slug.value, build.value)
  }
  editingName.value = false
}
function cancelEditName() { editingName.value = false }

// Description editing
const editingDesc = ref(false)
const editDesc = ref('')
const descInput = ref<HTMLInputElement | null>(null)

function startEditDesc() {
  editDesc.value = build.value?.definition.meta.description ?? ''
  editingDesc.value = true
  nextTick(() => descInput.value?.focus())
}
function saveDesc() {
  if (build.value) {
    build.value.definition.meta.description = editDesc.value.trim()
    build.value.definition.meta.updatedAt = Date.now()
    saveBuild(slug.value, build.value)
  }
  editingDesc.value = false
}
function cancelEditDesc() { editingDesc.value = false }

function onBuildUpdate(updated: PersistedBuild) {
  build.value = updated
  saveBuild(slug.value, updated)
}
</script>

<style scoped>
.detail {
  max-width: 1400px;
  margin: 0 auto;
}

.detail-header {
  position: sticky;
  top: 57px; /* below main nav */
  z-index: 10;
  background: var(--fpv-surface);
  border-bottom: 1px solid var(--fpv-border);
  padding: var(--fpv-space-sm) 0;
  margin: 0 calc(-1 * var(--fpv-space-lg));
  padding-left: var(--fpv-space-lg);
  padding-right: var(--fpv-space-lg);
  display: flex;
  align-items: flex-start;
  gap: var(--fpv-space-md);
  margin-bottom: var(--fpv-space-md);
}

.back-btn {
  color: var(--fpv-text-muted);
  font-size: var(--fpv-font-label);
  white-space: nowrap;
  padding-top: 4px;
  min-height: 44px;
  display: flex;
  align-items: center;
}
.back-btn:hover { color: var(--fpv-primary); }

.detail-title-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.detail-name {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--fpv-text);
  cursor: text;
  min-height: 44px;
  display: flex;
  align-items: center;
}
.detail-name:hover { color: var(--fpv-primary); }

.detail-name-input, .detail-desc-input {
  background: var(--fpv-surface-2);
  border: 1px solid var(--fpv-primary);
  border-radius: var(--fpv-radius-sm);
  color: var(--fpv-text);
  padding: 6px 10px;
  font-family: var(--fpv-font-sans);
  min-height: 44px;
  width: 100%;
}
.detail-name-input { font-size: 1.1rem; font-weight: 600; }
.detail-desc-input { font-size: var(--fpv-font-label); }

.detail-desc {
  font-size: var(--fpv-font-label);
  color: var(--fpv-text-muted);
  cursor: text;
}
.detail-desc.placeholder { opacity: 0.4; }

.budget-card {
  background: var(--fpv-surface-2);
  border: 1px solid var(--fpv-border);
  border-radius: var(--fpv-radius-md);
  padding: var(--fpv-space-md);
  margin-bottom: var(--fpv-space-md);
  display: grid;
  grid-template-columns: 200px 1fr;
  grid-template-rows: auto auto;
  gap: var(--fpv-space-md);
  align-items: center;
}

build-progress {
  grid-row: 1 / 3;
  height: 140px;
}

.budget-stats {
  display: flex;
  gap: var(--fpv-space-lg);
}

.bstat {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.bstat-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--fpv-text-muted);
}

.bstat-value {
  font-family: var(--fpv-font-mono);
  font-size: 1rem;
  font-weight: 600;
  color: var(--fpv-text);
}
.bstat-value.primary { color: var(--fpv-primary); }
.bstat-value.muted { color: var(--fpv-text-muted); }

.budget-legend {
  display: flex;
  align-items: center;
  gap: var(--fpv-space-sm);
}

.legend-dot {
  width: 10px; height: 10px;
  border-radius: 50%;
  display: inline-block;
}
.legend-dot.confirmed { background: var(--fpv-success); }
.legend-dot.estimate { background: var(--fpv-text-muted); }
.legend-label { font-size: 11px; color: var(--fpv-text-muted); margin-right: var(--fpv-space-sm); }

.tab-nav {
  display: flex;
  gap: 0;
  border-bottom: 1px solid var(--fpv-border);
  margin-bottom: var(--fpv-space-md);
  overflow-x: auto;
}

.tab-nav a {
  padding: var(--fpv-space-sm) var(--fpv-space-md);
  color: var(--fpv-text-muted);
  border-bottom: 2px solid transparent;
  white-space: nowrap;
  font-size: var(--fpv-font-body);
  min-height: 44px;
  display: flex;
  align-items: center;
  transition: color 0.15s;
}
.tab-nav a:hover { color: var(--fpv-text); }
.tab-nav a.router-link-active { color: var(--fpv-primary); border-bottom-color: var(--fpv-primary); }

.not-found {
  padding: var(--fpv-space-xl);
  color: var(--fpv-text-muted);
  text-align: center;
}

@media (max-width: 600px) {
  .budget-card {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto auto;
  }
  build-progress { grid-row: auto; height: 120px; }
  .budget-stats { flex-wrap: wrap; gap: var(--fpv-space-md); }
  .detail-header {
    margin-left: calc(-1 * var(--fpv-space-md));
    margin-right: calc(-1 * var(--fpv-space-md));
    padding-left: var(--fpv-space-md);
    padding-right: var(--fpv-space-md);
  }
}
</style>
