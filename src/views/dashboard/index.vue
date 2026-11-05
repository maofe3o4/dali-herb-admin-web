<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import * as echarts from 'echarts'
import { Refresh } from '@element-plus/icons-vue'
import { getStatsOverview, type StatsOverview } from '@/api/stats'
import { getRecordPage, type RecognitionRecord } from '@/api/record'
import { getModelPage, type ModelVersion } from '@/api/model'
import { mediaUrl } from '@/utils/media'

/* ============================================================
 * 数据看板
 * 数据来源全部复用已有接口，后端无需改动：
 *   /admin/stats/overview          -> KPI、近 7 天趋势、热门药材 Top5
 *   /admin/records?status=1|2|3    -> 成功/疑似/失败 精确计数
 *   /admin/records?pageSize=100    -> 最近 100 条（置信度分档、模型版本使用、最近动态）
 *   /admin/models                  -> 模型版本资产
 * ============================================================ */

const router = useRouter()

const rootRef = ref<HTMLDivElement>()
const overview = ref<StatsOverview | null>(null)
const statusCounts = ref({ success: 0, suspected: 0, failed: 0 })
const statusTotal = computed(
  () => statusCounts.value.success + statusCounts.value.suspected + statusCounts.value.failed,
)
const recent = ref<RecognitionRecord[]>([])
const models = ref<ModelVersion[]>([])
const loading = ref(false)
const updatedAt = ref('')
const loadError = ref('')

const trendRef = ref<HTMLDivElement>()
const statusRef = ref<HTMLDivElement>()
const confidenceRef = ref<HTMLDivElement>()
const topHerbRef = ref<HTMLDivElement>()
const modelUsageRef = ref<HTMLDivElement>()

const charts: echarts.ECharts[] = []

const PALETTE = {
  green: '#0C6B4F',
  greenBright: '#12A379',
  greenSoft: '#DFF2EA',
  blue: '#2A5CE0',
  blueSoft: '#E6EDFD',
  amber: '#B4700A',
  red: '#C0392B',
  ink: '#0F1A16',
  muted: '#5F7269',
  weak: '#93A39A',
  hairline: '#E4EAE6',
  surface: '#FFFFFF',
}

/* ---------------- 派生指标 ---------------- */
const recordTotal = computed(() => overview.value?.recordCount ?? 0)
const successRate = computed(() => {
  if (!recordTotal.value) return 0
  return ((overview.value?.successRecordCount ?? 0) / recordTotal.value) * 100
})
const perUser = computed(() => {
  const users = overview.value?.userCount ?? 0
  return users ? recordTotal.value / users : 0
})
const analyseBasis = computed(() => recent.value.length)

/** 置信度分档（按服务端返回的 level，避免前端自己猜阈值） */
const levelBands = computed(() => {
  const bands = [
    { key: 'high', label: '高可信', hint: '直接采纳', value: 0, color: PALETTE.green },
    { key: 'mid', label: '中等', hint: '建议复核', value: 0, color: PALETTE.blue },
    { key: 'low', label: '疑似', hint: '需人工确认', value: 0, color: PALETTE.amber },
    { key: 'unknown', label: '未识别', hint: '未匹配到药材', value: 0, color: PALETTE.weak },
  ]
  const map = new Map(bands.map((b) => [b.key, b]))
  for (const r of recent.value) {
    const key = r.status === 'failed' ? 'unknown' : r.level || 'unknown'
    const band = map.get(key) || map.get('unknown')
    if (band) band.value += 1
  }
  return bands
})

