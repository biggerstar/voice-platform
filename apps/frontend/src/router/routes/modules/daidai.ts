import type { RouteRecordRaw } from 'vue-router';


const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'mdi:user-online-outline',
      order: 8,
      title: "带带",
      hideChildrenInMenu: true,
      keepAlive: true,
    },
    name: 'platform-daidai',
    path: '/daidai',
    component: () => import('#/views/daidai/index.vue'),
  },
];

export default routes;
