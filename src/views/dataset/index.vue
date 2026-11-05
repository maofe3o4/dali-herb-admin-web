<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import * as echarts from 'echarts'
import { Refresh } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import {
  batchSaveSamples,
  getSamplePage,
  getSampleStats,
  type DatasetSample,
  type SampleStats,
} from '@/api/sample'
import { getHerbPage } from '@/api/herb'
import { mediaUrl } from '@/utils/media'

const router = useRouter()

const rootRef = ref<HTMLDivElement>()
const loading = ref(false)
const stats = ref<SampleStats | null>(null)
const pending = ref<DatasetSample[]>([])
const pendingTotal = ref(0)
const herbNames = ref<Record<string, string>>({})
const updatedAt = ref('')

const auditChartRef = ref<HTMLDivElement>()
const trendChartRef = ref<HTMLDivElement>()
const splitChartRef = ref<HTMLDivElement>()
const sourceChartRef = ref<HTMLDivElement>()
const topHerbChartRef = ref<HTMLDivElement>()
const charts: echarts.ECharts[] = []

const PALETTE = {
  green: '#0C6B4F',
  greenBright: '#12A379',
  greenSoft: '#DFF2EA',
  blue: '#2A5CE0',
  blueSoft: '#E6EDFD',
  amber: '#B4700A',
  amberSoft: '#FBF0DC',
  red: '#C0392B',
  ink: '#0F1A16',
  muted: '#5F7269',
  weak: '#93A39A',
  hairline: '#E4EAE6',
}

/* ---------------- 派生指标 ---------------- */
const AUDIT_META = [
  { key: '0', name: '待标注', color: PALETTE.weak },
  { key: '1', name: '待审核', color: PALETTE.amber },
  { key: '2', name: '已入库', color: PALETTE.greenBright },
  { key: '3', name: '废弃', color: PALETTE.red },
]

const auditItems = computed(() => {
  const map = stats.value?.auditStatus ?? {}
  return AUDIT_META.map((item) => ({ ...item, value: Number(map[item.key] ?? 0) }))
})
const auditedCount = computed(() => Number(stats.value?.auditStatus?.['2'] ?? 0))
const auditedRate = computed(() => {
  const total = stats.value?.total ?? 0
  return total ? (auditedCount.value / total) * 100 : 0
})
const splitCounts = computed(() => {
  const map = stats.value?.split ?? {}
  return {
    train: Number(map['train'] ?? 0),
    val: Number(map['val'] ?? 0),
    test: Number(map['test'] ?? 0),
  }
})
const sourceCounts = computed(() => {
  const map = stats.value?.source ?? {}
  return {
    recognition: Number(map['recognition'] ?? 0),
    expert: Number(map['expert'] ?? 0),
    other: Object.entries(map)
      .filter(([key]) => key !== 'recognition' && key !== 'expert')
      .reduce((sum, [, value]) => sum + Number(value ?? 0), 0),
  }
})

const kpis = computed(() => {
  const s = stats.value
  return [
    { key: 'total', label: '样本总量', value: s?.total ?? 0, unit: '条', foot: `今日新增 ${s?.todayCollectedCount ?? 0} 条`, accent: 'green' },
    { key: 'audited', label: '已入库', value: auditedCount.value, unit: '条', foot: `入库率 ${auditedRate.value.toFixed(1)}%`, accent: 'blue' },
    { key: 'pending', label: '待审核 / 待标注', value: s?.pendingAuditCount ?? 0, unit: '条', foot: '需人工确认后进入训练集', accent: 'amber' },
    { key: 'auto', label: '低置信自动采集', value: s?.autoCollectedCount ?? 0, unit: '条', foot: '识别 Top-1 < 70% 自动入库', accent: 'green' },
  ]
})

const splitCards = computed(() => {
  const s = stats.value
  return [
    { label: '训练集 train', value: splitCounts.value.train, color: PALETTE.green },
    { label: '验证集 val', value: splitCounts.value.val, color: PALETTE.blue },
    { label: '测试集 test', value: splitCounts.value.test, color: PALETTE.amber },
    { label: '难样本', value: s?.hardCaseCount ?? 0, color: PALETTE.red },
  ]
})