/** 模型版本使用分布（近 N 条记录） */
const modelUsage = computed(() => {
  const counter = new Map<string, number>()
  for (const r of recent.value) {
    const key = r.modelVersion || '未知版本'
    counter.set(key, (counter.get(key) ?? 0) + 1)
  }
  return [...counter.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
})

const topHerbs = computed(() => overview.value?.topHerbs ?? [])

const recentRows = computed(() => recent.value.slice(0, 8))

const publishedModels = computed(() => models.value.filter((m) => m.status === 2 || m.status === 3))

const kpis = computed(() => {
  const o = overview.value
  return [
    {
      key: 'record',
      label: '识别总量',
      value: o?.recordCount ?? 0,
      unit: '条',
      foot: `今日 +${o?.todayRecordCount ?? 0}`,
      accent: 'green',
    },
    {
      key: 'success',
      label: '识别成功率',
      value: successRate.value,
      unit: '%',
      foot: `成功 ${o?.successRecordCount ?? 0} / ${o?.recordCount ?? 0} 条`,
      accent: 'blue',
    },
    {
      key: 'user',
      label: '用户数',
      value: o?.userCount ?? 0,
      unit: '人',
      foot: `人均 ${perUser.value.toFixed(1)} 次识别`,
      accent: 'green',
    },
    {
      key: 'feedback',
      label: '待处理反馈',
      value: o?.pendingFeedbackCount ?? 0,
      unit: '单',
      foot: `累计 ${o?.feedbackCount ?? 0} 单`,
      accent: 'amber',
    },
  ]
})

const metrics = computed(() => {
  const o = overview.value
  return [
    {
      label: '药材',
      value: `${o?.publishedHerbCount ?? 0} / ${o?.herbCount ?? 0}`,
      text: '已发布 / 总数',
      percent: o?.herbCount ? ((o.publishedHerbCount ?? 0) / o.herbCount) * 100 : 0,
      color: PALETTE.green,
    },
    {
      label: '样本',
      value: `${o?.auditedSampleCount ?? 0} / ${o?.sampleCount ?? 0}`,
      text: '已审核 / 总数',
      percent: o?.sampleCount ? ((o.auditedSampleCount ?? 0) / o.sampleCount) * 100 : 0,
      color: PALETTE.blue,
    },
    {
      label: '模型版本',
      value: `${o?.publishedModelCount ?? 0} / ${o?.modelCount ?? 0}`,
      text: '在用 / 总数',
      percent: o?.modelCount ? ((o.publishedModelCount ?? 0) / o.modelCount) * 100 : 0,
      color: PALETTE.green,
    },
    {
      label: '反馈工单',
      value: `${o?.pendingFeedbackCount ?? 0} / ${o?.feedbackCount ?? 0}`,
      text: '待处理 / 总数',
      percent: o?.feedbackCount ? ((o.pendingFeedbackCount ?? 0) / o.feedbackCount) * 100 : 0,
      color: PALETTE.amber,
    },
    {
      label: '识别记录',
      value: `${o?.todayRecordCount ?? 0} / ${o?.recordCount ?? 0}`,
      text: '今日 / 总量',
      percent: o?.recordCount ? ((o.todayRecordCount ?? 0) / o.recordCount) * 100 : 0,
      color: PALETTE.blue,
    },
    {
      label: '分类覆盖',
      value: `${o?.publishedHerbCount ?? 0}`,
      text: '已发布药材数',
      percent: 100,
      color: PALETTE.green,
    },
  ]
})

function percentText(value?: number | null) {
  if (value == null || Number.isNaN(Number(value))) return '-'
  return Number(value).toFixed(1) + '%'
}

function timeText(value?: string) {
  if (!value) return '-'
  return String(value).replace('T', ' ').slice(5, 16)
}

/* ---------------- 图表 ---------------- */
function clearCharts() {
  while (charts.length) charts.pop()?.dispose()
}

function mountChart(el: HTMLDivElement | undefined, option: echarts.EChartsOption) {
  if (!el) return
  const chart = echarts.init(el)
  chart.setOption(option)
  charts.push(chart)
}

function renderTrend() {
  const days = overview.value?.last7Days ?? []
  const counts = days.map((d) => Number(d.count ?? 0))
  const avg = counts.length ? counts.reduce((a, b) => a + b, 0) / counts.length : 0
  mountChart(trendRef.value, {
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(15,26,22,.92)',
      borderWidth: 0,
      textStyle: { color: '#fff', fontSize: 12 },
      formatter: (params: unknown) => {
        const arr = params as Array<{ axisValue: string; value: number }>
        const row = arr[0]
        if (!row) return ''
        return `${row.axisValue}<br/>识别 <b>${row.value}</b> 次`
      },
    },
    grid: { left: 44, right: 18, top: 24, bottom: 28 },
    xAxis: {
      type: 'category',
      data: days.map((d) => d.date),
      boundaryGap: false,
      axisLine: { lineStyle: { color: PALETTE.hairline } },
      axisTick: { show: false },
      axisLabel: { color: PALETTE.muted, fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      axisLabel: { color: PALETTE.muted, fontSize: 11 },
      splitLine: { lineStyle: { color: '#F0F4F1' } },
    },
    series: [
      {
        name: '识别次数',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 7,
        data: counts,
        lineStyle: { color: PALETTE.green, width: 2.5 },
        itemStyle: { color: PALETTE.green, borderColor: '#fff', borderWidth: 2 },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(18,163,121,.28)' },
            { offset: 1, color: 'rgba(18,163,121,.02)' },
          ]),
        },
        markLine: {
          silent: true,
          symbol: 'none',
          label: { show: false },
          lineStyle: { color: PALETTE.blue, type: 'dashed', width: 1 },
          data: [{ yAxis: Number(avg.toFixed(2)) }],
        },
      },
    ],
  })
}

