import axios, { type AxiosRequestConfig } from 'axios'
import { ElMessage } from 'element-plus'

export interface ApiResponse<T = unknown> {
  code: number
  message: string
  data: T
  traceId?: string
}

const TOKEN_KEY = 'dali_herb_admin_token'

const service = axios.create({
  baseURL: '/api/v1',
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