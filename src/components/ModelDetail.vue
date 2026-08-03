<script setup lang="ts">
import { computed } from 'vue'
import type { ModelInfo, RadarMetrics } from '../types'
import { METRIC_LABELS } from '../types'
import RadarChart from './RadarChart.vue'

const props = defineProps<{ model: ModelInfo }>()
const emit = defineEmits<{ back: [] }>()

const allMetricKeys = Object.keys(METRIC_LABELS) as (keyof RadarMetrics)[]
const metricEntries = allMetricKeys.map(k => [k, METRIC_LABELS[k]] as const)

const single = computed<ModelInfo[]>(() => [props.model])
const emptyHidden = computed(() => new Set<string>())
const allMetrics = computed(() => new Set<string>(allMetricKeys))

const priceText = computed(() =>
  props.model.rawPrice > 0 ? '$' + props.model.rawPrice.toFixed(2) : 'Free'
)

const extUrl = computed(() => {
  const slug = props.model.slug ?? props.model.id
  return `https://artificialanalysis.ai/models/${encodeURIComponent(slug)}`
})

const metaRows = computed(() => [
  { label: '厂商', value: props.model.provider },
  { label: '发布日期', value: props.model.meta.releaseDate },
  { label: '上下文窗口', value: props.model.meta.contextWindow },
  { label: '输出速度', value: props.model.meta.outputSpeed },
  { label: '首 Token 延迟', value: props.model.meta.latency },
  { label: '模态支持', value: props.model.meta.modalities },
  { label: '混合价格', value: `${priceText.value}/1M tokens` },
])
</script>

<template>
  <div class="detail">
    <div class="d-top">
      <button class="d-back" @click="emit('back')">← 返回对比</button>
      <a class="d-ext" :href="extUrl" target="_blank" rel="noopener noreferrer">
        在 artificialanalysis.ai 查看 ↗
      </a>
    </div>

    <div class="d-hero">
      <div class="d-title">
        <h1 class="d-name">{{ model.name }}</h1>
        <div class="d-sub">
          <span class="d-prov">{{ model.provider }}</span>
          <span class="d-rel">发布于 {{ model.meta.releaseDate }}</span>
        </div>
      </div>
      <div class="d-iq">
        <div class="d-iq-num">{{ model.intelligenceIndex || '—' }}</div>
        <div class="d-iq-lbl">Intelligence Index</div>
      </div>
    </div>

    <div class="d-cards">
      <div class="dc">
        <div class="dc-lbl">价格</div>
        <div class="dc-val">{{ priceText }}</div>
        <div class="dc-sub">per 1M tokens</div>
      </div>
      <div class="dc">
        <div class="dc-lbl">输出速度</div>
        <div class="dc-val">{{ model.meta.outputSpeed }}</div>
      </div>
      <div class="dc">
        <div class="dc-lbl">上下文窗口</div>
        <div class="dc-val">{{ model.meta.contextWindow }}</div>
      </div>
      <div class="dc">
        <div class="dc-lbl">首 Token 延迟</div>
        <div class="dc-val">{{ model.meta.latency }}</div>
      </div>
      <div class="dc">
        <div class="dc-lbl">模态支持</div>
        <div class="dc-val dc-sm">{{ model.meta.modalities }}</div>
      </div>
    </div>

    <div class="d-grid">
      <section class="d-panel">
        <h2 class="d-panel-h">能力雷达</h2>
        <div class="d-radar">
          <RadarChart :models="single" :hidden="emptyHidden" :active-metrics="allMetrics" />
        </div>
      </section>

      <section class="d-panel">
        <h2 class="d-panel-h">维度评分</h2>
        <div class="d-metrics">
          <div v-for="[k, label] in metricEntries" :key="k" class="dm">
            <div class="dm-head">
              <span class="dm-name">{{ label }}</span>
              <span class="dm-score">{{ model.metrics[k] }}</span>
            </div>
            <div class="dm-bar">
              <div class="dm-fill" :style="{ width: model.metrics[k] + '%' }"></div>
            </div>
          </div>
        </div>
      </section>
    </div>

    <section class="d-panel">
      <h2 class="d-panel-h">模型信息</h2>
      <table class="d-meta">
        <tbody>
          <tr v-for="row in metaRows" :key="row.label">
            <td class="d-meta-lbl">{{ row.label }}</td>
            <td class="d-meta-val">{{ row.value }}</td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>

