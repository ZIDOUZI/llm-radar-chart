import type { ModelDetailExtra, ModelInfo, RadarMetrics } from '../types'
import { METRIC_LABELS } from '../types'
import { matchModelsToTargets } from './match'

/** 优先显示的数据源 */
export type PreferSource = 'aa' | 'arena' | 'livebench'

const DIM_KEYS = Object.keys(METRIC_LABELS) as (keyof RadarMetrics)[]
const SOURCE_ORDER: PreferSource[] = ['aa', 'arena', 'livebench']

/** 按偏好顺序取第一个非零值 */
function pickDim(prefer: PreferSource, values: Partial<Record<PreferSource, number | undefined>>): number {
  const order = [prefer, ...SOURCE_ORDER.filter((s) => s !== prefer)]
  for (const s of order) {
    const v = values[s]
    if (v != null && v > 0) return v
  }
  return 0
}

function pickMeta(aa: string, ar: string): string {
  return aa && aa !== '—' ? aa : ar
}

/** 第一步:AA + Arena 合并(与历史行为一致) */
function mergeAaArena(aa: ModelInfo[], arena: ModelInfo[], prefer: PreferSource): ModelInfo[] {
  if (!arena.length) return aa

  const matched = matchModelsToTargets(arena, aa)
  const usedArena = new Set<string>()

  const merged: ModelInfo[] = aa.map((m) => {
    const ar = matched.get(m.id)
    if (!ar) {
      return {
        ...m,
        detail: {
          sources: { aa: { ...m.metrics } },
        },
      }
    }
    usedArena.add(ar.id)

    const metrics = {} as RadarMetrics
    for (const k of DIM_KEYS) {
      metrics[k] = pickDim(prefer, {
        aa: m.metrics[k],
        arena: ar.metrics[k],
      })
    }

    const detail: ModelDetailExtra = {
      sources: {
        aa: { ...m.metrics },
        arena: ar.detail?.sources?.arena,
      },
      arena: ar.detail?.arena,
    }

    return {
      ...m,
      rawPrice: pickDim(prefer, { aa: m.rawPrice, arena: ar.rawPrice }),
      intelligenceIndex: pickDim(prefer, { aa: m.intelligenceIndex, arena: ar.intelligenceIndex }),
      metrics,
      meta: {
        contextWindow: pickMeta(m.meta.contextWindow, ar.meta.contextWindow),
        outputSpeed: pickMeta(m.meta.outputSpeed, ar.meta.outputSpeed),
        latency: pickMeta(m.meta.latency, ar.meta.latency),
        modalities: pickMeta(m.meta.modalities, ar.meta.modalities),
        releaseDate: pickMeta(m.meta.releaseDate, ar.meta.releaseDate),
      },
      detail,
    }
  })

  for (const ar of arena) {
    if (!usedArena.has(ar.id)) merged.push(ar)
  }
  return merged
}

/**
 * 合并三个数据源的模型:
 * - 先按历史逻辑合并 AA + Arena
 * - 再把 LiveBench 按模型名配对到合并结果,每个雷达维度按 prefer 取优先源,
 *   缺失(0/占位)时依次回退到其余源
 * - 各源独有的模型都保留在列表里
 */
export function mergeModels(
  aa: ModelInfo[],
  arena: ModelInfo[],
  livebench: ModelInfo[],
  prefer: PreferSource
): ModelInfo[] {
  let merged = mergeAaArena(aa, arena, prefer)
  if (!livebench.length) return merged

  const matched = matchModelsToTargets(livebench, merged)
  const usedLivebench = new Set<string>()

  merged = merged.map((m) => {
    const lb = matched.get(m.id)
    if (!lb) return m
    usedLivebench.add(lb.id)

    const metrics = {} as RadarMetrics
    for (const k of DIM_KEYS) {
      metrics[k] = pickDim(prefer, {
        aa: m.detail?.sources?.aa?.[k],
        arena: m.detail?.sources?.arena?.[k],
        livebench: lb.detail?.sources?.livebench?.[k],
      })
    }

    return {
      ...m,
      metrics,
      livebenchCost: lb.livebenchCost ?? m.livebenchCost,
      detail: {
        sources: {
          aa: m.detail?.sources?.aa,
          arena: m.detail?.sources?.arena,
          livebench: lb.detail?.sources?.livebench,
        },
        arena: m.detail?.arena,
        livebench: lb.detail?.livebench,
      },
    }
  })

  for (const lb of livebench) {
    if (!usedLivebench.has(lb.id)) merged.push(lb)
  }
  return merged
}
