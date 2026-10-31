<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowDown } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

async function handleLogout() {
  await ElMessageBox.confirm('确定退出登录吗？', '提示', { type: 'warning' })
  auth.logout()
  ElMessage.success('已退出登录')
  router.push('/login')
}
</script>

<template>
  <div class="header-bar">
    <div class="header-title">{{ route.meta.title || '后台管理' }}</div>
    <el-dropdown>
      <span class="header-user">
        {{ auth.adminInfo?.realName || auth.adminInfo?.username || '管理员' }}
        <el-icon><ArrowDown /></el-icon>
      </span>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item @click="handleLogout">退出登录</el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </div>
</template>

<style scoped>
.header-bar {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.header-title {
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
}
.header-user {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  color: #374151;
}
</style>