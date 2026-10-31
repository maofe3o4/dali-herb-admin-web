import request from './request'

export interface Category {
  id: string
  parentId: string
  name: string
  type: string
  code?: string
  iconUrl?: string
  sortOrder?: number
    status?: number
}

export interface CategorySaveRequest {
  parentId?: string | number
  name: string
  type: string
  code?: string
  iconUrl?: string
  sortOrder?: number
  status?: number
}

export function getCategories(type?: string) {
  return request.get<Category[]>('/admin/categories', { params: { type } })
}

export function saveCategory(data: CategorySaveRequest) {
  return request.post<number>('/admin/categories', data)
}

export function updateCategory(id: number | string, data: CategorySaveRequest) {
  return request.put<boolean>(`/admin/categories/${id}`, data)
}

export function deleteCategory(id: number | string) {
  return request.delete<boolean>(`/admin/categories/${id}`)
}