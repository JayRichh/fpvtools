<script setup lang="ts">
import '@components/tilt/tilt-calculator.js'
</script>
<template>
  <div class="tilt-view">
    <h1>Camera Tilt Calculator</h1>
    <p class="subtitle">Visualize camera FOV, horizon position, and ground coverage at a given tilt angle and speed.</p>
    <tilt-calculator></tilt-calculator>
  </div>
</template>
<style scoped>
.tilt-view { max-width: 700px; margin: 0 auto; }
.subtitle { color: var(--fpv-text-muted); margin-bottom: var(--fpv-space-lg); font-size: var(--fpv-font-label); }
</style>
