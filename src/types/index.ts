/** 八个对比维度 */
export interface RadarMetrics {
  intelligence: number   // 综合推理 (Intelligence Index)
  coding: number         // 编程能力 (Coding Index)
  instruction: number    // 指令遵循 (IFBench)
  longContext: number    // 长文本 (LCR)
  agent: number          // 智能体 (Terminal-Bench)
  factuality: number     // 事实可靠 (GPQA)
  speed: number          // 输出速度 (归一化)
  price: number          // 价格优势 (越便宜越高)
}

export const METRIC_LABELS: Record<keyof RadarMetrics, string> = {
  intelligence: '综合推理',
  coding: '编程能力',
  instruction: '指令遵循',
  longContext: '长文本',
  agent: '智能体',
  factuality: '事实可靠',
  speed: '输出速度',
  price: '价格优势',
}

export const METRIC_API_MAP: Record<keyof RadarMetrics, string[]> = {
  intelligence: ['artificial_analysis_intelligence_index'],
  coding: ['artificial_analysis_coding_index', 'livecodebench', 'scicode'],
  instruction: ['ifbench'],
  longContext: ['lcr'],
  agent: ['terminalbench_v2_1', 'terminalbench_hard', 'tau2', 'tau_banking'],
  factuality: ['gpqa', 'mmlu_pro'],
  speed: [],
  price: [],
}

export interface ModelMeta {
  contextWindow: string   // 上下文窗口，如 "1M"
  outputSpeed: string     // 输出速度，如 "153 t/s"
  latency: string         // 首 token 延迟，如 "0.3s"
  modalities: string      // 模态支持，如 "Text, Image"
  releaseDate: string     // 发布日期
}

export interface ModelInfo {
  id: string
  name: string
  provider: string
  metrics: RadarMetrics
  rawPrice: number
  intelligenceIndex: number
  meta: ModelMeta
}

export interface ApiModelData {
  id: string
  name: string
  slug: string
  release_date: string | null
  model_creator: { id: string; name: string; slug: string }
  evaluations: Record<string, number | null>
  pricing: {
    price_1m_input_tokens: number | null
    price_1m_output_tokens: number | null
    price_1m_blended_3_to_1: number | null
  } | null
  context_length: number | null
  median_output_tokens_per_second: number | null
  median_time_to_first_token_seconds: number | null
  median_time_to_first_answer_token: number | null
  modality: string | null
}

export interface ApiResponse {
  status: number
  data: ApiModelData[]
}

