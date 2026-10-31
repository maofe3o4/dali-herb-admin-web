<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { getFeedbackPage, replyFeedback, type Feedback } from '@/api/feedback'

const loading = ref(false)
const list = ref<Feedback[]>([])
const total = ref(0)
const query = reactive<{ page: number; pageSize: number; status?: number }>({
  page: 1,
  pageSize: 10,
  status: undefined,
})

const statusOptions = [
  { label: '全部', value: undefined },
  { label: '待处理', value: 0 },
  { label: '处理中', value: 1 },
  { label: '已处理', value: 2 },
  { label: '已关闭', value: 3 },
]

const replyVisible = ref(false)
const replyForm = reactive({ id: '', reply: '', status: 2 })

function statusText(status: number) {
  return statusOptions.find((item) => item.value === status)?.label || '-'
}

async function load() {
  loading.value = true
  try {
    const res = await getFeedbackPage(query)
    list.value = res.list
    total.value = res.total
  } finally {
    loading.value = false
  }
}

function openReply(row: Feedback) {
  replyForm.id = row.id
  replyForm.reply = row.reply || ''
  replyForm.status = 2
  replyVisible.value = true
}

async function submitReply() {
  await replyFeedback(replyForm.id, { reply: replyForm.reply, status: replyForm.status })
  ElMessage.success('回复成功')
  replyVisible.value = false
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
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="type" label="类型" width="130" />
      <el-table-column prop="content" label="反馈内容" min-width="240" show-overflow-tooltip />
      <el-table-column prop="userId" label="用户 ID" width="100" />
      <el-table-column label="状态" width="100">
        <template #default="{ row }">{{ statusText(row.status) }}</template>
      </el-table-column>
      <el-table-column prop="reply" label="回复" min-width="180" show-overflow-tooltip />
      <el-table-column prop="createdAt" label="提交时间" width="180" />
      <el-table-column label="操作" width="100" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openReply(row)">回复</el-button>
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

    <el-dialog v-model="replyVisible" title="回复反馈" width="520px">
      <el-input v-model="replyForm.reply" type="textarea" :rows="4" placeholder="请输入回复内容" />
      <template #footer>
        <el-button @click="replyVisible = false">取消</el-button>
        <el-button type="primary" @click="submitReply">提交</el-button>
      </template>
    </el-dialog>
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