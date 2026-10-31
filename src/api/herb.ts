import request from './request'

export interface PageResult<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}

/**
 * 药材（对应后端 com.dali.herb.module.herb.vo.HerbVO）—— 这是**响应**结构。
 *
 * ⚠️ 主题色有两个字段名，且都来自同一列 `t_herb.cover_color`：
 *   - `color`      —— 小程序端使用的历史命名（services/real.js 读 color）
 *   - `coverColor` —— 后台管理端使用的命名，与保存请求 DTO（HerbSaveRequest.coverColor）同名
 * 后端两个都返回是为了兼容两端历史命名，值恒等。
 * 保存请求只认 `coverColor`（`color` 是响应专有字段，回传会被后端忽略）。
 */
export interface Herb {
  id: string
  name: string
  alias?: string
  baiName?: string
  latinName?: string
  family?: string
  familyId?: string | number
  genus?: string
  species?: string
  part?: string
  partId?: string | number
  efficacyCategory?: string
  efficacyCategoryId?: string | number
  efficacyCategoryIds?: number[]
  nature?: string
  flavor?: string
  meridian?: string
  toxicity?: string
  contraindication?: string
  usageDosage?: string
  efficacy?: string
  brief?: string
  traits?: string
  identification?: string
  collectionProcess?: string
  habitat?: string
  altitude?: string
  altitudeMin?: number
  altitudeMax?: number
  regions?: string[]
  dataSource?: string
  coverImageId?: number
  coverImageUrl?: string
  isDaodi?: boolean
  isEthnic?: boolean
  isHot?: boolean
  emoji?: string
  color?: string
  /** 主题色（后台命名，与 color 同源；保存请求用它） */
  coverColor?: string
  status?: number
  sortOrder?: number
  /** 易混淆关系；仅详情响应返回（列表不返回），编辑表单据此回填 */
  lookalikes?: Lookalike[]
}

export interface HerbQuery {
  page?: number
  pageSize?: number
  keyword?: string
  part?: string
  isDaodi?: boolean
  sort?: string
}

/**
 * 易混淆药材关系（t_herb_lookalike）。
 *
 * `id` 是小程序端的历史命名（字符串形式的对比药材 id），`lookalikeHerbId` 是同一值的
 * 数值形式，编辑表单的选择器用后者回填。保存时只提交 `lookalikeHerbId` / `difference` /
 * `riskLevel` —— 随 HerbSaveRequest 一起提交，服务端**全量替换**该药材的易混淆关系。
 */
export interface Lookalike {
  id?: string
  lookalikeHerbId?: number
  name?: string
  /** 关键差异，小程序详情页「易混淆药材」与结果页「易混淆提示」直接展示 */
  difference?: string
  /** 风险等级，越大越容易混 */
  riskLevel?: number
}

export function getHerbPage(params: HerbQuery) {
  return request.get<PageResult<Herb>>('/admin/herbs', { params })
}

/**
 * 后台药材详情。
 *
 * 列表接口（GET /admin/herbs）不返回易混淆关系（详情才返回，避免 N+1），
 * 所以编辑弹窗打开时必须单独取一次详情来回填「易混淆药材」分区。
 * 也不能用公共的 GET /herbs/{id} —— 它只放行已发布（status=2）的药材，
 * 且会自增小程序浏览量。
 */
export function getHerbDetail(id: number | string) {
  return request.get<Herb>(`/admin/herbs/${id}`)
}

export function publishHerb(id: number | string) {
  return request.post<boolean>(`/admin/herbs/${id}/publish`)
}

export function deleteHerb(id: number | string) {
  return request.delete<boolean>(`/admin/herbs/${id}`)
}

export function saveHerb(data: Record<string, unknown>) {
  return request.post<number>('/admin/herbs', data)
}

export function updateHerb(id: number | string, data: Record<string, unknown>) {
  return request.put<boolean>(`/admin/herbs/${id}`, data)
}