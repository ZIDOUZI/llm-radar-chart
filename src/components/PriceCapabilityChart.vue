<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import {
  Chart as ChartJS,
  ScatterController,
  LinearScale,
  LogarithmicScale,
  PointElement,
  Tooltip,
} from 'chart.js'
import type { ChartData, ChartOptions, ChartEvent, ActiveElement } from 'chart.js'
import type { ModelInfo, RadarMetrics } from '../types'
import { METRIC_LABELS } from '../types'
import { getProviderColor, hexToRgba } from '../utils/colors'

ChartJS.register(ScatterController, LinearScale, LogarithmicScale, PointElement, Tooltip)

const props = defineProps<{
  models: ModelInfo[]
  hidden: Set<string>
  selectedIds: Set<string>
}>()

const emit = defineEmits<{
  select: [id: string]
}>()

const canvas = ref<HTMLCanvasElement | null>(null)
const capabilityKey = ref<keyof RadarMetrics>('intelligence')
const activeId = ref<string | null>(null)
let chart: ChartJS<'scatter'> | null = null

const capOptions = computed(() =>
  (Object.entries(METRIC_LABELS) as [keyof RadarMetrics, string][])
    .filter(([k]) => k !== 'price')
)

/** 可绘制的模型:未被隐藏、有真实价格、所选能力维度有分 */
const plottable = computed(() =>
  props.models.filter(
    (m) => !props.hidden.has(m.id) && m.rawPrice > 0 && (m.metrics[capabilityKey.value] ?? 0) > 0
  )
)

const activeModel = computed(() => props.models.find((m) => m.id === activeId.value) ?? null)

/** 价格更高但能力更低(相对选中模型) */
const worseDeals = computed<ModelInfo[]>(() => {
  const sel = activeModel.value
  if (!sel) return []
  const cap = capabilityKey.value
  const selCap = sel.metrics[cap] ?? 0
  if (selCap <= 0) return []
  return plottable.value
    .filter((m) => m.id !== sel.id && m.rawPrice > sel.rawPrice && (m.metrics[cap] ?? 0) < selCap)
    .sort((a, b) => b.rawPrice - a.rawPrice || ((a.metrics[cap] ?? 0) - (b.metrics[cap] ?? 0)))
})

function onCapabilityChange(e: Event) {
  const v = (e.target as HTMLSelectElement).value as keyof RadarMetrics
  if (v !== 'price') capabilityKey.value = v
}

function priceAxisRange() {
  const prices = plottable.value.map((m) => m.rawPrice)
  let min = Math.pow(10, Math.floor(Math.log10(Math.min(...prices))))
  let max = Math.pow(10, Math.ceil(Math.log10(Math.max(...prices))))
  if (max <= min) max = min * 10
  return { min, max }
}

function buildData(): ChartData<'scatter'> {
  const datasets: ChartData<'scatter'>['datasets'] = plottable.value.map((m, i) => {
    const c = getProviderColor(m.provider, i)
    const isActive = m.id === activeId.value
    const isSelected = props.selectedIds.has(m.id)
    return {
      label: m.name,
      data: [{ x: m.rawPrice, y: m.metrics[capabilityKey.value] ?? 0 }],
      backgroundColor: isActive ? '#2563eb' : isSelected ? c.border : hexToRgba(c.border, 0.55),
      borderColor: isActive ? '#1d4ed8' : c.border,
      borderWidth: isActive ? 2.5 : isSelected ? 2 : 1,
      pointRadius: isActive ? 8 : isSelected ? 7 : 5,
      pointHoverRadius: 9,
      pointHitRadius: 12,
      order: isActive ? 0 : 1,
    }
  })
  return { datasets }
}

function formatPrice(v: unknown): string {
  const n = Number(v)
  if (!isFinite(n)) return ''
  return n >= 1 ? '$' + n.toFixed(0) : '$' + String(parseFloat(n.toPrecision(2)))
}

