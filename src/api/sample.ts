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

/** 数据集概况（后端 /admin/samples/stats） */
export interface SampleStats {
  total: number
  /** 审核状态分布：0 待标注 1 待审核 2 已入库 3 废弃 */
  auditStatus: Record<string, number>
  /** 数据集划分分布：train / val / test */
  split: Record<string, number>
  /** 来源分布：recognition 低置信自动采集 / expert 专家标注 */
  source: Record<string, number>
  hardCaseCount: number
  autoCollectedCount: number
  pendingAuditCount: number
  todayCollectedCount: number
  /** 近 14 天采集趋势 */
  last14Days: Array<{ date: string; total: number; auto: number }>
  /** 样本数最多的药材 */
  topHerbs: Array<{ herbId: number | null; name: string | null; count: number }>
}

export function getSamplePage(params: {
  page?: number
  pageSize?: number
  herbId?: number
  auditStatus?: number
  split?: string
  isHardCase?: boolean
  source?: string
}) {
  return request.get<PageResult<DatasetSample>>('/admin/samples', { params })
}

/** 数据集概况：给「数据集」页面用 */
export function getSampleStats() {
  return request.get<SampleStats>('/admin/samples/stats')
}

/** 批量保存样本：带 id 为更新（审核/划分），不带 id 为新增 */
export function batchSaveSamples(items: Array<Record<string, unknown>>) {
  return request.post<number>('/admin/samples', items)
}