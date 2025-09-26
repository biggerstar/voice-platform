import type { RouteRecordRaw } from 'vue-router';


const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'material-symbols:contextual-token-outline-rounded',
      order: 10,
      title: "多多",
      hideChildrenInMenu: true,
      keepAlive: true,
    },
    name: 'platform-pdd',
    path: '/ pdd',
    component: () => import('#/views/pdd/index.vue'),
  },
];

export default routes;
