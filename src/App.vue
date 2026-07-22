<script setup lang="ts">
import { ref, reactive, onMounted, computed, watch } from 'vue'
import type { ModelInfo } from './types'
import { METRIC_LABELS } from './types'
import { getModels, setApiKey, clearApiKey, hasApiKey } from './services/api'
import ModelSelector from './components/ModelSelector.vue'
import RadarChart from './components/RadarChart.vue'
import ModelTooltip from './components/ModelTooltip.vue'

const SELECTED_CACHE_KEY = 'llm-radar-selected'

function loadCachedSelected(): string[] { try { const r = localStorage.getItem(SELECTED_CACHE_KEY); return r ? JSON.parse(r) : [] } catch { return [] } }
function saveCachedSelected(ids: Set<string>) { localStorage.setItem(SELECTED_CACHE_KEY, JSON.stringify([...ids])) }

const models = ref<ModelInfo[]>([])
const selectedIds = reactive(new Set<string>())
const hiddenIds = reactive(new Set<string>())
const loading = ref(true)
const error = ref<string | null>(null)
const hoveredModel = ref<ModelInfo | null>(null)
const activeMetrics = ref(new Set<string>(['intelligence','coding','instruction','longContext','agent','factuality','speed','price']))
const metricsKey = ref(0)
const showSettings = ref(false)
const apiKeyInput = ref('')
const showApiKeyInput = ref(false)
const usingApi = ref(hasApiKey())

const selectedModels = computed(() => models.value.filter(m => selectedIds.has(m.id)))
watch(selectedIds, s => saveCachedSelected(s), { deep: true })

onMounted(async () => {
  try {
    models.value = await getModels(); usingApi.value = hasApiKey()
    const cached = loadCachedSelected()
    if (cached.length) { for (const id of cached) { if (models.value.some(m => m.id === id)) selectedIds.add(id) } }
    if (selectedIds.size === 0) { for (const m of models.value.slice(0, 3)) selectedIds.add(m.id) }
  } catch (e) { error.value = e instanceof Error ? e.message : '加载失败' }
  finally { loading.value = false }
})

function toggleModel(id: string) { selectedIds.has(id) ? (selectedIds.delete(id), hiddenIds.delete(id)) : selectedIds.add(id) }
function toggleVisibility(id: string) { hiddenIds.has(id) ? hiddenIds.delete(id) : hiddenIds.add(id) }
function clearAll() { selectedIds.clear(); hiddenIds.clear() }
function selectAll() {}

async function handleSetApiKey() {
  const k = apiKeyInput.value.trim(); if (!k) return
  setApiKey(k); apiKeyInput.value = ''; showApiKeyInput.value = false
  loading.value = true; error.value = null
  try {
    selectedIds.clear(); hiddenIds.clear(); models.value = await getModels(); usingApi.value = true
    for (const m of models.value.slice(0, 3)) selectedIds.add(m.id)
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败'; clearApiKey(); usingApi.value = false
    models.value = await getModels()
  } finally { loading.value = false }
}
function handleClearApiKey() {
  clearApiKey(); usingApi.value = false; selectedIds.clear(); hiddenIds.clear()
  getModels().then(m => { models.value = m; for (const d of m.slice(0, 3)) selectedIds.add(d.id) })
}
function toggleAllVisibility() {
  const v = selectedModels.value.length - hiddenIds.size
  v > 0 ? selectedModels.value.forEach(m => hiddenIds.add(m.id)) : hiddenIds.clear()
}
function toggleApiKeyInput() { showApiKeyInput.value = !showApiKeyInput.value }
function onModelHover(m: ModelInfo | null) { hoveredModel.value = m }
function toggleMetric(key: string) {
  const next = new Set(activeMetrics.value)
  next.has(key) ? next.delete(key) : next.add(key)
  activeMetrics.value = next
  metricsKey.value++
}
</script>