function buildOptions(): ChartOptions<'scatter'> {
  const range = priceAxisRange()
  return {
    responsive: true,
    maintainAspectRatio: true,
    interaction: { mode: 'nearest', intersect: true },
    scales: {
      x: {
        type: 'logarithmic',
        min: range.min,
        max: range.max,
        title: {
          display: true,
          text: '价格 ($/1M tokens, 对数刻度)',
          color: '#374151',
          font: { size: 11, weight: 'bold' },
        },
        ticks: {
          color: '#9ca3af',
          font: { size: 10 },
          callback: formatPrice,
        },
        grid: { color: 'rgba(0,0,0,0.06)' },
      },
      y: {
        type: 'linear',
        min: 0,
        max: 100,
        title: {
          display: true,
          text: `${METRIC_LABELS[capabilityKey.value]} (0-100)`,
          color: '#374151',
          font: { size: 11, weight: 'bold' },
        },
        ticks: {
          stepSize: 20,
          color: '#9ca3af',
          font: { size: 10 },
        },
        grid: { color: 'rgba(0,0,0,0.06)' },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const m = plottable.value[ctx.datasetIndex]
            if (!m) return ''
            const raw = ctx.raw as { x: number; y: number }
            return ` ${m.name}: ${METRIC_LABELS[capabilityKey.value]} ${raw.y} · $${raw.x.toFixed(2)}/1M`
          },
        },
      },
    },
    onHover: (_e, els) => {
      if (canvas.value) canvas.value.style.cursor = els.length ? 'pointer' : 'default'
    },
    onClick: (e: ChartEvent, _els: ActiveElement[], c: ChartJS<'scatter'>) => {
      if (!canvas.value) return
      const ev = e.native as MouseEvent
      const rect = canvas.value.getBoundingClientRect()
      const px = ev.offsetX ?? ev.clientX - rect.left
      const py = ev.offsetY ?? ev.clientY - rect.top

      // 优先精确命中;否则取最近点并限制点击距离,点空白处可取消
      let idx: number | null = null
      let hit = c.getElementsAtEventForMode(e.native as MouseEvent, 'nearest', { intersect: true }, false)
      if (hit.length) {
        idx = hit[0].datasetIndex
      } else {
        hit = c.getElementsAtEventForMode(e.native as MouseEvent, 'nearest', { intersect: false }, false)
        if (hit.length) {
          const el = c.getDatasetMeta(hit[0].datasetIndex).data[0]
          const dist = Math.hypot(el.x - px, el.y - py)
          if (dist <= 20) idx = hit[0].datasetIndex
        }
      }

      const m = idx != null ? plottable.value[idx] : undefined
      if (!m) {
        activeId.value = null
        return
      }
      activeId.value = m.id
      emit('select', m.id)
    },
  }
}

function render() {
  if (!canvas.value) {
    if (chart) {
      chart.destroy()
      chart = null
    }
    return
  }
  const data = buildData()
  const options = buildOptions()
  if (!chart) {
    chart = new ChartJS(canvas.value, { type: 'scatter', data, options })
  } else {
    chart.data = data
    chart.options = options
    chart.update()
  }
}

watch(
  () => [props.models, props.hidden, props.selectedIds, capabilityKey.value, activeId.value],
  render,
  { deep: true, flush: 'post' }
)

function pickActive(id: string) {
  activeId.value = id
  emit('select', id)
}

onMounted(render)
onUnmounted(() => {
  chart?.destroy()
  chart = null
})
</script>

