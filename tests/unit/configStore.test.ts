import { describe, it, expect, beforeEach } from 'vitest'
import { useConfigStore } from '../../src/stores/configStore'
import { DEFAULT_PRESETS, PARAMETER_LIMITS, type PresetKey } from '../../src/types'
import {
  loadParameterPresets,
  loadActivePreset,
  saveConfig,
} from '../../src/services/storage'

/** 重置单例 store 到持久化状态（localStorage 已在 afterEach 清空） */
function reinitStore() {
  useConfigStore.getState().initConfig()
}

describe('configStore 参数预设', () => {
  beforeEach(() => {
    reinitStore()
  })

  it('初始状态使用默认预设，温度与最大长度取平衡预设', () => {
    const { config, activePreset, presets } = useConfigStore.getState()
    expect(activePreset).toBe('balanced')
    expect(config.temperature).toBe(DEFAULT_PRESETS.balanced.temperature)
    expect(config.maxTokens).toBe(DEFAULT_PRESETS.balanced.maxTokens)
    expect(presets).toEqual(DEFAULT_PRESETS)
  })

  it('切换预设后温度与最大长度跟随该预设变化', () => {
    const store = useConfigStore.getState()

    store.switchPreset('precise')
    let state = useConfigStore.getState()
    expect(state.activePreset).toBe('precise')
    expect(state.config.temperature).toBe(DEFAULT_PRESETS.precise.temperature)
    expect(state.config.maxTokens).toBe(DEFAULT_PRESETS.precise.maxTokens)

    state.switchPreset('creative')
    state = useConfigStore.getState()
    expect(state.activePreset).toBe('creative')
    expect(state.config.temperature).toBe(DEFAULT_PRESETS.creative.temperature)
    expect(state.config.maxTokens).toBe(DEFAULT_PRESETS.creative.maxTokens)
  })

  it('修改当前预设后切走再切回，恢复之前调好的值，另外两份不被改动', () => {
    const otherPresets: PresetKey[] = ['precise', 'creative']
    const othersBefore = otherPresets.map((key) => ({
      key,
      ...DEFAULT_PRESETS[key],
    }))

    // 在平衡预设下调整参数
    useConfigStore.getState().setTemperature(0.9)
    useConfigStore.getState().setMaxTokens(3000)

    // 依次切到另外两份，参数应是它们自己的值
    useConfigStore.getState().switchPreset('precise')
    expect(useConfigStore.getState().config.temperature).toBe(DEFAULT_PRESETS.precise.temperature)
    useConfigStore.getState().switchPreset('creative')
    expect(useConfigStore.getState().config.temperature).toBe(DEFAULT_PRESETS.creative.temperature)

    // 切回平衡，应回到之前调好的那一份
    useConfigStore.getState().switchPreset('balanced')
    const state = useConfigStore.getState()
    expect(state.config.temperature).toBe(0.9)
    expect(state.config.maxTokens).toBe(3000)

    // 另外两份保持默认未改动
    for (const snapshot of othersBefore) {
      const preset = state.presets[snapshot.key]
      expect(preset.temperature).toBe(snapshot.temperature)
      expect(preset.maxTokens).toBe(snapshot.maxTokens)
    }
  })

  it('每个预设独立保存各自的修改，互不影响', () => {
    useConfigStore.getState().switchPreset('precise')
    useConfigStore.getState().setTemperature(0.1)
    useConfigStore.getState().switchPreset('creative')
    useConfigStore.getState().setTemperature(1.8)

    const { presets } = useConfigStore.getState()
    expect(presets.precise.temperature).toBe(0.1)
    expect(presets.creative.temperature).toBe(1.8)
    expect(presets.balanced.temperature).toBe(DEFAULT_PRESETS.balanced.temperature)
  })

  it('温度越界时不生效并给出原因', () => {
    const { config: before, presets: presetsBefore } = useConfigStore.getState()
    const { min, max } = PARAMETER_LIMITS.temperature

    const tooLow = useConfigStore.getState().setTemperature(min - 0.1)
    const tooHigh = useConfigStore.getState().setTemperature(max + 0.1)

    expect(tooLow.ok).toBe(false)
    expect(tooLow.reason).toContain(String(min))
    expect(tooHigh.ok).toBe(false)
    expect(tooHigh.reason).toContain(String(max))

    const state = useConfigStore.getState()
    expect(state.config.temperature).toBe(before.temperature)
    expect(state.presets).toEqual(presetsBefore)
  })

  it('温度输入非数字（NaN / Infinity）时不生效并给出原因', () => {
    const before = useConfigStore.getState().config.temperature

    expect(useConfigStore.getState().setTemperature(Number.NaN)).toMatchObject({ ok: false })
    expect(useConfigStore.getState().setTemperature(Number.POSITIVE_INFINITY)).toMatchObject({
      ok: false,
    })

    expect(useConfigStore.getState().config.temperature).toBe(before)
  })

  it('Max Tokens 越界、非整数、非数字时不生效并给出原因', () => {
    const before = useConfigStore.getState().config.maxTokens
    const { min, max } = PARAMETER_LIMITS.maxTokens

    const tooLow = useConfigStore.getState().setMaxTokens(min - 100)
    const tooHigh = useConfigStore.getState().setMaxTokens(max + 100)
    const notInteger = useConfigStore.getState().setMaxTokens(1000.5)
    const notNumber = useConfigStore.getState().setMaxTokens(Number.NaN)

    expect(tooLow).toMatchObject({ ok: false })
    expect(tooLow.reason).toContain(String(min))
    expect(tooHigh).toMatchObject({ ok: false })
    expect(tooHigh.reason).toContain(String(max))
    expect(notInteger.ok).toBe(false)
    expect(notNumber.ok).toBe(false)

    expect(useConfigStore.getState().config.maxTokens).toBe(before)
  })

  it('本地保存的预设与激活项在重新初始化后恢复', () => {
    useConfigStore.getState().switchPreset('creative')
    useConfigStore.getState().setTemperature(1.5)
    useConfigStore.getState().setMaxTokens(5000)

    // 模拟重新打开应用：重新从 localStorage 初始化
    reinitStore()

    const state = useConfigStore.getState()
    expect(state.activePreset).toBe('creative')
    expect(state.config.temperature).toBe(1.5)
    expect(state.config.maxTokens).toBe(5000)
    expect(state.presets.creative.temperature).toBe(1.5)
    // 其他预设仍是默认
    expect(state.presets.precise).toEqual(DEFAULT_PRESETS.precise)
  })

  it('直接读取存储层验证持久化内容', () => {
    useConfigStore.getState().switchPreset('precise')
    useConfigStore.getState().setTemperature(0.3)

    const presets = loadParameterPresets()
    expect(presets.precise.temperature).toBe(0.3)
    expect(presets.balanced).toEqual(DEFAULT_PRESETS.balanced)
    expect(loadActivePreset()).toBe('precise')
  })

  it('保存其它配置（API Key 等）不会顶掉任何预设', () => {
    useConfigStore.getState().switchPreset('creative')
    useConfigStore.getState().setTemperature(1.6)
    const presetsSnapshot = useConfigStore.getState().presets

    // 后续操作重新保存主配置
    useConfigStore.getState().updateConfig({ model: 'Qwen/Qwen2.5-72B-Instruct' })
    saveConfig({ ...useConfigStore.getState().config, apiKey: 'some-valid-key-123' })

    expect(loadParameterPresets()).toEqual(presetsSnapshot)
    expect(loadActivePreset()).toBe('creative')
  })

  it('重置后三套预设与激活项恢复默认', () => {
    useConfigStore.getState().switchPreset('creative')
    useConfigStore.getState().setTemperature(1.9)

    useConfigStore.getState().resetConfig()

    const state = useConfigStore.getState()
    expect(state.presets).toEqual(DEFAULT_PRESETS)
    expect(state.activePreset).toBe('balanced')
    expect(state.config.temperature).toBe(DEFAULT_PRESETS.balanced.temperature)
    expect(loadActivePreset()).toBe('balanced')
  })
})
