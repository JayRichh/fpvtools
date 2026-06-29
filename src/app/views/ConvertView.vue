<script setup lang="ts">
import '@components/convert/unit-converter.js'
</script>
<template>
  <div class="convert-view">
    <h1>Unit Converters</h1>
    <p class="subtitle">FPV-specific unit conversions — power, frequency, electrical, and angles.</p>
    <unit-converter></unit-converter>
  </div>
</template>
<style scoped>
.convert-view { max-width: 700px; margin: 0 auto; }
.subtitle { color: var(--fpv-text-muted); margin-bottom: var(--fpv-space-lg); font-size: var(--fpv-font-label); }
</style>
