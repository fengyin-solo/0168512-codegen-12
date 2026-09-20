import type { AppConfig, Conversation, PromptTemplate, PresetKey, ParameterPresets } from '../types';
import { DEFAULT_CONFIG, DEFAULT_TEMPLATES, DEFAULT_PRESETS, DEFAULT_PRESET, PRESET_ORDER, PARAMETER_LIMITS } from '../types';

// Storage keys
const STORAGE_KEYS = {
  CONFIG: 'react-chat-config',
  CONVERSATIONS: 'react-chat-conversations',
  PROMPT_TEMPLATES: 'react-chat-prompt-templates',
  PARAMETER_PRESETS: 'react-chat-parameter-presets',
  ACTIVE_PRESET: 'react-chat-active-preset',
} as const;

/**
 * 简单的加密函数（Base64 + 字符偏移）
 * 注意：这不是真正的加密，只是简单的混淆，防止明文存储
 */
function encrypt(text: string): string {
  if (!text) return '';
  
  // 先进行字符偏移
  const shifted = text
    .split('')
    .map(char => String.fromCharCode(char.charCodeAt(0) + 3))
    .join('');
  
  // 然后 Base64 编码
  return btoa(encodeURIComponent(shifted));
}

/**
 * 解密函数
 */
function decrypt(encoded: string): string {
  if (!encoded) return '';
  
  try {
    // 先 Base64 解码
    const shifted = decodeURIComponent(atob(encoded));
    
    // 然后字符偏移还原
    return shifted
      .split('')
      .map(char => String.fromCharCode(char.charCodeAt(0) - 3))
      .join('');
  } catch {
    return '';
  }
}

/**
 * 保存配置到 localStorage
 * @param config 应用配置
 */
export function saveConfig(config: AppConfig): void {
  try {
    // 加密 API Key
    const configToSave = {
      ...config,
      apiKey: encrypt(config.apiKey),
    };
    
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(configToSave));
  } catch (error) {
    console.error('Failed to save config:', error);
    throw new Error('保存配置失败');
  }
}

/**
 * 从 localStorage 加载配置
 * @returns 应用配置，如果不存在则返回默认配置
 */
export function loadConfig(): AppConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.CONFIG);
    
    if (!stored) {
      return DEFAULT_CONFIG;
    }
    
    const parsed = JSON.parse(stored) as AppConfig;
    
    // 解密 API Key
    return {
      ...DEFAULT_CONFIG,
      ...parsed,
      apiKey: decrypt(parsed.apiKey),
    };
  } catch (error) {
    console.error('Failed to load config:', error);
    return DEFAULT_CONFIG;
  }
}

/**
 * 清除配置
 */
export function clearConfig(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.CONFIG);
  } catch (error) {
    console.error('Failed to clear config:', error);
  }
}

/**
 * 判断值是否为可参与计算的有限数字
 */
function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * 校验单个预设参数是否合法（temperature: 0-2；maxTokens: 100-8192 的整数）
 */
function isValidPresetParams(value: unknown): value is ParameterPresets[PresetKey] {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const { temperature, maxTokens } = value as Record<string, unknown>;
  const { temperature: tempLimit, maxTokens: tokenLimit } = PARAMETER_LIMITS;
  return (
    isFiniteNumber(temperature) &&
    temperature >= tempLimit.min &&
    temperature <= tempLimit.max &&
    isFiniteNumber(maxTokens) &&
    Number.isInteger(maxTokens) &&
    maxTokens >= tokenLimit.min &&
    maxTokens <= tokenLimit.max
  );
}

/**
 * 规范化三套预设：缺失或非法的单项回退为对应默认值，保证每份预设始终可用
 */
function normalizePresets(raw: unknown): ParameterPresets {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<PresetKey, unknown>>;
  const result = { ...DEFAULT_PRESETS };
  for (const key of PRESET_ORDER) {
    const preset = source[key];
    if (isValidPresetParams(preset)) {
      result[key] = { temperature: preset.temperature, maxTokens: preset.maxTokens };
    }
  }
  return result;
}

/**
 * 保存三套参数预设到 localStorage
 * @param presets 预设集合
 */
export function saveParameterPresets(presets: ParameterPresets): void {
  try {
    localStorage.setItem(STORAGE_KEYS.PARAMETER_PRESETS, JSON.stringify(presets));
  } catch (error) {
    console.error('Failed to save parameter presets:', error);
    throw new Error('保存参数预设失败');
  }
}

/**
 * 深拷贝默认预设，避免外部修改污染常量
 */
function cloneDefaultPresets(): ParameterPresets {
  return Object.fromEntries(
    PRESET_ORDER.map((key) => [key, { ...DEFAULT_PRESETS[key] }]),
  ) as ParameterPresets;
}

/**
 * 从 localStorage 加载三套参数预设
 * @returns 预设集合，不存在或数据损坏时返回默认预设
 */
export function loadParameterPresets(): ParameterPresets {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.PARAMETER_PRESETS);
    if (!stored) {
      return cloneDefaultPresets();
    }
    return normalizePresets(JSON.parse(stored));
  } catch (error) {
    console.error('Failed to load parameter presets:', error);
    return cloneDefaultPresets();
  }
}

/**
 * 保存当前激活的预设标识
 * @param key 预设标识
 */
export function saveActivePreset(key: PresetKey): void {
  try {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_PRESET, key);
  } catch (error) {
    console.error('Failed to save active preset:', error);
  }
}

