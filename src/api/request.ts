import axios, { type AxiosRequestConfig } from 'axios'
import { ElMessage } from 'element-plus'

export interface ApiResponse<T = unknown> {
  code: number
  message: string
  data: T
  traceId?: string
}

const TOKEN_KEY = 'dali_herb_admin_token'

// 接口基础地址
// ------------------------------------------------------------------
// 默认走**同源相对路径** `/api/v1`，由各环境自行转发：
//   · 开发（vite dev）  -> vite.config.ts 的 server.proxy 转发到 http://127.0.0.1:8080
//   · 生产（Vercel）    -> vercel.json 的 rewrites 转发到 http://203.195.180.247:8080
//
// ⚠️ 不要把服务器 IP 直接写在这里。Vercel 是 HTTPS，浏览器会以
//    "Mixed Content（混合内容）" 拦截 http:// 的接口请求，页面直接白屏报错。
//    走同源相对路径 + 平台侧代理，既避开混合内容，也顺带绕开跨域预检。
//
// 如需临时指向别处（例如本地直连线上后端调试），在 .env.local 里设：
//   VITE_API_BASE_URL=http://203.195.180.247:8080/api/v1
const service = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  timeout: 20000,
})

service.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`)
  }
  return config
})

service.interceptors.response.use(
  (response) => {
    const res = response.data as ApiResponse
    if (res.code !== 0) {
      ElMessage.error(res.message || '请求失败')
      if (res.code === 401) {
        localStorage.removeItem(TOKEN_KEY)
        if (window.location.pathname !== '/login') {
          window.location.href = '/login'
        }
      }
      return Promise.reject(new Error(res.message || '请求失败'))
    }
    return res.data as any
  },
  (error) => {
    const status = error?.response?.status
    if (status === 401) {
      localStorage.removeItem(TOKEN_KEY)
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
      ElMessage.error('登录已过期，请重新登录')
    } else {
      ElMessage.error(error?.response?.data?.message || error.message || '网络异常')
    }
    return Promise.reject(error)
  },
)

export interface HttpClient {
  get<T>(url: string, config?: AxiosRequestConfig): Promise<T>
  post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T>
  put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T>
  delete<T>(url: string, config?: AxiosRequestConfig): Promise<T>
}

export default service as unknown as HttpClient