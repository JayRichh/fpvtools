<script setup lang="ts">
import { useI18n } from '@/app/composables/useI18n'
import '@components/pid/pid-simulator.js'

const { t } = useI18n()
</script>

<template>
  <div class="pid-view">
    <h1>{{ t('pid.title') }}</h1>
    <p class="subtitle">{{ t('pid.subtitle') }}</p>
    <pid-simulator></pid-simulator>
  </div>
</template>

<style scoped>
.pid-view { max-width: 1400px; margin: 0 auto; }
.subtitle { color: var(--fpv-text-muted); margin-bottom: var(--fpv-space-lg); font-size: var(--fpv-font-label); }
</style>
