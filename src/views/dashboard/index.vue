<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import * as echarts from 'echarts'
import { getStatsOverview, type StatsOverview } from '@/api/stats'

const stats = ref<StatsOverview | null>(null)
const chartRef = ref<HTMLDivElement>()
let chart: echarts.ECharts | null = null

const cards = [
  { key: 'userCount', label: '用户数' },
  { key: 'herbCount', label: '药材总数' },
  { key: 'publishedHerbCount', label: '已发布' },
  { key: 'recordCount', label: '识别总数' },
  { key: 'todayRecordCount', label: '今日识别' },
  { key: 'pendingFeedbackCount', label: '待处理反馈' },
  { key: 'modelCount', label: '模型版本' },
  { key: 'sampleCount', label: '样本总数' },
] as const

function renderChart() {
  if (!chartRef.value || !stats.value) return
  if (!chart) chart = echarts.init(chartRef.value)
  chart.setOption({
    tooltip: { trigger: 'axis' },
    grid: { left: 36, right: 20, top: 30, bottom: 28 },
    xAxis: {
      type: 'category',
      data: stats.value.last7Days.map((item) => item.date),
      axisLine: { lineStyle: { color: '#cbd5e1' } },
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      splitLine: { lineStyle: { color: '#eef2f0' } },
    },
    series: [
      {
        name: '识别次数',
        type: 'line',
        smooth: true,
        symbolSize: 7,
        data: stats.value.last7Days.map((item) => item.count),
        itemStyle: { color: '#1f6e4e' },
        areaStyle: { color: 'rgba(31, 110, 78, 0.12)' },
      },
    ],
  })
}

function resizeChart() {
  chart?.resize()
}

onMounted(async () => {
  stats.value = await getStatsOverview()
  await nextTick()
  renderChart()
  window.addEventListener('resize', resizeChart)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeChart)
  chart?.dispose()
})
</script>

<template>
  <div class="dashboard">
    <el-row :gutter="16">
      <el-col v-for="card in cards" :key="card.key" :xs="12" :sm="8" :lg="6">
        <el-card shadow="never" class="stat-card">
          <div class="stat-label">{{ card.label }}</div>
          <div class="stat-value">{{ stats?.[card.key] ?? 0 }}</div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16" class="dashboard-row">
      <el-col :lg="16">
        <el-card shadow="never">
          <template #header>
            <div class="card-title">近 7 天识别趋势</div>
          </template>
          <div ref="chartRef" class="trend-chart"></div>
        </el-card>
      </el-col>
      <el-col :lg="8">
        <el-card shadow="never">
          <template #header>
            <div class="card-title">识别热门药材 Top5</div>
          </template>
          <el-empty v-if="!stats?.topHerbs?.length" description="暂无识别数据" />
          <div v-else class="top-list">
            <div v-for="(item, index) in stats.topHerbs" :key="item.name" class="top-item">
              <span class="top-index">{{ index + 1 }}</span>
              <span class="top-name">{{ item.name }}</span>
              <span class="top-count">{{ item.count }} 次</span>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<style scoped>
.dashboard-row {
  margin-top: 16px;
}
.stat-card {
  margin-bottom: 16px;
  border-radius: 10px;
}
.stat-label {
  color: #6b7280;
  font-size: 14px;
}
.stat-value {
  margin-top: 8px;
  font-size: 26px;
  font-weight: 700;
  color: #1f6e4e;
}
.card-title {
  font-weight: 600;
}
.trend-chart {
  height: 320px;
}
.top-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 8px 0;
}
.top-item {
  display: flex;
  align-items: center;
  gap: 10px;
}
.top-index {
  width: 22px;
  height: 22px;
  line-height: 22px;
  text-align: center;
  border-radius: 6px;
  background: #e8f3ec;
  color: #1f6e4e;
  font-size: 12px;
  font-weight: 600;
}
.top-name {
  flex: 1;
}
.top-count {
  color: #6b7280;
}
</style>