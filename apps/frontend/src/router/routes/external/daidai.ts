import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    name: 'DaiDai',
    path: '/daidai',
    component: () => import('#/views/daidai/index.vue'),
    meta: {
      title: 'bridge',
      authority: [],
      ignoreAccess: true,
    }
  },
];

export default routes;
