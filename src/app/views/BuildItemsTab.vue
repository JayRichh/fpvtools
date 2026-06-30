<template>
  <div class="items-tab">
    <div v-for="cat in catOrder" :key="cat" class="cat-section">
      <button class="cat-header" @click="toggleCat(cat)">
        <span class="cat-chevron">{{ collapsed[cat] ? '▶' : '▼' }}</span>
        <span class="cat-name">{{ cat }}</span>
        <span class="cat-meta">{{ catItems(cat).length }} items · NZD ${{ catSubtotal(cat).toFixed(2) }}</span>
      </button>

      <div v-if="!collapsed[cat]">
        <build-item-row
          v-for="item in catItems(cat)"
          :key="item.id"
          :item="item"
          :bought="isBought(item.id)"
          :note-override="noteFor(item.id)"
          @item-bought="onBought"
          @item-note="onNote"
          @item-delete="onDelete"
          @item-edit="startEdit(item.id)"
        ></build-item-row>

        <!-- Edit form inline -->
        <div v-if="editingId && catItems(cat).some(i => i.id === editingId)">
          <build-item-form
            :initial-item="editingItem"
            :default-cat="cat"
            @item-save="onSave"
            @item-cancel="editingId = null"
          ></build-item-form>
        </div>

        <!-- Add item form or button -->
        <div v-if="addingCat === cat">
          <build-item-form
            :initial-item="null"
            :default-cat="cat"
            @item-save="onSave"
            @item-cancel="addingCat = null"
          ></build-item-form>
        </div>
        <button v-else class="btn-add-item" @click="startAdd(cat)">+ Add item</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, reactive } from 'vue'
import type { PersistedBuild, BuildItem, ItemCategory } from '@core/builds/types'
import '@components/builds/build-item-row.js'
import '@components/builds/build-item-form.js'

const props = defineProps<{ build: PersistedBuild }>()
const emit = defineEmits<{ (e: 'update', build: PersistedBuild): void }>()

const catOrder = computed(() => props.build.definition.catOrder)
const collapsed = reactive<Record<string, boolean>>({})
const addingCat = ref<string | null>(null)
const editingId = ref<string | null>(null)
const editingItem = computed(() => props.build.definition.items.find(i => i.id === editingId.value) ?? null)

function toggleCat(cat: string) { collapsed[cat] = !collapsed[cat] }
function catItems(cat: string): BuildItem[] { return props.build.definition.items.filter(i => i.cat === cat) }
function catSubtotal(cat: string) { return catItems(cat).reduce((s, i) => s + i.price, 0) }
function isBought(id: string) { return !!props.build.userState.bought[id] }
function noteFor(id: string) { return props.build.userState.notes[id] ?? '' }

function startAdd(cat: string) {
  addingCat.value = cat as ItemCategory
  editingId.value = null
}

function startEdit(id: string) {
  editingId.value = id
  addingCat.value = null
}

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

function onSave(e: Event) {
  const item = (e as CustomEvent<BuildItem>).detail
  const b = cloneBuild()
  const idx = b.definition.items.findIndex(i => i.id === item.id)
  if (idx >= 0) {
    b.definition.items[idx] = item
  } else {
    b.definition.items.push(item)
    if (!b.definition.storeOrder.includes(item.store) && item.store) {
      b.definition.storeOrder.push(item.store)
    }
  }
  b.definition.meta.updatedAt = Date.now()
  emit('update', b)
  editingId.value = null
  addingCat.value = null
}
</script>

<style scoped>
.cat-section {
  margin-bottom: var(--fpv-space-md);
}

.cat-header {
  display: flex;
  align-items: center;
  gap: var(--fpv-space-sm);
  width: 100%;
  background: var(--fpv-surface-2);
  border: 1px solid var(--fpv-border);
  border-radius: var(--fpv-radius-sm);
  padding: var(--fpv-space-sm) var(--fpv-space-md);
  cursor: pointer;
  color: var(--fpv-text);
  font-family: var(--fpv-font-sans);
  font-size: var(--fpv-font-body);
  text-align: left;
  min-height: 44px;
  margin-bottom: var(--fpv-space-xs);
}
.cat-header:hover { border-color: var(--fpv-primary); }

.cat-chevron { font-size: 10px; color: var(--fpv-text-muted); }
.cat-name { font-weight: 600; flex: 1; }
.cat-meta { font-size: var(--fpv-font-label); color: var(--fpv-text-muted); }

.btn-add-item {
  background: transparent;
  border: 1px dashed var(--fpv-border);
  border-radius: var(--fpv-radius-sm);
  color: var(--fpv-text-muted);
  padding: 8px 16px;
  cursor: pointer;
  font-size: var(--fpv-font-label);
  font-family: var(--fpv-font-sans);
  min-height: 44px;
  width: 100%;
  margin-top: var(--fpv-space-xs);
  transition: border-color 0.12s, color 0.12s;
}
.btn-add-item:hover { border-color: var(--fpv-primary); color: var(--fpv-primary); }
</style>
