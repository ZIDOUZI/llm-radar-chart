export interface ProviderColor {
  bg: string
  border: string
}

export const PROVIDER_COLORS: Record<string, ProviderColor> = {
  'Anthropic':   { bg: 'rgba(204,120,92,0.2)',  border: '#cc785c' },
  'OpenAI':      { bg: 'rgba(107,114,128,0.15)', border: '#6b7280' },
  'Google':      { bg: 'rgba(52,168,83,0.2)',    border: '#34A853' },
  'DeepSeek':    { bg: 'rgba(28,127,248,0.2)',   border: '#1c7ff8' },
  'Alibaba':     { bg: 'rgba(235,53,104,0.2)',   border: '#EB3568' },
  'Meta':        { bg: 'rgba(4,122,254,0.2)',    border: '#047AFE' },
  'xAI':         { bg: 'rgba(107,114,128,0.15)', border: '#6b7280' },
  'Mistral':     { bg: 'rgba(115,108,211,0.2)',  border: '#736cd3' },
  'Kimi':        { bg: 'rgba(255,105,0,0.2)',    border: '#ff6900' },
  'Moonshot AI': { bg: 'rgba(255,105,0,0.2)',    border: '#ff6900' },
  'MiniMax':     { bg: 'rgba(226,178,162,0.2)',  border: '#e2b2a2' },
  'NVIDIA':      { bg: 'rgba(134,183,55,0.2)',   border: '#86b737' },
  'Amazon':      { bg: 'rgba(255,153,0,0.2)',    border: '#FF9900' },
  'Z AI':        { bg: 'rgba(34,67,230,0.2)',    border: '#2243e6' },
  'Z.AI':        { bg: 'rgba(34,67,230,0.2)',    border: '#2243e6' },
  'Abacus.AI':   { bg: 'rgba(147,51,234,0.2)',   border: '#9333ea' },
  'Thinking Machines': { bg: 'rgba(107,114,128,0.15)', border: '#6b7280' },
  'Xiaomi':      { bg: 'rgba(253,111,0,0.2)',    border: '#fd6f00' },
  'Tencent':     { bg: 'rgba(21,33,169,0.2)',    border: '#1521a9' },
  'ByteDance':   { bg: 'rgba(124,89,245,0.2)',   border: '#7c59f5' },
  'Cohere':      { bg: 'rgba(0,137,244,0.2)',    border: '#0089f4' },
  'Perplexity':  { bg: 'rgba(115,108,211,0.2)',  border: '#736cd3' },
  'Upstage':     { bg: 'rgba(224,59,104,0.2)',   border: '#e23b68' },
  'InclusionAI': { bg: 'rgba(255,112,24,0.2)',   border: '#ff7018' },
}

// 未匹配 provider 时的后备颜色
const FALLBACK_BORDERS = ['#ff7018', '#047AFE', '#2243e6', '#0089f4', '#EB3568', '#7c59f5']

export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

export function getProviderColor(provider: string, index: number): ProviderColor {
  if (PROVIDER_COLORS[provider]) return PROVIDER_COLORS[provider]
  const c = FALLBACK_BORDERS[index % FALLBACK_BORDERS.length]
  return { bg: hexToRgba(c, 0.2), border: c }
}
