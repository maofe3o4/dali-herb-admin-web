import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { adminLogin, getAdminInfo, type AdminInfo, type LoginForm } from '@/api/auth'

const TOKEN_KEY = 'dali_herb_admin_token'

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem(TOKEN_KEY) || '')
  const adminInfo = ref<AdminInfo | null>(null)
  const isLoggedIn = computed(() => !!token.value)

  async function login(form: LoginForm) {
    const res = await adminLogin(form)
    token.value = res.token
    localStorage.setItem(TOKEN_KEY, res.token)
    await fetchMe()
  }

  async function fetchMe() {
    if (!token.value) return
    adminInfo.value = await getAdminInfo()
  }

  function logout() {
    token.value = ''
    adminInfo.value = null
    localStorage.removeItem(TOKEN_KEY)
  }

  return { token, adminInfo, isLoggedIn, login, fetchMe, logout }
})