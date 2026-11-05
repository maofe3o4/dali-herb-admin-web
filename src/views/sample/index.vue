<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ArrowDown, Download, Refresh } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { batchSaveSamples, getSamplePage, type DatasetSample } from '@/api/sample'
import { getHerbPage } from '@/api/herb'
import { mediaUrl } from '@/utils/media'

/* 审核状态：0 待标注 1 待审核 2 已入库 3 废弃 */
const AUDIT_META = [
  { value: 0, label: '待标注', cls: 'is-waiting' },
  { value: 1, label: '待审核', cls: 'is-reviewing' },
  { value: 2, label: '已入库', cls: 'is-audited' },
  { value: 3, label: '废弃', cls: 'is-discarded' },
]

const AUDIT_FILTERS = [
  { label: '全部状态', value: undefined as number | undefined },
  ...AUDIT_META.map((item) => ({ label: item.label, value: item.value as number | undefined })),
]
const SOURCE_FILTERS = [
  { label: '全部来源', value: undefined as string | undefined },
  { label: '自动采集', value: 'recognition' },
  { label: '专家标注', value: 'expert' },
]
const SPLIT_FILTERS = [
  { label: '全部数据集', value: undefined as string | undefined },
  { label: 'train', value: 'train' },
  { label: 'val', value: 'val' },
  { label: 'test', value: 'test' },
]
const HARD_FILTERS = [
  { label: '全部样本', value: undefined as boolean | undefined },
  { label: '仅难样本', value: true },
  { label: '非难样本', value: false },
]

const loading = ref(false)
const exporting = ref(false)
const list = ref<DatasetSample[]>([])
const total = ref(0)
const selectedRows = ref<DatasetSample[]>([])
const herbNames = ref<Record<string, string>>({})
const query = reactive<{
  page: number
  pageSize: number
  auditStatus?: number
  source?: string
  split?: string
  isHardCase?: boolean
  herbId?: number
}>({ page: 1, pageSize: 10 })

const herbOptions = computed(() =>
  Object.entries(herbNames.value)
    .map(([id, name]) => ({ value: Number(id), label: name }))
    .sort((a, b) => a.label.localeCompare(b.label, 'zh')),
)

function auditMeta(status?: number) {
  return AUDIT_META.find((item) => item.value === status) || AUDIT_META[0]
}

function auditText(status?: number) {
  return auditMeta(status).label
}

function auditTagClass(status?: number) {
  return auditMeta(status).cls
}

function sourceText(source?: string) {
  if (source === 'recognition') return '自动采集'
  if (source === 'expert') return '专家标注'
  return source || '—'
}

function herbName(row: DatasetSample) {
  if (row.herbId == null) return '未定标'
  return herbNames.value[String(row.herbId)] || `#${row.herbId}`
}

function timeText(value?: string) {
  if (!value) return '-'
  return String(value).replace('T', ' ').slice(0, 16)
}

async function load() {
  loading.value = true
  try {
    const res = await getSamplePage({ ...query })
    list.value = res.list || []
    total.value = res.total || 0
  } finally {
    loading.value = false
  }
}

async function loadHerbNames() {
  try {
    const res = await getHerbPage({ page: 1, pageSize: 100 })
    const map: Record<string, string> = {}
    ;(res.list || []).forEach((herb) => {
      map[String(herb.id)] = herb.name
    })
    herbNames.value = map
  } catch {
    // 药材名只是展示用，失败不阻塞页面
  }
}

function onFilterChange() {
  query.page = 1
  load()
}

function onSelectionChange(rows: DatasetSample[]) {
  selectedRows.value = rows
}

/** 审核：入库(2) / 废弃(3) */
async function audit(rows: DatasetSample[], auditStatus: number) {
  if (!rows.length) return
  const label = auditStatus === 2 ? '入库' : '废弃'
  if (auditStatus === 3) {
    try {
      await ElMessageBox.confirm(`将 ${rows.length} 条样本标记为废弃？`, '确认', { type: 'warning' })
    } catch {
      return
    }
  }
  const items = rows
    .filter((row) => row.auditStatus !== auditStatus)
    .map((row) => ({ id: row.id, auditStatus }))
  if (!items.length) {
    ElMessage.info(`所选样本已是「${label}」状态`)
    return
  }
  await batchSaveSamples(items)
  ElMessage.success(`已${label} ${items.length} 条样本`)
  selectedRows.value = []
  await load()
}

/** 设置数据集划分（train / val / test） */
async function setSplit(rows: DatasetSample[], split: string) {
  if (!rows.length) return
  await batchSaveSamples(rows.map((row) => ({ id: row.id, split })))
  ElMessage.success(`已将 ${rows.length} 条样本设为 ${split}`)
  selectedRows.value = []
  await load()
}

