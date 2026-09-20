/**
 * 应用配置
 */
export interface AppConfig {
  /** API 密钥 */
  apiKey: string;
  /** 模型名称 */
  model: string;
  /** 温度参数 (0-2) */
  temperature: number;
  /** 最大 Token 数 */
  maxTokens: number;
  /** API 基础 URL */
  baseUrl: string;
}

/**
 * API 请求配置
 */
export interface APIConfig extends AppConfig {
  /** 是否启用流式响应 */
  stream: boolean;
}

/**
 * 可用模型信息
 */
export interface ModelInfo {
  /** 模型 ID */
  id: string;
  /** 模型显示名称 */
  name: string;
  /** 模型描述 */
  description?: string;
  /** 最大上下文长度 */
  maxContext?: number;
}

/**
 * SiliconFlow 平台支持的模型列表
 */
export const AVAILABLE_MODELS: ModelInfo[] = [
  {
    id: 'deepseek-ai/DeepSeek-V3',
    name: 'DeepSeek V3',
    description: 'DeepSeek 最新模型，性能强大',
    maxContext: 64000,
  },
  {
    id: 'Qwen/Qwen2.5-72B-Instruct',
    name: 'Qwen 2.5 72B',
    description: '通义千问大模型',
    maxContext: 32000,
  },
  {
    id: 'Qwen/Qwen2.5-32B-Instruct',
    name: 'Qwen 2.5 32B',
    description: '通义千问中等规模模型',
    maxContext: 32000,
  },
];

/**
 * 参数预设
 */

/** 预设标识：精确 / 平衡 / 创意 */
export type PresetKey = 'precise' | 'balanced' | 'creative';

/** 单个预设包含的参数（温度与最大长度） */
export interface ParameterPreset {
  /** 温度参数 (0-2) */
  temperature: number;
  /** 最大 Token 数 */
  maxTokens: number;
}

/** 三套预设的集合 */
export type ParameterPresets = Record<PresetKey, ParameterPreset>;

/** 预设展示信息 */
export interface PresetMeta {
  /** 显示名称 */
  label: string;
  /** 简要说明 */
  description: string;
}

/** 三套预设的展示信息，顺序即切换顺序 */
export const PRESET_ORDER: PresetKey[] = ['precise', 'balanced', 'creative'];

export const PRESET_META: Record<PresetKey, PresetMeta> = {
  precise: { label: '精确', description: '低温度，输出更确定、聚焦' },
  balanced: { label: '平衡', description: '温度适中，兼顾稳定与发散' },
  creative: { label: '创意', description: '高温度，输出更随机、多样' },
};

/** 滑块/输入框允许的取值范围 */
export const PARAMETER_LIMITS = {
  temperature: { min: 0, max: 2, step: 0.1 },
  maxTokens: { min: 100, max: 8192, step: 100 },
} as const;

/** 各预设的默认参数 */
export const DEFAULT_PRESETS: ParameterPresets = {
  precise: { temperature: 0.2, maxTokens: 1024 },
  balanced: { temperature: 0.7, maxTokens: 2048 },
  creative: { temperature: 1.2, maxTokens: 4096 },
};

/** 默认激活的预设 */
export const DEFAULT_PRESET: PresetKey = 'balanced';

/**
 * 默认配置
 */
export const DEFAULT_CONFIG: AppConfig = {
  apiKey: '',
  model: 'deepseek-ai/DeepSeek-V3',
  temperature: DEFAULT_PRESETS[DEFAULT_PRESET].temperature,
  maxTokens: DEFAULT_PRESETS[DEFAULT_PRESET].maxTokens,
  baseUrl: 'https://api.siliconflow.com/v1',
};

/**
 * 配置验证结果
 */
export interface ConfigValidation {
  isValid: boolean;
  errors: {
    apiKey?: string;
    temperature?: string;
    maxTokens?: string;
  };
}
