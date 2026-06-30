<template>
  <div class="links-tab">
    <!-- Firmware card -->
    <div class="links-card">
      <h3 class="card-title">Firmware</h3>
      <div v-for="(link, idx) in build.definition.firmware" :key="idx" class="link-row">
        <template v-if="editingFw !== idx">
          <a :href="link.url" target="_blank" rel="noopener noreferrer" class="link-name">{{ link.name }} →</a>
          <div class="link-actions">
            <button class="btn-icon-sm" @click="startEditFw(idx)">Edit</button>
            <button class="btn-icon-sm danger" @click="deleteFwConfirm = idx">×</button>
          </div>
          <div v-if="deleteFwConfirm === idx" class="inline-confirm">
            Remove? <button class="btn-xs-danger" @click="confirmDeleteFw(idx)">Yes</button>
            <button class="btn-xs-ghost" @click="deleteFwConfirm = -1">No</button>
          </div>
        </template>
        <template v-else>
          <div class="edit-row">
            <input v-model="fwName" class="edit-input" placeholder="Name" @keydown.esc="editingFw = -1" />
            <input v-model="fwUrl" class="edit-input" type="url" placeholder="https://…" @keydown.esc="editingFw = -1" />
            <button class="btn-xs-primary" @click="saveFw(idx)">Save</button>
            <button class="btn-xs-ghost" @click="editingFw = -1">Cancel</button>
          </div>
        </template>
      </div>
      <div v-if="addingFw" class="add-row">
        <input v-model="newFwName" class="edit-input" placeholder="Name" @keydown.esc="cancelAddFw" />
        <input v-model="newFwUrl" class="edit-input" type="url" placeholder="https://…" @keydown.esc="cancelAddFw" />
        <button class="btn-xs-primary" :disabled="!newFwName.trim()" @click="saveAddFw">Add</button>
        <button class="btn-xs-ghost" @click="cancelAddFw">Cancel</button>
      </div>
      <button v-else class="btn-add-link" @click="addingFw = true">+ Add firmware link</button>
    </div>

    <!-- References card -->
    <div class="links-card">
      <h3 class="card-title">References</h3>
      <div v-for="(link, idx) in build.definition.refs" :key="idx" class="link-row">
        <template v-if="editingRef !== idx">
          <a :href="link.url" target="_blank" rel="noopener noreferrer" class="link-name">{{ link.name }} →</a>
          <div class="link-actions">
            <button class="btn-icon-sm" @click="startEditRef(idx)">Edit</button>
            <button class="btn-icon-sm danger" @click="deleteRefConfirm = idx">×</button>
          </div>
          <div v-if="deleteRefConfirm === idx" class="inline-confirm">
            Remove? <button class="btn-xs-danger" @click="confirmDeleteRef(idx)">Yes</button>
            <button class="btn-xs-ghost" @click="deleteRefConfirm = -1">No</button>
          </div>
        </template>
        <template v-else>
          <div class="edit-row">
            <input v-model="refName" class="edit-input" placeholder="Name" @keydown.esc="editingRef = -1" />
            <input v-model="refUrl" class="edit-input" type="url" placeholder="https://…" @keydown.esc="editingRef = -1" />
            <button class="btn-xs-primary" @click="saveRef(idx)">Save</button>
            <button class="btn-xs-ghost" @click="editingRef = -1">Cancel</button>
          </div>
        </template>
      </div>
      <div v-if="addingRef" class="add-row">
        <input v-model="newRefName" class="edit-input" placeholder="Name" @keydown.esc="cancelAddRef" />
        <input v-model="newRefUrl" class="edit-input" type="url" placeholder="https://…" @keydown.esc="cancelAddRef" />
        <button class="btn-xs-primary" :disabled="!newRefName.trim()" @click="saveAddRef">Add</button>
        <button class="btn-xs-ghost" @click="cancelAddRef">Cancel</button>
      </div>
      <button v-else class="btn-add-link" @click="addingRef = true">+ Add reference</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { PersistedBuild } from '@core/builds/types'

const props = defineProps<{ build: PersistedBuild }>()
const emit = defineEmits<{ (e: 'update', build: PersistedBuild): void }>()

function cloneBuild(): PersistedBuild { return JSON.parse(JSON.stringify(props.build)) as PersistedBuild }

// Firmware
const editingFw = ref(-1)
const fwName = ref('')
const fwUrl = ref('')
const deleteFwConfirm = ref(-1)
const addingFw = ref(false)
const newFwName = ref('')
const newFwUrl = ref('')

function startEditFw(idx: number) { fwName.value = props.build.definition.firmware[idx].name; fwUrl.value = props.build.definition.firmware[idx].url; editingFw.value = idx }
function saveFw(idx: number) {
  const b = cloneBuild(); b.definition.firmware[idx] = { name: fwName.value.trim(), url: fwUrl.value.trim() }; b.definition.meta.updatedAt = Date.now(); emit('update', b); editingFw.value = -1
}
function confirmDeleteFw(idx: number) { const b = cloneBuild(); b.definition.firmware.splice(idx, 1); b.definition.meta.updatedAt = Date.now(); emit('update', b); deleteFwConfirm.value = -1 }
function saveAddFw() { if (!newFwName.value.trim()) return; const b = cloneBuild(); b.definition.firmware.push({ name: newFwName.value.trim(), url: newFwUrl.value.trim() }); b.definition.meta.updatedAt = Date.now(); emit('update', b); cancelAddFw() }
function cancelAddFw() { addingFw.value = false; newFwName.value = ''; newFwUrl.value = '' }

