<template>
  <div class="store-tab">
    <div v-for="storeName in storeOrder" :key="storeName" class="store-card" :class="{ complete: storeComplete(storeName) }">
      <div class="store-header">
        <div class="store-left">
          <span class="store-dot" :style="{ background: storeHue(storeName) }"></span>
          <div>
            <div class="store-name">{{ storeName }}</div>
            <div class="store-ship">{{ storeShip(storeName) }}</div>
          </div>
        </div>
        <div class="store-right">
          <span class="store-subtotal">NZD ${{ storeSubtotal(storeName).toFixed(2) }}</span>
          <span class="store-progress">{{ storeBought(storeName) }}/{{ storeItems(storeName).length }}</span>
          <a v-if="storeUrl(storeName)" :href="storeUrl(storeName)" target="_blank" rel="noopener noreferrer" class="store-link">
            {{ t('build.btn_open_store', { store: storeName }) }} →
          </a>
        </div>
      </div>
      <div class="store-items" v-if="storeItems(storeName).length">
        <build-item-row
          v-for="item in storeItems(storeName)"
          :key="item.id"
          :item="item"
          :bought="isBought(item.id)"
          :note-override="noteFor(item.id)"
          @item-bought="onBought"
          @item-note="onNote"
          @item-delete="onDelete"
          @item-edit="onEdit(item.id)"
        ></build-item-row>
      </div>
    </div>

    <!-- Edit form modal overlay -->
    <div v-if="editingId" class="edit-overlay">
      <div class="edit-modal">
        <build-item-form
          :initial-item="editingItem"
          @item-save="onSave"
          @item-cancel="editingId = null"
        ></build-item-form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from '@/app/composables/useI18n'
import type { PersistedBuild, BuildItem } from '@core/builds/types'
import '@components/builds/build-item-row.js'
import '@components/builds/build-item-form.js'

const { t } = useI18n()

const props = defineProps<{ build: PersistedBuild }>()
const emit = defineEmits<{ (e: 'update', build: PersistedBuild): void }>()

const editingId = ref<string | null>(null)
const editingItem = computed(() => props.build.definition.items.find(i => i.id === editingId.value) ?? null)

const storeOrder = computed(() => props.build.definition.storeOrder)

function storeItems(store: string): BuildItem[] {
  return props.build.definition.items.filter(i => i.store === store)
}
function storeSubtotal(store: string) { return storeItems(store).reduce((s, i) => s + i.price, 0) }
function storeBought(store: string) { return storeItems(store).filter(i => props.build.userState.bought[i.id]).length }
function storeComplete(store: string) { const items = storeItems(store); return items.length > 0 && storeBought(store) === items.length }
function isBought(id: string) { return !!props.build.userState.bought[id] }
function noteFor(id: string) { return props.build.userState.notes[id] ?? '' }

function storeHue(store: string) {
  const h = props.build.definition.storesMeta[store]?.hue ?? 0
  return `hsl(${h}, 60%, 55%)`
}
function storeShip(store: string) { return props.build.definition.storesMeta[store]?.ship ?? '' }
function storeUrl(store: string) { return props.build.definition.storesMeta[store]?.url ?? '' }

function cloneBuild(): PersistedBuild {
  return JSON.parse(JSON.stringify(props.build)) as PersistedBuild
}

function onBought(e: Event) {
  const { id, value } = (e as CustomEvent<{ id: string; value: boolean }>).detail
  const b = cloneBuild()
  b.userState.bought[id] = value
  b.definition.meta.updatedAt = Date.now()
  emit('update', b)
}

function onNote(e: Event) {
  const { id, value } = (e as CustomEvent<{ id: string; value: string }>).detail
  const b = cloneBuild()
  b.userState.notes[id] = value
  emit('update', b)
}

function onDelete(e: Event) {
  const { id } = (e as CustomEvent<{ id: string }>).detail
  const b = cloneBuild()
  b.definition.items = b.definition.items.filter(i => i.id !== id)
  delete b.userState.bought[id]
  delete b.userState.notes[id]
  b.definition.meta.updatedAt = Date.now()
  emit('update', b)
}

function onEdit(id: string) { editingId.value = id }

function onSave(e: Event) {
  const item = (e as CustomEvent<BuildItem>).detail
  const b = cloneBuild()
  const idx = b.definition.items.findIndex(i => i.id === item.id)
  if (idx >= 0) b.definition.items[idx] = item
  b.definition.meta.updatedAt = Date.now()
  emit('update', b)
  editingId.value = null
}
</script>

<style scoped>
.store-card {
  background: var(--fpv-surface-2);
  border: 1px solid var(--fpv-border);
  border-radius: var(--fpv-radius-md);
  padding: var(--fpv-space-md);
  margin-bottom: var(--fpv-space-md);
  transition: border-color 0.2s;
}
.store-card.complete { border-color: var(--fpv-primary); }

.store-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--fpv-space-sm);
  margin-bottom: var(--fpv-space-sm);
  padding-bottom: var(--fpv-space-sm);
  border-bottom: 1px solid var(--fpv-border);
}

.store-left { display: flex; align-items: center; gap: var(--fpv-space-sm); }
.store-dot { width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; }
.store-name { font-weight: 600; color: var(--fpv-text); }
.store-ship { font-size: 11px; color: var(--fpv-text-muted); }

.store-right { display: flex; align-items: center; gap: var(--fpv-space-md); flex-wrap: wrap; }
.store-subtotal { font-family: var(--fpv-font-mono); font-weight: 600; color: var(--fpv-text); }
.store-progress { font-size: var(--fpv-font-label); color: var(--fpv-text-muted); }
.store-link {
  font-size: var(--fpv-font-label);
  color: var(--fpv-primary);
  border: 1px solid color-mix(in srgb, var(--fpv-primary) 40%, transparent);
  padding: 4px 10px;
  border-radius: var(--fpv-radius-sm);
  white-space: nowrap;
}
.store-link:hover { background: color-mix(in srgb, var(--fpv-primary) 10%, transparent); }

.edit-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--fpv-space-md);
}
.edit-modal {
  width: 100%;
  max-width: 560px;
  max-height: 90vh;
  overflow-y: auto;
}

@media (max-width: 600px) {
  .store-header { flex-direction: column; align-items: flex-start; }
}
</style>
