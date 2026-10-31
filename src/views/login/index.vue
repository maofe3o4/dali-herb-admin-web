<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { Lock, User } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const formRef = ref<FormInstance>()
const loading = ref(false)
const form = reactive({
  username: 'admin',
  password: 'admin123',
})

const rules: FormRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
}

async function handleLogin() {
  await formRef.value?.validate()
  loading.value = true
  try {
    await auth.login(form)
    ElMessage.success('登录成功')
    const redirect = (route.query.redirect as string) || '/dashboard'
    router.push(redirect)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-panel">
      <div class="login-brand">
        <div class="brand-title">大理中药材管理后台</div>
        <div class="brand-subtitle">Dali Herb Admin</div>
      </div>
      <el-form ref="formRef" :model="form" :rules="rules" size="large" @keyup.enter="handleLogin">
        <el-form-item prop="username">
          <el-input v-model="form.username" placeholder="用户名" :prefix-icon="User" />
        </el-form-item>
        <el-form-item prop="password">
          <el-input
            v-model="form.password"
            type="password"
            show-password
            placeholder="密码"
            :prefix-icon="Lock"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" class="login-button" :loading="loading" @click="handleLogin">
            登录
          </el-button>
        </el-form-item>
      </el-form>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background:
    radial-gradient(circle at 20% 20%, rgba(31, 110, 78, 0.16), transparent 40%),
    linear-gradient(135deg, #f5f7f5 0%, #dcebe1 100%);
}
.login-panel {
  width: 380px;
  padding: 40px 36px 24px;
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 18px 50px rgba(16, 40, 30, 0.14);
}
.login-brand {
  margin-bottom: 28px;
  text-align: center;
}
.brand-title {
  font-size: 22px;
  font-weight: 700;
  color: #1f6e4e;
}
.brand-subtitle {
  margin-top: 6px;
  color: #8a9a90;
  letter-spacing: 2px;
}
.login-button {
  width: 100%;
}
</style>