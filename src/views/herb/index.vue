<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { deleteHerb, getHerbPage, publishHerb, type Herb } from '@/api/herb'
import HerbFormDialog from './components/HerbFormDialog.vue'

const loading = ref(false)
const list = ref<Herb[]>([])
const total = ref(0)
const query = reactive({ page: 1, pageSize: 10, keyword: '' })

const dialogVisible = ref(false)
const editingHerb = ref<Herb | null>(null)

function statusText(status?: number) {
  if (status === 0) return '草稿'
  if (status === 1) return '待审核'
  if (status === 2) return '已发布'
  if (status === 3) return '已下架'
  return '-'
}

function statusType(status?: number) {
  if (status === 2) return 'success'
  if (status === 1) return 'warning'
  if (status === 3) return 'info'
  return 'info'
}

async function load() {
  loading.value = true
  try {
    const res = await getHerbPage(query)
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

function openCreate() {
  editingHerb.value = null
  dialogVisible.value = true
}

function openEdit(row: Herb) {
  editingHerb.value = row
  dialogVisible.value = true
}

async function handlePublish(row: Herb) {
  await ElMessageBox.confirm(`确认发布「${row.name}」？`, '提示', { type: 'warning' })
  await publishHerb(row.id)
  ElMessage.success('发布成功')
  load()
}

async function handleDelete(row: Herb) {
  await ElMessageBox.confirm(`确认删除「${row.name}」？`, '提示', { type: 'warning' })
  await deleteHerb(row.id)
  ElMessage.success('删除成功')
  load()
}

onMounted(load)
</script>

<template>
  <div>
    <el-card shadow="never">
      <div class="toolbar">
        <el-input
          v-model="query.keyword"
          placeholder="药材名称 / 别名 / 拉丁名"
          clearable
          style="width: 260px"
          @keyup.enter="search"
        />
        <el-button type="primary" @click="search">查询</el-button>
        <el-button type="success" :icon="Plus" @click="openCreate">新增药材</el-button>
      </div>

      <el-table v-loading="loading" :data="list" stripe>
        <el-table-column label="封面" width="80">
          <template #default="{ row }">
            <el-image
              v-if="row.coverImageUrl"
              :src="row.coverImageUrl"
              fit="cover"
              style="width: 46px; height: 46px; border-radius: 6px"
            />
            <span v-else class="cover-placeholder">{{ row.emoji || '' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="name" label="名称" min-width="120" />
        <el-table-column prop="latinName" label="拉丁学名" min-width="200" />
        <el-table-column prop="family" label="科" width="100" />
        <el-table-column prop="part" label="药用部位" width="120" />
        <el-table-column prop="efficacyCategory" label="功效分类" width="130" />
        <el-table-column label="道地" width="80">
          <template #default="{ row }">
            <el-tag v-if="row.isDaodi" type="success">是</el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)">{{ statusText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button v-if="row.status !== 2" link type="success" @click="handlePublish(row)">发布</el-button>
            <el-button link type="danger" @click="handleDelete(row)">删除</el-button>
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

    <HerbFormDialog v-model="dialogVisible" :herb="editingHerb" @saved="load" />
  </div>
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
.cover-placeholder {
  display: inline-flex;
  width: 46px;
  height: 46px;
  border-radius: 6px;
  align-items: center;
  justify-content: center;
  background: #eef2f0;
  font-size: 22px;
}
</style>