function renderStatus() {
  const data = [
    { name: '识别成功', value: statusCounts.value.success, itemStyle: { color: PALETTE.greenBright } },
    { name: '疑似结果', value: statusCounts.value.suspected, itemStyle: { color: PALETTE.amber } },
    { name: '未识别', value: statusCounts.value.failed, itemStyle: { color: PALETTE.red } },
  ]
  mountChart(statusRef.value, {
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(15,26,22,.92)',
      borderWidth: 0,
      textStyle: { color: '#fff', fontSize: 12 },
      formatter: '{b}<br/>{c} 条（{d}%）',
    },
    legend: {
      bottom: 0,
      icon: 'circle',
      itemWidth: 8,
      itemHeight: 8,
      textStyle: { color: PALETTE.muted, fontSize: 12 },
    },
    series: [
      {
        type: 'pie',
        radius: ['52%', '72%'],
        center: ['50%', '45%'],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: '#fff', borderWidth: 3 },
        label: { show: false },
        emphasis: { scale: true, scaleSize: 4 },
        data,
      },
    ],
  })
}

function renderConfidence() {
  const bands = levelBands.value
  mountChart(confidenceRef.value, {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: 'rgba(15,26,22,.92)',
      borderWidth: 0,
      textStyle: { color: '#fff', fontSize: 12 },
    },
    grid: { left: 62, right: 44, top: 10, bottom: 8 },
    xAxis: { type: 'value', show: false },
    yAxis: {
      type: 'category',
      inverse: true,
      data: bands.map((b) => b.label),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: PALETTE.muted, fontSize: 12 },
    },
    series: [
      {
        type: 'bar',
        barWidth: 12,
        data: bands.map((b) => ({
          value: b.value,
          itemStyle: { color: b.color, borderRadius: [0, 6, 6, 0] },
        })),
        label: {
          show: true,
          position: 'right',
          color: PALETTE.ink,
          fontSize: 12,
          fontWeight: 600,
          formatter: '{c}',
        },
        showBackground: true,
        backgroundStyle: { color: '#F0F4F1', borderRadius: 6 },
      },
    ],
  })
}

