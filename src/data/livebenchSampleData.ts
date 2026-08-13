import type { ModelInfo } from '../types'

/**
 * LiveBench 内置样本数据 — 模拟官方 2026-06-25 版的数据展示效果,
 * 仅用于开发/离线预览。数值取自官方榜单快照。
 */
export const livebenchSampleModels: ModelInfo[] = [
  { id: 'claude-fable-5', name: 'Claude Fable 5 Max Effort', provider: 'Anthropic', rawPrice: 0, livebenchCost: 1.439, intelligenceIndex: 0,
    meta: { contextWindow: '—', outputSpeed: '—', latency: '—', modalities: '—', releaseDate: '—' },
    metrics: { intelligence: 89, coding: 86, instruction: 76, longContext: 0, agent: 62, factuality: 0, speed: 0, price: 6 },
    detail: {
      sources: { livebench: { intelligence: 89, coding: 86, instruction: 76, agent: 62, price: 6 } },
      livebench: {
        release: '2026-06-25', overall: 83.0,
        categories: { Reasoning: 89.7, Coding: 86.0, 'Agentic Coding': 62.2, Mathematics: 96.0, 'Data Analysis': 80.5, Language: 90.7, IF: 75.8 },
        costPerTask: 0.3492, costPerSuccessfulTask: 1.439,
      },
    } },
  { id: 'gpt-5-5-xhigh', name: 'GPT-5.5 Thinking xHigh Effort', provider: 'OpenAI', rawPrice: 0, livebenchCost: 0.435, intelligenceIndex: 0,
    meta: { contextWindow: '—', outputSpeed: '—', latency: '—', modalities: '—', releaseDate: '—' },
    metrics: { intelligence: 89, coding: 82, instruction: 71, longContext: 0, agent: 54, factuality: 0, speed: 0, price: 29 },
    detail: {
      sources: { livebench: { intelligence: 89, coding: 82, instruction: 71, agent: 54, price: 29 } },
      livebench: {
        release: '2026-06-25', overall: 80.2,
        categories: { Reasoning: 89.7, Coding: 82.1, 'Agentic Coding': 54.0, Mathematics: 95.9, 'Data Analysis': 81.6, Language: 87.4, IF: 70.7 },
        costPerTask: 0.1057, costPerSuccessfulTask: 0.435,
      },
    } },
  { id: 'gemini-3-5-flash', name: 'Gemini 3.5 Flash High', provider: 'Google', rawPrice: 0, livebenchCost: 0.249, intelligenceIndex: 0,
    meta: { contextWindow: '—', outputSpeed: '—', latency: '—', modalities: '—', releaseDate: '—' },
    metrics: { intelligence: 80, coding: 78, instruction: 76, longContext: 0, agent: 49, factuality: 0, speed: 0, price: 39 },
    detail: {
      sources: { livebench: { intelligence: 80, coding: 78, instruction: 76, agent: 49, price: 39 } },
      livebench: {
        release: '2026-06-25', overall: 74.6,
        categories: { Reasoning: 82.0, Coding: 78.2, 'Agentic Coding': 49.0, Mathematics: 88.2, 'Data Analysis': 64.9, Language: 84.6, IF: 75.6 },
        costPerTask: 0.0611, costPerSuccessfulTask: 0.249,
      },
    } },
  { id: 'glm-5-2', name: 'GLM-5.2', provider: 'Z.AI', rawPrice: 0, livebenchCost: 0.225, intelligenceIndex: 0,
    meta: { contextWindow: '—', outputSpeed: '—', latency: '—', modalities: '—', releaseDate: '—' },
    metrics: { intelligence: 80, coding: 80, instruction: 62, longContext: 0, agent: 52, factuality: 0, speed: 0, price: 41 },
    detail: {
      sources: { livebench: { intelligence: 80, coding: 80, instruction: 62, agent: 52, price: 41 } },
      livebench: {
        release: '2026-06-25', overall: 73.2,
        categories: { Reasoning: 78.6, Coding: 79.7, 'Agentic Coding': 51.8, Mathematics: 89.8, 'Data Analysis': 73.7, Language: 76.2, IF: 62.3 },
        costPerTask: 0.0557, costPerSuccessfulTask: 0.225,
      },
    } },
  { id: 'kimi-k2-6', name: 'Kimi K2.6 Thinking', provider: 'Moonshot AI', rawPrice: 0, livebenchCost: 0.169, intelligenceIndex: 0,
    meta: { contextWindow: '—', outputSpeed: '—', latency: '—', modalities: '—', releaseDate: '—' },
    metrics: { intelligence: 76, coding: 79, instruction: 64, longContext: 0, agent: 47, factuality: 0, speed: 0, price: 47 },
    detail: {
      sources: { livebench: { intelligence: 76, coding: 79, instruction: 64, agent: 47, price: 47 } },
      livebench: {
        release: '2026-06-25', overall: 70.5,
        categories: { Reasoning: 79.4, Coding: 78.6, 'Agentic Coding': 46.9, Mathematics: 84.3, 'Data Analysis': 65.1, Language: 75.1, IF: 64.4 },
        costPerTask: 0.0407, costPerSuccessfulTask: 0.169,
      },
    } },
  { id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash', provider: 'DeepSeek', rawPrice: 0, livebenchCost: 0.016, intelligenceIndex: 0,
    meta: { contextWindow: '—', outputSpeed: '—', latency: '—', modalities: '—', releaseDate: '—' },
    metrics: { intelligence: 72, coding: 69, instruction: 63, longContext: 0, agent: 38, factuality: 0, speed: 0, price: 91 },
    detail: {
      sources: { livebench: { intelligence: 72, coding: 69, instruction: 63, agent: 38, price: 91 } },
      livebench: {
        release: '2026-06-25', overall: 65.5,
        categories: { Reasoning: 70.6, Coding: 69.2, 'Agentic Coding': 37.6, Mathematics: 79.6, 'Data Analysis': 68.0, Language: 70.1, IF: 63.1 },
        costPerTask: 0.0105, costPerSuccessfulTask: 0.016,
      },
    } },
]
