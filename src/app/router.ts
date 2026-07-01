import { createRouter, createWebHashHistory } from 'vue-router'
import { fpvI18n } from '@core/shared/i18n'
import { ROUTE_SEO_KEYS } from './seo'
import { seedIfAbsent, getBuild } from '@core/builds/storage'
import { trackPageview } from './analytics'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('./views/HomeView.vue'),
    },
    {
      path: '/pid',
      name: 'pid',
      component: () => import('./views/PidView.vue'),
    },
    {
      path: '/power',
      name: 'power',
      component: () => import('./views/PowerView.vue'),
    },
    {
      path: '/motors',
      name: 'motors',
      component: () => import('./views/MotorsView.vue'),
    },
    {
      path: '/rf',
      name: 'rf',
      component: () => import('./views/RfView.vue'),
    },
    {
      path: '/convert',
      name: 'convert',
      component: () => import('./views/ConvertView.vue'),
    },
    {
      path: '/blackbox',
      name: 'blackbox',
      component: () => import('./views/BlackboxView.vue'),
    },
    {
      path: '/tilt',
      name: 'tilt',
      component: () => import('./views/TiltView.vue'),
    },
    {
      path: '/diff',
      name: 'diff',
      component: () => import('./views/DiffView.vue'),
    },
    {
      path: '/build',
      name: 'build-gallery',
      component: () => import('./views/BuildGalleryView.vue'),
    },
    {
      path: '/build/:slug',
      redirect: (to) => ({ path: `/build/${to.params.slug}/store` }),
    },
    {
      path: '/build/:slug',
      name: 'build-detail',
      component: () => import('./views/BuildDetailView.vue'),
      children: [
        {
          path: 'store',
          name: 'build-store',
          component: () => import('./views/BuildStoreTab.vue'),
        },
        {
          path: 'items',
          name: 'build-items',
          component: () => import('./views/BuildItemsTab.vue'),
        },
        {
          path: 'check',
          name: 'build-check',
          component: () => import('./views/BuildChecklistTab.vue'),
        },
        {
          path: 'links',
          name: 'build-links',
          component: () => import('./views/BuildLinksTab.vue'),
        },
      ],
    },
    {
      path: '/flighttime',
      name: 'flighttime',
      component: () => import('./views/FlightTimeView.vue'),
    },
  ],
})

function applyMeta(path: string): void {
  const key = ROUTE_SEO_KEYS[path] ?? 'home'
  document.title = fpvI18n.t(`seo.${key}_title`)

  let descEl = document.querySelector('meta[name="description"]')
  if (descEl) descEl.setAttribute('content', fpvI18n.t(`seo.${key}_desc`))

  let ogTitleEl = document.querySelector('meta[property="og:title"]')
  if (!ogTitleEl) {
    ogTitleEl = document.createElement('meta')
    ogTitleEl.setAttribute('property', 'og:title')
    document.head.appendChild(ogTitleEl)
  }
  ogTitleEl.setAttribute('content', fpvI18n.t(`seo.${key}_title`))

  let ogDescEl = document.querySelector('meta[property="og:description"]')
  if (!ogDescEl) {
    ogDescEl = document.createElement('meta')
    ogDescEl.setAttribute('property', 'og:description')
    document.head.appendChild(ogDescEl)
  }
  ogDescEl.setAttribute('content', fpvI18n.t(`seo.${key}_desc`))
}

// Re-apply meta whenever locale changes
fpvI18n.subscribe(() => {
  const currentPath = router.currentRoute.value.path
  applyMeta(currentPath)
})

router.beforeEach((to) => {
  // Dynamic title for build detail routes
  const slug = to.params.slug as string | undefined
  if (slug) {
    seedIfAbsent()
    const build = getBuild(slug)
    const buildName = build?.definition.meta.name ?? slug
    const childName = to.name as string
    const suffix =
      childName === 'build-store' ? 'Store Guide' :
      childName === 'build-items' ? 'Parts List' :
      childName === 'build-check' ? 'Build Checklist' :
      childName === 'build-links' ? 'Firmware & Links' : 'Build'
    document.title = `${buildName} — ${suffix} | FPV Tools`
    return
  }
  applyMeta(to.path)
})

// Record pageviews for analytics. Kept separate from beforeEach (which
// early-returns for build-detail routes) so no navigation is missed. The build
// slug is normalised so user-created build names never reach analytics.
router.afterEach((to) => {
  const slug = to.params.slug
  const path =
    typeof slug === 'string' && slug
      ? to.path.replace(`/build/${slug}`, '/build/:slug')
      : to.path
  trackPageview(path)
})

export default router
