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
import { canonicalKey } from '../services/match'
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
type XAxisMode = 'tokenPrice' | 'taskCost'
const xAxisMode = ref<XAxisMode>('tokenPrice')
const activeId = ref<string | null>(null)
const hoverId = ref<string | null>(null)
const showLabels = ref(true)
let chart: ChartJS<'scatter'> | null = null

/** 除悬停/选中模型外, 最多给多少个点尝试画名称 */
const LABEL_OTHER_MAX = 40

function shortName(name: string): string {
  const base = name.replace(/\s*\(.*$/, '')
  return base.length > 16 ? base.slice(0, 15) + '…' : base
}

/** 推理强度从低到高的顺序。没有明确强度的模型不参与连线。 */
const REASONING_RANKS: Record<string, number> = {
  'no-thinking': 0,
  'no-reasoning': 0,
  'non-thinking': 0,
  'non-reasoning': 0,
  nothinking: 0,
  nonreasoning: 0,
  none: 0,
  minimal: 1,
  low: 2,
  medium: 3,
  high: 4,
  xhigh: 5,
  'x-high': 5,
  'extra-high': 5,
  max: 6,
}
const REASONING_WORDS = new Set(['thinking', 'reasoning', 'auto', 'effort', 'extended', 'mode', 'preview', 'exp', 'latest'])

interface ReasoningProfile {
  base: string
  rank: number
}

function parseReasoningProfile(value: string): ReasoningProfile | null {
  const tokens = canonicalKey(value).split('-').filter(Boolean)
  if (!tokens.length) return null

  // “No Thinking”/“Non-Reasoning”是一个整体等级，不能只按 thinking/reasoning 去掉。
  for (const [suffix, rank] of Object.entries(REASONING_RANKS).filter(([key]) => key.includes('-'))) {
    const suffixTokens = suffix.split('-')
    const start = tokens.length - suffixTokens.length
    if (start < 1 || tokens.slice(start).join('-') !== suffix) continue
    const base = tokens.slice(0, start)
    while (base.length && REASONING_WORDS.has(base[base.length - 1])) base.pop()
    if (base.length) return { base: base.join('-'), rank }
  }

  // 处理 High/Low/Medium xHigh/Max 后跟 Effort、Thinking 等修饰词的形式。
  for (let i = tokens.length - 1; i >= 1; i--) {
    const rank = REASONING_RANKS[tokens[i]]
    if (rank == null || !tokens.slice(i + 1).every((token) => REASONING_WORDS.has(token))) continue
    const base = tokens.slice(0, i)
    while (base.length && REASONING_WORDS.has(base[base.length - 1])) base.pop()
    if (base.length) return { base: base.join('-'), rank }
  }
  return null
}

function reasoningProfile(model: ModelInfo): ReasoningProfile | null {
  const fromName = parseReasoningProfile(model.name)
  if (fromName) return fromName
  // 部分数据源展示名会省略强度，但 id 仍保留 -low/-high 等后缀。
  return parseReasoningProfile(model.id)
}

let rafPending = false
function scheduleDraw() {
  if (rafPending) return
  rafPending = true
  requestAnimationFrame(() => {
    rafPending = false
    chart?.draw()
  })
}

function onCanvasLeave() {
  if (hoverId.value !== null) {
    hoverId.value = null
    scheduleDraw()
  }
}

const capOptions = computed(() =>
  (Object.entries(METRIC_LABELS) as [keyof RadarMetrics, string][])
    .filter(([k]) => k !== 'price')
)

const xAxisLabel = computed(() => xAxisMode.value === 'taskCost' ? 'LiveBench 单任务平均成本' : 'Token 价格')
const xAxisSuffix = computed(() => xAxisMode.value === 'taskCost' ? '/task' : '/1M tokens')
const xAxisComparisonLabel = computed(() => xAxisMode.value === 'taskCost' ? '成本' : '价格')

/** 任务成本只取 LiveBench 的 cost_per_question, 不回退到 token 价格或成功任务成本。 */
function xValue(model: ModelInfo): number | null {
  if (xAxisMode.value === 'taskCost') {
    const cost = model.detail?.livebench?.costPerTask
    return cost != null && cost > 0 ? cost : null
  }
  return model.rawPrice > 0 ? model.rawPrice : null
}

function formatXAxisAmount(value: number): string {
  return xAxisMode.value === 'taskCost' ? '$' + value.toFixed(4) : '$' + value.toFixed(2)
}

function formatXAxisTick(value: unknown): string {
  const n = Number(value)
  if (!isFinite(n)) return ''
  if (xAxisMode.value === 'taskCost') return '$' + (n >= 1 ? n.toFixed(2) : n.toPrecision(2))
  return n >= 1 ? '$' + n.toFixed(0) : '$' + String(parseFloat(n.toPrecision(2)))
}

function onXAxisChange(e: Event) {
  const value = (e.target as HTMLSelectElement).value as XAxisMode
  if (value === 'tokenPrice' || value === 'taskCost') xAxisMode.value = value
}

/** 可绘制的模型:左侧已选中、未被隐藏、有当前横轴数据、所选能力维度有分 */
const plottable = computed(() =>
  props.models.filter(
    (m) =>
      props.selectedIds.has(m.id) &&
      !props.hidden.has(m.id) &&
      xValue(m) != null &&
      (m.metrics[capabilityKey.value] ?? 0) > 0
  )
)

/** 当前展示的模型:点击固定的优先(叠加层常驻), 未点击时跟随悬停 */
const displayModel = computed(() => {
  const id = activeId.value ?? hoverId.value
  return plottable.value.find((m) => m.id === id) ?? null
})

/** 横轴值更高但能力更低(相对选中模型) */
const worseDeals = computed<ModelInfo[]>(() => {
  const sel = displayModel.value
  if (!sel) return []
  const cap = capabilityKey.value
  const selCap = sel.metrics[cap] ?? 0
  const selX = xValue(sel)
  if (selCap <= 0 || selX == null) return []
  return plottable.value
    .filter((m) => {
      const value = xValue(m)
      return m.id !== sel.id && value != null && value > selX && (m.metrics[cap] ?? 0) < selCap
    })
    .sort((a, b) => (xValue(b) ?? 0) - (xValue(a) ?? 0) || ((a.metrics[cap] ?? 0) - (b.metrics[cap] ?? 0)))
})

function onCapabilityChange(e: Event) {
  const v = (e.target as HTMLSelectElement).value as keyof RadarMetrics
  if (v !== 'price') capabilityKey.value = v
}

function toggleLabels() {
  showLabels.value = !showLabels.value
  scheduleDraw()
}

function xAxisRange() {
  const values = plottable.value.map((m) => xValue(m) ?? 0).filter((v) => v > 0)
  let min = Math.pow(10, Math.floor(Math.log10(Math.min(...values))))
  let max = Math.pow(10, Math.ceil(Math.log10(Math.max(...values))))
  if (max <= min) max = min * 10
  return { min, max }
}

function buildData(): ChartData<'scatter'> {
  const datasets: ChartData<'scatter'>['datasets'] = plottable.value.map((m, i) => {
    const c = getProviderColor(m.provider, i)
    return {
      label: m.name,
      data: [{ x: xValue(m) ?? 0, y: m.metrics[capabilityKey.value] ?? 0 }],
      backgroundColor: hexToRgba(c.border, 0.75),
      borderColor: c.border,
      borderWidth: 1.5,
      pointRadius: 5,
      pointHoverRadius: 8,
      pointHitRadius: 12,
    }
  })
  return { datasets }
}

/** 同一基础模型的相邻推理强度之间画细线，线条位于散点下方。 */
const reasoningConnectionsPlugin = {
  id: 'reasoning-connections',
  beforeDatasetsDraw(pluginChart: unknown) {
    const c = pluginChart as ChartJS<'scatter'>
    if (!c.chartArea || plottable.value.length < 2) return

    const groups = new Map<string, Map<number, number>>()
    plottable.value.forEach((model, index) => {
      const profile = reasoningProfile(model)
      if (!profile) return
      const levels = groups.get(profile.base) ?? new Map<number, number>()
      // 同一级别存在重复数据时只保留第一个，避免画出不代表强度变化的横向线。
      if (!levels.has(profile.rank)) levels.set(profile.rank, index)
      groups.set(profile.base, levels)
    })

    const ctx = c.ctx
    ctx.save()
    ctx.lineWidth = 1
    ctx.lineCap = 'round'
    for (const levels of groups.values()) {
      const points = [...levels.entries()]
        .sort(([a], [b]) => a - b)
        .map(([_, index]) => ({ index, point: c.getDatasetMeta(index).data[0] }))
        .filter(({ point }) => !!point)
      if (points.length < 2) continue

      const color = getProviderColor(plottable.value[points[0].index].provider, points[0].index).border
      ctx.strokeStyle = hexToRgba(color, 0.38)
      ctx.beginPath()
      ctx.moveTo(points[0].point.x, points[0].point.y)
      for (const { point } of points.slice(1)) ctx.lineTo(point.x, point.y)
      ctx.stroke()
    }
    ctx.restore()
  },
}

function buildOptions(): ChartOptions<'scatter'> {
  const range = xAxisRange()
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
          text: `${xAxisLabel.value} (${xAxisSuffix.value}, 对数刻度)`,
          color: '#374151',
          font: { size: 11, weight: 'bold' },
        },
        ticks: {
          color: '#9ca3af',
          font: { size: 10 },
          callback: formatXAxisTick,
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
            return ` ${m.name}: ${METRIC_LABELS[capabilityKey.value]} ${raw.y} · ${formatXAxisAmount(raw.x)}${xAxisSuffix.value}`
          },
        },
      },
    },
    onHover: (e, _els, c) => {
      const idx = pickIndexAt(e.native, c)
      const next = idx != null ? (plottable.value[idx]?.id ?? null) : null
      if (next !== hoverId.value) {
        hoverId.value = next
        scheduleDraw()
      }
      if (canvas.value) canvas.value.style.cursor = idx != null ? 'pointer' : 'default'
    },
    onClick: (e: ChartEvent, _els: ActiveElement[], c: ChartJS<'scatter'>) => {
      const idx = pickIndexAt(e.native, c)
      const m = idx != null ? plottable.value[idx] : undefined
      if (!m) {
        activeId.value = null
        return
      }
      activeId.value = m.id
      hoverId.value = m.id
      emit('select', m.id)
      scheduleDraw()
    },
  }
}

