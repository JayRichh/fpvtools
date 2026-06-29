<template>
  <div class="layout">
    <header class="nav">
      <div class="nav-inner">
        <router-link class="brand" to="/">FPV Tools</router-link>
        <nav class="nav-links">
          <router-link to="/pid">PID</router-link>
          <router-link to="/power">Power</router-link>
          <router-link to="/motors">Motors</router-link>
          <router-link to="/rf">RF</router-link>
          <router-link to="/convert">Convert</router-link>
          <router-link to="/blackbox">Blackbox</router-link>
          <router-link to="/tilt">Tilt</router-link>
          <router-link to="/diff">Diff</router-link>
        </nav>
        <button class="theme-btn" @click="cycle" :title="`Theme: ${label}`">
          {{ themeIcon }}
        </button>
      </div>
    </header>
    <main class="main">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useTheme } from './composables/useTheme'

const { theme, label, cycle } = useTheme()

const themeIcon = computed(() => {
  if (theme.value === 'dark') return '🌙'
  if (theme.value === 'light') return '☀️'
  return '⚙️'
})
</script>

<style scoped>
.layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.nav {
  position: sticky;
  top: 0;
  z-index: 100;
  background-color: var(--fpv-surface);
  border-bottom: 1px solid var(--fpv-border);
}

.nav-inner {
  display: flex;
  align-items: center;
  gap: var(--fpv-space-md);
  padding: var(--fpv-space-sm) var(--fpv-space-lg);
  max-width: 1280px;
  margin: 0 auto;
  width: 100%;
  flex-wrap: wrap;
}

.brand {
  font-family: var(--fpv-font-sans);
  font-size: 16px;
  font-weight: 600;
  color: var(--fpv-primary);
  white-space: nowrap;
  flex-shrink: 0;
}

.brand:hover {
  color: var(--fpv-text);
}

.nav-links {
  display: flex;
  flex-wrap: wrap;
  gap: var(--fpv-space-xs) var(--fpv-space-md);
  flex: 1;
}

.nav-links a {
  font-size: var(--fpv-font-body);
  color: var(--fpv-text-muted);
  transition: color 0.15s ease;
  white-space: nowrap;
}

.nav-links a:hover,
.nav-links a.router-link-active {
  color: var(--fpv-text);
}

.nav-links a.router-link-exact-active {
  color: var(--fpv-primary);
}

.theme-btn {
  margin-left: auto;
  padding: var(--fpv-space-xs) var(--fpv-space-sm);
  background: var(--fpv-surface-2);
  border: 1px solid var(--fpv-border);
  border-radius: var(--fpv-radius-sm);
  color: var(--fpv-text);
  font-size: var(--fpv-font-label);
  flex-shrink: 0;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.theme-btn:hover {
  border-color: var(--fpv-primary);
  background-color: var(--fpv-border);
}

.main {
  flex: 1;
  padding: var(--fpv-space-lg);
  max-width: 1280px;
  margin: 0 auto;
  width: 100%;
}

@media (max-width: 600px) {
  .nav-inner {
    padding: var(--fpv-space-sm) var(--fpv-space-md);
  }

  .nav-links {
    gap: var(--fpv-space-xs) var(--fpv-space-sm);
  }

  .main {
    padding: var(--fpv-space-md);
  }
}
</style>
