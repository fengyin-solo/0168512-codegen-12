import { create } from 'zustand';
import type { AppConfig, ConfigUpdates, ConfigValidation, PresetId } from '../types';
import { DEFAULT_CONFIG } from '../types';
import { saveConfig, loadConfig } from '../services/storage';
import { validateConfig, validateAPIKey, validateParameterValue } from '../utils/validators';

interface ConfigState {
  /** 当前配置 */
  config: AppConfig;
  /** 配置是否有效 */
  isValid: boolean;
  /** 验证错误信息 */
  errors: ConfigValidation['errors'];
  /** 是否已初始化 */
  initialized: boolean;
}

interface ConfigActions {
  /** 初始化配置（从 localStorage 加载） */
  initConfig: () => void;
  /** 更新配置（数值参数越界或不是数字时不生效，并在 errors 中给出原因） */
  updateConfig: (updates: ConfigUpdates) => void;
  /** 切换当前参数预设，应用该预设保存的温度与最大长度 */
  setActivePreset: (preset: PresetId) => void;
  /** 验证当前配置 */
  validateCurrentConfig: () => boolean;
  /** 重置为默认配置 */
  resetConfig: () => void;
  /** 设置 API Key */
  setAPIKey: (apiKey: string) => void;
  /** 设置模型 */
  setModel: (model: string) => void;
  /** 设置 temperature */
  setTemperature: (temperature: number) => void;
  /** 设置 maxTokens */
  setMaxTokens: (maxTokens: number) => void;
}

type ConfigStore = ConfigState & ConfigActions;

export const useConfigStore = create<ConfigStore>((set, get) => ({
  // Initial state
  config: DEFAULT_CONFIG,
  isValid: false,
  errors: {},
  initialized: false,

  // Actions
  initConfig: () => {
    const loadedConfig = loadConfig();
    const validation = validateConfig(loadedConfig);

    set({
      config: loadedConfig,
      isValid: validation.isValid && validateAPIKey(loadedConfig.apiKey),
      errors: validation.errors,
      initialized: true,
    });
  },

  updateConfig: (updates) => {
    const { config, errors: prevErrors } = get();

    // 数值参数先校验：越界或不是数字时不生效，并记录原因
    const rejected: ConfigValidation['errors'] = {};
    const validUpdates: Partial<AppConfig> = {};

    for (const key of Object.keys(updates) as (keyof ConfigUpdates)[]) {
      const value = updates[key];
      if (key === 'temperature' || key === 'maxTokens') {
        const reason = validateParameterValue(key, value);
        if (reason) {
          rejected[key] = reason;
          continue;
        }
        validUpdates[key] = value as number;
      } else {
        // 其他字段（apiKey、model 等）保持原有行为，直接应用
        (validUpdates as Record<string, unknown>)[key] = value;
      }
    }

    const newConfig: AppConfig = { ...config, ...validUpdates };

    // 参数变化同步写入当前预设槽位，其余预设保持不变
    if (validUpdates.temperature !== undefined || validUpdates.maxTokens !== undefined) {
      newConfig.presets = {
        ...config.presets,
        [config.activePreset]: {
          ...config.presets[config.activePreset],
          ...(validUpdates.temperature !== undefined
            ? { temperature: validUpdates.temperature }
            : {}),
          ...(validUpdates.maxTokens !== undefined
            ? { maxTokens: validUpdates.maxTokens }
            : {}),
        },
      };
    }

    const validation = validateConfig(newConfig);
    const errors: ConfigValidation['errors'] = {
      ...prevErrors,
      ...validation.errors,
      ...rejected,
    };
    // 本次校验通过的字段，清除旧的错误提示
    (['temperature', 'maxTokens'] as const).forEach((param) => {
      if (param in updates && !rejected[param]) {
        delete errors[param];
      }
    });
    if ('apiKey' in updates && !validation.errors.apiKey) {
      delete errors.apiKey;
    }

    // 保存到 localStorage（整体保存，预设之外的字段与另外两套预设原样保留）
    try {
      saveConfig(newConfig);
    } catch (error) {
      console.error('Failed to save config:', error);
    }

    set({
      config: newConfig,
      isValid: Object.keys(errors).length === 0,
      errors,
    });
  },

  setActivePreset: (preset) => {
    const { config } = get();
    const target = config.presets[preset];
    if (!target) return;

    // 应用目标预设记住的温度与最大长度
    const newConfig: AppConfig = {
      ...config,
      activePreset: preset,
      temperature: target.temperature,
      maxTokens: target.maxTokens,
    };

    try {
      saveConfig(newConfig);
    } catch (error) {
      console.error('Failed to save config:', error);
    }

    const validation = validateConfig(newConfig);

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
    try {
      saveConfig(DEFAULT_CONFIG);
    } catch (error) {
      console.error('Failed to save default config:', error);
    }

    set({
      config: DEFAULT_CONFIG,
      isValid: false,
      errors: {},
    });
  },

  setAPIKey: (apiKey) => {
    const { updateConfig } = get();
    updateConfig({ apiKey });
  },

  setModel: (model) => {
    const { updateConfig } = get();
    updateConfig({ model });
  },

  setTemperature: (temperature) => {
    const { updateConfig } = get();
    updateConfig({ temperature });
  },

  setMaxTokens: (maxTokens) => {
    const { updateConfig } = get();
    updateConfig({ maxTokens });
  },
}));
