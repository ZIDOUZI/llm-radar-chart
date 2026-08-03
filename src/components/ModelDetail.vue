<script setup lang="ts">
import { computed } from 'vue'
import type { ModelInfo, RadarMetrics } from '../types'
import { METRIC_LABELS } from '../types'
import type { PreferSource } from '../services/merge'
import RadarChart from './RadarChart.vue'

const props = defineProps<{ model: ModelInfo; prefer?: PreferSource }>()
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

const arenaDetail = computed(() => props.model.detail?.arena ?? null)
const sources = computed(() => props.model.detail?.sources ?? null)
const arenaCats = computed(() => Object.entries(arenaDetail.value?.categories ?? {}))

function srcVal(src: 'aa' | 'arena', k: keyof RadarMetrics): number | undefined {
  return sources.value?.[src]?.[k]
}

/** 当前展示的分值来自哪个源(用于标注) */
function activeSrc(k: keyof RadarMetrics): 'aa' | 'arena' | null {
  const v = props.model.metrics[k]
  if (v <= 0) return null
  const aa = srcVal('aa', k)
  const ar = srcVal('arena', k)
  if (aa != null && aa === v) return 'aa'
  if (ar != null && ar === v) return 'arena'
  return null
}

function hasSourceValue(k: keyof RadarMetrics): boolean {
  return srcVal('aa', k) != null || srcVal('arena', k) != null
}

function fmtRating(r: number | null): string {
  if (r == null) return '—'
  if (r >= 100) return Math.round(r).toLocaleString()
  if (r >= 1) return r.toFixed(3)
  return r.toFixed(4)
}

const CATEGORY_LABELS: Record<string, string> = {
  text: '综合推理榜',
  text_factuality: '事实可靠榜',
  agent: '智能体榜',
  search_factuality: '搜索事实榜',
  vision: '视觉榜',
  document: '文档榜',
  search: '搜索榜',
  image_edit: '图像编辑榜',
  text_to_image: '文生图榜',
  text_to_video: '文生视频榜',
  image_to_video: '图生视频榜',
  video_edit: '视频编辑榜',
  webdev: '网页开发榜',
}

