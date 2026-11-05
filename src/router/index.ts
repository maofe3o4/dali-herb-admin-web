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

/* ------------------------------------------------------------------
 * 发版后 chunk 加载失败的自愈
 * ------------------------------------------------------------------
 * 打包后每个页面是独立的 chunk，文件名带内容 hash，发版即变。
 * 用户如果在发版前打开过页面，浏览器里还留着旧的入口 chunk，
 * 点进没访问过的页面时会去加载「旧 hash 的 chunk」。Vercel 的 SPA 兜底
 * rewrite 会把不存在的静态文件回退成 index.html，浏览器于是报
 *   Failed to load module script: ... MIME type of "text/html"
 * 页面就白屏。
 * 这里统一兜底：捕获到这类 chunk 加载失败时刷新一次，让用户无感
 * 切到新版本；用 sessionStorage 限制频率，避免刷新死循环。
 * ------------------------------------------------------------------ */
const CHUNK_RELOAD_KEY = 'dali_herb_chunk_reload_at'

function reloadForChunkError() {
  const last = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) || 0)
  if (Date.now() - last < 60_000) return
  sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()))
  window.location.reload()
}

window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault()
  reloadForChunkError()
})

router.onError((error) => {
  const message = error instanceof Error ? error.message : String(error)
  if (/Failed to fetch dynamically imported module|Importing a module script failed|MIME type/i.test(message)) {
    reloadForChunkError()
  }
})

export default router