<template>
  <div class="pcc">
    <div class="pcc-bar">
      <span class="pcc-lbl">能力维度</span>
      <select class="pcc-sel" :value="capabilityKey" @change="onCapabilityChange">
        <option v-for="[k, label] in capOptions" :key="k" :value="k">{{ label }}</option>
      </select>
      <span class="pcc-hint">点击散点查看「价格更高但能力更低」的模型</span>
    </div>

    <div v-if="!plottable.length" class="pcc-empty">
      没有可绘制的模型(需要同时有价格和能力数据)
    </div>
    <div v-else class="pcc-chart">
      <canvas ref="canvas"></canvas>
    </div>

    <div v-if="activeModel" class="pcc-panel">
      <div class="pcc-sel-head">
        <span class="pcc-sel-name">{{ activeModel.name }}</span>
        <span class="pcc-sel-meta">
          ${{ activeModel.rawPrice.toFixed(2) }}/1M ·
          {{ METRIC_LABELS[capabilityKey] }} {{ activeModel.metrics[capabilityKey] }}
        </span>
      </div>
      <div v-if="(activeModel.metrics[capabilityKey] ?? 0) <= 0" class="pcc-panel-empty">
        该模型在当前能力维度没有数据
      </div>
      <div v-else-if="!worseDeals.length" class="pcc-panel-empty">
        没有价格更高且能力更低的模型
      </div>
      <div v-else class="pcc-list">
        <div class="pcc-list-title">价格更高 · 能力更低</div>
        <div
          v-for="m in worseDeals"
          :key="m.id"
          class="pcc-row"
          :class="{ active: m.id === activeId }"
          @click="pickActive(m.id)"
        >
          <span class="pcc-dot" :style="{ background: getProviderColor(m.provider, 0).border }"></span>
          <span class="pcc-name">{{ m.name }}</span>
          <span class="pcc-num pcc-price">
            ${{ m.rawPrice.toFixed(2) }} <em class="pcc-delta">+${{ (m.rawPrice - activeModel.rawPrice).toFixed(2) }}</em>
          </span>
          <span class="pcc-num pcc-cap">
            {{ METRIC_LABELS[capabilityKey] }} {{ m.metrics[capabilityKey] }}
            <em class="pcc-delta pcc-delta-down">-{{ activeModel.metrics[capabilityKey] - (m.metrics[capabilityKey] ?? 0) }}</em>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pcc {
  width: 100%;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.pcc-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.pcc-lbl {
  font-size: 0.72rem;
  color: #6b7280;
  font-weight: 600;
}
.pcc-sel {
  padding: 4px 10px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  color: #111827;
  font-size: 0.78rem;
  cursor: pointer;
  outline: none;
}
.pcc-sel:focus {
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}
.pcc-hint {
  font-size: 0.7rem;
  color: #9ca3af;
}

.pcc-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  color: #9ca3af;
  font-size: 0.85rem;
}

.pcc-chart {
  flex: 1;
  min-height: 0;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 8px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  display: flex;
  align-items: center;
  justify-content: center;
}
.pcc-chart canvas {
  max-width: 100%;
  max-height: 100%;
}

.pcc-panel {
  flex-shrink: 0;
  max-height: 40%;
  overflow: auto;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 10px 12px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}
.pcc-sel-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding-bottom: 6px;
  border-bottom: 1px solid #f3f4f6;
}
.pcc-sel-name {
  font-size: 0.82rem;
  font-weight: 700;
  color: #111827;
}
.pcc-sel-meta {
  font-size: 0.7rem;
  color: #6b7280;
}
.pcc-panel-empty {
  padding: 12px 4px 4px;
  font-size: 0.75rem;
  color: #9ca3af;
}
.pcc-list-title {
  padding: 6px 0 4px;
  font-size: 0.68rem;
  font-weight: 600;
  color: #dc2626;
}
.pcc-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 5px 4px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.12s;
}
.pcc-row:hover {
  background: #f9fafb;
}
.pcc-row.active {
  background: #eff6ff;
}
.pcc-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  flex-shrink: 0;
}
.pcc-name {
  flex: 1;
  min-width: 0;
  font-size: 0.78rem;
  color: #111827;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.pcc-num {
  font-size: 0.72rem;
  color: #374151;
  white-space: nowrap;
}
.pcc-price {
  min-width: 96px;
}
.pcc-cap {
  min-width: 128px;
}
.pcc-delta {
  font-style: normal;
  color: #dc2626;
  font-weight: 600;
}
.pcc-delta-down {
  color: #d97706;
}
</style>