<template>
  <div class="app">
    <header class="hdr">
      <span class="hdr-logo">◈ LLM Radar</span>
      <div class="hdr-right">
        <span class="hdr-tag" :class="{ live: usingApi }">{{ usingApi ? 'Live' : 'Sample' }}</span>
        <button v-if="!usingApi" class="hdr-btn" @click="toggleApiKeyInput">{{ showApiKeyInput ? '取消' : 'Key' }}</button>
        <button v-else class="hdr-btn hdr-btn-x" @click="handleClearApiKey">Clear Key</button>
      </div>
    </header>

    <div v-if="showApiKeyInput" class="key-row">
      <input v-model="apiKeyInput" type="password" placeholder="Paste API key…" class="key-inp" @keyup.enter="handleSetApiKey" />
      <button class="key-ok" @click="handleSetApiKey">确认</button>
      <a href="https://artificialanalysis.ai/api-reference" target="_blank" class="key-hint">获取 Key</a>
    </div>

    <div v-if="error" class="err-row">⚠️ {{ error }}</div>

    <div v-if="loading" class="ld">
      <div class="ld-spin"></div><p>加载中…</p>
    </div>

    <div v-else class="main">
      <aside class="sb">
        <div class="sb-settings">
          <button class="sb-set-btn" @click="showSettings = !showSettings">
            ⚙ {{ showSettings ? '收起' : '维度' }}
          </button>
          <div v-if="showSettings" class="sb-set-panel">
            <label v-for="[k, v] in Object.entries(METRIC_LABELS)" :key="k" class="sb-set-row">
              <input type="checkbox" :checked="activeMetrics.has(k)" @change="toggleMetric(k)" />
              <span>{{ v }}</span>
            </label>
          </div>
        </div>
        <ModelSelector :models="models" :selected="selectedIds" :hidden="hiddenIds"
          @toggle="toggleModel" @toggle-visibility="toggleVisibility" @selectAll="selectAll" @clearAll="clearAll"
          @toggle-all-vis="toggleAllVisibility" @hover="onModelHover" />
      </aside>
      <section class="ch">
        <RadarChart :key="metricsKey" :models="selectedModels" :hidden="hiddenIds" :active-metrics="activeMetrics"
          @toggle-visibility="toggleVisibility" @hover="onModelHover" />
        <ModelTooltip :model="hoveredModel" />
        <div class="ch-foot">
          <span class="ch-note">{{ usingApi ? 'artificialanalysis.ai' : '样本数据 · 离线模式' }}</span>
        </div>
      </section>
    </div>
  </div>
</template>

<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans SC', sans-serif;
  background: #f8f9fb; color: #111827; font-size: 14px; -webkit-font-smoothing: antialiased;
}
</style>

<style scoped>
.app { height: 100vh; display: flex; flex-direction: column; overflow: hidden; }

.hdr {
  display: flex; align-items: center; justify-content: space-between;
  height: 44px; padding: 0 20px; flex-shrink: 0;
  background: #fff; border-bottom: 1px solid #e5e7eb;
}
.hdr-logo { font-size: 0.9rem; font-weight: 700; color: #111827; letter-spacing: -0.02em; }
.hdr-right { display: flex; align-items: center; gap: 8px; }
.hdr-tag { font-size: 0.65rem; font-weight: 600; padding: 2px 8px; border-radius: 99px; background: #f3f4f6; color: #6b7280; }
.hdr-tag.live { background: #dbeafe; color: #2563eb; }
.hdr-btn {
  font-size: 0.75rem; padding: 4px 10px; border-radius: 6px; border: 1px solid #e5e7eb;
  background: #fff; color: #374151; cursor: pointer; transition: all 0.15s;
}
.hdr-btn:hover { background: #f9fafb; border-color: #d1d5db; }
.hdr-btn-x { color: #ef4444; border-color: #fecaca; }
.hdr-btn-x:hover { background: #fef2f2; }

.key-row {
  display: flex; align-items: center; gap: 8px; padding: 8px 20px;
  background: #f0f7ff; border-bottom: 1px solid #dbeafe;
}
.key-inp {
  padding: 5px 12px; border: 1px solid #d1d5db; border-radius: 6px;
  font-size: 0.82rem; width: 280px; outline: none;
}
.key-inp:focus { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
.key-ok {
  padding: 5px 14px; border-radius: 6px; border: none; background: #2563eb;
  color: #fff; font-size: 0.82rem; cursor: pointer; font-weight: 500;
}
.key-ok:hover { background: #1d4ed8; }
.key-hint { font-size: 0.75rem; color: #6b7280; }

.err-row { padding: 8px 20px; background: #fef2f2; color: #dc2626; font-size: 0.8rem; border-bottom: 1px solid #fecaca; }

.ld { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; color: #9ca3af; }
.ld-spin { width: 28px; height: 28px; border: 2px solid #e5e7eb; border-top-color: #2563eb; border-radius: 50%; animation: sp 0.7s linear infinite; }
@keyframes sp { to { transform: rotate(360deg); } }

.main { flex: 1; display: flex; overflow: hidden; }
.sb {
  width: 320px; flex-shrink: 0; display: flex; flex-direction: column;
  background: #fff; border-right: 1px solid #e5e7eb;
  overflow-y: auto; overflow-x: hidden;
}
.sb-settings { padding: 10px 12px 0; flex-shrink: 0; }
.sb-set-btn {
  font-size: 0.72rem; padding: 4px 10px; border-radius: 6px;
  border: 1px solid #e5e7eb; background: #fff; color: #6b7280; cursor: pointer;
}
.sb-set-btn:hover { background: #f9fafb; }
.sb-set-panel { display: flex; flex-wrap: wrap; gap: 4px 12px; padding: 6px 0 4px; }
.sb-set-row { display: flex; align-items: center; gap: 4px; font-size: 0.7rem; color: #374151; cursor: pointer; }
.sb-set-row input { accent-color: #2563eb; width: 13px; height: 13px; }
.ch {
  flex: 1; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 6px;
  padding: 12px 16px 10px; overflow: hidden;
}
.ch-foot { display: flex; align-items: center; gap: 12px; }
.ch-note { font-size: 0.7rem; color: #9ca3af; }
</style>
