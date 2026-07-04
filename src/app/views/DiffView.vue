<script setup lang="ts">
import { useI18n } from '@/app/composables/useI18n'
import '@components/diff/tune-diff.js'

const { t } = useI18n()
</script>
<template>
  <div class="diff-view">
    <h1>{{ t('diff.title') }}</h1>
    <p class="subtitle">{{ t('diff.subtitle') }}</p>
    <tune-diff></tune-diff>
  </div>
</template>
<style scoped>
</style>
