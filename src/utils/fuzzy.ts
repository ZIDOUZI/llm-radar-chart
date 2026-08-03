/**
 * 轻量模糊匹配,用于模型搜索:
 * - 分隔符(空格/点/横线/下划线/斜杠)不敏感:"gpt 5.6" 能匹配 "GPT-5.6"
 * - 粘连写法支持:"gpt56" 能匹配 "GPT-5.6"
 * - 分词匹配:"claude opus 5" 能匹配 "Claude Opus 5 (High)"
 * - 字符子序列兜底:"gm35" 能匹配 "Gemini 3.5 Flash"
 */

function normCompact(s: string): string {
  return s.toLowerCase().replace(/[\s.\-_/]+/g, '')
}

function isSubsequence(q: string, f: string): boolean {
  if (!q) return true
  let i = 0
  for (const c of f) {
    if (c === q[i]) i++
    if (i === q.length) return true
  }
  return i === q.length
}

/**
 * 分词匹配:查询的每个词都要匹配字段中的某个"单词",且一一对应(不可复用)。
 * 这样 "gpt 5.5" 不会误配 "GPT-5.6"(第二个 5 找不到对应的单词)。
 */
function tokenMatch(tokens: string[], field: string): boolean {
  const words = field.toLowerCase().split(/[\s.\-_/]+/).filter(Boolean)
  const used = new Set<number>()
  for (const t of tokens) {
    let found = false
    for (let i = 0; i < words.length; i++) {
      if (used.has(i)) continue
      if (words[i].includes(t)) {
        used.add(i)
        found = true
        break
      }
    }
    if (!found) return false
  }
  return true
}

export function fuzzyMatch(query: string, ...fields: string[]): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true

  const compactQ = normCompact(q)
  const tokens = q.split(/[\s.\-_/]+/).filter(Boolean)

  for (const field of fields) {
    const compactF = normCompact(field)
    // 1) 紧凑子串匹配
    if (compactF.includes(compactQ)) return true
    // 2) 查询的每个词都出现在字段里(顺序不敏感)
    if (tokens.length > 1 && tokenMatch(tokens, field)) return true
    // 3) 字符子序列匹配
    if (isSubsequence(compactQ, compactF)) return true
  }
  return false
}