const metaRows = computed(() => {
  const rows: Array<{ label: string; value: string }> = [
    { label: '厂商', value: props.model.provider },
    { label: '模型 ID', value: props.model.id },
  ]
  if (props.model.slug) rows.push({ label: 'AA Slug', value: props.model.slug })
  rows.push(
    { label: '发布日期', value: props.model.meta.releaseDate },
    { label: '上下文窗口', value: props.model.meta.contextWindow },
    { label: '输出速度', value: props.model.meta.outputSpeed },
    { label: '首 Token 延迟', value: props.model.meta.latency },
    { label: '模态支持', value: props.model.meta.modalities },
    { label: '混合价格', value: `${priceText.value}/1M tokens` },
    { label: 'Intelligence Index', value: props.model.intelligenceIndex ? String(props.model.intelligenceIndex) : '—' },
  )
  if (arenaDetail.value) {
    rows.push(
      { label: 'Arena 排名', value: arenaDetail.value.rank != null ? `#${arenaDetail.value.rank}` : '—' },
      { label: 'Arena 票数', value: arenaDetail.value.votes != null ? arenaDetail.value.votes.toLocaleString() : '—' },
      { label: '许可证', value: arenaDetail.value.license ?? '—' },
      { label: 'Arena 数据日期', value: arenaDetail.value.publishedAt ?? '—' },
    )
  }
  return rows
})
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
      <div v-if="arenaDetail" class="dc">
        <div class="dc-lbl">Arena 排名</div>
        <div class="dc-val">{{ arenaDetail.rank != null ? '#' + arenaDetail.rank : '—' }}</div>
        <div class="dc-sub">{{ arenaDetail.votes != null ? arenaDetail.votes.toLocaleString() + ' 票' : '' }}</div>
      </div>
      <div v-if="arenaDetail?.license" class="dc">
        <div class="dc-lbl">许可证</div>
        <div class="dc-val dc-sm">{{ arenaDetail.license }}</div>
      </div>
    </div>

    <div class="d-grid">
      <section class="d-panel">
        <h2 class="d-panel-h">能力雷达</h2>
        <div class="d-radar">
          <RadarChart :models="single" :hidden="emptyHidden" :active-metrics="allMetrics" no-legend />
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
            <div v-if="hasSourceValue(k)" class="dm-srcs">
              <span v-if="srcVal('aa', k) != null" class="dms" :class="{ on: activeSrc(k) === 'aa' }">AA {{ srcVal('aa', k) }}</span>
              <span v-if="srcVal('arena', k) != null" class="dms" :class="{ on: activeSrc(k) === 'arena' }">Arena {{ srcVal('arena', k) }}</span>
            </div>
          </div>
        </div>
      </section>
    </div>

    <section v-if="arenaCats.length" class="d-panel">
      <h2 class="d-panel-h">Arena 排行榜数据</h2>
      <table class="d-meta">
        <thead>
          <tr>
            <th class="d-meta-lbl">榜单</th>
            <th class="d-meta-lbl">分值</th>
            <th class="d-meta-lbl">排名</th>
            <th class="d-meta-lbl">样本</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="[cat, v] in arenaCats" :key="cat">
            <td class="d-meta-val">{{ CATEGORY_LABELS[cat] ?? cat }}</td>
            <td class="d-meta-val">{{ fmtRating(v.rating) }}</td>
            <td class="d-meta-val">{{ v.rank != null ? '#' + v.rank : '—' }}</td>
            <td class="d-meta-val">{{ v.votes != null ? v.votes.toLocaleString() : '—' }}</td>
          </tr>
        </tbody>
      </table>
    </section>

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
  max-width: 1160px;
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
.d-sub { display: flex; align-items: center; gap: 8px; margin-top: 6px; flex-wrap: wrap; }
.d-prov {
  font-size: 0.72rem; font-weight: 600; color: #2563eb;
  background: #eff6ff; border: 1px solid #dbeafe; padding: 2px 8px; border-radius: 99px;
}
.d-rel { font-size: 0.75rem; color: #9ca3af; }
.d-iq { text-align: right; flex-shrink: 0; }
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

.d-grid { display: grid; grid-template-columns: 1.6fr 1fr; gap: 14px; align-items: stretch; }
@media (max-width: 980px) { .d-grid { grid-template-columns: 1fr; } }

.d-panel {
  background: #fff; border: 1px solid #e5e7eb; border-radius: 10px;
  padding: 14px 16px; box-shadow: 0 1px 2px rgba(0,0,0,0.04);
}
.d-panel-h { font-size: 0.8rem; font-weight: 600; color: #374151; margin-bottom: 10px; }

.d-radar { height: 520px; }
.d-radar :deep(.radar-chart-wrapper) { height: 100%; border: none; box-shadow: none; }

.d-metrics { display: flex; flex-direction: column; gap: 11px; }
.dm-head { display: flex; justify-content: space-between; font-size: 0.75rem; margin-bottom: 3px; }
.dm-name { color: #374151; }
.dm-score { color: #6366f1; font-weight: 700; }
.dm-bar { height: 6px; background: #f3f4f6; border-radius: 99px; overflow: hidden; }
.dm-fill { height: 100%; background: linear-gradient(90deg, #6366f1, #2563eb); border-radius: 99px; }
.dm-srcs { display: flex; gap: 8px; margin-top: 4px; }
.dms {
  font-size: 0.62rem; color: #9ca3af; padding: 1px 7px; border-radius: 99px;
  background: #f9fafb; border: 1px solid #f3f4f6;
}
.dms.on { color: #2563eb; background: #eff6ff; border-color: #dbeafe; font-weight: 600; }

.d-meta { width: 100%; border-collapse: collapse; }
.d-meta tr { border-bottom: 1px solid #f3f4f6; }
.d-meta tr:last-child { border-bottom: none; }
.d-meta-lbl { width: 140px; padding: 8px 4px; font-size: 0.75rem; color: #9ca3af; text-align: left; }
.d-meta-val { padding: 8px 4px; font-size: 0.8rem; color: #111827; font-weight: 500; }
.d-meta thead .d-meta-lbl { font-size: 0.68rem; font-weight: 600; color: #9ca3af; }
</style>
