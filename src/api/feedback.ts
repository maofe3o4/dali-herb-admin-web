import request from './request'
import type { PageResult } from './herb'

export interface Feedback {
  id: string
  userId?: number
  type: string
  content: string
  images?: string[]
  contact?: string
  relatedHerbId?: number
  relatedRecordId?: number
  status: number
  reply?: string
  createdAt?: string
}

export interface FeedbackQuery {
  page?: number
  pageSize?: number
  status?: number
}

export function getFeedbackPage(params: FeedbackQuery) {
  return request.get<PageResult<Feedback>>('/admin/feedback', { params })
}

export function replyFeedback(id: number | string, data: { reply: string; status: number }) {
  return request.put<boolean>(`/admin/feedback/${id}`, data)
}