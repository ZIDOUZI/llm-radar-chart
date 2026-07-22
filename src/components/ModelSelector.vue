<script setup lang="ts">
import { computed, ref, nextTick } from 'vue'
import type { ModelInfo } from '../types'

const props = defineProps<{ models: ModelInfo[]; selected: Set<string>; hidden: Set<string> }>()
const emit = defineEmits<{ toggle: [id: string]; 'toggle-visibility': [id: string]; selectAll: []; clearAll: []; 'toggle-all-vis': []; hover: [m: ModelInfo | null] }>()

const q = ref('')
const provFilter = ref<string | null>(null)
const collapsed = ref(new Set<string>())
const listEl = ref<HTMLElement | null>(null)

const providers = computed(() => [...new Set(props.models.map(m => m.provider))].sort())
const filtered = computed(() => {
  let r = props.models
  if (q.value) { const s = q.value.toLowerCase(); r = r.filter(m => m.name.toLowerCase().includes(s) || m.provider.toLowerCase().includes(s)) }
  if (provFilter.value) r = r.filter(m => m.provider === provFilter.value)
  return r
})
const grouped = computed(() => {
  const g: Record<string, ModelInfo[]> = {}
  for (const m of filtered.value) (g[m.provider] ??= []).push(m)
  return Object.entries(g).sort((a, b) => {
    const as = a[1].some(m => props.selected.has(m.id)), bs = b[1].some(m => props.selected.has(m.id))
    if (as && !bs) return -1; if (!as && bs) return 1; return a[0].localeCompare(b[0])
  })
})

function toggleProv(p: string) { collapsed.value.has(p) ? collapsed.value.delete(p) : collapsed.value.add(p); collapsed.value = new Set(collapsed.value) }
function selCount(ms: ModelInfo[]) { return ms.filter(m => props.selected.has(m.id)).length }

const totalSel = computed(() => props.selected.size)
const allSel = computed(() => filtered.value.every(m => props.selected.has(m.id)))
const visibleCount = computed(() => totalSel.value - props.hidden.size)

function doToggle(id: string) {
  emit('toggle', id)
  nextTick(() => { const el = document.getElementById(`r-${id}`); el && listEl.value?.scrollTo({ top: el.offsetTop - 50, behavior: 'smooth' }) })
}
function doVis(id: string) { emit('toggle-visibility', id) }
function toggleAll() {
  allSel.value
    ? filtered.value.forEach(m => { if (props.selected.has(m.id)) emit('toggle', m.id) })
    : filtered.value.forEach(m => { if (!props.selected.has(m.id)) emit('toggle', m.id) })
  emit('selectAll')
}
</script>

<template>
  <div class="sel">
    <div class="s-top">
      <input v-model="q" type="text" placeholder="搜索模型…" class="s-src" />
      <select v-model="provFilter" class="s-prov">
        <option :value="null">全部</option>
        <option v-for="p in providers" :key="p" :value="p">{{ p }}</option>
      </select>
    </div>
    <div class="s-bar">
      <span class="s-n">{{ totalSel }} / {{ models.length }}</span>
      <div class="s-acts">
        <button class="sb" @click="toggleAll">{{ allSel ? '取消' : '全选' }}</button>
        <button v-if="totalSel" class="sb sb-x" @click="emit('clearAll')">清空</button>
        <button v-if="totalSel" class="sb" @click="emit('toggle-all-vis')">
          {{ visibleCount > 0 ? '隐藏' : '显示' }}
        </button>
      </div>
    </div>
    <div ref="listEl" class="s-list">
      <div v-for="[prov, pms] in grouped" :key="prov" class="pg">
        <div class="ph" @click="toggleProv(prov)">
          <span class="ph-arr">{{ collapsed.has(prov) ? '▸' : '▾' }}</span>
          <span class="ph-n">{{ prov }}</span>
          <span class="ph-c">{{ selCount(pms) }}/{{ pms.length }}</span>
        </div>
        <div v-if="!collapsed.has(prov)" class="pb">
          <div v-for="m in pms" :key="m.id" :id="`r-${m.id}`" class="mr" :class="{ on: selected.has(m.id) }"
            @mouseenter="emit('hover', m)" @mouseleave="emit('hover', null)">
            <input type="checkbox" :checked="selected.has(m.id)" @change="doToggle(m.id)" class="mch" />
            <div class="mi" @click="doToggle(m.id)">
              <div class="mn">{{ m.name }}</div>
              <div class="mm">
                <span>{{ m.rawPrice > 0 ? '$' + m.rawPrice.toFixed(2) : 'Free' }}/1M</span>
                <span v-if="m.intelligenceIndex" class="miq">IQ {{ m.intelligenceIndex }}</span>
              </div>
            </div>
            <button v-if="selected.has(m.id)" class="me" :class="{ off: hidden.has(m.id) }"
              @click.stop.prevent="doVis(m.id)" :title="hidden.has(m.id) ? '显示' : '隐藏'">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
          </div>
        </div>
      </div>
      <div v-if="!filtered.length" class="mepty">无匹配结果</div>
    </div>
  </div>
