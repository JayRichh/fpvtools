import { computed } from 'vue'
import { useLocalStorage } from './useLocalStorage'

export type Theme = 'dark' | 'light' | 'auto'

const THEMES: Theme[] = ['dark', 'light', 'auto']

const theme = useLocalStorage<Theme>('fpv-theme', 'dark')

function applyTheme(t: Theme) {
  document.documentElement.setAttribute('data-theme', t)
}

export function useTheme() {
  function cycle() {
    const current = THEMES.indexOf(theme.value)
    theme.value = THEMES[(current + 1) % THEMES.length]
    applyTheme(theme.value)
  }

  function setTheme(t: Theme) {
    theme.value = t
    applyTheme(t)
  }

  const label = computed(() => {
    const icons: Record<Theme, string> = { dark: 'Dark', light: 'Light', auto: 'Auto' }
    return icons[theme.value]
  })

  // Apply on composable init
  applyTheme(theme.value)

  return { theme, label, cycle, setTheme }
}