/**
 * 加载当前激活的预设标识
 * @returns 预设标识，不存在或非法时返回默认预设
 */
export function loadActivePreset(): PresetKey {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.ACTIVE_PRESET);
    if (stored && (PRESET_ORDER as string[]).includes(stored)) {
      return stored as PresetKey;
    }
  } catch (error) {
    console.error('Failed to load active preset:', error);
  }
  return DEFAULT_PRESET;
}

/**
 * 保存对话列表到 localStorage
 * @param conversations 对话列表
 */
export function saveConversations(conversations: Conversation[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.CONVERSATIONS, JSON.stringify(conversations));
  } catch (error) {
    console.error('Failed to save conversations:', error);
    
    // 如果存储失败（可能是超出配额），尝试只保存最近的对话
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      const recentConversations = conversations.slice(0, 10);
      try {
        localStorage.setItem(STORAGE_KEYS.CONVERSATIONS, JSON.stringify(recentConversations));
      } catch {
        throw new Error('存储空间不足，无法保存对话');
      }
    } else {
      throw new Error('保存对话失败');
    }
  }
}

/**
 * 从 localStorage 加载对话列表
 * @returns 对话列表
 */
export function loadConversations(): Conversation[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.CONVERSATIONS);
    
    if (!stored) {
      return [];
    }
    
    const parsed = JSON.parse(stored) as Conversation[];
    
    // 验证数据结构
    if (!Array.isArray(parsed)) {
      return [];
    }
    
    // 过滤无效数据并按更新时间排序
    return parsed
      .filter(conv => conv && conv.id && Array.isArray(conv.messages))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  } catch (error) {
    console.error('Failed to load conversations:', error);
    return [];
  }
}

/**
 * 清除所有对话
 */
export function clearConversations(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.CONVERSATIONS);
  } catch (error) {
    console.error('Failed to clear conversations:', error);
  }
}

/**
 * 清除所有存储数据
 */
export function clearAllStorage(): void {
  clearConfig();
  clearConversations();
  try {
    localStorage.removeItem(STORAGE_KEYS.PARAMETER_PRESETS);
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_PRESET);
  } catch (error) {
    console.error('Failed to clear parameter presets:', error);
  }
}

/**
 * 获取存储使用情况
 * @returns 存储使用信息
 */
export function getStorageUsage(): { used: number; available: number } {
  let used = 0;
  
  try {
    for (const key of Object.values(STORAGE_KEYS)) {
      const item = localStorage.getItem(key);
      if (item) {
        used += item.length * 2; // UTF-16 编码，每个字符 2 字节
      }
    }
  } catch {
    // 忽略错误
  }
  
  // localStorage 通常限制为 5MB
  const available = 5 * 1024 * 1024 - used;
  
  return { used, available: Math.max(0, available) };
}

/**
 * 导出所有数据
 * @returns 导出的数据对象
 */
export function exportData(): { config: AppConfig; conversations: Conversation[] } {
  return {
    config: loadConfig(),
    conversations: loadConversations(),
  };
}

/**
 * 导入数据
 * @param data 要导入的数据
 */
export function importData(data: { config?: AppConfig; conversations?: Conversation[] }): void {
  if (data.config) {
    saveConfig(data.config);
  }
  
  if (data.conversations) {
    saveConversations(data.conversations);
  }
}

/**
 * 生成默认提示词模板
 * @returns 默认模板列表
 */
function generateDefaultTemplates(): PromptTemplate[] {
  const now = Date.now();
  return DEFAULT_TEMPLATES.map((template, index) => ({
    ...template,
    id: `default-${index}`,
    createdAt: now,
    updatedAt: now,
  }));
}

/**
 * 保存提示词模板到 localStorage
 * @param templates 模板列表
 */
export function savePromptTemplates(templates: PromptTemplate[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.PROMPT_TEMPLATES, JSON.stringify(templates));
  } catch (error) {
    console.error('Failed to save prompt templates:', error);
    throw new Error('保存提示词模板失败');
  }
}

/**
 * 从 localStorage 加载提示词模板
 * @returns 模板列表，如果不存在则返回默认模板
 */
export function loadPromptTemplates(): PromptTemplate[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.PROMPT_TEMPLATES);
    
    if (!stored) {
      const defaultTemplates = generateDefaultTemplates();
      savePromptTemplates(defaultTemplates);
      return defaultTemplates;
    }
    
    const parsed = JSON.parse(stored) as PromptTemplate[];
    
    if (!Array.isArray(parsed)) {
      const defaultTemplates = generateDefaultTemplates();
      savePromptTemplates(defaultTemplates);
      return defaultTemplates;
    }
    
    return parsed
      .filter(t => t && t.id && t.name && t.content)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  } catch (error) {
    console.error('Failed to load prompt templates:', error);
    return generateDefaultTemplates();
  }
}

/**
 * 清除所有提示词模板
 */
export function clearPromptTemplates(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.PROMPT_TEMPLATES);
  } catch (error) {
    console.error('Failed to clear prompt templates:', error);
  }
}

/**
 * 重置为默认提示词模板
 * @returns 重置后的模板列表
 */
export function resetPromptTemplates(): PromptTemplate[] {
  const defaultTemplates = generateDefaultTemplates();
  savePromptTemplates(defaultTemplates);
  return defaultTemplates;
}
