<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { Delete, Plus } from '@element-plus/icons-vue'
import { getCategories, type Category } from '@/api/category'
import { getHerbDetail, getHerbPage, saveHerb, updateHerb, type Herb, type Lookalike } from '@/api/herb'
import { uploadFile } from '@/api/upload'
import { mediaUrl } from '@/utils/media'

const props = defineProps<{
  modelValue: boolean
  herb?: Herb | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  saved: []
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

const isEdit = computed(() => !!props.herb?.id)
const formRef = ref<FormInstance>()
const submitting = ref(false)
const uploadLoading = ref(false)

const efficacyOptions = ref<Category[]>([])
const familyOptions = ref<Category[]>([])
const partOptions = ref<Category[]>([])
/** 易混淆药材的可选列表（库里 30 味，一次拉全量即可，无需远程搜索） */
const lookalikeOptions = ref<Herb[]>([])

function defaultForm(): Record<string, any> {
  return {
    name: '',
    alias: '',
    baiName: '',
    latinName: '',
    family: '',
    familyId: undefined,
    genus: '',
    species: '',
    part: '',
    partId: undefined,
    efficacyCategoryId: undefined,
    efficacyCategoryIds: [] as number[],
    nature: '',
    flavor: '',
    meridian: '',
    toxicity: '',
    contraindication: '',
    usageDosage: '',
    efficacy: '',
    brief: '',
    traits: '',
    identification: '',
    collectionProcess: '',
    habitat: '',
    altitudeMin: undefined,
    altitudeMax: undefined,
    dataSource: '',
    coverImageUrl: '',
    isDaodi: false,
    isEthnic: false,
    isHot: false,
    emoji: '',
    coverColor: '#E8F3EC',
    status: 0,
    sortOrder: 99,
    regionsText: '',
    lookalikes: [] as Lookalike[],
  }
}

const form = reactive<Record<string, any>>(defaultForm())

const rules: FormRules = {
  name: [{ required: true, message: '请输入药材名称', trigger: 'blur' }],
  latinName: [{ required: true, message: '请输入拉丁学名', trigger: 'blur' }],
  part: [{ required: true, message: '请输入药用部位', trigger: 'blur' }],
  brief: [{ required: true, message: '请输入一句话简介', trigger: 'blur' }],
  efficacyCategoryIds: [
    {
      validator: (_rule, value, callback) => {
        if (!value || value.length === 0) {
          callback(new Error('请至少选择一个功效分类'))
        } else {
          callback()
        }
      },
      trigger: 'change',
    },
  ],
}

function parseRegions(value?: string): string[] {
  if (!value) return []
  return value
    .split(/[、,，;；|]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function loadForm() {
  Object.assign(form, defaultForm(), props.herb || {})
  // 【契约修复】主题色在两端字段名不同：
  //   响应（后端 HerbVO）→ color
  //   请求（后端 HerbSaveRequest）→ coverColor
  // 只做 Object.assign 的话 props.herb.color 会落到 form.color，而模板绑定的是 form.coverColor，
  // 于是编辑任意药材都会显示并回写默认色 #E8F3EC，把库里的主题色覆盖掉。这里显式做一次映射。
  form.coverColor = props.herb?.color || defaultForm().coverColor
  form.regionsText = (props.herb?.regions || []).join('、')
  const ids = props.herb?.efficacyCategoryIds?.length
    ? props.herb.efficacyCategoryIds
    : props.herb?.efficacyCategoryId
      ? [Number(props.herb.efficacyCategoryId)]
      : []
  form.efficacyCategoryIds = ids
  form.lookalikes = []
  // 易混淆关系只有详情接口返回，列表行里没有，编辑时必须单独取一次
  if (props.herb?.id) {
    getHerbDetail(props.herb.id)
      .then((detail) => {
        form.lookalikes = (detail?.lookalikes || []).map((lk: Lookalike) => ({
          lookalikeHerbId: lk.lookalikeHerbId ?? Number(lk.id),
          difference: lk.difference || '',
          riskLevel: lk.riskLevel ?? 0,
        }))
      })
      .catch(() => {
        // 取不到详情不阻塞编辑主体，只是易混淆分区为空
      })
  }
}

function addLookalike() {
  form.lookalikes.push({ lookalikeHerbId: undefined, difference: '', riskLevel: 0 })
}

function removeLookalike(index: number | string) {
  form.lookalikes.splice(Number(index), 1)
}

/** 可选药材：排除自己，避免把药材列为自己的易混淆项（后端也会拦） */
function availableLookalikes(currentIndex: number | string) {
  const selfIndex = Number(currentIndex)
  const selfId = props.herb?.id ? Number(props.herb.id) : undefined
  const chosen = form.lookalikes
    .map((item: Lookalike, i: number) => (i === selfIndex ? undefined : item.lookalikeHerbId))
    .filter(Boolean)
  return lookalikeOptions.value.filter(
    (h) => Number(h.id) !== selfId && !chosen.includes(Number(h.id)),
  )
}

async function loadOptions() {
  const [efficacy, family, part] = await Promise.all([
    getCategories('efficacy'),
    getCategories('family'),
    getCategories('part'),
  ])
  efficacyOptions.value = efficacy
  familyOptions.value = family
  partOptions.value = part
  // 易混淆候选项：一次拉全量即可（库内 30 味），后台需要能把非已发布状态的药材也设为对比项
  try {
    const page = await getHerbPage({ page: 1, pageSize: 500 })
    lookalikeOptions.value = page.list || []
  } catch (error) {
    lookalikeOptions.value = []
  }
}

async function handleUpload(options: any) {
  uploadLoading.value = true
  try {
    const result = await uploadFile(options.file as File, 'herb')
    form.coverImageUrl = result.url
    ElMessage.success('图片上传成功')
    options.onSuccess?.(result)
  } catch (error) {
    options.onError?.(error)
  } finally {
    uploadLoading.value = false
  }
}

async function handleSubmit() {
  await formRef.value?.validate()
  submitting.value = true
  try {
    const payload: Record<string, any> = { ...form }
    payload.regions = parseRegions(payload.regionsText)
    delete payload.regionsText

    const numberFields = ['efficacyCategoryId', 'familyId', 'partId', 'altitudeMin', 'altitudeMax', 'sortOrder', 'status']
    numberFields.forEach((key) => {
      if (payload[key] !== undefined && payload[key] !== null && payload[key] !== '') {
        payload[key] = Number(payload[key])
      }
    })

      payload.efficacyCategoryIds = (payload.efficacyCategoryIds || []).map((id: number | string) => Number(id))
      payload.efficacyCategoryId = payload.efficacyCategoryIds[0] ?? null

    // 易混淆关系：丢掉没选药材的空行，数值字段显式转成数字。
    // 后端是全量替换语义，所以这里提交什么就是最终结果。
    payload.lookalikes = (payload.lookalikes || [])
      .filter((item: Lookalike) => item.lookalikeHerbId)
      .map((item: Lookalike) => ({
        lookalikeHerbId: Number(item.lookalikeHerbId),
        difference: (item.difference || '').trim(),
        riskLevel: Number(item.riskLevel) || 0,
      }))

    if (isEdit.value && props.herb?.id) {
      await updateHerb(props.herb.id, payload)
    } else {
      await saveHerb(payload)
    }
    ElMessage.success('保存成功')
    visible.value = false
    emit('saved')
  } finally {
    submitting.value = false
  }
}

watch(
  () => props.modelValue,
  (value) => {
    if (value) {
      loadForm()
    }
  },
)

onMounted(loadOptions)
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="isEdit ? '编辑中草药' : '新增中草药'"
    width="820px"
    top="5vh"
    destroy-on-close
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
      <el-divider content-position="left">基本信息</el-divider>
      <el-row :gutter="16">
        <el-col :span="8">
          <el-form-item label="名称" prop="name">
            <el-input v-model="form.name" placeholder="如：滇重楼" />
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="别名">
            <el-input v-model="form.alias" placeholder="多个用、分隔" />
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="白族药名">
            <el-input v-model="form.baiName" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="拉丁学名">
            <el-input v-model="form.latinName" placeholder="Paris polyphylla var. yunnanensis" />
          </el-form-item>
        </el-col>
        <el-col :span="6">
          <el-form-item label="科">
            <el-input v-model="form.family" placeholder="百合科" />
          </el-form-item>
        </el-col>
        <el-col :span="6">
          <el-form-item label="属">
            <el-input v-model="form.genus" placeholder="重楼属" />
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="种">
            <el-input v-model="form.species" />
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="药用部位">
            <el-input v-model="form.part" placeholder="根及根茎" />
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="功效分类">
            <el-select v-model="form.efficacyCategoryIds" multiple clearable filterable collapse-tags collapse-tags-tooltip placeholder="请选择">
              <el-option v-for="item in efficacyOptions" :key="item.id" :label="item.name" :value="Number(item.id)" />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="科属分类">
            <el-select v-model="form.familyId" clearable filterable placeholder="请选择">
              <el-option v-for="item in familyOptions" :key="item.id" :label="item.name" :value="Number(item.id)" />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="部位分类">
            <el-select v-model="form.partId" clearable filterable placeholder="请选择">
              <el-option v-for="item in partOptions" :key="item.id" :label="item.name" :value="Number(item.id)" />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="24">
          <el-form-item label="封面图">
            <el-upload
              class="cover-uploader"
              :show-file-list="false"
              :http-request="handleUpload"
              accept="image/*"
            >
              <img v-if="form.coverImageUrl" :src="mediaUrl(form.coverImageUrl)" class="cover-image" alt="封面图" />
              <el-icon v-else class="cover-uploader-icon"><Plus /></el-icon>
            </el-upload>
          </el-form-item>
        </el-col>
      </el-row>

      <el-divider content-position="left">性味功效</el-divider>
      <el-row :gutter="16">
        <el-col :span="6"><el-form-item label="性"><el-input v-model="form.nature" placeholder="微寒" /></el-form-item></el-col>
        <el-col :span="6"><el-form-item label="味"><el-input v-model="form.flavor" placeholder="苦" /></el-form-item></el-col>
        <el-col :span="6"><el-form-item label="归经"><el-input v-model="form.meridian" placeholder="肝经" /></el-form-item></el-col>
        <el-col :span="6"><el-form-item label="毒性"><el-input v-model="form.toxicity" placeholder="有小毒" /></el-form-item></el-col>
        <el-col :span="24">
          <el-form-item label="一句话简介">
            <el-input v-model="form.brief" maxlength="80" show-word-limit placeholder="40字最佳" />
          </el-form-item>
        </el-col>
        <el-col :span="24">
          <el-form-item label="功效主治">
            <el-input v-model="form.efficacy" type="textarea" :rows="2" />
          </el-form-item>
        </el-col>
      </el-row>

      <el-divider content-position="left">鉴别与产地</el-divider>
      <el-row :gutter="16">
        <el-col :span="12"><el-form-item label="性状"><el-input v-model="form.traits" type="textarea" :rows="2" /></el-form-item></el-col>
        <el-col :span="12"><el-form-item label="鉴别要点"><el-input v-model="form.identification" type="textarea" :rows="2" /></el-form-item></el-col>
        <el-col :span="12"><el-form-item label="采收加工"><el-input v-model="form.collectionProcess" type="textarea" :rows="2" /></el-form-item></el-col>
        <el-col :span="12"><el-form-item label="生境"><el-input v-model="form.habitat" /></el-form-item></el-col>
        <el-col :span="6"><el-form-item label="最低海拔"><el-input-number v-model="form.altitudeMin" :min="0" controls-position="right" /></el-form-item></el-col>
        <el-col :span="6"><el-form-item label="最高海拔"><el-input-number v-model="form.altitudeMax" :min="0" controls-position="right" /></el-form-item></el-col>
        <el-col :span="12"><el-form-item label="大理产地"><el-input v-model="form.regionsText" placeholder="苍山、漾濞县、云龙县" /></el-form-item></el-col>
        <el-col :span="12"><el-form-item label="禁忌"><el-input v-model="form.contraindication" type="textarea" :rows="2" /></el-form-item></el-col>
        <el-col :span="12"><el-form-item label="用法用量"><el-input v-model="form.usageDosage" type="textarea" :rows="2" /></el-form-item></el-col>
        <el-col :span="24"><el-form-item label="数据来源"><el-input v-model="form.dataSource" /></el-form-item></el-col>
      </el-row>

      <el-divider content-position="left">易混淆药材</el-divider>
      <el-row :gutter="16">
        <el-col :span="24">
          <div v-for="(item, index) in form.lookalikes" :key="index" class="lk-row">
            <el-select
              v-model="item.lookalikeHerbId"
              filterable
              clearable
              placeholder="选择易混淆药材"
              style="width: 190px"
            >
              <el-option
                v-for="h in availableLookalikes(index)"
                :key="h.id"
                :label="h.name"
                :value="Number(h.id)"
              />
            </el-select>
            <el-input v-model="item.difference" placeholder="关键差异（一句话）" />
            <el-input-number
              v-model="item.riskLevel"
              :min="0"
              :max="9"
              controls-position="right"
              style="width: 120px"
            />
            <el-button link type="danger" :icon="Delete" @click="removeLookalike(index)">删除</el-button>
          </div>
          <el-button link type="primary" :icon="Plus" @click="addLookalike">添加易混淆药材</el-button>
          <div class="lk-tip">
            关键差异会直接展示在小程序「易混淆药材」与识别结果页的「易混淆提示」中；风险等级越大排序越靠前。
          </div>
        </el-col>
      </el-row>

      <el-divider content-position="left">展示与状态</el-divider>
      <el-row :gutter="16">
        <el-col :span="6"><el-form-item label="图标"><el-input v-model="form.emoji" /></el-form-item></el-col>
        <el-col :span="6"><el-form-item label="主题色"><el-input v-model="form.coverColor" /></el-form-item></el-col>
        <el-col :span="6"><el-form-item label="排序"><el-input-number v-model="form.sortOrder" :min="0" controls-position="right" /></el-form-item></el-col>
        <el-col :span="6">
          <el-form-item label="状态">
            <el-select v-model="form.status">
              <el-option label="草稿" :value="0" />
              <el-option label="待审核" :value="1" />
              <el-option label="已发布" :value="2" />
              <el-option label="已下架" :value="3" />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="8"><el-form-item label="道地药材"><el-switch v-model="form.isDaodi" /></el-form-item></el-col>
        <el-col :span="8"><el-form-item label="民族药"><el-switch v-model="form.isEthnic" /></el-form-item></el-col>
        <el-col :span="8"><el-form-item label="首页热门"><el-switch v-model="form.isHot" /></el-form-item></el-col>
      </el-row>
    </el-form>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">保存</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.cover-uploader :deep(.el-upload) {
  width: 96px;
  height: 96px;
  border: 1px dashed #c0c4cc;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  overflow: hidden;
  background: #fafafa;
}
.cover-uploader :deep(.el-upload:hover) {
  border-color: #1f6e4e;
}
.cover-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.cover-uploader-icon {
  font-size: 22px;
  color: #8a9a90;
}
.lk-row {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
}
.lk-row .el-input {
  flex: 1;
}
.lk-tip {
  font-size: 12px;
  color: #8a9a90;
  line-height: 1.6;
  margin-top: 4px;
}
</style>