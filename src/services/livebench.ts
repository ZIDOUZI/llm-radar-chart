import type { LivebenchApiResponse, ModelInfo, RadarMetrics } from '../types'
import { METRIC_LABELS } from '../types'
import { livebenchSampleModels } from '../data/livebenchSampleData'

const LIVEBENCH_URL = '/api/livebench'

export interface LivebenchFetchResult {
  models: ModelInfo[]
  live: boolean // true=拉到线上数据,false=降级到样本
}

/**
 * livebench 类别 -> 雷达维度候选。
 * 按官方 7 类映射:
 * - 综合推理 = Reasoning + Mathematics + Data Analysis + Language 的平均
 * - 编程 = Coding, 智能体 = Agentic Coding, 指令遵循 = IF
 * - longContext / factuality / speed 无对应榜,留 0 交给其它源回退
 */
const DIM_CATEGORY_CANDIDATES: Record<keyof RadarMetrics, string[][]> = {
  intelligence: [['Reasoning', 'Mathematics', 'Data Analysis', 'Language']],
  coding: [['Coding']],
  instruction: [['IF']],
  longContext: [],
  agent: [['Agentic Coding']],
  factuality: [],
  speed: [],
  price: [],
}

function capitalize(s: string): string {
  return s.replace(/\b[a-z]/g, (c) => c.toUpperCase())
}

function avg(values: number[]): number | null {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null
}

/** livebench 每成功任务成本 -> 价格优势分(越便宜越高,对数归一) */
function normalizePrice(costPerSuccessfulTask: number | null): number {
  if (costPerSuccessfulTask == null || costPerSuccessfulTask <= 0) return 0
  const minPrice = 0.01
  const maxPrice = 2.0
  const score = 100 - (Math.log2(costPerSuccessfulTask / minPrice) / Math.log2(maxPrice / minPrice)) * 100
  return Math.round(Math.max(0, Math.min(100, score)))
}

function buildMetrics(row: LivebenchApiResponse['models'][number]): RadarMetrics {
  const dim = (groups: string[][]): number => {
    for (const group of groups) {
      const values = group
        .map((cat) => row.categories[cat])
        .filter((v): v is number => v != null)
      const v = avg(values)
      if (v != null) return Math.round(v)
    }
    return 0
  }

  return {
    intelligence: dim(DIM_CATEGORY_CANDIDATES.intelligence),
    coding: dim(DIM_CATEGORY_CANDIDATES.coding),
    instruction: dim(DIM_CATEGORY_CANDIDATES.instruction),
    longContext: dim(DIM_CATEGORY_CANDIDATES.longContext),
    agent: dim(DIM_CATEGORY_CANDIDATES.agent),
    factuality: dim(DIM_CATEGORY_CANDIDATES.factuality),
    speed: 0,
    price: normalizePrice(row.costPerSuccessfulTask),
  }
}

export function transformLivebench(data: LivebenchApiResponse): ModelInfo[] {
  return data.models.map((row) => {
    const metrics = buildMetrics(row)
    const livebenchMetrics: Partial<RadarMetrics> = {}
    for (const k of Object.keys(METRIC_LABELS) as (keyof RadarMetrics)[]) {
      if (metrics[k] > 0) livebenchMetrics[k] = metrics[k]
    }
    return {
      id: row.key,
      name: row.name,
      provider: row.provider ? capitalize(row.provider) : 'Unknown',
      rawPrice: 0,
      livebenchCost: row.costPerSuccessfulTask,
      intelligenceIndex: 0,
      metrics,
      meta: {
        contextWindow: '—',
        outputSpeed: '—',
        latency: '—',
        modalities: '—',
        releaseDate: '—',
      },
      detail: {
        sources: { livebench: livebenchMetrics },
        livebench: {
          release: data.release,
          overall: row.overall,
          categories: row.categories,
          costPerTask: row.costPerTask,
          costPerSuccessfulTask: row.costPerSuccessfulTask,
        },
      },
    }
  })
}

/**
 * 拉取 livebench 数据并转换为 ModelInfo。
 * 生产走 Vercel 函数 /api/livebench;开发环境没有该函数,自动降级到内置样本。
 */
export async function fetchLivebenchModels(): Promise<LivebenchFetchResult> {
  try {
    const resp = await fetch(LIVEBENCH_URL)
    if (!resp.ok) throw new Error(`LiveBench API ${resp.status}`)
    const data = (await resp.json()) as LivebenchApiResponse
    const models = transformLivebench(data)
    if (!models.length) throw new Error('LiveBench 返回空数据')
    return { models, live: true }
  } catch (e) {
    console.warn('LiveBench 数据获取失败,降级到样本数据:', e)
    return { models: livebenchSampleModels, live: false }
  }
}
