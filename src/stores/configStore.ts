import { create } from 'zustand';
import type { AppConfig, ConfigValidation, PresetKey, ParameterPresets } from '../types';
import {
  DEFAULT_CONFIG,
  DEFAULT_PRESETS,
  DEFAULT_PRESET,
  PARAMETER_LIMITS,
} from '../types';
import {
  saveConfig,
  loadConfig,
  saveParameterPresets,
  loadParameterPresets,
  saveActivePreset,
  loadActivePreset,
} from '../services/storage';
import { validateConfig, validateAPIKey } from '../utils/validators';

/** 参数更新结果：失败时携带不生效的原因 */
export interface ParameterUpdateResult {
  ok: boolean;
  reason?: string;
}

/**
 * 校验 temperature 是否为滑块允许的有限数字（0-2）
 */
function checkTemperature(temperature: unknown): ParameterUpdateResult {
  if (typeof temperature !== 'number' || Number.isNaN(temperature) || !Number.isFinite(temperature)) {
    return { ok: false, reason: 'Temperature 需要输入一个数字' };
  }
  const { min, max } = PARAMETER_LIMITS.temperature;
  if (temperature < min || temperature > max) {
    return { ok: false, reason: `Temperature 必须在 ${min}-${max} 之间` };
  }
  return { ok: true };
}

/**
 * 校验 maxTokens 是否为滑块允许的正整数（100-8192）
 */
function checkMaxTokens(maxTokens: unknown): ParameterUpdateResult {
  if (typeof maxTokens !== 'number' || Number.isNaN(maxTokens) || !Number.isFinite(maxTokens)) {
    return { ok: false, reason: 'Max Tokens 需要输入一个数字' };
  }
  if (!Number.isInteger(maxTokens)) {
    return { ok: false, reason: 'Max Tokens 必须是整数' };
  }
  const { min, max } = PARAMETER_LIMITS.maxTokens;
  if (maxTokens < min || maxTokens > max) {
    return { ok: false, reason: `Max Tokens 必须在 ${min}-${max} 之间` };
  }
  return { ok: true };
}

interface ConfigState {
  /** 当前配置 */
  config: AppConfig;
  /** 配置是否有效 */
  isValid: boolean;
  /** 验证错误信息 */
  errors: ConfigValidation['errors'];
  /** 是否已初始化 */
  initialized: boolean;
  /** 三套参数预设（每一份独立保存，互不影响） */
  presets: ParameterPresets;
  /** 当前激活的预设 */
  activePreset: PresetKey;
}

interface ConfigActions {
  /** 初始化配置（从 localStorage 加载） */
  initConfig: () => void;
  /** 更新配置（apiKey / model 等非预设字段） */
  updateConfig: (updates: Partial<AppConfig>) => void;
  /** 验证当前配置 */
  validateCurrentConfig: () => boolean;
  /** 重置为默认配置（含三套预设） */
  resetConfig: () => void;
  /** 设置 API Key */
  setAPIKey: (apiKey: string) => void;
  /** 设置模型 */
  setModel: (model: string) => void;
  /** 切换参数预设，温度与最大长度跟随该预设变化 */
  switchPreset: (key: PresetKey) => void;
  /** 设置当前预设的 temperature；非法值不生效并返回原因 */
  setTemperature: (temperature: number) => ParameterUpdateResult;
  /** 设置当前预设的 maxTokens；非法值不生效并返回原因 */
  setMaxTokens: (maxTokens: number) => ParameterUpdateResult;
}

type ConfigStore = ConfigState & ConfigActions;

