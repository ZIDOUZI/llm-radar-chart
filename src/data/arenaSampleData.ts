import type { ModelInfo } from '../types'

/**
 * Arena 内置样本数据 — 模拟 Elo 排行的展示效果,仅用于开发/离线预览。
 * 数值为示意,不代表真实 Elo 成绩。
 */
export const arenaSampleModels: ModelInfo[] = [
  { id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash', provider: 'DeepSeek', rawPrice: 0.06, intelligenceIndex: 78,
    meta: { contextWindow:'1M', outputSpeed:'101 t/s', latency:'1.4s', modalities:'Text', releaseDate:'2026-03' },
    metrics: { intelligence:78, coding:72, instruction:70, longContext:74, agent:66, factuality:64, speed:68, price:100 } },
  { id: 'gpt-5-5-xhigh', name: 'GPT-5.5', provider: 'OpenAI', rawPrice: 4.35, intelligenceIndex: 92,
    meta: { contextWindow:'922k', outputSpeed:'61 t/s', latency:'117s', modalities:'Text, Image', releaseDate:'2026-05' },
    metrics: { intelligence:92, coding:90, instruction:88, longContext:86, agent:90, factuality:88, speed:48, price:22 } },
  { id: 'claude-fable-5', name: 'Claude Fable 5', provider: 'Anthropic', rawPrice: 7.70, intelligenceIndex: 95,
    meta: { contextWindow:'1M', outputSpeed:'62 t/s', latency:'35s', modalities:'Text, Image', releaseDate:'2026-05' },
    metrics: { intelligence:95, coding:85, instruction:94, longContext:92, agent:88, factuality:90, speed:48, price:5 } },
  { id: 'gemini-3-5-flash', name: 'Gemini 3.5 Flash', provider: 'Google', rawPrice: 1.31, intelligenceIndex: 74,
    meta: { contextWindow:'1M', outputSpeed:'153 t/s', latency:'19s', modalities:'Text, Image, Audio, Video', releaseDate:'2026-03' },
    metrics: { intelligence:74, coding:66, instruction:76, longContext:90, agent:70, factuality:72, speed:82, price:62 } },
  { id: 'glm-5-2', name: 'GLM-5.2', provider: 'Z AI', rawPrice: 0.90, intelligenceIndex: 80,
    meta: { contextWindow:'1M', outputSpeed:'112 t/s', latency:'2.4s', modalities:'Text, Image', releaseDate:'2026-04' },
    metrics: { intelligence:80, coding:84, instruction:82, longContext:78, agent:76, factuality:78, speed:72, price:75 } },
  { id: 'kimi-k2-6', name: 'Kimi K2.6', provider: 'Kimi', rawPrice: 0.70, intelligenceIndex: 68,
    meta: { contextWindow:'256k', outputSpeed:'46 t/s', latency:'2.5s', modalities:'Text', releaseDate:'2026-03' },
    metrics: { intelligence:68, coding:74, instruction:70, longContext:80, agent:70, factuality:66, speed:38, price:80 } },
]