function pickIndexAt(e: Event, c: ChartJS<'scatter'>): number | null {
  if (!canvas.value) return null
  const ev = e as MouseEvent
  const rect = canvas.value.getBoundingClientRect()
  const px = ev.offsetX ?? ev.clientX - rect.left
  const py = ev.offsetY ?? ev.clientY - rect.top

  // 优先精确命中;否则取最近点并限制点击距离
  let hit = c.getElementsAtEventForMode(ev, 'nearest', { intersect: true }, false)
  if (hit.length) return hit[0].datasetIndex
  hit = c.getElementsAtEventForMode(ev, 'nearest', { intersect: false }, false)
  if (hit.length) {
    const el = c.getDatasetMeta(hit[0].datasetIndex).data[0]
    const dist = Math.hypot(el.x - px, el.y - py)
    if (dist <= 20) return hit[0].datasetIndex
  }
  return null
}

/** 悬停/选中时, 绘制从该点延伸到图表底部和右侧的矩形区域 */
const quadrantPlugin = {
  id: 'quadrant-overlay',
  afterDatasetsDraw(pluginChart: unknown) {
    const c = pluginChart as ChartJS<'scatter'>
    const m = displayModel.value
    if (!m || !c.chartArea) return
    const { left, right, top, bottom } = c.chartArea
    const cap = m.metrics[capabilityKey.value] ?? 0
    const mX = xValue(m)
    if (cap <= 0 || mX == null) return

    const x0 = c.scales.x.getPixelForValue(mX)
    const y1 = c.scales.y.getPixelForValue(cap)
    if (x0 >= right || y1 <= top) return

    const ctx = c.ctx
    ctx.save()
    ctx.fillStyle = 'rgba(220,38,38,0.08)'
    ctx.strokeStyle = 'rgba(220,38,38,0.55)'
    ctx.setLineDash([6, 4])
    ctx.lineWidth = 1.5
    ctx.fillRect(x0, y1, right - x0, bottom - y1)
    ctx.strokeRect(x0, y1, right - x0, bottom - y1)
    ctx.setLineDash([])
    ctx.fillStyle = 'rgba(220,38,38,0.9)'
    ctx.font = '11px Inter, sans-serif'
    ctx.fillText(`${xAxisComparisonLabel.value}更高 · 能力更低`, Math.max(left + 4, Math.min(x0 + 8, right - 150)), y1 + 14)
    ctx.restore()
  },
}

