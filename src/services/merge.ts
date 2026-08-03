import type { ModelInfo, RadarMetrics } from '../types'
import { METRIC_LABELS } from '../types'
import { matchArenaToAa } from './match'

/** 优先显示的数据源 */
export type PreferSource = 'aa' | 'arena'

const DIM_KEYS = Object.keys(METRIC_LABELS) as (keyof RadarMetrics)[]

function pickDim(prefer: PreferSource, aa: number, ar: number): number {
  return prefer === 'aa' ? (aa > 0 ? aa : ar) : (ar > 0 ? ar : aa)
}

function pickMeta(aa: string, ar: string): string {
  return aa && aa !== '—' ? aa : ar
}

/**
 * 合并两个数据源的模型:
 * - 按模型名把 AA 与 arena 模型配对(见 match.ts)
 * - 每个雷达维度按 prefer 取优先源的值,缺失(0/占位)时回退到另一个源
 * - arena 独有的模型也保留在列表里
 */
export function mergeModels(aa: ModelInfo[], arena: ModelInfo[], prefer: PreferSource): ModelInfo[] {
  if (!arena.length) return aa

  const matched = matchArenaToAa(arena, aa)
  const usedArena = new Set<string>()

  const merged: ModelInfo[] = aa.map((m) => {
    const ar = matched.get(m.id)
    if (!ar) return m
    usedArena.add(ar.id)

    const metrics = {} as RadarMetrics
    for (const k of DIM_KEYS) metrics[k] = pickDim(prefer, m.metrics[k], ar.metrics[k])

    return {
      ...m,
      rawPrice: pickDim(prefer, m.rawPrice, ar.rawPrice),
      intelligenceIndex: pickDim(prefer, m.intelligenceIndex, ar.intelligenceIndex),
      metrics,
      meta: {
        contextWindow: pickMeta(m.meta.contextWindow, ar.meta.contextWindow),
        outputSpeed: pickMeta(m.meta.outputSpeed, ar.meta.outputSpeed),
        latency: pickMeta(m.meta.latency, ar.meta.latency),
        modalities: pickMeta(m.meta.modalities, ar.meta.modalities),
        releaseDate: pickMeta(m.meta.releaseDate, ar.meta.releaseDate),
      },
    }
  })

  for (const ar of arena) {
    if (!usedArena.has(ar.id)) merged.push(ar)
  }
  return merged
}
