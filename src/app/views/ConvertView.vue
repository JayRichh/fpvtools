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
</style>
