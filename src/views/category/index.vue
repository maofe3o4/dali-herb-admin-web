<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import {
  deleteCategory,
  getCategories,
  saveCategory,
  updateCategory,
  type Category,
} from '@/api/category'

const loading = ref(false)
const list = ref<Category[]>([])
const type = ref('')
const dialogVisible = ref(false)
const submitting = ref(false)
const editingId = ref<string | null>(null)
const formRef = ref<FormInstance>()

const typeOptions = [
  { label: '全部', value: '' },
  { label: '功效', value: 'efficacy' },
  { label: '科属', value: 'family' },
  { label: '药用部位', value: 'part' },
  { label: '产区', value: 'region' },
  { label: '民族药', value: 'ethnic' },
]

const categoryTypes = typeOptions.filter((item) => item.value)

const form = reactive({
  parentId: '0',
  name: '',
  type: 'efficacy',
  code: '',
  iconUrl: '',
  sortOrder: 0,
  status: 1,
})

const rules: FormRules = {
  name: [{ required: true, message: '请输入分类名称', trigger: 'blur' }],
  type: [{ required: true, message: '请选择分类类型', trigger: 'change' }],
}

const parentOptions = computed(() =>
  list.value.filter((item) => item.type === form.type && item.id !== editingId.value),
)

async function load() {
  loading.value = true
  try {
    list.value = await getCategories(type.value || undefined)
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editingId.value = null
  Object.assign(form, {
    parentId: '0',
    name: '',
    type: type.value || 'efficacy',
    code: '',
    iconUrl: '',
    sortOrder: 0,
    status: 1,
  })
  dialogVisible.value = true
}

function openEdit(row: Category) {
  editingId.value = row.id
  Object.assign(form, {
    parentId: row.parentId || '0',
    name: row.name,
    type: row.type,
    code: row.code || '',
    iconUrl: row.iconUrl || '',
    sortOrder: row.sortOrder ?? 0,
    status: row.status ?? 1,
  })
  dialogVisible.value = true
}

async function submit() {
  await formRef.value?.validate()
  submitting.value = true
  try {
    const payload = { ...form, parentId: Number(form.parentId) || 0 }
    if (editingId.value) {
      await updateCategory(editingId.value, payload)
    } else {
      await saveCategory(payload)
    }
    ElMessage.success('保存成功')
    dialogVisible.value = false
    load()
  } finally {
    submitting.value = false
  }
}

async function remove(row: Category) {
  await ElMessageBox.confirm(`确认删除分类「${row.name}」？`, '提示', { type: 'warning' })
  await deleteCategory(row.id)
  ElMessage.success('删除成功')
  load()
}

onMounted(load)
</script>

<template>
  <el-card shadow="never">
    <div class="toolbar">
      <el-select v-model="type" placeholder="分类类型" style="width: 160px" @change="load">
        <el-option v-for="item in typeOptions" :key="item.value" :label="item.label" :value="item.value" />
      </el-select>
      <el-button type="success" :icon="Plus" @click="openCreate">新增分类</el-button>
    </div>

    <el-table v-loading="loading" :data="list" stripe>
      <el-table-column prop="id" label="ID" width="90" />
      <el-table-column prop="name" label="分类名称" min-width="150" />
      <el-table-column prop="type" label="类型" width="120" />
      <el-table-column prop="code" label="编码" width="100" />
      <el-table-column prop="parentId" label="父级 ID" width="100" />
      <el-table-column prop="sortOrder" label="排序" width="90" />
      <el-table-column label="操作" width="160" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
          <el-button link type="danger" @click="remove(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑分类' : '新增分类'" width="520px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
        <el-form-item label="类型" prop="type">
          <el-select v-model="form.type" @change="form.parentId = '0'">
            <el-option v-for="item in categoryTypes" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="父级">
          <el-select v-model="form.parentId" clearable>
            <el-option label="顶级分类" value="0" />
            <el-option v-for="item in parentOptions" :key="item.id" :label="item.name" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="名称" prop="name">
          <el-input v-model="form.name" placeholder="如：清热解毒" />
        </el-form-item>
        <el-form-item label="编码">
          <el-input v-model="form.code" placeholder="如：e01" />
        </el-form-item>
        <el-form-item label="图标 URL">
          <el-input v-model="form.iconUrl" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.sortOrder" :min="0" controls-position="right" />
        </el-form-item>
        <el-form-item label="状态">
          <el-switch v-model="form.status" :active-value="1" :inactive-value="0" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submit">保存</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<style scoped>
.toolbar {
  display: flex;
  gap: 10px;
  margin-bottom: 14px;
}
</style>