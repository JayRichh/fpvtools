import { createRouter, createWebHashHistory } from 'vue-router'

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

export default router
