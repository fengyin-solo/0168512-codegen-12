/**
 * 参数预设 ID（精确 / 平衡 / 创意）
 */
export type PresetId = 'precise' | 'balanced' | 'creative';

/**
 * 参数预设：一组 temperature 与 maxTokens 取值
 */
export interface ParameterPreset {
  /** 温度参数 (0-2) */
  temperature: number;
  /** 最大 Token 数 */
  maxTokens: number;
}

/**
 * 参数取值范围（与滑块控件一致）
 */
export const PARAM_RANGES = {
  temperature: { min: 0, max: 2 },
  maxTokens: { min: 100, max: 8192 },
} as const;

/**
 * 全部预设 ID（按展示顺序）
 */
export const PRESET_IDS: PresetId[] = ['precise', 'balanced', 'creative'];

/**
 * 预设中文标签
 */
export const PRESET_LABELS: Record<PresetId, string> = {
  precise: '精确',
  balanced: '平衡',
  creative: '创意',
};

/**
 * 三套预设的默认取值
 */
export const DEFAULT_PRESETS: Record<PresetId, ParameterPreset> = {
  precise: { temperature: 0.2, maxTokens: 1024 },
  balanced: { temperature: 0.7, maxTokens: 2048 },
  creative: { temperature: 1.5, maxTokens: 4096 },
};

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
  /** 当前使用的参数预设 */
  activePreset: PresetId;
  /** 三套参数预设，各自独立保存温度与最大长度 */
  presets: Record<PresetId, ParameterPreset>;
}

/**
 * 配置更新载荷：数值参数允许为 null（输入被清空或不是数字时），
 * 由 store 校验后拒绝并给出原因
 */
export type ConfigUpdates = Omit<Partial<AppConfig>, 'temperature' | 'maxTokens'> & {
  temperature?: number | null;
  maxTokens?: number | null;
};

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
 * 默认配置
 */
export const DEFAULT_CONFIG: AppConfig = {
  apiKey: '',
  model: 'deepseek-ai/DeepSeek-V3',
  temperature: DEFAULT_PRESETS.balanced.temperature,
  maxTokens: DEFAULT_PRESETS.balanced.maxTokens,
  baseUrl: 'https://api.siliconflow.com/v1',
  activePreset: 'balanced',
  presets: DEFAULT_PRESETS,
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
