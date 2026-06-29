<script setup lang="ts">
import '@components/diff/tune-diff.js'
</script>
<template>
  <div class="diff-view">
    <h1>Tune Diff</h1>
    <p class="subtitle">Paste two Betaflight "diff all" outputs to compare PIDs, filters, rates, and features side-by-side.</p>
    <tune-diff></tune-diff>
  </div>
</template>
<style scoped>
.diff-view { max-width: 900px; margin: 0 auto; }
.subtitle { color: var(--fpv-text-muted); margin-bottom: var(--fpv-space-lg); font-size: var(--fpv-font-label); }
</style>
