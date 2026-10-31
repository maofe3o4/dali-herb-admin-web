import request from './request'
import type { PageResult } from './herb'

export interface DatasetSample {
  id: number
  herbId?: number
  imageUrl?: string
  source?: string
  part?: string
  device?: string
  resolution?: string
  annotatorId?: number
  auditStatus: number
  split?: string
  isHardCase?: boolean
  remark?: string
  createdAt?: string
}

export function getSamplePage(params: {
  page?: number
  pageSize?: number
  herbId?: number
  auditStatus?: number
  split?: string
  isHardCase?: boolean
}) {
  return request.get<PageResult<DatasetSample>>('/admin/samples', { params })
}