/** 悬停/选中/框内点的高亮圈 */
const hoverHighlightPlugin = {
  id: 'hover-highlight',
  afterDatasetsDraw(pluginChart: unknown) {
    const c = pluginChart as ChartJS<'scatter'>
    if (!c.chartArea) return
    const sel = displayModel.value
    const selCap = sel?.metrics[capabilityKey.value] ?? 0
    const selX = sel ? xValue(sel) : null
    const ctx = c.ctx
    ctx.save()
    for (let i = 0; i < plottable.value.length; i++) {
      const m = plottable.value[i]
      const pt = c.getDatasetMeta(i).data[0]
      if (!pt) continue
      const isActive = m.id === activeId.value
      const isHovered = m.id === hoverId.value
      const mX = xValue(m)
      const inQuadrant =
        !!sel &&
        selX != null &&
        mX != null &&
        m.id !== sel.id &&
        mX > selX &&
        (m.metrics[capabilityKey.value] ?? 0) < selCap
      if (!isActive && !isHovered && !inQuadrant) continue
      const col = getProviderColor(m.provider, i).border
      ctx.beginPath()
      ctx.arc(pt.x, pt.y, isActive || isHovered ? 9 : 7, 0, Math.PI * 2)
      ctx.fillStyle = isActive || isHovered ? 'rgba(37,99,235,0.18)' : 'rgba(220,38,38,0.12)'
      ctx.fill()
      ctx.strokeStyle = isActive || isHovered ? '#2563eb' : col
      ctx.lineWidth = isActive || isHovered ? 2.5 : 2
      ctx.stroke()
    }
    ctx.restore()
  },
}