</template>

<style scoped>
.sel { display: flex; flex-direction: column; height: 100%; }

.s-top { display: flex; gap: 6px; padding: 12px 12px 8px; }
.s-src {
  flex: 1; min-width: 0; padding: 6px 10px; border: 1px solid #e5e7eb; border-radius: 8px;
  font-size: 0.8rem; background: #f9fafb; outline: none; color: #111827; transition: all 0.15s;
}
.s-src:focus { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,0.1); background: #fff; }
.s-src::placeholder { color: #9ca3af; }
.s-prov {
  width: 90px; flex-shrink: 0; padding: 6px 8px; border: 1px solid #e5e7eb; border-radius: 8px;
  font-size: 0.75rem; background: #f9fafb; outline: none; color: #111827; cursor: pointer;
  appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: right 6px center; padding-right: 24px;
}
.s-prov:focus { border-color: #2563eb; }

.s-bar { display: flex; justify-content: space-between; align-items: center; padding: 0 12px 8px; }
.s-n { font-size: 0.72rem; color: #9ca3af; }
.s-acts { display: flex; gap: 4px; }
.sb {
  padding: 3px 10px; border-radius: 6px; border: 1px solid #e5e7eb; background: #fff;
  font-size: 0.7rem; color: #6b7280; cursor: pointer; transition: all 0.15s;
}
.sb:hover { background: #f9fafb; border-color: #d1d5db; }
.sb-x { color: #ef4444; border-color: #fecaca; }
.sb-x:hover { background: #fef2f2; }

.s-list { flex: 1; overflow-y: auto; }

.pg { margin-bottom: 1px; }
.ph {
  display: flex; align-items: center; gap: 5px; padding: 6px 12px;
  cursor: pointer; user-select: none; font-size: 0.73rem; color: #6b7280; font-weight: 600;
  transition: background 0.1s;
}
.ph:hover { background: #f9fafb; }
.ph-arr { font-size: 0.55rem; width: 10px; color: #9ca3af; }
.ph-n { flex: 1; }
.ph-c { font-size: 0.65rem; color: #9ca3af; font-weight: 400; }

.pb { padding: 0 4px 0 17px; }

.mr {
  display: flex; align-items: center; gap: 8px; padding: 5px 10px;
  border-radius: 6px; cursor: pointer; transition: background 0.1s;
}
.mr:hover { background: #f9fafb; }
.mr.on { background: #eff6ff; }

.mch { accent-color: #2563eb; width: 15px; height: 15px; cursor: pointer; flex-shrink: 0; }
.mi { flex: 1; min-width: 0; }
.mn {
  font-size: 0.8rem; font-weight: 500; color: #111827;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.35;
}
.mm { display: flex; gap: 8px; font-size: 0.68rem; color: #9ca3af; margin-top: 1px; }
.miq { color: #6366f1; }

.me {
  flex-shrink: 0; width: 26px; height: 26px; border: none; border-radius: 6px;
  background: transparent; cursor: pointer; display: flex; align-items: center; justify-content: center;
  color: #6b7280; opacity: 0.4; transition: all 0.15s;
}
.me:hover { background: #e5e7eb; opacity: 0.9; }
.me.off { opacity: 0.15; }
.me.off:hover { background: #fee2e2; opacity: 0.5; color: #ef4444; }

.mepty { padding: 24px; text-align: center; color: #9ca3af; font-size: 0.8rem; }
</style>
