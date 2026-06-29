<template>
  <div class="home">
    <section class="hero">
      <h1 class="hero-title">FPV Tools</h1>
      <p class="hero-tagline">Browser-native calculators and simulators for FPV pilots</p>
    </section>

    <section class="tools-grid">
      <router-link
        v-for="tool in tools"
        :key="tool.path"
        :to="tool.path"
        class="tool-card"
      >
        <h2 class="tool-name">{{ tool.name }}</h2>
        <p class="tool-desc">{{ tool.description }}</p>
      </router-link>
    </section>
  </div>
</template>

<script setup lang="ts">
const tools = [
  {
    name: 'PID Tuner',
    path: '/pid',
    description: 'Simulate PID controller response and tune gains with live step-response preview.',
  },
  {
    name: 'Power Calculator',
    path: '/power',
    description: 'Estimate battery capacity, current draw, and flight time for any build.',
  },
  {
    name: 'Motor Calculator',
    path: '/motors',
    description: 'Compare KV ratings, thrust, and efficiency across motor and prop combinations.',
  },
  {
    name: 'RF Link Budget',
    path: '/rf',
    description: 'Calculate range, link margin, and RSSI for your video transmitter setup.',
  },
  {
    name: 'Unit Converter',
    path: '/convert',
    description: 'Convert between imperial and metric units commonly used in FPV builds.',
  },
  {
    name: 'Blackbox Viewer',
    path: '/blackbox',
    description: 'Analyze Betaflight blackbox logs to diagnose oscillations and tune PIDs.',
  },
  {
    name: 'Tilt Calculator',
    path: '/tilt',
    description: 'Compute camera tilt angle, field of view, and horizon offset at speed.',
  },
  {
    name: 'Diff Viewer',
    path: '/diff',
    description: 'Compare Betaflight diff dumps side-by-side to track configuration changes.',
  },
]
</script>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  gap: var(--fpv-space-xl);
}

.hero {
  padding: var(--fpv-space-xl) 0 var(--fpv-space-lg);
  display: flex;
  flex-direction: column;
  gap: var(--fpv-space-sm);
}

.hero-title {
  font-family: var(--fpv-font-sans);
  font-size: clamp(2rem, 5vw, 3.5rem);
  font-weight: 600;
  color: var(--fpv-text);
  line-height: 1.15;
}

.hero-tagline {
  font-size: clamp(1rem, 2vw, 1.2rem);
  color: var(--fpv-text-muted);
  max-width: 560px;
}

.tools-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--fpv-space-md);
}

.tool-card {
  display: flex;
  flex-direction: column;
  gap: var(--fpv-space-sm);
  padding: var(--fpv-space-lg);
  background-color: var(--fpv-surface);
  border: 1px solid var(--fpv-border);
  border-radius: var(--fpv-radius-lg);
  transition:
    border-color 0.2s ease,
    transform 0.2s ease;
}

.tool-card:hover {
  border-color: var(--fpv-primary);
  transform: translateY(-2px);
}

.tool-name {
  font-family: var(--fpv-font-sans);
  font-size: 16px;
  font-weight: 600;
  color: var(--fpv-text);
}

.tool-desc {
  font-size: var(--fpv-font-body);
  color: var(--fpv-text-muted);
  line-height: 1.55;
}
</style>
