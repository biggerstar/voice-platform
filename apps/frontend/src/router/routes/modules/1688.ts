import type { RouteRecordRaw } from 'vue-router';


const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'mdi:user-online-outline',
      order: 8,
      title: "1688",
      hideChildrenInMenu: true,
      keepAlive: true,
    },
    name: 'platform-1688',
    path: '/1688',
    component: () => import('#/views/1688/index.vue'),
  },
];

export default routes;
