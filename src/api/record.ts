import request from './request'
import type { PageResult } from './herb'

export interface RecordTop {
  herbId?: string
  name?: string
  emoji?: string
  color?: string
  latinName?: string
  confidence?: number
  percent?: number
  level?: string
}

export interface RecognitionRecord {
  recordId: string
  status: string
  statusCode?: number
  level?: string
  imageUrl?: string
  modelVersion?: string
  costMs?: number
  createdAt?: string
  isFavorited?: boolean
  top?: RecordTop
  candidates?: Array<{ herbId?: string; name?: string; confidence?: number; percent?: number }>
}

export interface RecordQuery {
  page?: number
  pageSize?: number
  status?: number
  keyword?: string
  startTime?: string
  endTime?: string
}

export function getRecordPage(params: RecordQuery) {
  return request.get<PageResult<RecognitionRecord>>('/admin/records', { params })
}

/** 删除一条识别记录（后台可删任意用户的记录；后端会同步清理对象存储里的原图） */
export function deleteRecord(recordId: string) {
  return request.delete<boolean>(`/admin/records/${encodeURIComponent(recordId)}`)
}