const metricStrip = computed(() => {
  const s = stats.value
  const total = s?.total ?? 0
  return [
    { label: '自动采集占比', value: total ? ((Number(s?.autoCollectedCount ?? 0) / total) * 100).toFixed(1) + '%' : '-' },
    { label: '待标注', value: String(auditItems.value.find((i) => i.key === '0')?.value ?? 0) },
    { label: '待审核', value: String(auditItems.value.find((i) => i.key === '1')?.value ?? 0) },
    { label: '今日采集', value: String(s?.todayCollectedCount ?? 0) },
    { label: '覆盖药材', value: String(s?.topHerbs?.length ? (s.topHerbs.length >= 10 ? '≥10' : s.topHerbs.length) : 0) + ' 味' },
    { label: '专家标注', value: String(sourceCounts.value.expert) + ' 条' },
  ]
})

function herbName(row: DatasetSample) {
  if (row.herbId == null) return '未定标'
  return herbNames.value[String(row.herbId)] || `#${row.herbId}`
}

function sourceText(source?: string) {
  if (source === 'recognition') return '自动采集'
  if (source === 'expert') return '专家标注'
  return source || '-'
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

const tooltipBase = {
  backgroundColor: 'rgba(15,26,22,.92)',
  borderWidth: 0,
  textStyle: { color: '#fff', fontSize: 12 },
}

function renderAudit() {
  const items = auditItems.value.filter((item) => item.value > 0)
  mountChart(auditChartRef.value, {
    animationDuration: 700,
    animationEasing: 'cubicOut',
    tooltip: { trigger: 'item', ...tooltipBase, formatter: '{b}：{c} 条（{d}%）' },
    legend: {
      orient: 'vertical',
      right: 8,
      top: 'center',
      itemWidth: 9,
      itemHeight: 9,
      textStyle: { color: PALETTE.muted, fontSize: 12 },
    },
    series: [
      {
        type: 'pie',
        radius: ['52%', '76%'],
        center: ['34%', '50%'],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: '#fff', borderWidth: 3, borderRadius: 5 },
        label: { show: false },
        data: items.map((item) => ({
          name: item.name,
          value: item.value,
          itemStyle: { color: item.color },
        })),
      },
    ],
  })
}

function renderTrend() {
  const days = stats.value?.last14Days ?? []
  mountChart(trendChartRef.value, {
    animation: true,
    animationDuration: 800,
    animationEasing: 'cubicOut',
    tooltip: { trigger: 'axis', ...tooltipBase, axisPointer: { type: 'shadow' } },
    legend: {
      right: 4,
      top: 0,
      itemWidth: 10,
      itemHeight: 10,
      textStyle: { color: PALETTE.muted, fontSize: 11 },
    },
    grid: { left: 40, right: 12, top: 34, bottom: 26 },
    xAxis: {
      type: 'category',
      data: days.map((d) => d.date),
      axisLine: { lineStyle: { color: PALETTE.hairline } },
      axisTick: { show: false },
      axisLabel: { color: PALETTE.muted, fontSize: 10, interval: 0, rotate: 30 },
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      axisLabel: { color: PALETTE.muted, fontSize: 10 },
      splitLine: { lineStyle: { color: '#F0F4F1' } },
    },
    series: [
      {
        name: '采集总量',
        type: 'bar',
        barMaxWidth: 16,
        data: days.map((d) => d.total),
        itemStyle: {
          borderRadius: [5, 5, 0, 0],
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#17B98A' },
            { offset: 1, color: PALETTE.green },
          ]),
        },
      },
      {
        name: '其中自动采集',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 5,
        data: days.map((d) => d.auto),
        lineStyle: { color: PALETTE.amber, width: 2 },
        itemStyle: { color: PALETTE.amber },
      },
    ],
  })
}

function renderSplit() {
  const counts = splitCounts.value
  const rows = [
    { name: 'train', value: counts.train, color: PALETTE.green },
    { name: 'val', value: counts.val, color: PALETTE.blue },
    { name: 'test', value: counts.test, color: PALETTE.amber },
  ]
  mountChart(splitChartRef.value, {
    animationDuration: 700,
    tooltip: { trigger: 'axis', ...tooltipBase, axisPointer: { type: 'shadow' } },
    grid: { left: 8, right: 40, top: 10, bottom: 10, containLabel: true },
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
        barWidth: 14,
        data: rows.map((r) => ({
          value: r.value,
          itemStyle: { color: r.color, borderRadius: [0, 6, 6, 0] },
        })),
        label: { show: true, position: 'right', color: PALETTE.muted, fontSize: 11, formatter: '{c} 条' },
        showBackground: true,
        backgroundStyle: { color: '#F0F4F1', borderRadius: 6 },
      },
    ],
  })
}

