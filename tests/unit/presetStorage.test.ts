import { describe, it, expect, beforeEach } from 'vitest'
import {
  saveParameterPresets,
  loadParameterPresets,
  saveActivePreset,
  loadActivePreset,
} from '../../src/services/storage'
import { DEFAULT_PRESETS, PARAMETER_LIMITS } from '../../src/types'

describe('storage 参数预设持久化', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('未存储时返回三套默认预设的拷贝', () => {
    const presets = loadParameterPresets()
    expect(presets).toEqual(DEFAULT_PRESETS)
    // 返回的是拷贝，修改不影响再次加载
    presets.precise.temperature = 99
    expect(loadParameterPresets()).toEqual(DEFAULT_PRESETS)
  })

  it('保存后可原样读回', () => {
    const presets = {
      precise: { temperature: 0.1, maxTokens: 512 },
      balanced: { temperature: 0.8, maxTokens: 2500 },
      creative: { temperature: 1.9, maxTokens: 8000 },
    }
    saveParameterPresets(presets)
    expect(loadParameterPresets()).toEqual(presets)

    saveActivePreset('creative')
    expect(loadActivePreset()).toBe('creative')
  })

  it('JSON 损坏时回退默认预设，不抛异常', () => {
    localStorage.setItem('react-chat-parameter-presets', '{not-json')
    expect(loadParameterPresets()).toEqual(DEFAULT_PRESETS)
  })

  it('单个预设越界/缺字段时仅该项回退默认，其余保留', () => {
    localStorage.setItem(
      'react-chat-parameter-presets',
      JSON.stringify({
        precise: { temperature: 5, maxTokens: 10 }, // 越界
        balanced: { temperature: 0.9, maxTokens: 3000 }, // 合法
        // creative 缺失
      }),
    )

    const presets = loadParameterPresets()
    expect(presets.precise).toEqual(DEFAULT_PRESETS.precise)
    expect(presets.balanced).toEqual({ temperature: 0.9, maxTokens: 3000 })
    expect(presets.creative).toEqual(DEFAULT_PRESETS.creative)
  })

  it('非数字 / NaN 类型的参数回退默认', () => {
    localStorage.setItem(
      'react-chat-parameter-presets',
      JSON.stringify({
        precise: { temperature: '0.2', maxTokens: NaN },
        balanced: { temperature: null, maxTokens: 2048 },
        creative: 'invalid',
      }),
    )

    const presets = loadParameterPresets()
    expect(presets.precise).toEqual(DEFAULT_PRESETS.precise)
    expect(presets.balanced).toEqual(DEFAULT_PRESETS.balanced)
    expect(presets.creative).toEqual(DEFAULT_PRESETS.creative)
  })

  it('非法的激活预设标识回退默认', () => {
    localStorage.setItem('react-chat-active-preset', 'unknown')
    expect(loadActivePreset()).toBe('balanced')
  })

  it('边界值被视为合法', () => {
    const { temperature: t, maxTokens: m } = PARAMETER_LIMITS
    saveParameterPresets({
      precise: { temperature: t.min, maxTokens: m.min },
      balanced: { temperature: t.max, maxTokens: m.max },
      creative: { temperature: 1, maxTokens: 1000 },
    })
    const presets = loadParameterPresets()
    expect(presets.precise).toEqual({ temperature: t.min, maxTokens: m.min })
    expect(presets.balanced).toEqual({ temperature: t.max, maxTokens: m.max })
  })
})
