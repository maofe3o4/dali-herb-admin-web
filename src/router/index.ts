import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/login/index.vue'),
    meta: { title: '登录' },
  },
  {
    path: '/',
    component: () => import('@/layout/index.vue'),
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/dashboard/index.vue'),
        meta: { title: '数据看板' },
      },
      {
        path: 'herbs',
        name: 'Herbs',
        component: () => import('@/views/herb/index.vue'),
        meta: { title: '中草药管理' },
      },
      {
        path: 'categories',
        name: 'Categories',
        component: () => import('@/views/category/index.vue'),
        meta: { title: '分类管理' },
      },
      {
        path: 'records',
        name: 'Records',
        component: () => import('@/views/record/index.vue'),
        meta: { title: '识别记录' },
      },
      {
        path: 'feedback',
        name: 'Feedback',
        component: () => import('@/views/feedback/index.vue'),
        meta: { title: '反馈工单' },
      },
      {
        path: 'models',
        name: 'Models',
        component: () => import('@/views/model/index.vue'),
        meta: { title: '模型版本' },
      },
      {
        path: 'dataset',
        name: 'Dataset',
        component: () => import('@/views/dataset/index.vue'),
        meta: { title: '数据集' },
      },
      {
        path: 'samples',
        name: 'Samples',
        component: () => import('@/views/sample/index.vue'),
        meta: { title: '样本管理' },
      },
      {
        path: 'logs',
        name: 'Logs',
        component: () => import('@/views/log/index.vue'),
        meta: { title: '操作日志' },
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/dashboard',
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

router.beforeEach((to) => {
  const token = localStorage.getItem('dali_herb_admin_token')
  if (to.path !== '/login' && !token) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }
  if (to.path === '/login' && token) {
    return '/dashboard'
  }
  document.title = to.meta.title ? `${to.meta.title} - 大理中药材管理后台` : '大理中药材管理后台'
  return true
})

export default router