export const useConfigStore = create<ConfigStore>((set, get) => ({
  // Initial state
  config: DEFAULT_CONFIG,
  isValid: false,
  errors: {},
  initialized: false,
  presets: DEFAULT_PRESETS,
  activePreset: DEFAULT_PRESET,

  // Actions
  initConfig: () => {
    const loadedConfig = loadConfig();
    const presets = loadParameterPresets();
    const activePreset = loadActivePreset();
    // 温度与最大长度以当前激活预设为准，保证重新打开后滑块落在正确位置
    const config: AppConfig = {
      ...loadedConfig,
      temperature: presets[activePreset].temperature,
      maxTokens: presets[activePreset].maxTokens,
    };
    const validation = validateConfig(config);

    set({
      config,
      presets,
      activePreset,
      isValid: validation.isValid && validateAPIKey(config.apiKey),
      errors: validation.errors,
      initialized: true,
    });
  },

  updateConfig: (updates) => {
    const { config } = get();
    const newConfig = { ...config, ...updates };
    const validation = validateConfig(newConfig);

    // 保存到 localStorage（独立 key，不会影响三套预设）
    try {
      saveConfig(newConfig);
    } catch (error) {
      console.error('Failed to save config:', error);
    }

    set({
      config: newConfig,
      isValid: validation.isValid && validateAPIKey(newConfig.apiKey),
      errors: validation.errors,
    });
  },

  validateCurrentConfig: () => {
    const { config } = get();
    const validation = validateConfig(config);
    const isValid = validation.isValid && validateAPIKey(config.apiKey);

    set({
      isValid,
      errors: validation.errors,
    });

    return isValid;
  },

  resetConfig: () => {
    const defaultPresets = Object.fromEntries(
      (Object.keys(DEFAULT_PRESETS) as PresetKey[]).map((key) => [
        key,
        { ...DEFAULT_PRESETS[key] },
      ]),
    ) as ParameterPresets;
    const activePreset = DEFAULT_PRESET;
    const config: AppConfig = {
      ...DEFAULT_CONFIG,
      temperature: defaultPresets[activePreset].temperature,
      maxTokens: defaultPresets[activePreset].maxTokens,
    };

    try {
      saveConfig(config);
      saveParameterPresets(defaultPresets);
      saveActivePreset(activePreset);
    } catch (error) {
      console.error('Failed to save default config:', error);
    }

    set({
      config,
      presets: defaultPresets,
      activePreset,
      isValid: false,
      errors: {},
    });
  },

  setAPIKey: (apiKey) => {
    get().updateConfig({ apiKey });
  },

  setModel: (model) => {
    get().updateConfig({ model });
  },

  switchPreset: (key) => {
    const { activePreset, presets, config } = get();
    if (key === activePreset || !presets[key]) {
      return;
    }

    const preset = presets[key];
    const newConfig: AppConfig = {
      ...config,
      temperature: preset.temperature,
      maxTokens: preset.maxTokens,
    };

    try {
      saveActivePreset(key);
      saveConfig(newConfig);
    } catch (error) {
      console.error('Failed to switch preset:', error);
    }

    set({ activePreset: key, config: newConfig });
  },

  setTemperature: (temperature) => {
    const result = checkTemperature(temperature);
    if (!result.ok) {
      return result;
    }

    const { config, presets, activePreset } = get();
    // 只改当前激活的这一份，另外两份保持不动
    const newPresets: ParameterPresets = {
      ...presets,
      [activePreset]: { ...presets[activePreset], temperature },
    };
    const newConfig: AppConfig = { ...config, temperature };
    const validation = validateConfig(newConfig);

    try {
      saveParameterPresets(newPresets);
      saveConfig(newConfig);
    } catch (error) {
      console.error('Failed to save temperature:', error);
    }

    set({
      presets: newPresets,
      config: newConfig,
      isValid: validation.isValid && validateAPIKey(newConfig.apiKey),
      errors: validation.errors,
    });
    return { ok: true };
  },

  setMaxTokens: (maxTokens) => {
    const result = checkMaxTokens(maxTokens);
    if (!result.ok) {
      return result;
    }

    const { config, presets, activePreset } = get();
    // 只改当前激活的这一份，另外两份保持不动
    const newPresets: ParameterPresets = {
      ...presets,
      [activePreset]: { ...presets[activePreset], maxTokens },
    };
    const newConfig: AppConfig = { ...config, maxTokens };
    const validation = validateConfig(newConfig);

    try {
      saveParameterPresets(newPresets);
      saveConfig(newConfig);
    } catch (error) {
      console.error('Failed to save maxTokens:', error);
    }

    set({
      presets: newPresets,
      config: newConfig,
      isValid: validation.isValid && validateAPIKey(newConfig.apiKey),
      errors: validation.errors,
    });
    return { ok: true };
  },
}));