function renderTopHerbs() {
  const rows = [...topHerbs.value].sort((a, b) => a.count - b.count)
  mountChart(topHerbRef.value, {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: 'rgba(15,26,22,.92)',
      borderWidth: 0,
      textStyle: { color: '#fff', fontSize: 12 },
    },
    grid: { left: 62, right: 40, top: 8, bottom: 8 },
    xAxis: { type: 'value', show: false },
    yAxis: {
      type: 'category',
      data: rows.map((r) => r.name),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: PALETTE.ink, fontSize: 12 },
    },
    series: [
      {
        type: 'bar',
        barWidth: 12,
        data: rows.map((r) => r.count),
        itemStyle: {
          borderRadius: [0, 6, 6, 0],
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: PALETTE.greenBright },
            { offset: 1, color: PALETTE.green },
          ]),
        },
        label: {
          show: true,
          position: 'right',
          color: PALETTE.muted,
          fontSize: 11,
          formatter: '{c} 次',
        },
        showBackground: true,
        backgroundStyle: { color: '#F0F4F1', borderRadius: 6 },
      },
    ],
  })
}

function renderModelUsage() {
  const rows = [...modelUsage.value].sort((a, b) => a.count - b.count)
  mountChart(modelUsageRef.value, {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: 'rgba(15,26,22,.92)',
      borderWidth: 0,
      textStyle: { color: '#fff', fontSize: 12 },
    },
    grid: { left: 8, right: 48, top: 8, bottom: 8, containLabel: true },
    xAxis: { type: 'value', show: false },
    yAxis: {
      type: 'category',
      data: rows.map((r) => r.name),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: PALETTE.muted, fontSize: 11, width: 150, overflow: 'truncate' },
    },
    series: [
      {
        type: 'bar',
        barWidth: 12,
        data: rows.map((r) => r.count),
        itemStyle: { borderRadius: [0, 6, 6, 0], color: PALETTE.blue },
        label: { show: true, position: 'right', color: PALETTE.muted, fontSize: 11, formatter: '{c} 条' },
        showBackground: true,
        backgroundStyle: { color: '#F0F4F1', borderRadius: 6 },
      },
    ],
  })
}

function renderCharts() {
  clearCharts()
  if (!overview.value) return
  renderTrend()
  if (statusTotal.value > 0) renderStatus()
  if (levelBands.value.some((b) => b.value > 0)) renderConfidence()
  if (topHerbs.value.length) renderTopHerbs()
  if (modelUsage.value.length) renderModelUsage()
}

function handleResize() {
  charts.forEach((c) => c.resize())
}

/* 侧边栏收起/展开会让内容区变宽，但不会触发 window.resize，
 * 用 ResizeObserver 盯住看板根节点，宽度一变就重排图表。 */
let resizeObserver: ResizeObserver | null = null
function setupResizeObserver() {
  if (!rootRef.value || typeof ResizeObserver === 'undefined') return
  resizeObserver?.disconnect()
  resizeObserver = new ResizeObserver(() => {
    charts.forEach((c) => c.resize())
  })
  resizeObserver.observe(rootRef.value)
}

/* ---------------- 数据加载 ---------------- */
async function loadAll() {
  loading.value = true
  loadError.value = ''
  try {
    const [ov, rec, s1, s2, s3, md] = await Promise.allSettled([
      getStatsOverview(),
      getRecordPage({ page: 1, pageSize: 100 }),
      getRecordPage({ page: 1, pageSize: 1, status: 1 }),
      getRecordPage({ page: 1, pageSize: 1, status: 2 }),
      getRecordPage({ page: 1, pageSize: 1, status: 3 }),
      getModelPage({ page: 1, pageSize: 50 }),
    ])

    if (ov.status === 'fulfilled') overview.value = ov.value
    else loadError.value = '统计概览加载失败，请稍后重试'

    const records = rec.status === 'fulfilled' ? rec.value : null
    if (records) recent.value = records.list || []

    statusCounts.value = {
      success: s1.status === 'fulfilled' ? s1.value.total : 0,
      suspected: s2.status === 'fulfilled' ? s2.value.total : 0,
      failed: s3.status === 'fulfilled' ? s3.value.total : 0,
    }
    if (md.status === 'fulfilled') models.value = md.value.list || []

    updatedAt.value = new Date().toLocaleTimeString('zh-CN', { hour12: false })
  } finally {
    loading.value = false
    await nextTick()
    renderCharts()
  }
}

function goRecords() {
  router.push('/records')
}

