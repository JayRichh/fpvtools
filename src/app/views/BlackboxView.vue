<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from '@/app/composables/useI18n'
import '@components/blackbox/bbl-dropzone.js'
import '@components/blackbox/bbl-overlay.js'

const { t } = useI18n()

const log = ref<any>(null)
const overlayRef = ref<Element | null>(null)

function onLogLoaded(e: CustomEvent) {
  log.value = e.detail
}

// Set the log property directly on the DOM element so the object is passed
// as a JS property (not a stringified attribute).
watch(log, (newLog) => {
  if (overlayRef.value) {
    (overlayRef.value as any).log = newLog
  }
})
</script>

<template>
  <div class="blackbox-view">
    <h1>{{ t('blackbox.title') }}</h1>
    <p class="subtitle">{{ t('blackbox.subtitle') }}</p>
    <bbl-dropzone @log-loaded="onLogLoaded"></bbl-dropzone>
    <bbl-overlay ref="overlayRef"></bbl-overlay>
  </div>
</template>

<style scoped>
.blackbox-view {
  max-width: 1400px;
  margin: 0 auto;
}
.subtitle {
  color: var(--fpv-text-muted);
  margin-bottom: var(--fpv-space-lg);
  font-size: var(--fpv-font-label);
}
</style>
