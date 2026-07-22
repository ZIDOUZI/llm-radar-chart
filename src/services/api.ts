import type { ModelInfo, RadarMetrics, ApiResponse, ApiModelData } from '../types'
import { METRIC_API_MAP } from '../types'
import { sampleModels } from '../data/sampleData'

// 开发环境走 Vite proxy 解决跨域，生产环境直接请求
const API_URL = import.meta.env.DEV ? '/api/v2/data/llms/models' : '/api/models'
const STORAGE_KEY = 'llm-radar-api-key'

function getApiKey(): string | null {
  return localStorage.getItem(STORAGE_KEY)
}

export function setApiKey(key: string): void {
  localStorage.setItem(STORAGE_KEY, key)
}

export function clearApiKey(): void {
  localStorage.removeItem(STORAGE_KEY)
}

export function hasApiKey(): boolean {
  return !!getApiKey()
}

/**
 * 将某个 evaluation 指标的原始值归一化到 0–100。
 * 使用所有模型中该指标的最大值作为 100 分基准。
 */
function normalizeValue(value: number | null, max: number, min = 0): number {
  if (value == null) return 0
  if (max === min) return 50
  return Math.round(((value - min) / (max - min)) * 100)
}

/**
 * 从 pricing 计算价格优势分（越便宜越高）。
 * blended price: $0.05 → 100, $5.00 → 0
 */
function normalizePrice(blendedPrice: number | null): number {
  if (blendedPrice == null || blendedPrice <= 0) return 50
  const minPrice = 0.01
  const maxPrice = 50.0
  const score = 100 - (Math.log2(blendedPrice / minPrice) / Math.log2(maxPrice / minPrice)) * 100
  return Math.round(Math.max(0, Math.min(100, score)))
}

function normalizeSpeed(tps: number | null): number {
  if (tps == null || tps <= 0) return 0
  // 对数归一化：10 t/s → ~0, 750 t/s → 100
  const score = (Math.log2(tps) / Math.log2(750)) * 100
  return Math.round(Math.max(0, Math.min(100, score)))
}

/**
 * 从 API 数据中提取指定 evaluation 指标值。
 * 对于有多个候选字段的维度，取第一个有值的。
 */
function getEvalValue(evals: Record<string, number | null>, keys: string[]): number | null {
  for (const key of keys) {
    const v = evals[key]
    if (v != null) return v
  }
  return null
}

/**
 * 将 API 返回的原始模型数据转换为统一的 ModelInfo。
 * 所有指标归一化到 0–100。
 */
function transformModel(raw: ApiModelData, allModels: ApiModelData[]): ModelInfo {
  const evals = raw.evaluations || {}

  // 计算各维度全局最大值用于归一化
  function computeMax(keys: string[]): number {
    let max = 0
    for (const m of allModels) {
      const v = getEvalValue(m.evaluations || {}, keys)
      if (v != null && v > max) max = v
    }
    return max || 1
  }

  const metrics: RadarMetrics = {
    intelligence: normalizeValue(getEvalValue(evals, METRIC_API_MAP.intelligence), computeMax(METRIC_API_MAP.intelligence)),
    coding: normalizeValue(getEvalValue(evals, METRIC_API_MAP.coding), computeMax(METRIC_API_MAP.coding)),
    instruction: normalizeValue(getEvalValue(evals, METRIC_API_MAP.instruction), computeMax(METRIC_API_MAP.instruction)),
    longContext: normalizeValue(getEvalValue(evals, METRIC_API_MAP.longContext), computeMax(METRIC_API_MAP.longContext)),
    agent: normalizeValue(getEvalValue(evals, METRIC_API_MAP.agent), computeMax(METRIC_API_MAP.agent)),
    factuality: normalizeValue(getEvalValue(evals, METRIC_API_MAP.factuality), computeMax(METRIC_API_MAP.factuality)),
    speed: normalizeSpeed(raw.median_output_tokens_per_second ?? null),
    price: normalizePrice(raw.pricing?.price_1m_blended_3_to_1 ?? null),
  }

  const blendedPrice = raw.pricing?.price_1m_blended_3_to_1

  function fmtMeta(raw: ApiModelData): ModelInfo['meta'] {
    const ctx = raw.context_length != null ? (raw.context_length >= 1_000_000 ? `${(raw.context_length / 1_000_000).toFixed(1)}M` : raw.context_length >= 1000 ? `${(raw.context_length / 1000).toFixed(0)}k` : String(raw.context_length)) : '—'
    const speed = raw.median_output_tokens_per_second != null ? `${Math.round(raw.median_output_tokens_per_second)} t/s` : '—'
    const lat = raw.median_time_to_first_token_seconds != null ? `${raw.median_time_to_first_token_seconds.toFixed(2)}s` : '—'
    const mods = raw.modality || '—'
    const rel = raw.release_date?.slice(0, 10) || '—'
    return { contextWindow: ctx, outputSpeed: speed, latency: lat, modalities: mods, releaseDate: rel }
  }

  return {
    id: raw.id,
    name: raw.name,
    provider: raw.model_creator?.name ?? 'Unknown',
    rawPrice: blendedPrice ?? 0,
    intelligenceIndex: evals['artificial_analysis_intelligence_index'] ?? 0,
    metrics,
    meta: fmtMeta(raw),
  }
}

/**
 * 从 artificialanalysis.ai API 获取模型数据。
 * 需要用户提供 API key（免费注册获取）。
 */
export async function fetchModelsFromApi(): Promise<ModelInfo[]> {
  const apiKey = getApiKey()
  if (!apiKey) {
    throw new Error('未设置 API Key')
  }

  const resp = await fetch(API_URL, {
    headers: { 'x-api-key': apiKey },
  })

  if (!resp.ok) {
    throw new Error(`API 请求失败: ${resp.status} ${resp.statusText}`)
  }

  const body = await resp.text()
  if (!body) {
    throw new Error(`API 返回空响应: ${resp.status}`)
  }

  const json: ApiResponse = JSON.parse(body)
  if (!json.data || !Array.isArray(json.data)) {
    throw new Error('API 返回数据格式异常')
  }

  // 过滤掉没有 evaluation 数据的模型
  const validModels = json.data.filter(
    (m) => m.evaluations && Object.keys(m.evaluations).length > 0
  )

  return validModels.map((m) => transformModel(m, validModels))
}

/**
 * 获取模型数据：优先从 API 获取，失败则使用样本数据。
 */
export async function getModels(): Promise<ModelInfo[]> {
  if (hasApiKey()) {
    try {
      const models = await fetchModelsFromApi()
      if (models.length > 0) return models
    } catch (e) {
      console.warn('API 获取失败，降级到样本数据:', e)
    }
  }
  return sampleModels
}
