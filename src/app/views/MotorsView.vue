<script setup lang="ts">
import { useI18n } from '@/app/composables/useI18n'
import '@components/motors/motor-calculator.js'

const { t } = useI18n()
</script>

<template>
  <div class="motors-view">
    <h1>{{ t('motors.title') }}</h1>
    <p class="subtitle">{{ t('motors.subtitle') }}</p>
    <motor-calculator></motor-calculator>
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
