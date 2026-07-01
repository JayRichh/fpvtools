<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from '@/app/composables/useI18n'
import '@components/flighttime/flight-time-calculator.js'

const { t } = useI18n()

const route = useRoute()
const router = useRouter()
const calcEl = ref<HTMLElement | null>(null)

onMounted(() => {
  const s = route.query.s as string | undefined
  if (s && calcEl.value) {
    try {
      const data = JSON.parse(atob(s)) as {
        hoverEfficiencyGPerW?: number
        totalHoverCurrentA?: number
        auwG?: number
      }
      const el = calcEl.value as any
      if (typeof el.setFromMotors === 'function') {
        el.setFromMotors(
          data.hoverEfficiencyGPerW ?? 5.5,
          data.totalHoverCurrentA ?? 18,
          data.auwG ?? 1200,
        )
      }
    } catch { /* ignore bad query */ }
    // Clear query param so URL stays clean
    router.replace({ query: {} })
  }
})
</script>

<template>
  <div class="flighttime-view">
    <h1>{{ t('flighttime.title') }}</h1>
    <p class="subtitle">{{ t('flighttime.subtitle') }}</p>
    <flight-time-calculator ref="calcEl"></flight-time-calculator>
  </div>
</template>

<style scoped>
.flighttime-view {
  max-width: 1400px;
  margin: 0 auto;
}
.subtitle {
  color: var(--fpv-text-muted);
  margin-bottom: var(--fpv-space-lg);
  font-size: var(--fpv-font-label);
}
</style>
