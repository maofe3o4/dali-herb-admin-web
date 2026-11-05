<script setup lang="ts">
import { useRoute } from 'vue-router'
import {
  CameraFilled,
  ChatDotRound,
  Collection,
  Cpu,
  DataLine,
  Document,
  Expand,
  Fold,
  Grid,
  Picture,
} from '@element-plus/icons-vue'

const { collapsed } = defineProps<{ collapsed: boolean }>()
const emit = defineEmits<{ toggle: [] }>()

const route = useRoute()

const menus = [
  { path: '/dashboard', title: '数据看板', icon: DataLine },
  { path: '/herbs', title: '中草药管理', icon: Collection },
  { path: '/categories', title: '分类管理', icon: Grid },
  { path: '/records', title: '识别记录', icon: CameraFilled },
  { path: '/feedback', title: '反馈工单', icon: ChatDotRound },
  { path: '/models', title: '模型版本', icon: Cpu },
  { path: '/samples', title: '数据集样本', icon: Picture },
  { path: '/logs', title: '操作日志', icon: Document },
]
</script>

<template>
  <div class="sidebar">
    <div class="sidebar-logo" :class="{ 'is-collapsed': collapsed }">
      <span class="logo-mark">大</span>
      <span v-if="!collapsed" class="logo-text">大理中药材</span>
    </div>

    <el-menu
      :default-active="route.path"
      :collapse="collapsed"
      :collapse-transition="false"
      router
      background-color="#10281e"
      text-color="#b8c9bf"
      active-text-color="#ffffff"
      class="sidebar-menu"
    >
      <el-menu-item v-for="menu in menus" :key="menu.path" :index="menu.path">
        <el-icon><component :is="menu.icon" /></el-icon>
        <template #title>{{ menu.title }}</template>
      </el-menu-item>
    </el-menu>

    <!-- 收起 / 展开：固定在侧边栏底部，状态记忆在 localStorage -->
    <div class="sidebar-switch" :class="{ 'is-collapsed': collapsed }" @click="emit('toggle')">
      <el-icon :size="18">
        <Expand v-if="collapsed" />
        <Fold v-else />
      </el-icon>
      <span v-if="!collapsed">收起菜单</span>
    </div>
  </div>
</template>

<style scoped>
.sidebar {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #10281e;
}
.sidebar-logo {
  flex: 0 0 60px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 20px;
  color: #fff;
  font-size: 17px;
  font-weight: 600;
  letter-spacing: 1px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  white-space: nowrap;
  overflow: hidden;
}
.sidebar-logo.is-collapsed {
  padding: 0;
  justify-content: center;
}
.logo-mark {
  display: none;
}
.sidebar-logo.is-collapsed .logo-mark {
  display: inline;
  font-size: 19px;
  letter-spacing: 0;
}
.sidebar-menu {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  border-right: none;
}
.sidebar-menu :deep(.el-menu-item.is-active) {
  background: #0c6b4f;
}
.sidebar-switch {
  flex: 0 0 48px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 20px;
  color: #b8c9bf;
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
  user-select: none;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  transition: color 0.15s ease, background 0.15s ease;
}
.sidebar-switch:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.05);
}
.sidebar-switch.is-collapsed {
  padding: 0;
  justify-content: center;
}
</style>
