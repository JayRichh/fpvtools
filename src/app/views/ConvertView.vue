<script setup lang="ts">
import { useI18n } from '@/app/composables/useI18n'
import '@components/convert/unit-converter.js'

const { t } = useI18n()
</script>
<template>
  <div class="convert-view">
    <h1>{{ t('convert.title') }}</h1>
    <p class="subtitle">{{ t('convert.subtitle') }}</p>
    <unit-converter></unit-converter>
  </div>
</template>
<style scoped>
.convert-view { max-width: 860px; margin: 0 auto; }
.subtitle { color: var(--fpv-text-muted); margin-bottom: var(--fpv-space-lg); font-size: var(--fpv-font-label); }
</style>