/** 名称标签: 悬停/选中的始终显示; 其余在按钮开启且不重叠时显示 */
const labelPlugin = {
  id: 'point-labels',
  afterDatasetsDraw(pluginChart: unknown) {
    const c = pluginChart as ChartJS<'scatter'>
    if (!c.chartArea || plottable.value.length === 0) return
    const { left, right, top, bottom } = c.chartArea
    const ctx = c.ctx
    const textH = 12
    ctx.save()
    ctx.font = '10px Inter, sans-serif'
    ctx.textBaseline = 'middle'

    const points = plottable.value.map((_, i) => {
      const pt = c.getDatasetMeta(i).data[0]
      return pt ? { x: pt.x, y: pt.y } : null
    })
    const placed: { x: number; y: number; w: number; h: number }[] = []
    const selIdx = plottable.value.findIndex((m) => m.id === (activeId.value ?? hoverId.value))

    const hitsPoint = (r: { x: number; y: number; w: number; h: number }, px: number, py: number) => {
      const cx = Math.max(r.x, Math.min(px, r.x + r.w))
      const cy = Math.max(r.y, Math.min(py, r.y + r.h))
      return (px - cx) ** 2 + (py - cy) ** 2 < 6 * 6
    }

    const drawLabel = (i: number, force: boolean) => {
      const p = points[i]
      if (!p) return
      const text = shortName(plottable.value[i].name)
      const w = ctx.measureText(text).width + 6
      // 依次尝试: 右侧 → 左侧 → 上方 → 下方, 找第一个不越界且不挤占的位置
      const candidates = [
        { x: p.x + 8, y: p.y - textH / 2 },
        { x: p.x - 8 - w, y: p.y - textH / 2 },
        { x: p.x - w / 2, y: p.y - textH - 8 },
        { x: p.x - w / 2, y: p.y + 8 },
      ]
      for (const cand of candidates) {
        const rect = { x: cand.x, y: cand.y, w, h: textH }
        if (rect.x < left + 2 || rect.x + rect.w > right - 2 || rect.y < top + 2 || rect.y + rect.h > bottom - 2) continue
        const overlapsLabel = placed.some(
          (r) => rect.x < r.x + r.w && rect.x + rect.w > r.x && rect.y < r.y + r.h && rect.y + rect.h > r.y
        )
        const coversPoint = points.some((q) => q && hitsPoint(rect, q.x, q.y))
        if (!force && (overlapsLabel || coversPoint)) continue

        placed.push(rect)
        ctx.fillStyle = 'rgba(255,255,255,0.9)'
        if (typeof ctx.roundRect === 'function') {
          ctx.beginPath()
          ctx.roundRect(rect.x, rect.y, rect.w, rect.h, 4)
          ctx.fill()
        } else {
          ctx.fillRect(rect.x, rect.y, rect.w, rect.h)
        }
        ctx.fillStyle = 'rgba(31,41,55,0.92)'
        ctx.fillText(text, rect.x + 3, rect.y + textH / 2)
        return
      }
    }

    if (selIdx >= 0) drawLabel(selIdx, true)
    if (showLabels.value && plottable.value.length <= LABEL_OTHER_MAX) {
      for (let i = 0; i < plottable.value.length; i++) {
        if (i !== selIdx) drawLabel(i, false)
      }
    }
    ctx.restore()
  },
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
    chart = new ChartJS(
      canvas.value,
      {
        type: 'scatter',
        data,
        options,
        plugins: [reasoningConnectionsPlugin, quadrantPlugin, hoverHighlightPlugin, labelPlugin],
      }
    )
  } else {
    chart.data = data
    chart.options = options
    chart.update()
  }
}

