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

/**
 * 为每个目标模型找最匹配的源模型:
 * 1. 基础 key 精确匹配(推荐)
 * 2. 包含匹配兜底(一方 key 包含另一方,限制最小长度避免误配)
 */
export function matchModelsToTargets<T extends { id: string; name: string }>(
  sourceModels: T[],
  targetModels: { id: string; name: string }[]
): Map<string, T> {
  const byBase = new Map<string, T[]>()
  for (const m of sourceModels) {
    const k = baseKey(m.name)
    const arr = byBase.get(k)
    if (arr) arr.push(m)
    else byBase.set(k, [m])
  }

  const result = new Map<string, T>()
  for (const target of targetModels) {
    const k = baseKey(target.name)
    const exact = byBase.get(k)
    if (exact && exact.length) {
      result.set(target.id, exact[0])
      continue
    }
    const kb = canonicalKey(target.name)
    if (kb.length >= 6) {
      for (const [ak, arr] of byBase) {
        if (ak.length >= 6 && (ak.includes(kb) || kb.includes(ak))) {
          result.set(target.id, arr[0])
          break
        }
      }
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
