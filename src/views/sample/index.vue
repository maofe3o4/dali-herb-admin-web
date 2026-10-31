<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { getSamplePage, type DatasetSample } from '@/api/sample'

const loading = ref(false)
const list = ref<DatasetSample[]>([])
const total = ref(0)
const query = reactive<{ page: number; pageSize: number; split?: string; auditStatus?: number }>({
  page: 1,
  pageSize: 10,
  split: undefined,
  auditStatus: undefined,
})

const splitOptions = [
  { label: '全部', value: '' },
  { label: 'train', value: 'train' },
  { label: 'val', value: 'val' },
  { label: 'test', value: 'test' },
]

const auditOptions = [
  { label: '全部', value: undefined },
  { label: '待标注', value: 0 },
  { label: '待审核', value: 1 },
  { label: '已入库', value: 2 },
  { label: '废弃', value: 3 },
]

function auditText(status?: number) {
  return auditOptions.find((item) => item.value === status)?.label || '-'
}

async function load() {
  loading.value = true
  try {
    const res = await getSamplePage(query)
    list.value = res.list
    total.value = res.total
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <el-card shadow="never">
    <div class="toolbar">
      <el-select v-model="query.split" placeholder="数据集" clearable style="width: 140px" @change="load">
        <el-option v-for="item in splitOptions" :key="item.value" :label="item.label" :value="item.value" />
      </el-select>
      <el-select v-model="query.auditStatus" placeholder="标注状态" clearable style="width: 140px" @change="load">
        <el-option v-for="item in auditOptions" :key="String(item.value)" :label="item.label" :value="item.value" />
      </el-select>
    </div>

    <el-table v-loading="loading" :data="list" stripe>
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column label="图片" width="90">
        <template #default="{ row }">
          <el-image v-if="row.imageUrl" :src="row.imageUrl" fit="cover" style="width: 48px; height: 48px; border-radius: 6px" />
        </template>
      </el-table-column>
      <el-table-column prop="herbId" label="药材 ID" width="100" />
      <el-table-column prop="source" label="来源" width="120" />
      <el-table-column prop="part" label="部位" width="120" />
      <el-table-column prop="device" label="设备" width="130" />
      <el-table-column label="标注状态" width="110">
        <template #default="{ row }">{{ auditText(row.auditStatus) }}</template>
      </el-table-column>
      <el-table-column prop="split" label="数据集" width="100" />
      <el-table-column label="难例" width="80">
        <template #default="{ row }">{{ row.isHardCase ? '是' : '否' }}</template>
      </el-table-column>
      <el-table-column prop="createdAt" label="创建时间" width="180" />
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