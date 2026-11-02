<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { getRecordPage, type RecognitionRecord } from '@/api/record'
import { mediaUrl } from '@/utils/media'

const loading = ref(false)
const list = ref<RecognitionRecord[]>([])
const total = ref(0)
const query = reactive<{ page: number; pageSize: number; keyword: string; status?: number }>({
  page: 1,
  pageSize: 10,
  keyword: '',
  status: undefined,
})

const statusOptions = [
  { label: '全部', value: undefined },
  { label: '成功', value: 1 },
  { label: '疑似', value: 2 },
  { label: '失败', value: 3 },
]

function statusText(status?: string) {
  if (status === 'success') return '成功'
  if (status === 'suspected') return '疑似'
  return '失败'
}

function statusType(status?: string) {
  if (status === 'success') return 'success'
  if (status === 'suspected') return 'warning'
  return 'danger'
}

async function load() {
  loading.value = true
  try {
    const res = await getRecordPage(query)
    list.value = res.list
    total.value = res.total
  } finally {
    loading.value = false
  }
}

function search() {
  query.page = 1
  load()
}

onMounted(load)
</script>

<template>
  <el-card shadow="never">
    <div class="toolbar">
      <el-input v-model="query.keyword" placeholder="药材名称 / 记录号" clearable style="width: 240px" @keyup.enter="search" />
      <el-select v-model="query.status" placeholder="状态" clearable style="width: 140px" @change="search">
        <el-option v-for="item in statusOptions" :key="String(item.value)" :label="item.label" :value="item.value" />
      </el-select>
      <el-button type="primary" @click="search">查询</el-button>
    </div>

    <el-table v-loading="loading" :data="list" stripe>
      <el-table-column label="图片" width="90">
        <template #default="{ row }">
          <el-image v-if="row.imageUrl" :src="mediaUrl(row.imageUrl)" fit="cover" style="width: 48px; height: 48px; border-radius: 6px" />
        </template>
      </el-table-column>
      <el-table-column prop="recordId" label="记录号" width="200" />
      <el-table-column label="识别结果" min-width="120">
        <template #default="{ row }">{{ row.top?.name || '-' }}</template>
      </el-table-column>
      <el-table-column label="置信度" width="110">
        <template #default="{ row }">{{ row.top?.percent != null ? row.top.percent + '%' : '-' }}</template>
      </el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="statusType(row.status)">{{ statusText(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="modelVersion" label="模型版本" width="130" />
      <el-table-column prop="costMs" label="耗时(ms)" width="100" />
      <el-table-column prop="createdAt" label="识别时间" width="180" />
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
  display: flex;
  gap: 10px;
  margin-bottom: 14px;
}
.pagination {
  margin-top: 16px;
  justify-content: flex-end;
}
</style>