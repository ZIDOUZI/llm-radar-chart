<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import {
  Chart as ChartJS,
  RadarController,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js'
import type { ChartData, ChartOptions } from 'chart.js'
import type { ModelInfo } from '../types'
import { METRIC_LABELS } from '../types'

ChartJS.register(RadarController, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend)

const props = defineProps<{
  models: ModelInfo[]
  hidden: Set<string>
  activeMetrics: Set<string>
}>()

const emit = defineEmits<{
  'toggle-visibility': [id: string]
  hover: [m: ModelInfo | null]
}>()

const canvas = ref<HTMLCanvasElement | null>(null)
const hoveredIndex = ref(-1)
let chart: ChartJS<'radar'> | null = null
let leaveTimer: ReturnType<typeof setTimeout> | null = null

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

const PROVIDER_COLORS: Record<string, { bg: string; border: string }> = {
  'Anthropic':   { bg: 'rgba(204,120,92,0.2)',  border: '#cc785c' },
  'OpenAI':      { bg: 'rgba(107,114,128,0.15)', border: '#6b7280' },
  'Google':      { bg: 'rgba(52,168,83,0.2)',    border: '#34A853' },
  'DeepSeek':    { bg: 'rgba(28,127,248,0.2)',   border: '#1c7ff8' },
  'Alibaba':     { bg: 'rgba(235,53,104,0.2)',   border: '#EB3568' },
  'Meta':        { bg: 'rgba(4,122,254,0.2)',    border: '#047AFE' },
  'xAI':         { bg: 'rgba(107,114,128,0.15)', border: '#6b7280' },
  'Mistral':     { bg: 'rgba(115,108,211,0.2)',  border: '#736cd3' },
  'Kimi':        { bg: 'rgba(255,105,0,0.2)',    border: '#ff6900' },
  'MiniMax':     { bg: 'rgba(226,178,162,0.2)',  border: '#e2b2a2' },
  'NVIDIA':      { bg: 'rgba(134,183,55,0.2)',   border: '#86b737' },
  'Amazon':      { bg: 'rgba(255,153,0,0.2)',    border: '#FF9900' },
  'Z AI':        { bg: 'rgba(34,67,230,0.2)',    border: '#2243e6' },
  'Xiaomi':      { bg: 'rgba(253,111,0,0.2)',    border: '#fd6f00' },
  'Tencent':     { bg: 'rgba(21,33,169,0.2)',    border: '#1521a9' },
  'ByteDance':   { bg: 'rgba(124,89,245,0.2)',   border: '#7c59f5' },
  'Cohere':      { bg: 'rgba(0,137,244,0.2)',    border: '#0089f4' },
  'Perplexity':  { bg: 'rgba(115,108,211,0.2)',  border: '#736cd3' },
  'Upstage':     { bg: 'rgba(224,59,104,0.2)',   border: '#e23b68' },
  'InclusionAI': { bg: 'rgba(255,112,24,0.2)',   border: '#ff7018' },
}

// 未匹配 provider 时的后备颜色
const FALLBACK_BORDERS = ['#ff7018', '#047AFE', '#2243e6', '#0089f4', '#EB3568', '#7c59f5']
function getProviderColor(provider: string, index: number): { bg: string; border: string } {
  if (PROVIDER_COLORS[provider]) return PROVIDER_COLORS[provider]
  const c = FALLBACK_BORDERS[index % FALLBACK_BORDERS.length]
  return { bg: hexToRgba(c, 0.2), border: c }
}

// 记住每个模型的颜色，供 applyHoverFocus 使用
const modelColors = new Map<string, { bg: string; border: string }>()

/** 缩短模型名：去掉括号内的推理模式，超过 28 字符则截断 */
function shortName(name: string): string {
  const base = name.replace(/\s*\(.*$/, '')
  return base.length > 28 ? base.slice(0, 26) + '…' : base
}

const labels = Object.entries(METRIC_LABELS)
  .filter(([k]) => props.activeMetrics.has(k))
  .map(([, v]) => v)

const metricKeys = Object.keys(METRIC_LABELS).filter(k => props.activeMetrics.has(k)) as (keyof RadarMetrics)[]

function buildChartData(): ChartData<'radar'> {
  modelColors.clear()
  const datasets: ChartData<'radar'>['datasets'] = props.models.map((m, i) => {
    const c = getProviderColor(m.provider, i)
    modelColors.set(m.id, c)
    return {
      label: shortName(m.name),
      data: metricKeys.map(k => m.metrics[k]),
      backgroundColor: c.bg,
      borderColor: c.border,
      borderWidth: 2,
      pointBackgroundColor: c.border,
      pointBorderColor: '#fff',
      pointRadius: 4,
      pointHoverRadius: 6,
      hidden: props.hidden.has(m.id),
    }
  })

  // 2+ 模型时追加平均值线
  if (props.models.length >= 2) {
    const count = props.models.length
    const avg = metricKeys.map(() => 0)
    for (const m of props.models) {
      metricKeys.forEach((k, i) => { avg[i] += m.metrics[k] })
    }
    for (let i = 0; i < avg.length; i++) avg[i] = Math.round(avg[i] / count)

    datasets.push({
      label: 'Average',
      data: avg,
      backgroundColor: 'rgba(0,0,0,0)',
      borderColor: 'rgba(156,163,175,0.7)',
      borderWidth: 1.5,
      borderDash: [5, 5],
      pointBackgroundColor: '#9ca3af',
      pointBorderColor: '#fff',
      pointRadius: 3,
      pointHoverRadius: 5,
      hidden: false,
    })
  }

  return { labels, datasets }
}

function buildOptions(): ChartOptions<'radar'> {
  return {
    responsive: true,
    maintainAspectRatio: true,
    scales: {
      r: {
        beginAtZero: true,
        max: 100,
        min: 0,
        ticks: {
          stepSize: 20,
          backdropColor: 'transparent',
          font: { size: 10 },
          color: '#9ca3af',
        },
        pointLabels: {
          font: { size: 12, weight: 'bold' },
          color: '#374151',
        },
        grid: { color: 'rgba(0,0,0,0.06)' },
        angleLines: { color: 'rgba(0,0,0,0.06)' },
      },
    },
    plugins: {
      legend: {
        position: 'right',
        align: 'start',
        labels: {
          padding: 14,
          usePointStyle: true,
          pointStyle: 'circle',
          pointStyleWidth: 18,
          font: { size: 13 },
          generateLabels(chart) {
            const ds = chart.data.datasets
            return ds.map((d, i) => {
              if (i >= props.models.length) {
                // 平均值线
                return {
                  text: String(d.label || ''),
                  fillStyle: 'transparent',
                  strokeStyle: String(d.borderColor || '#9ca3af'),
                  lineWidth: 1.5,
                  hidden: false,
                  datasetIndex: i,
                  index: i,
                  pointStyle: 'line',
                  rotation: 0,
                }
              }
              const m = props.models[i]
              const c = modelColors.get(m.id)!
              const isHovered = hoveredIndex.value === i
              const alpha = isHovered ? 1 : (hoveredIndex.value === -1 ? 0.55 : 0.15)
              return {
                text: shortName(m.name),
                fillStyle: hexToRgba(c.border, alpha * 0.25),
                strokeStyle: hexToRgba(c.border, alpha),
                lineWidth: isHovered ? 3 : 2,
                hidden: false,
                datasetIndex: i,
                index: i,
                pointStyle: 'circle',
                rotation: 0,
              }
            })
          },
        },
        onHover(_e, item) {
          if (leaveTimer) { clearTimeout(leaveTimer); leaveTimer = null }
          if (item != null && item.datasetIndex != null && item.datasetIndex < props.models.length) {
            hoveredIndex.value = item.datasetIndex
            emit('hover', props.models[item.datasetIndex])
          }
        },
        onLeave() {
          leaveTimer = setTimeout(() => {
            hoveredIndex.value = -1
            emit('hover', null)
            leaveTimer = null
          }, 150)
        },
        onClick(_e, legendItem) {
          const idx = legendItem.datasetIndex
          if (idx !== undefined && idx < props.models.length) {
            emit('toggle-visibility', props.models[idx].id)
          }
        },
      },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const model = props.models[ctx.datasetIndex]
            if (!model) return ''
            const rawPrice = model.rawPrice
            let extra = ''
            if (metricKeys[ctx.dataIndex] === 'price' && rawPrice != null) {
              extra = ` ($${rawPrice.toFixed(2)}/1M tokens)`
            }
            return ` ${ctx.dataset.label}: ${ctx.raw}${extra}`
          },
        },
      },
    },
  }
}

