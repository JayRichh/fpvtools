<script setup lang="ts">
import { useI18n } from '@/app/composables/useI18n'
import '@components/tilt/tilt-calculator.js'

const { t } = useI18n()
</script>
<template>
  <div class="tilt-view">
    <h1>{{ t('tilt.title') }}</h1>
    <p class="subtitle">{{ t('tilt.subtitle') }}</p>
    <tilt-calculator></tilt-calculator>
  </div>
</template>
<style scoped>
</style>
