<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import Sidebar from './components/Sidebar.vue'
import HeaderBar from './components/HeaderBar.vue'

const auth = useAuthStore()

/** 侧边栏收起状态，记住用户选择（刷新后保持） */
const COLLAPSE_KEY = 'dh_admin_sidebar_collapsed'
const collapsed = ref(localStorage.getItem(COLLAPSE_KEY) === '1')

watch(collapsed, (value) => {
  localStorage.setItem(COLLAPSE_KEY, value ? '1' : '0')
})

function toggleSidebar() {
  collapsed.value = !collapsed.value
}

onMounted(() => {
  if (auth.token && !auth.adminInfo) {
    auth.fetchMe().catch(() => {})
  }
})
</script>

<template>
  <!-- 整页固定高度、不产生文档级滚动：只有右侧内容区滚动，左侧始终停在原位 -->
  <el-container class="layout">
    <el-aside :width="collapsed ? '64px' : '220px'" class="layout-aside">
      <Sidebar :collapsed="collapsed" @toggle="toggleSidebar" />
    </el-aside>
    <el-container class="layout-body">
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
  height: 100vh;
  overflow: hidden;
}
.layout-aside {
  height: 100vh;
  background: #10281e;
  color: #fff;
  overflow: hidden;
  transition: width 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
.layout-body {
  height: 100vh;
  min-width: 0;
  overflow: hidden;
}
.layout-header {
  flex: 0 0 60px;
  height: 60px;
  padding: 0 20px;
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
}
.layout-main {
  flex: 1;
  min-height: 0;
  padding: 18px;
  background: #f5f7f5;
  overflow-y: auto;
}
</style>