onMounted(() => {
  loadAll()
  setupResizeObserver()
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  resizeObserver?.disconnect()
  resizeObserver = null
  clearCharts()
})
</script>

<template>
  <div ref="rootRef" v-loading="loading" class="dashboard">
    <!-- 页头 -->
    <div class="page-head">
      <div class="head-main">
        <div class="kicker">DALI HERB · ADMIN CONSOLE</div>
        <h1 class="page-title">数据看板</h1>
        <p class="page-sub">识别、药材、样本与工单的运营总览</p>
      </div>
      <div class="head-side">
        <span class="updated">{{ updatedAt ? '更新于 ' + updatedAt : '加载中…' }}</span>
        <el-button :icon="Refresh" :loading="loading" @click="loadAll">刷新</el-button>
      </div>
    </div>

    <el-alert v-if="loadError" :title="loadError" type="error" show-icon :closable="false" class="load-error" />

    <!-- KPI 主卡 -->
    <div class="kpi-grid">
      <div v-for="kpi in kpis" :key="kpi.key" class="kpi-card" :class="'accent-' + kpi.accent">
        <div class="kpi-label">{{ kpi.label }}</div>
        <div class="kpi-value">
          <span class="num">{{ kpi.key === 'success' ? kpi.value.toFixed(1) : kpi.value }}</span>
          <span class="unit">{{ kpi.unit }}</span>
        </div>
        <div class="kpi-foot">{{ kpi.foot }}</div>
      </div>
    </div>

    <!-- 次级指标 -->
    <div class="metric-strip">
      <div v-for="m in metrics" :key="m.label" class="metric-item">
        <div class="metric-head">
          <span class="metric-label">{{ m.label }}</span>
          <span class="metric-value num">{{ m.value }}</span>
        </div>
        <div class="metric-bar">
          <i :style="{ width: Math.min(100, Math.max(0, m.percent)) + '%', background: m.color }"></i>
        </div>
        <div class="metric-text">{{ m.text }}</div>
      </div>
    </div>

    <!-- 趋势 + 状态分布 -->
    <div class="grid-trend">
      <section class="panel">
        <header class="panel-head">
          <div>
            <div class="panel-title">近 7 天识别趋势</div>
            <div class="panel-hint">虚线为日均值</div>
          </div>
          <span class="panel-badge">{{ recordTotal }} 条累计</span>
        </header>
        <div ref="trendRef" class="chart chart-trend"></div>
      </section>

      <section class="panel">
        <header class="panel-head">
          <div>
            <div class="panel-title">识别状态分布</div>
            <div class="panel-hint">全部记录</div>
          </div>
        </header>
        <div v-if="statusTotal" ref="statusRef" class="chart chart-donut"></div>
        <el-empty v-else description="暂无识别记录" :image-size="64" />
      </section>
    </div>

    <!-- 置信度 / 热门药材 / 模型使用 -->
    <div class="grid-three">
      <section class="panel">
        <header class="panel-head">
          <div>
            <div class="panel-title">置信度分档</div>
            <div class="panel-hint">最近 {{ analyseBasis }} 条</div>
          </div>
        </header>
        <div v-if="levelBands.some((b) => b.value > 0)" ref="confidenceRef" class="chart chart-bars"></div>
        <el-empty v-else description="暂无识别记录" :image-size="64" />
        <div class="band-legend">
          <span v-for="b in levelBands" :key="b.key" class="band-item">
            <i :style="{ background: b.color }"></i>{{ b.label }}<em>{{ b.hint }}</em>
          </span>
        </div>
      </section>

      <section class="panel">
        <header class="panel-head">
          <div>
            <div class="panel-title">热门识别药材 Top5</div>
            <div class="panel-hint">累计识别次数</div>
          </div>
        </header>
        <div v-if="topHerbs.length" ref="topHerbRef" class="chart chart-bars"></div>
        <el-empty v-else description="暂无识别数据" :image-size="64" />
      </section>

      <section class="panel">
        <header class="panel-head">
          <div>
            <div class="panel-title">模型版本使用</div>
            <div class="panel-hint">最近 {{ analyseBasis }} 条</div>
          </div>
          <span v-if="publishedModels.length" class="panel-badge">{{ publishedModels[0]?.version }}</span>
        </header>
        <div v-if="modelUsage.length" ref="modelUsageRef" class="chart chart-bars"></div>
        <el-empty v-else description="暂无调用数据" :image-size="64" />
      </section>
    </div>

    <!-- 最近识别动态 -->
    <section class="panel">
      <header class="panel-head">
        <div>
          <div class="panel-title">最近识别动态</div>
          <div class="panel-hint">最新 {{ recentRows.length }} 条</div>
        </div>
        <el-button link type="primary" @click="goRecords">查看全部记录 →</el-button>
      </header>

      <el-empty v-if="!recentRows.length" description="暂无识别记录" :image-size="72" />
      <div v-else class="feed">
        <div v-for="row in recentRows" :key="row.recordId" class="feed-row" @click="goRecords">
          <img v-if="row.imageUrl" class="feed-thumb" :src="mediaUrl(row.imageUrl)" alt="" />
          <div v-else class="feed-thumb feed-thumb-empty">🌿</div>

          <div class="feed-main">
            <div class="feed-name">{{ row.top?.name || '未识别' }}</div>
            <div class="feed-meta">
              <span class="feed-tag" :class="'st-' + (row.status || 'unknown')">
                {{ row.status === 'success' ? '识别成功' : row.status === 'suspected' ? '疑似结果' : '未识别' }}
              </span>
              <span class="feed-model">{{ row.modelVersion || '-' }}</span>
              <span class="feed-id">{{ row.recordId }}</span>
            </div>
          </div>

          <div class="feed-confidence">
            <span class="num">{{ percentText(row.top?.percent) }}</span>
            <div class="confidence-bar">
              <i :style="{ width: Math.min(100, Number(row.top?.percent ?? 0)) + '%' }"></i>
            </div>
          </div>

          <div class="feed-time">{{ timeText(row.createdAt) }}</div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.dashboard {
  --green: #0c6b4f;
  --green-bright: #12a379;
  --green-soft: #dff2ea;
  --blue: #2a5ce0;
  --blue-soft: #e6edfd;
  --ink: #0f1a16;
  --muted: #5f7269;
  --weak: #93a39a;
  --hairline: #e4eae6;
  --mono: 'SF Mono', 'DIN Alternate', Menlo, Consolas, 'Courier New', monospace;

  color: var(--ink);
}
.num {
  font-family: var(--mono);
  font-variant-numeric: tabular-nums;
}

