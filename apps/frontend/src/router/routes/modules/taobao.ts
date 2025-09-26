import type { RouteRecordRaw } from 'vue-router';


const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'material-symbols:contextual-token-outline-rounded',
      order: 5,
      title: "淘宝",
      hideChildrenInMenu: true,
      keepAlive: true,
    },
    name: 'platform-taobao',
    path: '/taobao',
    component: () => import('#/views/taobao/index.vue'),
  },
];

export default routes;
