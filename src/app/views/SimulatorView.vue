<script setup lang="ts">
import { useI18n } from '@/app/composables/useI18n'
import '@components/sim/fpv-simulator.js'

const { t } = useI18n()
</script>

<template>
  <div class="sim-view">
    <h1>{{ t('sim.title') }}</h1>
    <p class="subtitle">{{ t('sim.subtitle') }}</p>
    <fpv-simulator></fpv-simulator>
  </div>
</template>

<style scoped>
</style>
