<script setup lang="ts">
import { useI18n } from '@/app/composables/useI18n'
import { useRouter } from 'vue-router'
import '@components/motors/motor-calculator.js'

const { t } = useI18n()
const router = useRouter()

function onFlyTimeExport(e: Event) {
  const detail = (e as CustomEvent<{ hoverEfficiencyGPerW: number; totalHoverCurrentA: number; auwG: number }>).detail
  const encoded = btoa(JSON.stringify(detail))
  router.push({ path: '/flighttime', query: { s: encoded } })
}
</script>

<template>
  <div class="motors-view">
    <h1>{{ t('motors.title') }}</h1>
    <p class="subtitle">{{ t('motors.subtitle') }}</p>
    <motor-calculator @fly-time-export="onFlyTimeExport"></motor-calculator>
  </div>
</template>

<style scoped>
.motors-view {
  max-width: 1400px;
  margin: 0 auto;
}
.subtitle {
  color: var(--fpv-text-muted);
  margin-bottom: var(--fpv-space-lg);
  font-size: var(--fpv-font-label);
}
</style>