/* 页头 */
.page-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 18px;
}
.kicker {
  font-size: 11px;
  letter-spacing: 2.4px;
  color: var(--weak);
  font-weight: 600;
}
.page-title {
  margin: 6px 0 4px;
  font-size: 26px;
  line-height: 1.15;
  font-weight: 800;
  letter-spacing: -0.5px;
}
.page-sub {
  margin: 0;
  font-size: 13px;
  color: var(--muted);
}
.head-side {
  display: flex;
  align-items: center;
  gap: 12px;
}
.updated {
  font-size: 12px;
  color: var(--weak);
  font-family: var(--mono);
}
.load-error {
  margin-bottom: 14px;
}

/* KPI */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}
.kpi-card {
  position: relative;
  background: #fff;
  border: 1px solid var(--hairline);
  border-radius: 14px;
  padding: 18px 20px 16px;
  overflow: hidden;
}
.kpi-card::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
}
.kpi-card.accent-green::before { background: var(--green); }
.kpi-card.accent-blue::before { background: var(--blue); }
.kpi-card.accent-amber::before { background: #b4700a; }
.kpi-label {
  font-size: 13px;
  color: var(--muted);
}
.kpi-value {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin: 8px 0 6px;
}
.kpi-value .num {
  font-size: 30px;
  font-weight: 800;
  letter-spacing: -0.6px;
  line-height: 1.1;
}
.kpi-value .unit {
  font-size: 12px;
  color: var(--weak);
}
.kpi-foot {
  font-size: 12px;
  color: var(--weak);
}

/* 次级指标条 */
.metric-strip {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 0;
  background: #fff;
  border: 1px solid var(--hairline);
  border-radius: 14px;
  margin-top: 14px;
  overflow: hidden;
}
.metric-item {
  padding: 14px 16px;
  border-right: 1px solid #eef3f0;
}
.metric-item:last-child {
  border-right: none;
}
.metric-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}
.metric-label {
  font-size: 12px;
  color: var(--muted);
}
.metric-value {
  font-size: 14px;
  font-weight: 700;
}
.metric-bar {
  height: 4px;
  border-radius: 999px;
  background: #f0f4f1;
  margin: 8px 0 6px;
  overflow: hidden;
}
.metric-bar i {
  display: block;
  height: 100%;
  border-radius: 999px;
}
.metric-text {
  font-size: 11px;
  color: var(--weak);
}

