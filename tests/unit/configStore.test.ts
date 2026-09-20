import { describe, it, expect, beforeEach } from 'vitest';

// node 环境下没有 localStorage，这里提供一个内存实现
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => (key in store ? store[key] : null),
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  configurable: true,
  writable: true,
});

import { useConfigStore } from '../../src/stores/configStore';
import { loadConfig } from '../../src/services/storage';
import { DEFAULT_CONFIG, DEFAULT_PRESETS } from '../../src/types';

const state = () => useConfigStore.getState();

beforeEach(() => {
  localStorage.clear();
  state().resetConfig();
});

describe('参数预设切换', () => {
  it('切换预设后温度与最大长度跟着变', () => {
    state().setActivePreset('precise');
    expect(state().config.activePreset).toBe('precise');
    expect(state().config.temperature).toBe(DEFAULT_PRESETS.precise.temperature);
    expect(state().config.maxTokens).toBe(DEFAULT_PRESETS.precise.maxTokens);

    state().setActivePreset('creative');
    expect(state().config.temperature).toBe(DEFAULT_PRESETS.creative.temperature);
    expect(state().config.maxTokens).toBe(DEFAULT_PRESETS.creative.maxTokens);
  });

  it('改动后切走再切回，回到之前调好的那一份，另外两套不被改动', () => {
    // 在“平衡”下调整两项参数
    state().updateConfig({ temperature: 0.9, maxTokens: 3000 });
    // 切到“创意”，只改温度
    state().setActivePreset('creative');
    state().updateConfig({ temperature: 1.8 });

    // 切回“平衡”：恢复之前调好的值
    state().setActivePreset('balanced');
    expect(state().config.temperature).toBe(0.9);
    expect(state().config.maxTokens).toBe(3000);

    // “精确”保持默认，“创意”记住了自己的调整
    expect(state().config.presets.precise).toEqual(DEFAULT_PRESETS.precise);
    expect(state().config.presets.creative).toEqual({
      temperature: 1.8,
      maxTokens: DEFAULT_PRESETS.creative.maxTokens,
    });
  });
});

describe('非法输入处理', () => {
  it('读数越界不生效并给出原因', () => {
    state().updateConfig({ temperature: 2.5 });
    expect(state().config.temperature).toBe(DEFAULT_CONFIG.temperature);
    expect(state().errors.temperature).toContain('0 ~ 2');

    state().updateConfig({ maxTokens: 50 });
    expect(state().config.maxTokens).toBe(DEFAULT_CONFIG.maxTokens);
    expect(state().errors.maxTokens).toContain('100 ~ 8192');
  });

  it('输入不是数字不生效并给出原因', () => {
    state().updateConfig({ maxTokens: null });
    expect(state().config.maxTokens).toBe(DEFAULT_CONFIG.maxTokens);
    expect(state().errors.maxTokens).toContain('数字');

    state().updateConfig({ temperature: Number('abc') });
    expect(state().config.temperature).toBe(DEFAULT_CONFIG.temperature);
    expect(state().errors.temperature).toContain('数字');
  });

  it('非法输入不会污染当前预设，修正后错误提示清除', () => {
    state().updateConfig({ maxTokens: 99999 });
    expect(state().config.presets.balanced).toEqual(DEFAULT_PRESETS.balanced);

    state().updateConfig({ maxTokens: 4096 });
    expect(state().config.maxTokens).toBe(4096);
    expect(state().errors.maxTokens).toBeUndefined();
    expect(state().config.presets.balanced.maxTokens).toBe(4096);
  });
});

describe('本地持久化', () => {
  it('重新打开（initConfig）后本地保存的预设与当前值能恢复', () => {
    state().setActivePreset('precise');
    state().updateConfig({ temperature: 0.3, maxTokens: 1500 });
    state().setActivePreset('creative');
    state().updateConfig({ temperature: 1.9 });

    // 模拟重新打开页面：从 localStorage 重新加载
    state().initConfig();

    expect(state().config.activePreset).toBe('creative');
    expect(state().config.temperature).toBe(1.9);
    expect(state().config.maxTokens).toBe(DEFAULT_PRESETS.creative.maxTokens);
    expect(state().config.presets.precise).toEqual({ temperature: 0.3, maxTokens: 1500 });
    expect(state().config.presets.balanced).toEqual(DEFAULT_PRESETS.balanced);
  });

  it('后续保存不会顶掉其他预设', () => {
    state().updateConfig({ temperature: 0.6 }); // 平衡
    state().setActivePreset('precise');
    state().updateConfig({ maxTokens: 900 });
    // 再改无关字段触发一次整体保存
    state().updateConfig({ apiKey: 'sk-test_key-123' });

    const loaded = loadConfig();
    expect(loaded.presets.balanced.temperature).toBe(0.6);
    expect(loaded.presets.precise.maxTokens).toBe(900);
    expect(loaded.presets.creative).toEqual(DEFAULT_PRESETS.creative);
  });

  it('旧版本数据（无预设字段）迁移：当前参数归入当前预设', () => {
    localStorage.setItem(
      'react-chat-config',
      JSON.stringify({
        apiKey: '',
        model: 'deepseek-ai/DeepSeek-V3',
        temperature: 1.1,
        maxTokens: 4000,
        baseUrl: 'https://api.siliconflow.com/v1',
      }),
    );

    const loaded = loadConfig();
    expect(loaded.activePreset).toBe('balanced');
    expect(loaded.temperature).toBe(1.1);
    expect(loaded.maxTokens).toBe(4000);
    expect(loaded.presets.balanced).toEqual({ temperature: 1.1, maxTokens: 4000 });
    expect(loaded.presets.creative).toEqual(DEFAULT_PRESETS.creative);
  });

  it('存储中某套预设损坏时回退默认，不影响其他预设', () => {
    localStorage.setItem(
      'react-chat-config',
      JSON.stringify({
        activePreset: 'precise',
        presets: {
          precise: { temperature: 99, maxTokens: 1500 }, // temperature 越界
          balanced: { temperature: 0.8, maxTokens: 2500 },
          creative: 'oops',
        },
      }),
    );

    const loaded = loadConfig();
    expect(loaded.presets.precise).toEqual({
      temperature: DEFAULT_PRESETS.precise.temperature,
      maxTokens: 1500,
    });
    expect(loaded.presets.balanced).toEqual({ temperature: 0.8, maxTokens: 2500 });
    expect(loaded.presets.creative).toEqual(DEFAULT_PRESETS.creative);
    // 当前读数以当前预设为准
    expect(loaded.temperature).toBe(DEFAULT_PRESETS.precise.temperature);
  });
});
