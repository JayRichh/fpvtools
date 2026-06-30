<script setup lang="ts">
import { useI18n } from '@/app/composables/useI18n'
import '@components/rf/link-budget.js'
import '@components/rf/vtx-checker.js'

const { t } = useI18n()
</script>
<template>
  <div class="rf-view">
    <h1>{{ t('rf.title') }}</h1>
    <p class="subtitle">{{ t('rf.subtitle') }}</p>
    <div class="rf-grid">
      <link-budget></link-budget>
      <vtx-checker></vtx-checker>
    </div>
  </div>
</template>
<style scoped>
.rf-view { max-width: 1100px; margin: 0 auto; }
.subtitle { color: var(--fpv-text-muted); margin-bottom: var(--fpv-space-lg); font-size: var(--fpv-font-label); }
.rf-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--fpv-space-lg); }
@media (max-width: 768px) { .rf-grid { grid-template-columns: 1fr; } }
</style>