<style scoped>
.detail {
  width: 100%;
  max-width: 1080px;
  margin: 0 auto;
  padding: 18px 24px 32px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.d-top { display: flex; align-items: center; justify-content: space-between; }
.d-back {
  font-size: 0.8rem; padding: 6px 14px; border-radius: 8px;
  border: 1px solid #e5e7eb; background: #fff; color: #374151;
  cursor: pointer; transition: all 0.15s;
}
.d-back:hover { background: #f9fafb; border-color: #d1d5db; }
.d-ext { font-size: 0.75rem; color: #2563eb; text-decoration: none; }
.d-ext:hover { text-decoration: underline; }

.d-hero {
  display: flex; align-items: flex-end; justify-content: space-between; gap: 16px;
  padding: 4px 2px;
}
.d-name { font-size: 1.6rem; font-weight: 700; letter-spacing: -0.02em; color: #111827; }
.d-sub { display: flex; align-items: center; gap: 8px; margin-top: 6px; }
.d-prov {
  font-size: 0.72rem; font-weight: 600; color: #2563eb;
  background: #eff6ff; border: 1px solid #dbeafe; padding: 2px 8px; border-radius: 99px;
}
.d-rel { font-size: 0.75rem; color: #9ca3af; }
.d-iq { text-align: right; }
.d-iq-num { font-size: 2.2rem; font-weight: 800; color: #6366f1; line-height: 1; }
.d-iq-lbl { font-size: 0.65rem; color: #9ca3af; margin-top: 4px; }

.d-cards {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 10px;
}
.dc {
  background: #fff; border: 1px solid #e5e7eb; border-radius: 10px;
  padding: 12px 14px; box-shadow: 0 1px 2px rgba(0,0,0,0.04);
}
.dc-lbl { font-size: 0.68rem; color: #9ca3af; }
.dc-val { font-size: 1.05rem; font-weight: 700; color: #111827; margin-top: 4px; white-space: nowrap; }
.dc-val.dc-sm { font-size: 0.85rem; white-space: normal; line-height: 1.4; }
.dc-sub { font-size: 0.62rem; color: #d1d5db; margin-top: 2px; }

.d-grid { display: grid; grid-template-columns: 1.35fr 1fr; gap: 14px; align-items: stretch; }
@media (max-width: 860px) { .d-grid { grid-template-columns: 1fr; } }

.d-panel {
  background: #fff; border: 1px solid #e5e7eb; border-radius: 10px;
  padding: 14px 16px; box-shadow: 0 1px 2px rgba(0,0,0,0.04);
}
.d-panel-h { font-size: 0.8rem; font-weight: 600; color: #374151; margin-bottom: 10px; }

.d-radar { height: 380px; }
.d-radar :deep(.radar-chart-wrapper) { height: 100%; border: none; box-shadow: none; }

.d-metrics { display: flex; flex-direction: column; gap: 9px; }
.dm-head { display: flex; justify-content: space-between; font-size: 0.75rem; margin-bottom: 3px; }
.dm-name { color: #374151; }
.dm-score { color: #6366f1; font-weight: 700; }
.dm-bar { height: 6px; background: #f3f4f6; border-radius: 99px; overflow: hidden; }
.dm-fill { height: 100%; background: linear-gradient(90deg, #6366f1, #2563eb); border-radius: 99px; }

.d-meta { width: 100%; border-collapse: collapse; }
.d-meta tr { border-bottom: 1px solid #f3f4f6; }
.d-meta tr:last-child { border-bottom: none; }
.d-meta-lbl { width: 140px; padding: 8px 4px; font-size: 0.75rem; color: #9ca3af; }
.d-meta-val { padding: 8px 4px; font-size: 0.8rem; color: #111827; font-weight: 500; }
</style>