/* 面板 */
.panel {
  background: #fff;
  border: 1px solid var(--hairline);
  border-radius: 14px;
  padding: 16px 18px 14px;
}
.panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}
.panel-title {
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.2px;
}
.panel-hint {
  font-size: 11px;
  color: var(--weak);
  margin-top: 2px;
}
.panel-badge {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--blue);
  background: var(--blue-soft);
  border: 1px solid #cddaf8;
  border-radius: 6px;
  padding: 2px 8px;
  white-space: nowrap;
}

/* 布局 */
.grid-trend {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
  gap: 14px;
  margin-top: 14px;
}
.grid-three {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  margin-top: 14px;
}
.dashboard > .panel {
  margin-top: 14px;
}

/* 图表 */
.chart {
  width: 100%;
}
.chart-trend {
  height: 268px;
}
.chart-donut {
  height: 268px;
}
.chart-bars {
  height: 168px;
}

/* 置信度图例 */
.band-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 14px;
  padding-top: 6px;
  border-top: 1px solid #f0f4f1;
  margin-top: 6px;
}
.band-item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: var(--muted);
}
.band-item i {
  width: 8px;
  height: 8px;
  border-radius: 2px;
}
.band-item em {
  font-style: normal;
  color: var(--weak);
}

/* 最近识别动态 */
.feed {
  display: flex;
  flex-direction: column;
}
.feed-row {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) 160px 96px;
  align-items: center;
  gap: 14px;
  padding: 10px 6px;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.16s ease;
}
.feed-row:hover {
  background: #f6faf8;
}
.feed-row + .feed-row {
  border-top: 1px solid #f2f6f3;
}
.feed-thumb {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  object-fit: cover;
  background: var(--green-soft);
  border: 1px solid var(--hairline);
}
.feed-thumb-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
}
.feed-name {
  font-size: 14px;
  font-weight: 600;
}
.feed-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 3px;
  font-size: 11px;
  color: var(--weak);
}
.feed-tag {
  border-radius: 5px;
  padding: 1px 7px;
  border: 1px solid transparent;
}
.feed-tag.st-success {
  color: var(--green);
  background: var(--green-soft);
  border-color: #bfe6d6;
}
.feed-tag.st-suspected {
  color: #9a5b08;
  background: #fbf0df;
  border-color: #f0dcbe;
}
.feed-tag.st-failed {
  color: #b03025;
  background: #fcebe8;
  border-color: #f5cec8;
}
.feed-model,
.feed-id {
  font-family: var(--mono);
  font-size: 10.5px;
  color: var(--weak);
}
.feed-confidence {
  display: flex;
  align-items: center;
  gap: 8px;
}
.feed-confidence .num {
  font-size: 12px;
  font-weight: 700;
  color: var(--ink);
  min-width: 44px;
  text-align: right;
}
.confidence-bar {
  flex: 1;
  height: 5px;
  border-radius: 999px;
  background: #f0f4f1;
  overflow: hidden;
}
.confidence-bar i {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--green-bright), var(--green));
}
.feed-time {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--weak);
  text-align: right;
}
</style>