watch(
  () => [props.models, props.hidden, props.selectedIds, capabilityKey.value, xAxisMode.value],
  render,
  { deep: true, flush: 'post' }
)

function pickActive(id: string) {
  activeId.value = id
  emit('select', id)
}

onMounted(() => {
  render()
  canvas.value?.addEventListener('mouseleave', onCanvasLeave)
})
onUnmounted(() => {
  canvas.value?.removeEventListener('mouseleave', onCanvasLeave)
  chart?.destroy()
  chart = null
})
</script>

<template>
  <div class="pcc">
    <div class="pcc-bar">
      <span class="pcc-lbl">横轴</span>
      <select
        class="pcc-sel"
        :value="xAxisMode"
        title="两种横轴口径独立展示,不会互相回退"
        @change="onXAxisChange"
      >
        <option value="tokenPrice">Token 价格</option>
        <option value="taskCost">LiveBench 单任务平均成本</option>
      </select>
      <span class="pcc-lbl">能力维度</span>
      <select class="pcc-sel" :value="capabilityKey" @change="onCapabilityChange">
        <option v-for="[k, label] in capOptions" :key="k" :value="k">{{ label }}</option>
      </select>
      <button class="pcc-lbl-btn" :class="{ on: showLabels }" @click="toggleLabels">
        名称 {{ showLabels ? '开' : '关' }}
      </button>
      <span class="pcc-hint">横轴口径独立取值,无跨平台回退 · 同模型相邻推理强度用细线连接 · 点击固定查看列表</span>
    </div>

    <div v-if="!plottable.length" class="pcc-empty">
      没有可绘制的模型(左侧未选中, 或缺少{{ xAxisLabel }}/能力数据)
    </div>
    <div v-else class="pcc-chart">
      <canvas ref="canvas"></canvas>
    </div>

    <div class="pcc-panel">
      <template v-if="displayModel">
        <div class="pcc-sel-head">
          <span class="pcc-sel-name">{{ displayModel.name }}</span>
          <span class="pcc-tag">{{ hoverId === displayModel.id ? '悬停' : '已选' }}</span>
          <span class="pcc-sel-meta">
            {{ formatXAxisAmount(xValue(displayModel) ?? 0) }}{{ xAxisSuffix }} ·
            {{ METRIC_LABELS[capabilityKey] }} {{ displayModel.metrics[capabilityKey] }}
          </span>
        </div>
        <div v-if="(displayModel.metrics[capabilityKey] ?? 0) <= 0" class="pcc-panel-empty">
          该模型在当前能力维度没有数据
        </div>
        <div v-else-if="!worseDeals.length" class="pcc-panel-empty">
          没有{{ xAxisComparisonLabel }}更高且能力更低的模型
        </div>
        <div v-else class="pcc-list">
          <div class="pcc-list-title">{{ xAxisComparisonLabel }}更高 · 能力更低</div>
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
              {{ formatXAxisAmount(xValue(m) ?? 0) }}
              <em class="pcc-delta">+{{ formatXAxisAmount((xValue(m) ?? 0) - (xValue(displayModel) ?? 0)) }}</em>
            </span>
            <span class="pcc-num pcc-cap">
              {{ METRIC_LABELS[capabilityKey] }} {{ m.metrics[capabilityKey] }}
              <em class="pcc-delta pcc-delta-down">-{{ displayModel.metrics[capabilityKey] - (m.metrics[capabilityKey] ?? 0) }}</em>
            </span>
          </div>
        </div>
      </template>
      <div v-else class="pcc-panel-empty">
        悬停或点击散点, 查看「{{ xAxisComparisonLabel }}更高 · 能力更低」的模型
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
.pcc-lbl-btn {
  padding: 4px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  color: #6b7280;
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}
.pcc-lbl-btn:hover {
  background: #f9fafb;
  border-color: #d1d5db;
}
.pcc-lbl-btn.on {
  background: #2563eb;
  border-color: #2563eb;
  color: #fff;
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
  height: 168px;
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
.pcc-tag {
  font-size: 0.62rem;
  font-weight: 600;
  color: #2563eb;
  background: #eff6ff;
  border-radius: 99px;
  padding: 1px 7px;
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
