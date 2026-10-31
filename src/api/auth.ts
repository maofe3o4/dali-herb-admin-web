import request from './request'

export interface LoginForm {
  username: string
  password: string
}

export interface LoginResponse {
  token: string
  userId: number
  nickname: string
  avatarUrl?: string
  admin: boolean
}

export interface AdminInfo {
  id: number
  username: string
  realName: string
  permissions: string[]
}

export function adminLogin(data: LoginForm) {
  return request.post<LoginResponse>('/admin/login', data)
}

export function getAdminInfo() {
  return request.get<AdminInfo>('/admin/me')
}