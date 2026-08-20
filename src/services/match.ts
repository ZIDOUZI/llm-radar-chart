/**
 * 模型名匹配层:把 arena / livebench / artificialanalysis 各边的模型名
 * 归一化成可比较的 key。榜单的变体后缀(如 (High)、-thinking、-max)会去掉,
 * 只保留模型主体。
 */

/** arena 榜的推理/配置变体后缀,匹配时去掉 */
const VARIANT_SUFFIXES = [
  'thinking',
  'high',
  'max',
  'low',
  'medium',
  'xhigh',
  'reasoning',
  'preview',
  'exp',
  'effort',
  'extended',
  'latest',
]

const REASONING_LEVELS = new Set(['minimal', 'low', 'medium', 'high', 'xhigh', 'max'])
const VARIANT_MODIFIERS = new Set(['thinking', 'reasoning', 'auto', 'effort', 'extended', 'mode', 'preview', 'exp', 'latest'])
const NO_REASONING_SUFFIXES = [
  ['no', 'thinking'],
  ['no', 'reasoning'],
  ['non', 'thinking'],
  ['non', 'reasoning'],
]

/** 规范化:小写、括号展开、分隔符统一为 -、去除非字母数字 */
export function canonicalKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\(([^)]*)\)/g, ' $1 ')
    .replace(/[._\s]+/g, '-')
    .replace(/[^a-z0-9-]+/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/** 去掉变体后缀后的基础 key */
export function baseKey(name: string): string {
  let k = canonicalKey(name)
  let changed = true
  while (changed) {
    changed = false
    for (const suf of VARIANT_SUFFIXES) {
      const marker = `-${suf}`
      if (k.endsWith(marker)) {
        k = k.slice(0, -marker.length)
        changed = true
      }
    }
  }
  return k
}

interface ModelKeys {
  canonical: string
  base: string
  variant: string
}

/**
 * 保留推理等级的匹配 key。比如 High 与 High Effort 都归一为同一个变体,
 * 但 High 与 xHigh 不再共享同一个 key。
 */
function modelKeys(name: string): ModelKeys {
  const tokens = canonicalKey(name).split('-').filter(Boolean)
  const canonical = tokens.join('-')

  for (const suffix of NO_REASONING_SUFFIXES) {
    const start = tokens.length - suffix.length
    if (start < 1 || tokens.slice(start).join('-') !== suffix.join('-')) continue
    const base = tokens.slice(0, start)
    while (base.length && VARIANT_MODIFIERS.has(base[base.length - 1])) base.pop()
    if (base.length) {
      const baseKeyValue = base.join('-')
      return { canonical, base: baseKeyValue, variant: `${baseKeyValue}-${suffix.join('-')}` }
    }
  }

  for (let i = tokens.length - 1; i >= 1; i--) {
    let level = tokens[i]
    let start = i
    if (level === 'high' && tokens[i - 1] === 'x') {
      level = 'xhigh'
      start = i - 1
    }
    if (!REASONING_LEVELS.has(level) || !tokens.slice(i + 1).every((token) => VARIANT_MODIFIERS.has(token))) continue
    const base = tokens.slice(0, start)
    while (base.length && VARIANT_MODIFIERS.has(base[base.length - 1])) base.pop()
    if (base.length) {
      const baseKeyValue = base.join('-')
      return { canonical, base: baseKeyValue, variant: `${baseKeyValue}-${level}` }
    }
  }

  const base = baseKey(name)
  return { canonical, base, variant: base }
}

function addUnique<T>(map: Map<string, T[]>, key: string, value: T): void {
  const values = map.get(key)
  if (values) {
    if (!values.includes(value)) values.push(value)
  } else {
    map.set(key, [value])
  }
}

function hasExplicitVariant<T extends { id: string; name: string }>(model: T): boolean {
  return [model.name, model.id].some((value) => {
    const keys = modelKeys(value)
    return keys.variant !== keys.base
  })
}

/**
 * 为每个目标模型找最匹配的源模型:
 * 1. 完整名称 key 精确匹配
 * 2. 保留推理等级的变体 key 精确匹配
 * 3. 基础 key 只有在源端唯一时才回退
 * 4. 包含匹配兜底(一方 key 包含另一方,限制最小长度且源端唯一)
 */
export function matchModelsToTargets<T extends { id: string; name: string }>(
  sourceModels: T[],
  targetModels: { id: string; name: string }[]
): Map<string, T> {
  const byCanonical = new Map<string, T[]>()
  const byVariant = new Map<string, T[]>()
  const byBase = new Map<string, T[]>()
  for (const m of sourceModels) {
    for (const value of [m.name, m.id]) {
      const keys = modelKeys(value)
      addUnique(byCanonical, keys.canonical, m)
      addUnique(byVariant, keys.variant, m)
      addUnique(byBase, keys.base, m)
    }
  }

  const result = new Map<string, T>()
  for (const target of targetModels) {
    const keys = [target.name, target.id].map(modelKeys)

    for (const key of keys) {
      const exact = byCanonical.get(key.canonical)
      if (exact?.length) {
        result.set(target.id, exact[0])
        break
      }
    }
    if (result.has(target.id)) continue

    for (const key of keys) {
      const exact = byVariant.get(key.variant)
      if (exact?.length) {
        result.set(target.id, exact[0])
        break
      }
    }
    if (result.has(target.id)) continue

    for (const key of keys) {
      const exact = byBase.get(key.base)
      if (exact?.length === 1 && key.variant === key.base && !hasExplicitVariant(exact[0])) {
        result.set(target.id, exact[0])
        break
      }
    }
    if (result.has(target.id)) continue

    for (const key of keys) {
      if (key.canonical.length < 6) continue
      for (const [ak, arr] of byBase) {
        if (
          arr.length === 1 &&
          key.variant === key.base &&
          !hasExplicitVariant(arr[0]) &&
          ak.length >= 6 &&
          (ak.includes(key.canonical) || key.canonical.includes(ak))
        ) {
          result.set(target.id, arr[0])
          break
        }
      }
      if (result.has(target.id)) break
    }
  }
  return result
}

/** 兼容旧入口:为每个 AA 模型找最匹配的 arena 模型 */
export function matchArenaToAa<T extends { id: string; name: string }>(
  arenaModels: T[],
  aaModels: { id: string; name: string }[]
): Map<string, T> {
  return matchModelsToTargets(arenaModels, aaModels)
}
