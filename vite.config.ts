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
        // 【契约修复】原目标 http://127.0.0.1:8080 在本联调环境没有任何进程监听
        // （Node 与 PowerShell 均 ECONNREFUSED），/api/v1 全部请求都会打不通。
        // 后端当前实例由架构师以 --server.port=8081 启动，故指向 8081。
        // 注意：server.proxy 仅对 `vite dev` 生效，`vite build` 产物不含代理配置，
        // 因此生产环境仍由反向代理（Nginx 等）按 /api/v1 转发，本次改动不影响生产可用性。
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
      },
    },
  },
})