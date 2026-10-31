<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { getLogPage, type OperationLog } from '@/api/log'

const loading = ref(false)
const list = ref<OperationLog[]>([])
const total = ref(0)
const query = reactive({ page: 1, pageSize: 10, module: '', action: '' })

async function load() {
  loading.value = true
  try {
    const res = await getLogPage(query)
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
      <el-input v-model="query.module" placeholder="模块，如 herbs" clearable style="width: 160px" @keyup.enter="search" />
      <el-input v-model="query.action" placeholder="动作，如 post" clearable style="width: 160px" @keyup.enter="search" />
      <el-button type="primary" @click="search">查询</el-button>
    </div>

    <el-table v-loading="loading" :data="list" stripe>
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="adminId" label="管理员 ID" width="110" />
      <el-table-column prop="module" label="模块" width="130" />
      <el-table-column prop="action" label="动作" width="100" />
      <el-table-column prop="targetId" label="目标 ID" width="120" />
      <el-table-column prop="ip" label="IP" width="140" />
      <el-table-column prop="createdAt" label="时间" width="180" />
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