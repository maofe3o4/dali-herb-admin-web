import request from './request'
import type { PageResult } from './herb'

export interface OperationLog {
  id: number
  adminId?: number
  module?: string
  action?: string
  targetId?: string
  ip?: string
  createdAt?: string
}

export function getLogPage(params: {
  page?: number
  pageSize?: number
  adminId?: number
  module?: string
  action?: string
}) {
  return request.get<PageResult<OperationLog>>('/admin/logs', { params })
}