function renderSource() {
  const s = sourceCounts.value
  const rows = [
    { name: '专家标注', value: s.expert, color: PALETTE.greenBright },
    { name: '自动采集', value: s.recognition, color: PALETTE.amber },
  ]
  if (s.other > 0) rows.push({ name: '其他', value: s.other, color: PALETTE.weak })
  mountChart(sourceChartRef.value, {
    animationDuration: 700,
    tooltip: { trigger: 'axis', ...tooltipBase, axisPointer: { type: 'shadow' } },
    grid: { left: 8, right: 40, top: 10, bottom: 10, containLabel: true },
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
        barWidth: 14,
        data: rows.map((r) => ({
          value: r.value,
          itemStyle: { color: r.color, borderRadius: [0, 6, 6, 0] },
        })),
        label: { show: true, position: 'right', color: PALETTE.muted, fontSize: 11, formatter: '{c} 条' },
        showBackground: true,
        backgroundStyle: { color: '#F0F4F1', borderRadius: 6 },
      },
    ],
  })
}

function renderTopHerbs() {
  const rows = [...(stats.value?.topHerbs ?? [])].slice(0, 8).reverse()
  mountChart(topHerbChartRef.value, {
    animationDuration: 750,
    tooltip: { trigger: 'axis', ...tooltipBase, axisPointer: { type: 'shadow' } },
    grid: { left: 66, right: 44, top: 8, bottom: 8 },
    xAxis: { type: 'value', show: false },
    yAxis: {
      type: 'category',
      data: rows.map((r) => r.name || `#${r.herbId}`),
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
        label: { show: true, position: 'right', color: PALETTE.muted, fontSize: 11, formatter: '{c} 条' },
        showBackground: true,
        backgroundStyle: { color: '#F0F4F1', borderRadius: 6 },
      },
    ],
  })
}

function renderCharts() {
  clearCharts()
  if (!stats.value) return
  if (auditItems.value.some((item) => item.value > 0)) renderAudit()
  renderTrend()
  renderSplit()
  renderSource()
  if ((stats.value.topHerbs ?? []).length) renderTopHerbs()
}

function handleResize() {
  charts.forEach((chart) => chart.resize())
}

let resizeObserver: ResizeObserver | null = null
function setupResizeObserver() {
  if (!rootRef.value || typeof ResizeObserver === 'undefined') return
  resizeObserver?.disconnect()
  resizeObserver = new ResizeObserver(() => charts.forEach((chart) => chart.resize()))
  resizeObserver.observe(rootRef.value)
}

/* ---------------- 数据加载 ---------------- */
async function load() {
  loading.value = true
  try {
    const [statsRes, herbRes, waiting0, waiting1] = await Promise.allSettled([
      getSampleStats(),
      getHerbPage({ page: 1, pageSize: 100 }),
      getSamplePage({ page: 1, pageSize: 6, auditStatus: 0 }),
      getSamplePage({ page: 1, pageSize: 6, auditStatus: 1 }),
    ])
    if (statsRes.status === 'fulfilled') stats.value = statsRes.value
    if (herbRes.status === 'fulfilled') {
      const map: Record<string, string> = {}
      ;(herbRes.value.list || []).forEach((herb) => {
        map[String(herb.id)] = herb.name
      })
      herbNames.value = map
    }
    const merged: DatasetSample[] = []
    if (waiting0.status === 'fulfilled') merged.push(...(waiting0.value.list || []))
    if (waiting1.status === 'fulfilled') merged.push(...(waiting1.value.list || []))
    merged.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
    pending.value = merged.slice(0, 8)
    pendingTotal.value =
      (waiting0.status === 'fulfilled' ? waiting0.value.total : 0) +
      (waiting1.status === 'fulfilled' ? waiting1.value.total : 0)
    updatedAt.value = new Date().toLocaleTimeString('zh-CN', { hour12: false })
  } finally {
    loading.value = false
    await nextTick()
    renderCharts()
  }
}