function batchAudit(auditStatus: number) {
  audit(selectedRows.value, auditStatus)
}

/** 行内「划分」下拉：command 形如 "样本ID:train" */
function onRowSplitCommand(command: string | number | object) {
  const [id, split] = String(command).split(':')
  const row = list.value.find((item) => String(item.id) === id)
  if (row && split) {
    setSplit([row], split)
  }
}

/** 批量「设为数据集」下拉：command 即 train/val/test */
function onBatchSplitCommand(command: string | number | object) {
  const split = String(command)
  if (selectedRows.value.length) {
    setSplit(selectedRows.value, split)
  }
}

function csvCell(value: unknown) {
  const text = String(value ?? '')
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** 导出当前筛选的全部样本为 CSV（Excel / WPS 可直接打开） */
async function exportCsv() {
  exporting.value = true
  try {
    const pageSize = 100
    const rows: DatasetSample[] = []
    let page = 1
    let max = 0
    while (page <= 50) {
      const res = await getSamplePage({ ...query, page, pageSize })
      max = res.total || 0
      const part = res.list || []
      rows.push(...part)
      if (part.length < pageSize || rows.length >= max) break
      page += 1
    }
    if (!rows.length) {
      ElMessage.warning('当前筛选没有可导出的样本')
      return
    }
    const header = ['ID', '图片地址', '药材ID', '药材名称', '来源', '部位', '设备', '分辨率', '难样本', '标注状态', '数据集', '说明', '采集时间']
    const lines = [header.join(',')]
    for (const row of rows) {
      lines.push(
        [
          row.id,
          row.imageUrl || '',
          row.herbId ?? '',
          row.herbId != null ? herbNames.value[String(row.herbId)] || `#${row.herbId}` : '',
          sourceText(row.source),
          row.part || '',
          row.device || '',
          row.resolution || '',
          row.isHardCase ? '是' : '否',
          auditText(row.auditStatus),
          row.split || '',
          row.remark || '',
          (row.createdAt || '').replace('T', ' ').slice(0, 19),
        ]
          .map(csvCell)
          .join(','),
      )
    }
    const csv = '\uFEFF' + lines.join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
    link.href = url
    link.download = `数据集样本_${stamp}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    ElMessage.success(`已导出 ${rows.length} 条样本`)
  } finally {
    exporting.value = false
  }
}

async function refresh() {
  await Promise.all([loadHerbNames(), load()])
  ElMessage.success('已刷新')
}

onMounted(() => {
  loadHerbNames()
  load()
})
</script>

<template>
  <el-card shadow="never">
    <div class="head-row">
      <div class="head-main">
        <span class="title">数据集样本</span>
        <span class="sub">共 {{ total }} 条 · 勾选后可批量审核，或按筛选条件导出</span>
      </div>
      <div class="head-actions">
        <el-button :icon="Refresh" :loading="loading" @click="refresh">刷新</el-button>
        <el-button type="primary" :icon="Download" :loading="exporting" @click="exportCsv">导出表格</el-button>
      </div>
    </div>

    <div class="toolbar">
      <el-select v-model="query.auditStatus" size="small" style="width: 126px" @change="onFilterChange">
        <el-option v-for="item in AUDIT_FILTERS" :key="String(item.value)" :label="item.label" :value="item.value" />
      </el-select>
      <el-select v-model="query.source" size="small" style="width: 126px" @change="onFilterChange">
        <el-option v-for="item in SOURCE_FILTERS" :key="String(item.value)" :label="item.label" :value="item.value" />
      </el-select>
      <el-select v-model="query.split" size="small" style="width: 126px" @change="onFilterChange">
        <el-option v-for="item in SPLIT_FILTERS" :key="String(item.value)" :label="item.label" :value="item.value" />
      </el-select>
      <el-select v-model="query.isHardCase" size="small" style="width: 116px" @change="onFilterChange">
        <el-option v-for="item in HARD_FILTERS" :key="String(item.value)" :label="item.label" :value="item.value" />
      </el-select>
      <el-select
        v-model="query.herbId"
        size="small"
        style="width: 148px"
        placeholder="全部药材"
        filterable
        clearable
        @change="onFilterChange"
      >
        <el-option v-for="herb in herbOptions" :key="herb.value" :label="herb.label" :value="herb.value" />
      </el-select>
      <div class="toolbar-gap" />
      <el-button size="small" type="primary" :disabled="!selectedRows.length" @click="batchAudit(2)">批量入库</el-button>
      <el-button size="small" type="danger" plain :disabled="!selectedRows.length" @click="batchAudit(3)">批量废弃</el-button>
      <el-dropdown size="small" :disabled="!selectedRows.length" @command="onBatchSplitCommand">
        <el-button size="small" :disabled="!selectedRows.length">
          设为数据集<el-icon class="el-icon--right"><ArrowDown /></el-icon>
        </el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="train">train</el-dropdown-item>
            <el-dropdown-item command="val">val</el-dropdown-item>
            <el-dropdown-item command="test">test</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>

    <el-table v-loading="loading" :data="list" stripe @selection-change="onSelectionChange">
      <el-table-column type="selection" width="46" />
      <el-table-column label="图片" width="74">
        <template #default="{ row }">
          <el-image
            v-if="row.imageUrl"
            :src="mediaUrl(row.imageUrl)"
            fit="cover"
            class="table-img"
            :preview-src-list="[mediaUrl(row.imageUrl)]"
            preview-teleported
          />
        </template>
      </el-table-column>
      <el-table-column label="药材" width="108">
        <template #default="{ row }">{{ herbName(row) }}</template>
      </el-table-column>
      <el-table-column label="来源" width="98">
        <template #default="{ row }">
          <span class="tag-line" :class="row.source === 'recognition' ? 'is-auto' : 'is-expert'">
            {{ sourceText(row.source) }}
          </span>
        </template>
      </el-table-column>
      <el-table-column label="部位" width="92">
        <template #default="{ row }">{{ row.part || '—' }}</template>
      </el-table-column>
      <el-table-column label="设备" width="118">
        <template #default="{ row }">{{ row.device || '—' }}</template>
      </el-table-column>
      <el-table-column label="难样本" width="76">
        <template #default="{ row }">{{ row.isHardCase ? '是' : '否' }}</template>
      </el-table-column>
      <el-table-column label="说明" min-width="220">
        <template #default="{ row }"><span class="remark">{{ row.remark || '—' }}</span></template>
      </el-table-column>
      <el-table-column label="标注状态" width="96">
        <template #default="{ row }">
          <span class="audit-tag" :class="auditTagClass(row.auditStatus)">{{ auditText(row.auditStatus) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="数据集" width="80">
        <template #default="{ row }">{{ row.split || '—' }}</template>
      </el-table-column>
      <el-table-column label="创建时间" width="150">
        <template #default="{ row }">{{ timeText(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="158" fixed="right">
        <template #default="{ row }">
          <el-button size="small" type="primary" link :disabled="row.auditStatus === 2" @click="audit([row], 2)">
            入库
          </el-button>
          <el-button size="small" type="danger" link :disabled="row.auditStatus === 3" @click="audit([row], 3)">
            废弃
          </el-button>
          <el-dropdown size="small" @command="onRowSplitCommand">
            <el-button size="small" link type="primary">划分</el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item :command="row.id + ':train'">train</el-dropdown-item>
                <el-dropdown-item :command="row.id + ':val'">val</el-dropdown-item>
                <el-dropdown-item :command="row.id + ':test'">test</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </template>
      </el-table-column>
    </el-table>

    <el-empty v-if="!loading && !list.length" description="没有符合条件的样本" :image-size="72" />

    <el-pagination
      v-model:current-page="query.page"
      v-model:page-size="query.pageSize"
      class="pagination"
      layout="total, sizes, prev, pager, next"
      :page-sizes="[10, 20, 50, 100]"
      :total="total"
      @current-change="load"
      @size-change="onFilterChange"
    />
  </el-card>
</template>

<style scoped>
.head-row {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}
.head-main {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.title {
  font-size: 16px;
  font-weight: 700;
  color: #0f1a16;
}
.sub {
  font-size: 12px;
  color: #93a39a;
}
.head-actions {
  display: flex;
  gap: 8px;
}
.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.toolbar-gap {
  flex: 1;
}
.table-img {
  width: 44px;
  height: 44px;
  border-radius: 6px;
  border: 1px solid #e4eae6;
}
.remark {
  color: #5f7269;
  font-size: 12px;
}
.tag-line {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 5px;
  font-size: 11px;
}
.tag-line.is-auto {
  color: #b4700a;
  background: #fbf0dc;
  border: 1px solid #f0dcbe;
}
.tag-line.is-expert {
  color: #0c6b4f;
  background: #dff2ea;
  border: 1px solid #b9e4d4;
}
.audit-tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 5px;
  font-size: 11px;
  line-height: 1.5;
}
.audit-tag.is-waiting {
  color: #5f7269;
  background: #f2f5f3;
  border: 1px solid #e4eae6;
}
.audit-tag.is-reviewing {
  color: #b4700a;
  background: #fbf0dc;
  border: 1px solid #f0dcbe;
}
.audit-tag.is-audited {
  color: #0c6b4f;
  background: #dff2ea;
  border: 1px solid #b9e4d4;
}
.audit-tag.is-discarded {
  color: #b03025;
  background: #fbeceb;
  border: 1px solid #f5cec8;
}
.pagination {
  margin-top: 16px;
  justify-content: flex-end;
}
</style>
