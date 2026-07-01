<template>
  <div class="checklist-tab">
    <div class="checklist-toolbar">
      <button class="btn-ghost btn-sm" @click="resetTicks">{{ t('build.btn_reset_ticks') }}</button>
    </div>

    <div class="checklist-items">
      <div v-for="(item, idx) in build.definition.checklist" :key="idx" class="check-row">
        <div class="check-left">
          <input
            type="checkbox"
            :checked="isChecked(idx)"
            @change="toggleCheck(idx)"
            :aria-label="item.text"
          />
        </div>
        <div class="check-body">
          <span
            v-if="editingIdx !== idx"
            class="check-text"
            :class="{ done: isChecked(idx) }"
            @click="startEditText(idx)"
          >{{ item.text }}</span>
          <input
            v-else
            ref="textInputs"
            v-model="editText"
            class="check-text-input"
            @blur="saveText(idx)"
            @keydown.enter="saveText(idx)"
            @keydown.esc="editingIdx = -1"
          />
        </div>
        <div class="check-right">
          <button class="phase-badge" :class="`phase-${item.phase.toLowerCase()}`" @click="cyclePhase(idx)">
            {{ phaseLabel(item.phase) }}
          </button>
          <button class="btn-icon" @click="requestDelete(idx)" :aria-label="t('build.aria_delete_check')">×</button>
        </div>
        <div v-if="deleteConfirm === idx" class="delete-confirm-row">
          {{ t('build.confirm_delete_check') }}
          <button class="btn-sm-danger" @click="confirmDelete(idx)">{{ t('common.confirm') }}</button>
          <button class="btn-sm-ghost" @click="deleteConfirm = -1">{{ t('common.cancel') }}</button>
        </div>
      </div>
    </div>

    <!-- Add check -->
    <div v-if="showAddForm" class="add-form">
      <input v-model="addText" class="add-input" :placeholder="t('build.placeholder_check_text')" @keydown.enter="saveAdd" @keydown.esc="cancelAdd" />
      <div class="add-phase-sel">
        <button
          v-for="p in phases"
          :key="p"
          class="phase-badge"
          :class="[`phase-${p.toLowerCase()}`, addPhase === p ? 'active' : '']"
          @click="addPhase = p"
        >{{ phaseLabel(p) }}</button>
      </div>
      <div class="add-actions">
        <button class="btn-primary btn-sm" :disabled="!addText.trim()" @click="saveAdd">{{ t('common.add') }}</button>
        <button class="btn-ghost btn-sm" @click="cancelAdd">{{ t('common.cancel') }}</button>
      </div>
    </div>
    <button v-else class="btn-add-check" @click="showAddForm = true">{{ t('build.btn_add_check') }}</button>

    <!-- NZ legal callout -->
    <div class="legal-note">
      {{ t('build.legal_note_nz') }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { useI18n } from '@/app/composables/useI18n'
import type { PersistedBuild, ChecklistItem } from '@core/builds/types'

const props = defineProps<{ build: PersistedBuild }>()
const emit = defineEmits<{ (e: 'update', build: PersistedBuild): void }>()

const { t } = useI18n()

const phases: ChecklistItem['phase'][] = ['Bench', 'Setup', 'Field']
const phaseLabel = (phase: string) => t(`build.phase_${phase.toLowerCase()}`)

const editingIdx = ref(-1)
const editText = ref('')
const textInputs = ref<HTMLInputElement[]>([])
const deleteConfirm = ref(-1)
const showAddForm = ref(false)
const addText = ref('')
const addPhase = ref<ChecklistItem['phase']>('Bench')

function isChecked(idx: number) { return !!props.build.userState.checks[idx] }

function cloneBuild(): PersistedBuild { return JSON.parse(JSON.stringify(props.build)) as PersistedBuild }

function toggleCheck(idx: number) {
  const b = cloneBuild()
  b.userState.checks[idx] = !b.userState.checks[idx]
  emit('update', b)
}

function resetTicks() {
  const b = cloneBuild()
  b.userState.checks = {}
  emit('update', b)
}

function startEditText(idx: number) {
  editText.value = props.build.definition.checklist[idx].text
  editingIdx.value = idx
  nextTick(() => textInputs.value[0]?.focus())
}

function saveText(idx: number) {
  if (!editText.value.trim()) { editingIdx.value = -1; return }
  const b = cloneBuild()
  b.definition.checklist[idx].text = editText.value.trim()
  b.definition.meta.updatedAt = Date.now()
  emit('update', b)
  editingIdx.value = -1
}

function cyclePhase(idx: number) {
  const b = cloneBuild()
  const cur = b.definition.checklist[idx].phase
  const next = phases[(phases.indexOf(cur) + 1) % phases.length]
  b.definition.checklist[idx].phase = next
  emit('update', b)
}

function requestDelete(idx: number) { deleteConfirm.value = idx }

function confirmDelete(idx: number) {
  const b = cloneBuild()
  b.definition.checklist.splice(idx, 1)
  const newChecks: Record<number, boolean> = {}
  Object.entries(b.userState.checks).forEach(([k, v]) => {
    const ki = parseInt(k)
    if (ki < idx) newChecks[ki] = v
    else if (ki > idx) newChecks[ki - 1] = v
  })
  b.userState.checks = newChecks
  b.definition.meta.updatedAt = Date.now()
  emit('update', b)
  deleteConfirm.value = -1
}

function saveAdd() {
  if (!addText.value.trim()) return
  const b = cloneBuild()
  b.definition.checklist.push({ text: addText.value.trim(), phase: addPhase.value })
  b.definition.meta.updatedAt = Date.now()
  emit('update', b)
  cancelAdd()
}

function cancelAdd() {
  showAddForm.value = false
  addText.value = ''
  addPhase.value = 'Bench'
}
</script>

<style scoped>
.checklist-toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: var(--fpv-space-sm);
}

