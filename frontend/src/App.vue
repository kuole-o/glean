<template>
  <!-- ===== Loading while checking auth ===== -->
  <div v-if="checkingAuth" class="loading-screen">
    <div class="loading-card">
      <div class="loading-spinner"></div>
      <p class="loading-text">加载中…</p>
    </div>
  </div>
  
  <template v-if="!checkingAuth">

  <!-- ===== UNLOGGED: Header + Login Screen + Footer ===== -->
  <template v-if="!loggedIn">
    <header class="header">
      <div class="header-inner">
        <div class="logo-wrap">
          <a :href="repoUrl" target="_blank" rel="noopener" class="logo-link" style="text-decoration:none">
            <h1 class="logo">📖 <span class="logo-text">拾句</span><span class="logo-sub">Glean</span></h1>
          </a>
          <span class="logo-desc">拾取散落的好句</span>
        </div>
      </div>
    </header>

    <div class="login-screen">
      <div class="login-card">
        <div class="login-emoji-logo">
          <span class="login-emoji">📖</span>
          <span class="login-brand">拾句</span>
          <span class="login-brand-sub">Glean</span>
        </div>
        <p class="login-subtitle">登录以管理句子</p>
        <form @submit.prevent="doLogin">
          <div class="login-field">
            <input v-model="loginForm.username" type="text" placeholder="用户名" autocomplete="off">
          </div>
          <div class="login-field">
            <input v-model="loginForm.password" type="password" placeholder="密码" autocomplete="off" ref="pwInput">
          </div>
          <div class="login-error">{{ loginError }}</div>
          <button type="submit" class="btn btn-primary btn-full" :disabled="loggingIn">
            {{ loggingIn ? '登录中…' : '登 录' }}
          </button>
        </form>
      </div>
    </div>

    <AppFooter :site-info="siteInfo" />
  </template>

  <!-- ===== LOGGED IN: Admin Dashboard ===== -->
  <template v-else>
    <header class="header">
      <div class="header-inner">
        <div class="logo-wrap">
          <a :href="repoUrl" target="_blank" rel="noopener" class="logo-link" style="text-decoration:none">
            <h1 class="logo">📖 <span class="logo-text">拾句</span><span class="logo-sub">Glean</span></h1>
          </a>
        </div>
        <div class="header-right">
          <span class="stats-badge">{{ statsText }}</span>
          <span class="stats-badge cache-badge">{{ cacheText }}</span>
          <!-- User Dropdown -->
          <div class="user-dropdown" :class="{ open: dropdownOpen }" @click.stop="dropdownOpen = !dropdownOpen" @mouseenter="clearTimeout(hoverTimeout); dropdownOpen = true" @mouseleave="hoverTimeout = setTimeout(() => { dropdownOpen = false }, 200)">
            <div class="user-trigger">
              <span class="user-avatar">{{ username.charAt(0).toUpperCase() }}</span>
              <span>{{ username }}</span>
              <span style="font-size:10px;opacity:0.6">▾</span>
            </div>
            <div class="user-dropdown-menu">
              <button class="user-dropdown-item danger" @click="doLogout">退出登录</button>
            </div>
          </div>
        </div>
      </div>
    </header>

    <main class="main">
      <!-- Toolbar: search + filter + add button (all in one row) -->
      <div class="toolbar">
        <div class="toolbar-left">
          <div class="search-box">
            <input v-model="searchQuery" placeholder="搜索句子内容、出处或作者…" @input="debouncedSearch">
          </div>
          <div class="filter-box">
            <select v-model="typeFilter" @change="loadSentences(1)">
              <option value="">全部分类</option>
              <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
            </select>
          </div>
        </div>
        <div class="toolbar-add">
          <button class="btn btn-primary" @click="openAddModal">＋ 新增句子</button>
        </div>
      </div>

      <!-- Table -->
      <div class="table-wrap">
        <table class="sentence-table" ref="sentenceTable">
          <thead>
            <tr>
              <th class="col-id" data-col="id"><span class="th-content">#</span><div class="th-resizer" @mousedown.prevent="startResize($event, 'col-id')"></div></th>
              <th class="col-content" data-col="content"><span class="th-content">句子</span><div class="th-resizer" @mousedown.prevent="startResize($event, 'col-content')"></div></th>
              <th class="col-type" data-col="type"><span class="th-content">分类</span><div class="th-resizer" @mousedown.prevent="startResize($event, 'col-type')"></div></th>
              <th class="col-source" data-col="source"><span class="th-content">出处</span><div class="th-resizer" @mousedown.prevent="startResize($event, 'col-source')"></div></th>
              <th class="col-who" data-col="who"><span class="th-content">作者</span><div class="th-resizer" @mousedown.prevent="startResize($event, 'col-who')"></div></th>
              <th class="col-time" data-col="time"><span class="th-content">创建时间</span><div class="th-resizer" @mousedown.prevent="startResize($event, 'col-time')"></div></th>
              <th class="col-actions" data-col="actions"><span class="th-content">操作</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading"><td colspan="7" class="loading-cell">加载中…</td></tr>
            <tr v-else-if="sentences.length === 0"><td colspan="7" class="loading-cell">暂无数据，点击右上角"新增句子"添加第一条</td></tr>
            <tr v-for="s in sentences" :key="s.id">
              <td class="col-id">{{ s.id }}</td>
              <td class="col-content">
                <span class="sentence-text" :title="s.content">{{ s.content }}</span>
              </td>
              <td class="col-type">
                <span class="type-tag" :style="tagStyle(s.type)">{{ s.type }}</span>
              </td>
              <td class="col-source">{{ s.from_source || '-' }}</td>
              <td class="col-who">{{ s.from_who || '-' }}</td>
              <td class="col-time">{{ s.created_at }}</td>
              <td class="col-actions">
                <div class="action-btns">
                  <button class="btn btn-secondary btn-sm" @click="openEditModal(s)">编辑</button>
                  <button class="btn btn-danger btn-sm" @click="openDeleteModal(s)">删除</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div class="pagination" v-if="totalPages > 1">
        <span class="page-info">共 {{ total }} 条记录</span>
        <button class="page-btn" :disabled="currentPage <= 1" @click="loadSentences(1)">&laquo;</button>
        <button class="page-btn" :disabled="currentPage <= 1" @click="loadSentences(currentPage - 1)">&lsaquo;</button>
        <button
          v-for="p in pageRange"
          :key="p"
          class="page-btn"
          :class="{ active: p === currentPage }"
          @click="loadSentences(p)"
        >{{ p }}</button>
        <button class="page-btn" :disabled="currentPage >= totalPages" @click="loadSentences(currentPage + 1)">&rsaquo;</button>
        <button class="page-btn" :disabled="currentPage >= totalPages" @click="loadSentences(totalPages)">&raquo;</button>
      </div>
      <div class="pagination" v-else-if="total > 0">
        <span class="page-info">共 {{ total }} 条记录</span>
      </div>
    </main>

    <AppFooter :site-info="siteInfo" />

    <!-- ===== Modals ===== -->
    <!-- Add / Edit Modal -->
    <div class="modal-overlay" :class="{ active: showEditModal }" @click.self="closeEditModal">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h2>{{ editingId ? '编辑句子' : '新增句子' }}</h2>
          <button class="modal-close" @click="closeEditModal">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>句子正文 <span class="required">*</span></label>
            <textarea v-model="editForm.content" rows="3" placeholder="一句值得被记住的话…"></textarea>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>分类</label>
              <select v-model="editForm.type">
                <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
              </select>
            </div>
            <div class="form-group">
              <label>出处</label>
              <input v-model="editForm.from_source" type="text" placeholder="作品、文章或来源">
            </div>
          </div>
          <div class="form-group">
            <label>作者</label>
            <input v-model="editForm.from_who" type="text" placeholder="原作者或引用者">
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="closeEditModal">取消</button>
          <button class="btn btn-primary" @click="saveSentence" :disabled="saving">
            {{ saving ? '保存中…' : '保存' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Delete Modal -->
    <div class="modal-overlay" :class="{ active: showDeleteModal }" @click.self="closeDeleteModal">
      <div class="modal modal-sm" @click.stop>
        <div class="modal-header">
          <h2>确认删除</h2>
          <button class="modal-close" @click="closeDeleteModal">&times;</button>
        </div>
        <div class="modal-body">
          <p>确定要删除以下句子吗？此操作不可撤销。</p>
          <blockquote>{{ deleteTarget?.content }}</blockquote>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="closeDeleteModal">取消</button>
          <button class="btn btn-danger" @click="confirmDelete" :disabled="deleting">
            {{ deleting ? '删除中…' : '确认删除' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Toast -->
    <div class="toast" :class="'show ' + toastType" :style="{ opacity: toastVisible ? 1 : 0 }">
      {{ toastMsg }}
    </div>
  </template>
  </template>
</template>

<script>
import { ref, reactive, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import * as api from './api.js'
import AppFooter from './components/AppFooter.vue'

export default {
  name: 'App',
  components: { AppFooter },
  setup() {
    // ---- Auth State ----
    const loggedIn = ref(false)
    const checkingAuth = ref(true)

    const username = ref('')
    const loggingIn = ref(false)
    const loginForm = reactive({ username: '', password: '' })
    const loginError = ref('')
    const dropdownOpen = ref(false)
    const hoverTimeout = ref(null)

    // ---- Data State ----
    const sentences = ref([])
    const loading = ref(false)
    const currentPage = ref(1)
    const totalPages = ref(1)
    const total = ref(0)
    const searchQuery = ref('')
    const typeFilter = ref('')
    const categories = ref([])
    const statsText = ref('')
    const cacheText = ref("")
    const siteInfo = ref({})

    // ---- Modal State ----
    const showEditModal = ref(false)
    const editingId = ref(null)
    const editForm = reactive({ content: '', type: '', from_source: '', from_who: '' })
    const saving = ref(false)
    const showDeleteModal = ref(false)
    const deleteTarget = ref(null)
    const deleting = ref(false)

    // ---- Toast ----
    const toastMsg = ref('')
    const toastType = ref('success')
    const toastVisible = ref(false)
    let toastTimer = null

    // ---- Column Resize ----
    let resizeData = null

    function showToast(msg, type = 'success') {
      toastMsg.value = msg
      toastType.value = type
      toastVisible.value = true
      clearTimeout(toastTimer)
      toastTimer = setTimeout(() => { toastVisible.value = false }, 2500)
    }

    // ---- Computed ----
    const repoUrl = 'https://github.com/kuole-o/glean'

    const pageRange = computed(() => {
      const p = currentPage.value
      const tp = totalPages.value
      const start = Math.max(1, p - 2)
      const end = Math.min(tp, p + 2)
      const arr = []
      for (let i = start; i <= end; i++) arr.push(i)
      return arr
    })

    // ---- Auth ----
    async function doLogin() {
      if (!loginForm.username || !loginForm.password) {
        loginError.value = '请输入用户名和密码'
        return
      }
      loginError.value = ''
      loggingIn.value = true
      try {
        const j = await api.login(loginForm.username, loginForm.password)
        if (j.code === 200) {
          api.setToken(j.data.token)
          username.value = j.data.username
          loggedIn.value = true
          initAdmin()
        } else {
          loginError.value = j.message || '登录失败'
        }
      } catch (e) {
        loginError.value = '网络错误：' + e.message
      } finally {
        loggingIn.value = false
      }
    }

    function doLogout() {
      api.clearToken()
      dropdownOpen.value = false
      loggedIn.value = false
      username.value = ''
      loginForm.username = ''
      loginForm.password = ''
    }

    // ---- Admin Init ----
    async function initAdmin() {
      await loadCategories()
      loadSentences(1)
      loadStats()
      restoreColumnWidths()
    }

    // ---- Data ----
    let searchTimer = null
    function debouncedSearch() {
      clearTimeout(searchTimer)
      searchTimer = setTimeout(() => loadSentences(1), 300)
    }

    async function loadSentences(page) {
      currentPage.value = page || 1
      loading.value = true
      try {
        const j = await api.getSentences({
          page: currentPage.value,
          size: 20,
          keyword: searchQuery.value || undefined,
          type: typeFilter.value || undefined,
        })
        if (j.code === 200) {
          sentences.value = j.data || []
          totalPages.value = j.totalPages || 1
          total.value = j.total || 0
        }
      } catch (e) {
        if (e instanceof api.AuthError) {
          loggedIn.value = false
          showToast('登录已过期，请重新登录', 'error')
        }
      } finally {
        loading.value = false
      }
    }

    async function loadCategories() {
      try {
        const j = await api.getCategories()
        if (j.code === 200 && j.data) categories.value = j.data
      } catch (e) {
        if (e instanceof api.AuthError) loggedIn.value = false
      }
    }

    async function loadStats() {
      try {
        const j = await api.getStats()
        if (j.code === 200) {
          statsText.value = `${j.stats.total} 条句子 · ${j.stats.types.length} 个分类`
          cacheText.value = j.cache?.enabled ? `⚡ Redis DB${j.cache.db}` : "⚪ 无缓存"
        }
      } catch (e) {
        if (e instanceof api.AuthError) loggedIn.value = false
      }
    }

    // ---- Tag colors ----
    // Preset semantic colors for the built-in categories (text / border pairs
    // chosen to fit the dark theme). 歌词 uses a NetEase-Cloud-style red.
    const PRESET_TAG_COLORS = {
      原创:   ['#7ee787', '#238636'], // 生长绿
      动画:   ['#ff9ec5', '#db2777'], // 二次元粉
      歌词:   ['#ff5a5f', '#c20c0c'], // 网易云红
      游戏:   ['#56d4dd', '#0e7490'], // 电竞青
      文学:   ['#e3b341', '#9e6a03'], // 书卷金
      网络:   ['#79c0ff', '#1f6feb'], // 网络蓝
      影视:   ['#ffa657', '#d29922'], // 光影橙
      诗词:   ['#d2a8ff', '#6f42c1'], // 诗意紫
      哲学:   ['#a5b4fc', '#4f46e5'], // 思辨靛
      抖机灵: ['#b5e853', '#5e8a00'], // 灵光黄绿
      其他:   ['#8b949e', '#484f58'], // 中性灰
    }

    // Fallback palette for user-defined categories not in the preset map.
    // Assigned by position in the category list, cycling when it overflows.
    const TAG_PALETTE = [
      ['#7ee787', '#238636'], // green
      ['#79c0ff', '#1f6feb'], // blue
      ['#ffa657', '#d29922'], // orange
      ['#d2a8ff', '#6f42c1'], // purple
      ['#ff9ec5', '#db2777'], // pink
      ['#56d4dd', '#0e7490'], // cyan
    ]

    function hashString(str) {
      let h = 0
      for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0
      return Math.abs(h)
    }

    function tagStyle(t) {
      const type = t || ''
      let pair = PRESET_TAG_COLORS[type]
      if (!pair) {
        const idx = categories.value.indexOf(type)
        // In the list → color by position; orphan value → stable hash.
        const key = idx >= 0 ? idx : hashString(type)
        pair = TAG_PALETTE[key % TAG_PALETTE.length]
      }
      return { color: pair[0], borderColor: pair[1] }
    }

    // ---- Modals ----
    function openAddModal() {
      editingId.value = null
      editForm.content = ''
      editForm.type = categories.value[0] || ''
      editForm.from_source = ''
      editForm.from_who = ''
      showEditModal.value = true
    }

    function openEditModal(s) {
      editingId.value = s.id
      editForm.content = s.content
      editForm.type = s.type
      editForm.from_source = s.from_source || ''
      editForm.from_who = s.from_who || ''
      showEditModal.value = true
    }

    function closeEditModal() {
      showEditModal.value = false
      editingId.value = null
    }

    async function saveSentence() {
      if (!editForm.content.trim()) {
        showToast('句子内容不能为空', 'error')
        return
      }
      saving.value = true
      try {
        const j = editingId.value
          ? await api.updateSentence(editingId.value, editForm)
          : await api.createSentence(editForm)
        if (j.code === 200) {
          showToast(editingId.value ? '更新成功' : '添加成功')
          closeEditModal()
          loadSentences(currentPage.value)
          loadStats()
        } else {
          showToast(j.message || '操作失败', 'error')
        }
      } catch (e) {
        if (e instanceof api.AuthError) loggedIn.value = false
        else showToast('网络错误', 'error')
      } finally {
        saving.value = false
      }
    }

    function openDeleteModal(s) {
      deleteTarget.value = s
      showDeleteModal.value = true
    }

    function closeDeleteModal() {
      showDeleteModal.value = false
      deleteTarget.value = null
    }

    async function confirmDelete() {
      if (!deleteTarget.value) return
      deleting.value = true
      try {
        const j = await api.deleteSentence(deleteTarget.value.id)
        if (j.code === 200) {
          showToast('删除成功')
          closeDeleteModal()
          loadSentences(currentPage.value)
          loadStats()
        } else {
          showToast(j.message || '删除失败', 'error')
        }
      } catch (e) {
        if (e instanceof api.AuthError) loggedIn.value = false
        else showToast('网络错误', 'error')
      } finally {
        deleting.value = false
      }
    }

    // ---- Column Resizing ----
    function startResize(e, colClass) {
      const th = e.currentTarget.parentElement
      const startX = e.clientX
      const startWidth = th.getBoundingClientRect().width
      e.currentTarget.classList.add('resizing')

      resizeData = { th, colClass, startX, startWidth }

      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    }

    function onMouseMove(e) {
      if (!resizeData) return
      const diff = e.clientX - resizeData.startX
      const newWidth = Math.max(30, resizeData.startWidth + diff)
      resizeData.th.style.width = newWidth + 'px'
      resizeData.th.style.minWidth = newWidth + 'px'
      resizeData.th.style.maxWidth = newWidth + 'px'
    }

    function onMouseUp() {
      if (!resizeData) return
      resizeData.th.querySelector('.th-resizer')?.classList.remove('resizing')
      saveColumnWidths()
      resizeData = null
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    function saveColumnWidths() {
      const table = document.querySelector('.sentence-table')
      if (!table) return
      const ths = table.querySelectorAll('thead th')
      const widths = {}
      ths.forEach(th => {
        const col = th.className.split(' ').find(c => c.startsWith('col-'))
        if (col) widths[col] = Math.round(th.getBoundingClientRect().width)
      })
      try { localStorage.setItem('glean_col_widths', JSON.stringify(widths)) } catch (e) {}
    }

    function restoreColumnWidths() {
      let saved
      try { saved = JSON.parse(localStorage.getItem('glean_col_widths')) } catch (e) { return }
      if (!saved) return
      const table = document.querySelector('.sentence-table')
      if (!table) return
      const ths = table.querySelectorAll('thead th')
      ths.forEach(th => {
        const col = th.className.split(' ').find(c => c.startsWith('col-'))
        if (col && saved[col]) {
          th.style.width = saved[col] + 'px'
          th.style.minWidth = saved[col] + 'px'
          th.style.maxWidth = saved[col] + 'px'
        }
      })
    }

    // ---- Close dropdown on click outside ----
    function onClickOutside(e) {
      if (dropdownOpen.value && !e.target.closest('.user-dropdown')) {
        dropdownOpen.value = false
      }
    }

    // ---- Init ----
    onMounted(async () => {
      document.addEventListener('click', onClickOutside)

      // Load site info (public)
      const si = await api.getSiteInfo()
      if (si.code === 200) siteInfo.value = si.data

      // Check auth
      const userData = await api.verifyToken()
      if (userData) {
        username.value = userData.username
        loggedIn.value = true
        await nextTick()
        initAdmin()
      }
      // Done checking auth
      checkingAuth.value = false
    })

    onUnmounted(() => {
      document.removeEventListener('click', onClickOutside)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    })

    return {
      loggedIn, username, loggingIn, loginForm, loginError, dropdownOpen,
      sentences, loading, currentPage, totalPages, total,
      checkingAuth, searchQuery, typeFilter, categories, statsText, cacheText, siteInfo,
      showEditModal, editingId, editForm, saving,
      showDeleteModal, deleteTarget, deleting,
      toastMsg, toastType, toastVisible,
      repoUrl, pageRange,
      doLogin, doLogout,
      debouncedSearch, loadSentences, tagStyle,
      openAddModal, openEditModal, closeEditModal, saveSentence,
      openDeleteModal, closeDeleteModal, confirmDelete,
      startResize,
    }
  }
}
</script>