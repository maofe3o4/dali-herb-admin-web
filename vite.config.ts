import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        // 本地开发转发到本机后端（Spring Boot :8080，context-path /api/v1）。
        // 注意：server.proxy 仅对 `vite dev` 生效，`vite build` 产物不含代理配置；
        // 生产环境由 vercel.json 的 rewrites 承担同样的转发职责。
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
      },
      '/qiniu': {
        // 七牛图库图片。线上由 vercel.json 的 /qiniu rewrite 转发；
        // dev 下走这里，保证图片地址归一化后本地也能正常显示。
        target: 'http://tns15ev3b.hn-bkt.clouddn.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/qiniu/, ''),
      },
    },
  },
})