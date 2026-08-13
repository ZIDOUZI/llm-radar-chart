/**
 * livebench.ai 数据代理
 *
 * 数据源: LiveBench 官方站点静态文件(与官网前端同源,无需 API key):
 *   https://livebench.ai/table_<release>.csv        — 每子任务得分(0-100)
 *   https://livebench.ai/categories_<release>.json  — 类别 -> 子任务列表
 *   https://livebench.ai/cost_<release>.csv         — 每模型成本(部分版本才有)
 * release 里的 '-' 在文件名中为 '_'(官网前端约定)。
 *
 * 模型显示名/厂商取自官方 modelLinks 快照(api/livebenchModelNames.json)。
 * 快照未覆盖的新模型回退为美化后的原始 key;官方新增 release 时把日期加进
 * RELEASES(最新在前)即可。
 */
import type { LivebenchApiResponse, LivebenchRow } from '../src/types'
import { livebenchModelNames } from './livebenchModelNames'

const LIVEBENCH_BASE = 'https://livebench.ai'
const RELEASES = [
  '2026-06-25',
  '2026-01-08',
  '2025-12-23',
  '2025-11-25',
  '2025-05-30',
  '2025-04-25',
  '2025-04-02',
  '2024-11-25',
  '2024-08-31',
  '2024-07-26',
  '2024-06-24',
]

type VercelRequest = {
  method?: string
}

type VercelResponse = {
  status(code: number): VercelResponse
  setHeader(name: string, value: string): VercelResponse
  json(body: unknown): VercelResponse
}

type NameEntry = { name: string | null; org: string | null }
type CsvRow = Record<string, string | number>

const CATEGORY_ORDER = [
  'Reasoning',
  'Coding',
  'Agentic Coding',
  'Mathematics',
  'Data Analysis',
  'Language',
  'IF',
]

/** 简易 CSV 解析:支持引号包裹字段与逗号内换行 */
export function parseCsv(text: string): CsvRow[] {
  const rows: CsvRow[] = []
  const records: string[][] = []
  let cur: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += c
      }
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      cur.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      cur.push(field)
      field = ''
      if (cur.some((v) => v.trim() !== '')) records.push(cur)
      cur = []
    } else {
      field += c
    }
  }
  if (cur.some((v) => v.trim() !== '')) records.push(cur)
  if (!records.length) return rows

  const headers = records[0].map((h) => h.trim())
  for (let i = 1; i < records.length; i++) {
    const cells = records[i]
    if (!cells[0]?.trim()) continue
    const row: CsvRow = {}
    headers.forEach((h, idx) => {
      const raw = cells[idx] ?? ''
      const n = Number(raw)
      row[h] = raw !== '' && Number.isFinite(n) ? n : raw
    })
    rows.push(row)
  }
  return rows
}

function toNum(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    if (Number.isFinite(n)) return n
  }
  return null
}

/** 原始 key 不在官方快照时的展示名回退:deepseek-v4-pro -> DeepSeek V4 Pro */
export function prettifyKey(key: string): string {
  return key
    .split('-')
    .filter(Boolean)
    .map((w) => {
      if (/^\d/.test(w)) return w
      return w.charAt(0).toUpperCase() + w.slice(1)
    })
    .join(' ')
}

function categoryAverages(row: CsvRow, categories: Record<string, string[]>): Record<string, number | null> {
  const out: Record<string, number | null> = {}
  for (const cat of CATEGORY_ORDER) {
    const tasks = categories[cat] ?? []
    const values = tasks
      .map((t) => toNum(row[t]))
      .filter((v): v is number => v != null)
    out[cat] = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null
  }
  return out
}

function overallOf(key: string, cats: Record<string, number | null>): number | null {
  // 官网 Averaging.js 对这两个旧模型有硬编码总分
  if (key === 'grok-3-thinking') return 72
  if (key === 'grok-3') return 58
  const values = Object.values(cats).filter((v): v is number => v != null)
  if (!values.length) return null
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100
}

function normalizeRow(
  row: CsvRow,
  categories: Record<string, string[]>,
  names: Record<string, NameEntry>,
  costRow?: CsvRow
): LivebenchRow {
  const key = String(row['model'] ?? '')
  const meta = names[key]
  const cats = categoryAverages(row, categories)
  return {
    key,
    name: meta?.name || prettifyKey(key),
    provider: meta?.org ?? null,
    overall: overallOf(key, cats),
    categories: cats,
    costPerTask: costRow ? toNum(costRow['cost_per_question']) : null,
    costPerSuccessfulTask: costRow ? toNum(costRow['cost_per_successful_task']) : null,
    outputTokens: costRow ? toNum(costRow['avg_output_tokens']) : null,
  }
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const resp = await fetch(url)
    return resp.ok ? resp.text() : null
  } catch {
    return null
  }
}

async function fetchRelease(release: string): Promise<{ models: LivebenchRow[]; release: string } | null> {
  const d = release.replaceAll('-', '_')
  const [tableText, categoriesBody, costText] = await Promise.all([
    fetchText(`${LIVEBENCH_BASE}/table_${d}.csv`),
    fetchText(`${LIVEBENCH_BASE}/categories_${d}.json`),
    fetchText(`${LIVEBENCH_BASE}/cost_${d}.csv`),
  ])
  if (!tableText || !categoriesBody) return null

  let categories: Record<string, string[]>
  try {
    categories = JSON.parse(categoriesBody) as Record<string, string[]>
  } catch {
    return null
  }

  const costRows = costText ? parseCsv(costText) : []
  const costMap = new Map(costRows.map((r) => [String(r['model'] ?? ''), r]))
  const models = parseCsv(tableText)
    .map((row) => normalizeRow(row, categories, livebenchModelNames, costMap.get(String(row['model'] ?? ''))))
    .filter((r) => r.key)
  return models.length ? { models, release } : null
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
): Promise<void> {
  if (request.method !== 'GET') {
    response.status(405).json({ error: 'Method not allowed' })
    return
  }

  for (const release of RELEASES) {
    const data = await fetchRelease(release)
    if (!data) continue
    const payload: LivebenchApiResponse = {
      source: 'livebench',
      release: data.release,
      generatedAt: new Date().toISOString(),
      models: data.models,
    }
    response
      .status(200)
      .setHeader('cache-control', 'public, max-age=0, s-maxage=3600')
      .json(payload)
    return
  }

  response.status(502).json({ error: 'LiveBench 数据获取失败' })
}
