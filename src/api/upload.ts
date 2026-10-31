import request from './request'

export interface UploadResult {
  path: string
  relativePath: string
  url: string
}

export function uploadFile(file: File, category = 'herb') {
  const formData = new FormData()
  formData.append('file', file)
  return request.post<UploadResult>(`/admin/upload?category=${category}`, formData)
}