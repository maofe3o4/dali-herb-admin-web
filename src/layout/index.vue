<script setup lang="ts">
import { onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import Sidebar from './components/Sidebar.vue'
import HeaderBar from './components/HeaderBar.vue'

const auth = useAuthStore()

onMounted(() => {
  if (auth.token && !auth.adminInfo) {
    auth.fetchMe().catch(() => {})
  }
})
</script>

<template>
  <el-container class="layout">
    <el-aside width="220px" class="layout-aside">
      <Sidebar />
    </el-aside>
    <el-container>
      <el-header class="layout-header">
        <HeaderBar />
      </el-header>
      <el-main class="layout-main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<style scoped>
.layout {
  min-height: 100vh;
}
.layout-aside {
  background: #10281e;
  color: #fff;
}
.layout-header {
  height: 60px;
  padding: 0 20px;
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
}
.layout-main {
  padding: 18px;
  background: #f5f7f5;
}
</style>