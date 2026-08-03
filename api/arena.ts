/**
 * arena.ai (LMArena) 数据代理 — 骨架实现
 *
 * arena.ai 官方没有公开 API,数据从官方 HuggingFace 数据集读取:
 *   https://huggingface.co/datasets/lmarena-ai/leaderboard-dataset
 * 走 datasets-server filter 接口(无需 API key),只取每类榜单的 overall 主榜:
 *   GET .../filter?dataset=...&config=text&split=latest&where="category" = 'overall'&offset=0&length=100
 *
 * 真实数据结构(2026-08 验证):
 * - config 按分类划分:text / text_factuality / agent / vision / document / search / ...(暂无 code 榜)
 * - split 用 latest(最新一期),行内 category 均为 overall
 * - 列:text 类用 rating,agent 类用 score(防御性映射已覆盖)
 *
 * TODO(骨架阶段):
 * 1. 目前只拉取前端维度映射需要的 config(text/text_factuality/agent),其余分类后续按需加
 * 2. 缓存最近一期结果,避免每次冷启动重复拉取(已加 CDN 缓存头,长期可再加函数内缓存)
 */
import type { ArenaApiResponse, ArenaLeaderboardRow } from '../src/types'

const HF_DATASET = 'lmarena-ai/leaderboard-dataset'
const HF_BASE = 'https://datasets-server.huggingface.co'
const PAGE_SIZE = 100
const MAX_ROWS_PER_CONFIG = 400

type VercelRequest = {
  method?: string
}

type VercelResponse = {
  status(code: number): VercelResponse
  setHeader(name: string, value: string): VercelResponse
  json(body: unknown): VercelResponse
}

// 要拉取的 config。按前端雷达维度映射挑选:
// text=综合推理, text_factuality=事实可靠, agent=智能体
const FETCH_CONFIGS = ['text', 'text_factuality', 'agent']

const NAME_KEYS = ['model_name', 'model', 'name']
const ORG_KEYS = ['organization', 'org', 'vendor', 'model_creator', 'provider']
const LICENSE_KEYS = ['license', 'model_license']
const RANK_KEYS = ['rank']
const RATING_KEYS = ['rating', 'score', 'elo', 'elo_score']
const VOTES_KEYS = ['votes', 'vote_count', 'num_votes', 'num_votes_total', 'observation_count', 'session_count']
const DATE_KEYS = ['leaderboard_publish_date', 'publish_date', 'date', 'updated_at']
const CATEGORY_KEYS = ['category', 'leaderboard', 'arena', 'leaderboard_name']

function pick(row: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    const v = row[k]
    if (v != null && v !== '') return v
  }
  return null
}

function toNum(v: unknown): number | null {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function toStr(v: unknown): string | null {
  return v == null ? null : String(v)
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function normalizeRow(row: Record<string, unknown>): ArenaLeaderboardRow {
  const name = toStr(pick(row, NAME_KEYS)) ?? ''
  return {
    key: slugify(name),
    name,
    provider: toStr(pick(row, ORG_KEYS)),
    license: toStr(pick(row, LICENSE_KEYS)),
    rank: toNum(pick(row, RANK_KEYS)),
    rating: toNum(pick(row, RATING_KEYS)),
    votes: toNum(pick(row, VOTES_KEYS)),
    category: toStr(pick(row, CATEGORY_KEYS)),
    publishedAt: toStr(pick(row, DATE_KEYS)),
  }
}

async function fetchOverallPage(
  config: string,
  offset: number
): Promise<{ rows: Record<string, unknown>[]; columns: string[] }> {
  const where = encodeURIComponent(`"category" = 'overall'`)
  const url = `${HF_BASE}/filter?dataset=${encodeURIComponent(HF_DATASET)}&config=${encodeURIComponent(config)}&split=latest&where=${where}&offset=${offset}&length=${PAGE_SIZE}`
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`HF datasets-server ${resp.status}`)
  const body = (await resp.json()) as {
    rows?: Array<{ row: Record<string, unknown> }>
    features?: Array<{ name: string }>
  }
  return {
    rows: (body.rows ?? []).map((r) => r.row),
    columns: (body.features ?? []).map((f) => f.name),
  }
}

async function fetchConfig(
  config: string
): Promise<{ config: string; rows: ArenaLeaderboardRow[]; columns: string[] }> {
  const all: Record<string, unknown>[] = []
  let columns: string[] = []
  for (let offset = 0; offset < MAX_ROWS_PER_CONFIG; offset += PAGE_SIZE) {
    const page = await fetchOverallPage(config, offset)
    columns = page.columns
    all.push(...page.rows)
    if (page.rows.length < PAGE_SIZE) break
  }
  return {
    config,
    rows: all.map(normalizeRow).filter((r) => r.name),
    columns,
  }
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
): Promise<void> {
  if (request.method !== 'GET') {
    response.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const results = await Promise.all(FETCH_CONFIGS.map(fetchConfig))
    const categories: Record<string, ArenaLeaderboardRow[]> = {}
    const columns: Record<string, string[]> = {}
    let latestDate: string | null = null
    for (const r of results) {
      categories[r.config] = r.rows
      columns[r.config] = r.columns
      for (const row of r.rows) {
        if (row.publishedAt && (!latestDate || row.publishedAt > latestDate)) {
          latestDate = row.publishedAt
        }
      }
    }

    const payload: ArenaApiResponse = {
      source: 'arena',
      generatedAt: new Date().toISOString(),
      latestDate,
      categories,
    }
    // columns 字段用于联调时核对真实数据列名(骨架阶段有用)
    response
      .status(200)
      .setHeader('cache-control', 'public, max-age=0, s-maxage=3600')
      .json({ ...payload, columns: columns } as ArenaApiResponse & { columns: Record<string, string[]> })
  } catch {
    response.status(502).json({ error: 'Arena 数据获取失败' })
  }
}