.checklist-items {
  display: flex;
  flex-direction: column;
  gap: 0;
  background: var(--fpv-surface-2);
  border: 1px solid var(--fpv-border);
  border-radius: var(--fpv-radius-md);
  overflow: hidden;
  margin-bottom: var(--fpv-space-md);
}

.check-row {
  display: grid;
  grid-template-columns: 44px 1fr auto;
  align-items: center;
  gap: var(--fpv-space-sm);
  padding: var(--fpv-space-xs) var(--fpv-space-sm);
  border-bottom: 1px solid var(--fpv-border);
  flex-wrap: wrap;
}
.check-row:last-child { border-bottom: none; }

.check-left { display: flex; align-items: center; justify-content: center; min-height: 44px; }
input[type="checkbox"] { width: 18px; height: 18px; accent-color: var(--fpv-primary); cursor: pointer; }

.check-body { flex: 1; }
.check-text {
  font-size: var(--fpv-font-body);
  color: var(--fpv-text);
  cursor: text;
  min-height: 44px;
  display: flex;
  align-items: center;
}
.check-text.done { text-decoration: line-through; color: var(--fpv-text-muted); }

.check-text-input {
  background: var(--fpv-surface);
  border: 1px solid var(--fpv-primary);
  border-radius: var(--fpv-radius-sm);
  color: var(--fpv-text);
  padding: 6px 8px;
  font-family: var(--fpv-font-sans);
  font-size: var(--fpv-font-body);
  min-height: 44px;
  width: 100%;
}

.check-right { display: flex; align-items: center; gap: var(--fpv-space-xs); }

.phase-badge {
  font-size: 10px;
  padding: 3px 8px;
  border-radius: 99px;
  border: 1px solid;
  cursor: pointer;
  font-family: var(--fpv-font-sans);
  font-weight: 500;
  min-height: 30px;
  background: transparent;
}
.phase-bench { color: var(--fpv-info); border-color: color-mix(in srgb, var(--fpv-info) 40%, transparent); }
.phase-setup { color: var(--fpv-accent); border-color: color-mix(in srgb, var(--fpv-accent) 40%, transparent); }
.phase-field { color: var(--fpv-success); border-color: color-mix(in srgb, var(--fpv-success) 40%, transparent); }

.btn-icon {
  background: transparent;
  border: none;
  color: var(--fpv-text-muted);
  cursor: pointer;
  padding: 4px 6px;
  font-size: 18px;
  border-radius: var(--fpv-radius-sm);
  min-height: 36px;
  min-width: 36px;
}
.btn-icon:hover { color: var(--fpv-error); background: color-mix(in srgb, var(--fpv-error) 8%, transparent); }

.delete-confirm-row {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: var(--fpv-space-sm);
  font-size: var(--fpv-font-label);
  color: var(--fpv-error);
  padding: var(--fpv-space-xs) var(--fpv-space-sm);
  background: color-mix(in srgb, var(--fpv-error) 6%, transparent);
}

.btn-sm-danger, .btn-sm-ghost {
  font-size: 11px; padding: 3px 10px; border-radius: var(--fpv-radius-sm); cursor: pointer;
  font-family: var(--fpv-font-sans); min-height: 28px; border: 1px solid;
}
.btn-sm-danger { background: transparent; border-color: var(--fpv-error); color: var(--fpv-error); }
.btn-sm-ghost { background: transparent; border-color: var(--fpv-border); color: var(--fpv-text-muted); }

.add-form {
  background: var(--fpv-surface-2);
  border: 1px solid var(--fpv-primary);
  border-radius: var(--fpv-radius-md);
  padding: var(--fpv-space-md);
  margin-bottom: var(--fpv-space-md);
  display: flex;
  flex-direction: column;
  gap: var(--fpv-space-sm);
}

.add-input {
  background: var(--fpv-surface);
  border: 1px solid var(--fpv-border);
  border-radius: var(--fpv-radius-sm);
  color: var(--fpv-text);
  padding: 8px 10px;
  font-family: var(--fpv-font-sans);
  font-size: var(--fpv-font-body);
  min-height: 44px;
  width: 100%;
  box-sizing: border-box;
}
.add-input:focus { outline: none; border-color: var(--fpv-primary); }

.add-phase-sel { display: flex; gap: var(--fpv-space-xs); }
.add-phase-sel .phase-badge.active { font-weight: 700; }

.add-actions { display: flex; gap: var(--fpv-space-sm); }

.btn-add-check {
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
  transition: border-color 0.12s, color 0.12s;
  margin-bottom: var(--fpv-space-md);
}
.btn-add-check:hover { border-color: var(--fpv-primary); color: var(--fpv-primary); }

.legal-note {
  font-size: 11px;
  color: var(--fpv-text-muted);
  border: 1px solid var(--fpv-border);
  border-radius: var(--fpv-radius-sm);
  padding: var(--fpv-space-sm) var(--fpv-space-md);
  background: var(--fpv-surface-2);
}

.btn-ghost { background: transparent; color: var(--fpv-text-muted); border: none; cursor: pointer; font-family: var(--fpv-font-sans); }
.btn-ghost:hover { color: var(--fpv-text); }
.btn-sm { font-size: 12px; padding: 4px 12px; min-height: 32px; border-radius: var(--fpv-radius-sm); border: 1px solid var(--fpv-border); }
.btn-primary { background: var(--fpv-primary); color: var(--fpv-surface); font-weight: 600; font-family: var(--fpv-font-sans); cursor: pointer; border: none; border-radius: var(--fpv-radius-sm); }
.btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
