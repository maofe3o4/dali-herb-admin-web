<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getModelPage, publishModel, type ModelVersion } from '@/api/model'

const loading = ref(false)
const list = ref<ModelVersion[]>([])
const total = ref(0)
const query = reactive<{ page: number; pageSize: number; status?: number }>({
  page: 1,
  pageSize: 10,
  status: undefined,
})

const statusOptions = [
  { label: '全部', value: undefined },
  { label: '训练中', value: 0 },
  { label: '待发布', value: 1 },
  { label: '灰度', value: 2 },
  { label: '全量', value: 3 },
  { label: '已下线', value: 4 },
]

function statusText(status: number) {
  return statusOptions.find((item) => item.value === status)?.label || '-'
}

async function load() {
  loading.value = true
  try {
    const res = await getModelPage(query)
    list.value = res.list
    total.value = res.total
  } finally {
    loading.value = false
  }
}

async function handlePublish(row: ModelVersion, gray: boolean) {
  await ElMessageBox.confirm(
    gray ? `将「${row.version}」灰度发布 10%？` : `将「${row.version}」全量发布？`,
    '提示',
    { type: 'warning' },
  )
  await publishModel(row.id, gray ? { status: 2, grayPercent: 10 } : { status: 3, grayPercent: 100 })
  ElMessage.success('发布成功')
  load()
}

onMounted(load)
</script>

<template>
  <el-card shadow="never">
    <div class="toolbar">
      <el-select v-model="query.status" placeholder="状态" clearable style="width: 140px" @change="load">
        <el-option v-for="item in statusOptions" :key="String(item.value)" :label="item.label" :value="item.value" />
      </el-select>
    </div>

    <el-table v-loading="loading" :data="list" stripe>
      <el-table-column prop="version" label="版本" min-width="160" />
      <el-table-column prop="algorithm" label="算法" min-width="160" />
      <el-table-column prop="backbone" label="主干网络" width="130" />
      <el-table-column prop="attention" label="注意力" width="120" />
      <el-table-column prop="top1Acc" label="Top-1" width="90" />
      <el-table-column prop="top5Acc" label="Top-5" width="90" />
      <el-table-column prop="inferP95Ms" label="P95(ms)" width="90" />
      <el-table-column label="状态" width="90">
        <template #default="{ row }">{{ statusText(row.status) }}</template>
      </el-table-column>
      <el-table-column prop="grayPercent" label="灰度%" width="90" />
      <el-table-column label="操作" width="180" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="handlePublish(row, true)">灰度</el-button>
          <el-button link type="success" @click="handlePublish(row, false)">全量</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination
      v-model:current-page="query.page"
      v-model:page-size="query.pageSize"
      class="pagination"
      layout="total, prev, pager, next"
      :total="total"
      @current-change="load"
    />
  </el-card>
</template>

<style scoped>
.toolbar {
  margin-bottom: 14px;
}
.pagination {
  margin-top: 16px;
  justify-content: flex-end;
}
</style>