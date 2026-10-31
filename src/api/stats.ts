import request from './request'

export interface StatsOverview {
  userCount: number
  herbCount: number
  publishedHerbCount: number
  recordCount: number
  todayRecordCount: number
  successRecordCount: number
  feedbackCount: number
  pendingFeedbackCount: number
  modelCount: number
  publishedModelCount: number
  sampleCount: number
  auditedSampleCount: number
  topHerbs: Array<{ name: string; count: number }>
  last7Days: Array<{ date: string; count: number }>
}

export function getStatsOverview() {
  return request.get<StatsOverview>('/admin/stats/overview')
}