async function review(row: DatasetSample, auditStatus: number) {
  await batchSaveSamples([{ id: row.id, auditStatus }])
  ElMessage.success(auditStatus === 2 ? '已入库，可用于训练' : '已标记废弃')
  await load()
}

function goSamples() {
  router.push('/samples')
}

onMounted(() => {
  load()
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
  <div ref="rootRef" v-loading="loading" class="dataset">
    <div class="page-head">
      <div>
        <div class="kicker">DATASET · 训练样本库</div>
        <h1 class="page-title">数据集情况</h1>
        <p class="page-sub">真实识别 Top-1 低于 70% 的样本自动入库，人工审核后进入训练集</p>
      </div>
      <div class="head-side">
        <span class="updated">{{ updatedAt ? '更新于 ' + updatedAt : '加载中…' }}</span>
        <el-button :icon="Refresh" :loading="loading" @click="load">刷新</el-button>
      </div>
    </div>

    <!-- KPI -->
    <div class="kpi-grid">
      <div v-for="kpi in kpis" :key="kpi.key" class="kpi-card" :class="'accent-' + kpi.accent">
        <div class="kpi-label">{{ kpi.label }}</div>
        <div class="kpi-value">
          <span class="num">{{ kpi.value }}</span>
          <span class="unit">{{ kpi.unit }}</span>
        </div>
        <div class="kpi-foot">{{ kpi.foot }}</div>
      </div>
    </div>

    <!-- 次级指标 -->
    <div class="metric-strip">
      <div v-for="m in metricStrip" :key="m.label" class="metric-item">
        <span class="metric-label">{{ m.label }}</span>
        <span class="metric-value num">{{ m.value }}</span>
      </div>
    </div>

    <!-- 图表：审核状态 + 采集趋势 -->
    <div class="grid-two">
      <section class="panel">
        <header class="panel-head">
          <div>
            <div class="panel-title">审核状态</div>
            <div class="panel-hint">全部 {{ stats?.total ?? 0 }} 条</div>
          </div>
          <span class="panel-badge">入库率 {{ auditedRate.toFixed(1) }}%</span>
        </header>
        <div v-if="auditItems.some((i) => i.value > 0)" ref="auditChartRef" class="chart chart-donut"></div>
        <el-empty v-else description="暂无样本" :image-size="64" />
      </section>

      <section class="panel">
        <header class="panel-head">
          <div>
            <div class="panel-title">近 14 天采集趋势</div>
            <div class="panel-hint">柱：采集总量 · 线：其中自动采集</div>
          </div>
        </header>
        <div ref="trendChartRef" class="chart chart-trend"></div>
      </section>
    </div>

    <!-- 三栏：划分 / 来源 / 热门药材 -->
    <div class="grid-three">
      <section class="panel">
        <header class="panel-head">
          <div>
            <div class="panel-title">数据集划分</div>
            <div class="panel-hint">train / val / test</div>
          </div>
        </header>
        <div ref="splitChartRef" class="chart chart-bars"></div>
        <div class="split-cards">
          <span v-for="item in splitCards" :key="item.label" class="split-item">
            <i :style="{ background: item.color }"></i>{{ item.label }}<em>{{ item.value }}</em>
          </span>
        </div>
      </section>

      <section class="panel">
        <header class="panel-head">
          <div>
            <div class="panel-title">样本来源</div>
            <div class="panel-hint">自动采集 / 专家标注</div>
          </div>
        </header>
        <div ref="sourceChartRef" class="chart chart-bars"></div>
      </section>

      <section class="panel">
        <header class="panel-head">
          <div>
            <div class="panel-title">样本最多的药材</div>
            <div class="panel-hint">Top 8</div>
          </div>
        </header>
        <div v-if="(stats?.topHerbs?.length ?? 0) > 0" ref="topHerbChartRef" class="chart chart-bars"></div>
        <el-empty v-else description="暂无数据" :image-size="64" />
      </section>
    </div>

    <!-- 待审核 -->
    <section class="panel">
      <header class="panel-head">
        <div>
          <div class="panel-title">待审核样本</div>
          <div class="panel-hint">待标注 + 待审核共 {{ pendingTotal }} 条，先到先审</div>
        </div>
        <el-button link type="primary" @click="goSamples">去样本管理审核 →</el-button>
      </header>

      <el-empty v-if="!pending.length" description="没有待审核样本" :image-size="72" />
      <el-table v-else :data="pending" class="pending-table" :show-header="true">
        <el-table-column label="图片" width="86">
          <template #default="{ row }">
            <el-image
              v-if="row.imageUrl"
              :src="mediaUrl(row.imageUrl)"
              fit="cover"
              class="pending-img"
              :preview-src-list="[mediaUrl(row.imageUrl)]"
              preview-teleported
            />
          </template>
        </el-table-column>
        <el-table-column label="药材" width="130">
          <template #default="{ row }">{{ herbName(row) }}</template>
        </el-table-column>
        <el-table-column label="来源" width="110">
          <template #default="{ row }">
            <span class="tag-line" :class="row.source === 'recognition' ? 'is-auto' : 'is-expert'">
              {{ sourceText(row.source) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="说明" min-width="240">
          <template #default="{ row }">
            <span class="remark">{{ row.remark || '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="采集时间" width="120">
          <template #default="{ row }">{{ timeText(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="primary" link @click="review(row, 2)">入库</el-button>
            <el-button size="small" type="danger" link @click="review(row, 3)">废弃</el-button>
          </template>
        </el-table-column>
      </el-table>
    </section>
  </div>
</template>

<style scoped>
.dataset {
  --green: #0c6b4f;
  --green-bright: #12a379;
  --green-soft: #dff2ea;
  --blue: #2a5ce0;
  --blue-soft: #e6edfd;
  --amber: #b4700a;
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

/* KPI 卡 */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
}
.kpi-card {
  position: relative;
  overflow: hidden;
  background: #fff;
  border: 1px solid var(--hairline);
  border-radius: 12px;
  padding: 16px 18px 14px;
}
.kpi-card::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  background: var(--green);
}
.kpi-card.accent-blue::before {
  background: var(--blue);
}
.kpi-card.accent-amber::before {
  background: var(--amber);
}
.kpi-label {
  font-size: 12px;
  color: var(--muted);
}
.kpi-value {
  display: flex;
  align-items: baseline;
  gap: 4px;
  margin: 8px 0 4px;
}
.kpi-value .num {
  font-size: 30px;
  font-weight: 800;
  letter-spacing: -1px;
  line-height: 1;
}
.kpi-value .unit {
  font-size: 12px;
  color: var(--weak);
}
.kpi-foot {
  font-size: 11px;
  color: var(--weak);
}

/* 次级指标 */
.metric-strip {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 10px;
  margin: 14px 0;
  padding: 12px 16px;
  background: #fff;
  border: 1px solid var(--hairline);
  border-radius: 12px;
}
.metric-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.metric-label {
  font-size: 11px;
  color: var(--muted);
}
.metric-value {
  font-size: 18px;
  font-weight: 700;
}

/* 面板 */
.grid-two {
  display: grid;
  grid-template-columns: 1.15fr 1fr;
  gap: 14px;
  margin-bottom: 14px;
}
.grid-three {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  margin-bottom: 14px;
}
.panel {
  background: #fff;
  border: 1px solid var(--hairline);
  border-radius: 12px;
  padding: 14px 16px;
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
}
.panel-hint {
  margin-top: 3px;
  font-size: 11px;
  color: var(--weak);
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
.chart {
  width: 100%;
}
.chart-donut {
  height: 208px;
}
.chart-trend {
  height: 208px;
}
.chart-bars {
  height: 168px;
}

/* 划分图例 */
.split-cards {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 6px;
  padding-top: 8px;
  border-top: 1px dashed var(--hairline);
}
.split-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--muted);
}
.split-item i {
  width: 8px;
  height: 8px;
  border-radius: 2px;
}
.split-item em {
  font-style: normal;
  color: var(--ink);
  font-family: var(--mono);
}

/* 待审核表格 */
.pending-table {
  margin-top: 4px;
}
.pending-img {
  width: 46px;
  height: 46px;
  border-radius: 6px;
  border: 1px solid var(--hairline);
}
.tag-line {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 5px;
  font-size: 11px;
}
.tag-line.is-auto {
  color: var(--amber);
  background: #fbf0dc;
  border: 1px solid #f0dcbe;
}
.tag-line.is-expert {
  color: var(--green);
  background: var(--green-soft);
  border: 1px solid #b9e4d4;
}
.remark {
  color: var(--muted);
  font-size: 12px;
}
</style>
