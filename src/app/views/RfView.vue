<script setup lang="ts">
import '@components/rf/link-budget.js'
import '@components/rf/vtx-checker.js'
</script>
<template>
  <div class="rf-view">
    <h1>RF Tools</h1>
    <p class="subtitle">ELRS link budget calculator and VTX power compliance checker.</p>
    <div class="rf-grid">
      <link-budget></link-budget>
      <vtx-checker></vtx-checker>
    </div>
  </div>
</template>
<style scoped>
.rf-view { max-width: 1100px; margin: 0 auto; }
.subtitle { color: var(--fpv-text-muted); margin-bottom: var(--fpv-space-lg); font-size: var(--fpv-font-label); }
.rf-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--fpv-space-lg); }
@media (max-width: 768px) { .rf-grid { grid-template-columns: 1fr; } }
</style>
