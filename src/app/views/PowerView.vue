<script setup lang="ts">
import { useI18n } from '@/app/composables/useI18n'
import '@components/power/pack-calculator.js'

const { t } = useI18n()
</script>
<template>
  <div class="power-view">
    <h1>{{ t('power.title') }}</h1>
    <p class="subtitle">{{ t('power.subtitle') }}</p>
    <pack-calculator></pack-calculator>
  </div>
</template>
<style scoped>
.power-view { }
.subtitle { color: var(--fpv-text-muted); margin-bottom: var(--fpv-space-lg); font-size: var(--fpv-font-label); }
</style>