function render() {
  if (!canvas.value) {
    if (chart) { chart.destroy(); chart = null }
    return
  }

  if (!chart) {
    chart = new ChartJS(canvas.value, {
      type: 'radar',
      data: buildChartData(),
      options: buildOptions(),
    })
  } else {
    chart.data = buildChartData()
    chart.options = buildOptions()
    chart.update()
  }
}

watch(() => [props.models, props.hidden, [...props.activeMetrics]], render, { deep: true, flush: 'post' })

function applyHoverFocus() {
  if (!chart) return
  const ds = chart.data.datasets
  const total = props.models.length
  ds.forEach((d, i) => {
    if (i >= total) return // 跳过平均值线
    const m = props.models[i]
    const c = modelColors.get(m.id)!
    if (hoveredIndex.value === -1) {
      d.backgroundColor = c.bg
      d.borderColor = c.border
      d.borderWidth = 2
      d.pointRadius = 4
      d.pointHoverRadius = 6
    } else if (i !== hoveredIndex.value) {
      d.backgroundColor = 'rgba(0,0,0,0.02)'
      d.borderColor = 'rgba(0,0,0,0.12)'
      d.borderWidth = 1
      d.pointRadius = 2
      d.pointHoverRadius = 3
    } else {
      d.backgroundColor = c.bg
      d.borderColor = c.border
      d.borderWidth = 3
      d.pointRadius = 6
      d.pointHoverRadius = 8
    }
  })
  chart.update('none')
}

