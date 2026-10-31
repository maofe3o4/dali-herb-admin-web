import request from './request'
import type { PageResult } from './herb'

export interface ModelVersion {
  id: number
  version: string
  algorithm?: string
  backbone?: string
  attention?: string
  strategy?: string
  classCount?: number
  trainSampleCount?: number
  top1Acc?: number
  top5Acc?: number
  inferP95Ms?: number
  status: number
  grayPercent?: number
  publishedAt?: string
  createdAt?: string
}

export function getModelPage(params: { page?: number; pageSize?: number; status?: number }) {
  return request.get<PageResult<ModelVersion>>('/admin/models', { params })
}

export function publishModel(id: number | string, data: { status?: number; grayPercent?: number }) {
  return request.post<boolean>(`/admin/models/${id}/publish`, data)
}