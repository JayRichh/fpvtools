<script setup lang="ts">
import '@components/power/pack-calculator.js'
</script>
<template>
  <div class="power-view">
    <h1>Pack Calculator</h1>
    <p class="subtitle">Li-ion and LiPo pack sizing — flight time, voltage sag, C-rate, and range.</p>
    <pack-calculator></pack-calculator>
  </div>
</template>
<style scoped>
.power-view { max-width: 900px; margin: 0 auto; }
.subtitle { color: var(--fpv-text-muted); margin-bottom: var(--fpv-space-lg); font-size: var(--fpv-font-label); }
</style>
