import type { ArenaApiResponse, ModelInfo, RadarMetrics } from '../types'
import { METRIC_LABELS } from '../types'
import { arenaSampleModels } from '../data/arenaSampleData'

const ARENA_URL = '/api/arena'

export interface ArenaFetchResult {
  models: ModelInfo[]
  live: boolean // true=拉到线上数据,false=降级到样本
}

/**
 * arena 数据集 config 名 → 雷达维度候选键。
 * 已按真实数据集结构收敛(2026-08):
 * - text=综合推理, agent=智能体, text_factuality=事实可靠
 * - arena 数据集目前没有 code / instruction / long-context 榜,对应维度留 0
 */
const DIM_CATEGORY_CANDIDATES: Record<keyof RadarMetrics, string[][]> = {
  intelligence: [['text']],
  coding: [],
  instruction: [],
  longContext: [],
  agent: [['agent']],
  factuality: [['text_factuality'], ['search_factuality']],
  speed: [],
  price: [],
}

function capitalize(s: string): string {
  return s.replace(/\b[a-z]/g, (c) => c.toUpperCase())
}

function eloScore(rating: number, min: number, max: number): number {
  if (max === min) return 50
  return Math.round(((rating - min) / (max - min)) * 100)
}

function computeRanges(data: ArenaApiResponse): Record<string, { min: number; max: number } | null> {
  const ranges: Record<string, { min: number; max: number } | null> = {}
  for (const [cat, rows] of Object.entries(data.categories)) {
    const ratings = rows.map((r) => r.rating).filter((v): v is number => v != null)
    ranges[cat] = ratings.length ? { min: Math.min(...ratings), max: Math.max(...ratings) } : null
  }
  return ranges
}

function buildMetrics(
  data: ArenaApiResponse,
  key: string,
  ranges: Record<string, { min: number; max: number } | null>
): RadarMetrics {
  const dim = (candidates: string[][]): number => {
    for (const group of candidates) {
      for (const cat of group) {
        const row = data.categories[cat]?.find((r) => r.key === key)
        if (row && row.rating != null) {
          const rg = ranges[cat]
          return rg ? eloScore(row.rating, rg.min, rg.max) : 50
        }
      }
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
    price: 0,
  }
}

function transformArena(data: ArenaApiResponse): ModelInfo[] {
  const textRows = data.categories['text'] ?? Object.values(data.categories)[0] ?? []
  const ranges = computeRanges(data)

  return textRows.map((row) => {
    const metrics = buildMetrics(data, row.key, ranges)
    // 各分类的原始排行值(text Elo / agent score / factuality Elo …)
    const categories: Record<string, { rating: number | null; rank: number | null; votes: number | null }> = {}
    for (const [cat, rows] of Object.entries(data.categories)) {
      const r = rows.find((x) => x.key === row.key)
      if (r) categories[cat] = { rating: r.rating, rank: r.rank, votes: r.votes }
    }
    // 该模型从 arena 实际拿到的雷达维度(>0 才算有)
    const arenaMetrics: Partial<RadarMetrics> = {}
    for (const k of Object.keys(METRIC_LABELS) as (keyof RadarMetrics)[]) {
      if (metrics[k] > 0) arenaMetrics[k] = metrics[k]
    }
    return {
      id: row.key,
      name: row.name,
      provider: row.provider ? capitalize(row.provider) : 'Unknown',
      // TODO: arena 数据集暂无价格列,后续如提供再映射;当前显示 Free 仅为骨架占位
      rawPrice: 0,
      intelligenceIndex: metrics.intelligence,
      metrics,
      meta: {
        contextWindow: '—',
        outputSpeed: '—',
        latency: '—',
        modalities: '—',
        releaseDate: '—',
      },
      detail: {
        sources: { arena: arenaMetrics },
        arena: {
          rank: row.rank,
          votes: row.votes,
          license: row.license,
          publishedAt: row.publishedAt,
          categories,
        },
      },
    }
  })
}

/**
 * 拉取 arena 数据并转换为 ModelInfo。
 * 生产走 Vercel 函数 /api/arena;开发环境没有该函数,自动降级到内置样本。
 */
export async function fetchArenaModels(): Promise<ArenaFetchResult> {
  try {
    const resp = await fetch(ARENA_URL)
    if (!resp.ok) throw new Error(`Arena API ${resp.status}`)
    const data = (await resp.json()) as ArenaApiResponse
    const models = transformArena(data)
    if (!models.length) throw new Error('Arena 返回空数据')
    return { models, live: true }
  } catch (e) {
    console.warn('Arena 数据获取失败,降级到样本数据:', e)
    return { models: arenaSampleModels, live: false }
  }
}
