<template>
  <div class="home">
    <section class="hero">
      <h1 class="hero-title">{{ t('nav.brand') }}</h1>
      <p class="hero-tagline">{{ t('home.tagline') }}</p>
    </section>

    <section v-for="group in groups" :key="group.title" class="tool-group">
      <h2 class="group-title">{{ group.title }}</h2>
      <div class="tools-grid">
        <article v-for="tool in group.tools" :key="tool.path" class="tool-article">
          <router-link :to="tool.path" class="tool-card">
            <div class="tool-head">
              <h3 class="tool-name">{{ tool.name }}</h3>
              <span class="tool-path">{{ tool.path }}</span>
            </div>
            <p class="tool-desc">{{ tool.description }}</p>
          </router-link>
        </article>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '@/app/composables/useI18n'

const { t } = useI18n()

const groups = computed(() => [
  {
    title: t('home.group_simulate'),
    tools: [
      { name: t('home.sim_name'), path: '/sim', description: t('home.sim_desc') },
      { name: t('home.pid_name'), path: '/pid', description: t('home.pid_desc') },
      { name: t('home.blackbox_name'), path: '/blackbox', description: t('home.blackbox_desc') },
      { name: t('home.diff_name'), path: '/diff', description: t('home.diff_desc') },
    ],
  },
  {
    title: t('home.group_plan'),
    tools: [
      { name: t('home.motors_name'), path: '/motors', description: t('home.motors_desc') },
      { name: t('home.power_name'), path: '/power', description: t('home.power_desc') },
      { name: t('home.flighttime_name'), path: '/flighttime', description: t('home.flighttime_desc') },
      { name: t('home.build_name'), path: '/build', description: t('home.build_desc') },
    ],
  },
  {
    title: t('home.group_reference'),
    tools: [
      { name: t('home.rf_name'), path: '/rf', description: t('home.rf_desc') },
      { name: t('home.tilt_name'), path: '/tilt', description: t('home.tilt_desc') },
      { name: t('home.convert_name'), path: '/convert', description: t('home.convert_desc') },
    ],
  },
])
</script>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  gap: var(--fpv-space-xl);
}

.hero {
  padding: var(--fpv-space-xl) 0 var(--fpv-space-sm);
  display: flex;
  flex-direction: column;
  gap: var(--fpv-space-sm);
}

.hero-title {
  font-family: var(--fpv-font-sans);
  font-size: clamp(2rem, 5vw, 3.5rem);
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--fpv-text);
  line-height: 1.15;
}

.hero-tagline {
  font-size: clamp(1rem, 2vw, 1.2rem);
  color: var(--fpv-text-muted);
  max-width: 60ch;
}

.tool-group {
  display: flex;
  flex-direction: column;
  gap: var(--fpv-space-md);
}

.group-title {
  font-family: var(--fpv-font-sans);
  font-size: var(--fpv-font-label);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--fpv-text-muted);
}

.tools-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--fpv-space-md);
}

.tool-article {
  display: contents;
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

.tool-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--fpv-space-sm);
}

.tool-name {
  font-family: var(--fpv-font-sans);
  font-size: 16px;
  font-weight: 600;
  color: var(--fpv-text);
}

.tool-path {
  font-family: var(--fpv-font-mono);
  font-size: var(--fpv-font-xs);
  color: var(--fpv-text-muted);
  opacity: 0.7;
  white-space: nowrap;
}

.tool-card:hover .tool-path {
  color: var(--fpv-primary);
  opacity: 1;
}

.tool-desc {
  font-size: var(--fpv-font-body);
  color: var(--fpv-text-muted);
  line-height: 1.55;
}
</style>
