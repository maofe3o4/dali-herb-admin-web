<script setup lang="ts">
import { useRoute } from 'vue-router'
import {
  CameraFilled,
  ChatDotRound,
  Collection,
  Cpu,
  DataLine,
  Document,
  Grid,
  Picture,
} from '@element-plus/icons-vue'

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
  <div class="sidebar-logo">大理中药材</div>
  <el-menu
    :default-active="route.path"
    router
    background-color="#10281e"
    text-color="#b8c9bf"
    active-text-color="#ffffff"
    class="sidebar-menu"
  >
    <el-menu-item v-for="menu in menus" :key="menu.path" :index="menu.path">
      <el-icon><component :is="menu.icon" /></el-icon>
      <span>{{ menu.title }}</span>
    </el-menu-item>
  </el-menu>
</template>

<style scoped>
.sidebar-logo {
  height: 60px;
  line-height: 60px;
  padding-left: 20px;
  color: #fff;
  font-size: 17px;
  font-weight: 600;
  letter-spacing: 1px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.sidebar-menu {
  border-right: none;
}
.sidebar-menu :deep(.el-menu-item.is-active) {
  background: #1f6e4e;
}
</style>