// References
const editingRef = ref(-1)
const refName = ref('')
const refUrl = ref('')
const deleteRefConfirm = ref(-1)
const addingRef = ref(false)
const newRefName = ref('')
const newRefUrl = ref('')

function startEditRef(idx: number) { refName.value = props.build.definition.refs[idx].name; refUrl.value = props.build.definition.refs[idx].url; editingRef.value = idx }
function saveRef(idx: number) { const b = cloneBuild(); b.definition.refs[idx] = { name: refName.value.trim(), url: refUrl.value.trim() }; b.definition.meta.updatedAt = Date.now(); emit('update', b); editingRef.value = -1 }
function confirmDeleteRef(idx: number) { const b = cloneBuild(); b.definition.refs.splice(idx, 1); b.definition.meta.updatedAt = Date.now(); emit('update', b); deleteRefConfirm.value = -1 }
function saveAddRef() { if (!newRefName.value.trim()) return; const b = cloneBuild(); b.definition.refs.push({ name: newRefName.value.trim(), url: newRefUrl.value.trim() }); b.definition.meta.updatedAt = Date.now(); emit('update', b); cancelAddRef() }
function cancelAddRef() { addingRef.value = false; newRefName.value = ''; newRefUrl.value = '' }
</script>

<style scoped>
.links-card {
  background: var(--fpv-surface-2);
  border: 1px solid var(--fpv-border);
  border-radius: var(--fpv-radius-md);
  padding: var(--fpv-space-md);
  margin-bottom: var(--fpv-space-md);
}

.card-title {
  font-size: var(--fpv-font-label);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--fpv-text-muted);
  margin-bottom: var(--fpv-space-sm);
}

.link-row {
  display: flex;
  align-items: center;
  gap: var(--fpv-space-sm);
  padding: var(--fpv-space-xs) 0;
  border-bottom: 1px solid var(--fpv-border);
  flex-wrap: wrap;
  min-height: 44px;
}
.link-row:last-of-type { border-bottom: none; }

.link-name {
  flex: 1;
  color: var(--fpv-primary);
  font-size: var(--fpv-font-body);
}
.link-name:hover { text-decoration: underline; }

.link-actions { display: flex; align-items: center; gap: 4px; }

.btn-icon-sm {
  background: transparent;
  border: 1px solid var(--fpv-border);
  border-radius: var(--fpv-radius-sm);
  color: var(--fpv-text-muted);
  cursor: pointer;
  padding: 3px 8px;
  font-size: 11px;
  font-family: var(--fpv-font-sans);
  min-height: 30px;
}
.btn-icon-sm:hover { border-color: var(--fpv-primary); color: var(--fpv-primary); }
.btn-icon-sm.danger:hover { border-color: var(--fpv-error); color: var(--fpv-error); }

.inline-confirm {
  width: 100%;
  display: flex;
  align-items: center;
  gap: var(--fpv-space-xs);
  font-size: 12px;
  color: var(--fpv-error);
  padding: 4px var(--fpv-space-xs);
  background: color-mix(in srgb, var(--fpv-error) 6%, transparent);
  border-radius: var(--fpv-radius-sm);
}

.edit-row, .add-row {
  display: flex;
  align-items: center;
  gap: var(--fpv-space-xs);
  width: 100%;
  flex-wrap: wrap;
}

.edit-input {
  flex: 1;
  background: var(--fpv-surface);
  border: 1px solid var(--fpv-primary);
  border-radius: var(--fpv-radius-sm);
  color: var(--fpv-text);
  padding: 6px 8px;
  font-family: var(--fpv-font-sans);
  font-size: var(--fpv-font-body);
  min-height: 36px;
  min-width: 120px;
}
.edit-input:focus { outline: none; }

.btn-xs-primary, .btn-xs-ghost, .btn-xs-danger {
  font-size: 11px; padding: 4px 10px; border-radius: var(--fpv-radius-sm);
  cursor: pointer; font-family: var(--fpv-font-sans); min-height: 30px; border: 1px solid; white-space: nowrap;
}
.btn-xs-primary { background: var(--fpv-primary); color: var(--fpv-surface); border-color: transparent; font-weight: 600; }
.btn-xs-primary:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-xs-ghost { background: transparent; border-color: var(--fpv-border); color: var(--fpv-text-muted); }
.btn-xs-danger { background: transparent; border-color: var(--fpv-error); color: var(--fpv-error); }

.btn-add-link {
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
  margin-top: var(--fpv-space-sm);
  transition: border-color 0.12s, color 0.12s;
}
.btn-add-link:hover { border-color: var(--fpv-primary); color: var(--fpv-primary); }
</style>
