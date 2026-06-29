import { createRouter, createWebHashHistory } from 'vue-router'
import { ROUTE_META } from './seo'

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
  ],
})

router.beforeEach((to) => {
  const meta = ROUTE_META[to.path] || ROUTE_META['/']
  document.title = meta.title

  let descEl = document.querySelector('meta[name="description"]')
  if (descEl) descEl.setAttribute('content', meta.description)

  let ogTitleEl = document.querySelector('meta[property="og:title"]')
  if (!ogTitleEl) {
    ogTitleEl = document.createElement('meta')
    ogTitleEl.setAttribute('property', 'og:title')
    document.head.appendChild(ogTitleEl)
  }
  ogTitleEl.setAttribute('content', meta.ogTitle || meta.title)

  let ogDescEl = document.querySelector('meta[property="og:description"]')
  if (!ogDescEl) {
    ogDescEl = document.createElement('meta')
    ogDescEl.setAttribute('property', 'og:description')
    document.head.appendChild(ogDescEl)
  }
  ogDescEl.setAttribute('content', meta.description)
})

export default router
