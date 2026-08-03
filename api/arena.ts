/**
 * arena.ai (LMArena) 数据代理 — 骨架实现
 *
 * arena.ai 官方没有公开 API,数据从官方 HuggingFace 数据集读取:
 *   https://huggingface.co/datasets/lmarena-ai/leaderboard-dataset
 * 走 datasets-server rows 接口(无需 API key):
 *   GET https://datasets-server.huggingface.co/rows?dataset=...&config=default&split=train&offset=0&length=100
 *
 * TODO(骨架阶段):
 * 1. 按真实数据集结构收敛字段映射(目前按常见命名防御性匹配)
 * 2. 缓存最近一期结果,避免每次冷启动重复拉取
 * 3. 收敛分页策略(MAX_ROWS 目前是拍脑袋的值)
 */
import type { ArenaApiResponse, ArenaLeaderboardRow } from '../src/types'

const HF_DATASET = 'lmarena-ai/leaderboard-dataset'
const HF_BASE = 'https://datasets-server.huggingface.co'
const PAGE_SIZE = 100
const MAX_ROWS = 500

type VercelRequest = {
  method?: string
}

type VercelResponse = {
  status(code: number): VercelResponse
  json(body: unknown): VercelResponse
}

const NAME_KEYS = ['model_name', 'model', 'name']
const ORG_KEYS = ['organization', 'org', 'vendor', 'model_creator', 'provider']
const LICENSE_KEYS = ['license', 'model_license']
const RANK_KEYS = ['rank']
const RATING_KEYS = ['rating', 'score', 'elo', 'elo_score']
const VOTES_KEYS = ['votes', 'vote_count', 'num_votes', 'num_votes_total']
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

async function fetchPage(
  offset: number,
  length: number
): Promise<{ rows: Record<string, unknown>[]; columns: string[] }> {
  const url = `${HF_BASE}/rows?dataset=${encodeURIComponent(HF_DATASET)}&config=default&split=train&offset=${offset}&length=${length}`
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

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
): Promise<void> {
  if (request.method !== 'GET') {
    response.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const first = await fetchPage(0, PAGE_SIZE)
    const rows: Record<string, unknown>[] = [...first.rows]
    for (let offset = PAGE_SIZE; offset < MAX_ROWS; offset += PAGE_SIZE) {
      const page = await fetchPage(offset, PAGE_SIZE)
      rows.push(...page.rows)
      if (page.rows.length < PAGE_SIZE) break
    }

    const normalized = rows.map(normalizeRow).filter((r) => r.name)
    const dates = normalized
      .map((r) => r.publishedAt)
      .filter((d): d is string => !!d)
    // 只保留最近一期的排行榜
    const latestDate = dates.length ? dates.reduce((a, b) => (b > a ? b : a)) : null
    const latest = latestDate ? normalized.filter((r) => r.publishedAt === latestDate) : normalized

    const categories: Record<string, ArenaLeaderboardRow[]> = {}
    for (const r of latest) {
      const c = r.category ?? 'default'
      ;(categories[c] ??= []).push(r)
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
      .json({ ...payload, columns: first.columns } as ArenaApiResponse & { columns: string[] })
  } catch {
    response.status(502).json({ error: 'Arena 数据获取失败' })
  }
}