watch(hoveredIndex, applyHoverFocus)

function onCanvasMove(e: MouseEvent) {
  if (!chart || !canvas.value) return
  // 鼠标在 legend 区域时跳过（右侧或底部），由 legend.onHover 处理
  const rect = canvas.value.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  const ca = chart.chartArea
  if (x > ca.right || y > ca.bottom) return

  if (leaveTimer) { clearTimeout(leaveTimer); leaveTimer = null }
  const els = chart.getElementsAtEventForMode(e, 'dataset', { intersect: false }, false)
  hoveredIndex.value = els.length > 0 ? (els[0] as any).datasetIndex : -1
}

function onCanvasLeave() {
  leaveTimer = setTimeout(() => {
    hoveredIndex.value = -1
    leaveTimer = null
  }, 250)
}

onMounted(() => {
  render()
  canvas.value?.addEventListener('mousemove', onCanvasMove)
  canvas.value?.addEventListener('mouseleave', onCanvasLeave)
})

onUnmounted(() => {
  canvas.value?.removeEventListener('mousemove', onCanvasMove)
  canvas.value?.removeEventListener('mouseleave', onCanvasLeave)
  chart?.destroy()
  chart = null
})
</script>

<template>
  <div class="radar-container">
    <div v-if="models.length === 0" class="radar-empty">
      <p>👈 请在左侧选择要对比的模型</p>
      <p class="radar-hint">点击 👁 按钮或图例控制显示/隐藏</p>
    </div>
    <div v-else class="radar-chart-wrapper">
      <canvas ref="canvas"></canvas>
    </div>
  </div>
</template>

<style scoped>
.radar-container { width: 100%; flex: 1; display: flex; align-items: center; }
.radar-chart-wrapper {
  width: 100%; height: 100%; background: #fff; border-radius: 10px;
  padding: 8px; border: 1px solid #e5e7eb; box-shadow: 0 1px 2px rgba(0,0,0,0.04);
  display: flex; align-items: center; justify-content: center;
}
.radar-chart-wrapper canvas { max-width: 100%; max-height: 100%; }
.radar-empty {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  flex: 1; height: 100%; background: #fff; border-radius: 10px;
  border: 1px solid #e5e7eb; box-shadow: 0 1px 2px rgba(0,0,0,0.04);
  color: #9ca3af; font-size: 1rem; gap: 8px;
}
.radar-hint { font-size: 0.8rem; color: #d1d5db; }
</style>
