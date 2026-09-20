import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { ConfigProvider, App as AntApp } from 'antd'
import { ParameterSlider } from '../../src/components/Config/ParameterSlider'
import { useConfigStore } from '../../src/stores/configStore'
import { PARAMETER_LIMITS } from '../../src/types'

/** 两个数字输入框：按当前值取对应 DOM 输入元素 */
function getNumberInput(currentValue: string): HTMLInputElement {
  const inputs = screen.getAllByRole('spinbutton')
  const found = inputs.find(
    (el) => el.getAttribute('aria-valuenow') === currentValue,
  ) as HTMLInputElement | undefined
  if (!found) {
    const values = inputs.map((el) => el.getAttribute('aria-valuenow'))
    throw new Error(`未找到当前值为 ${currentValue} 的数字输入框，实际为：${values.join(', ')}`)
  }
  return found
}

function clickPreset(name: '精确' | '平衡' | '创意') {
  const segmented = document.querySelector('.ant-segmented')!
  const items = Array.from(segmented.querySelectorAll('label.ant-segmented-item'))
  const target = items.find(
    (el) => el.querySelector('.ant-segmented-item-label')?.getAttribute('title') === name,
  ) as HTMLElement | undefined
  if (!target) {
    throw new Error(`未找到预设：${name}`)
  }
  // 点击整项（label 会把点击转发给内部 radio）
  fireEvent.click(target)
}

// antd 的 message 需要 App 包裹才能在测试环境稳定挂载
function renderSlider() {
  const state = useConfigStore.getState()
  const result = render(
    <ConfigProvider>
      <AntApp>
        <ParameterSlider
          temperature={state.config.temperature}
          maxTokens={state.config.maxTokens}
          activePreset={state.activePreset}
          onTemperatureChange={(v) => useConfigStore.getState().setTemperature(v)}
          onMaxTokensChange={(v) => useConfigStore.getState().setMaxTokens(v)}
          onPresetChange={(k) => useConfigStore.getState().switchPreset(k)}
        />
      </AntApp>
    </ConfigProvider>,
  )

  const rerenderFromStore = () => {
    const s = useConfigStore.getState()
    result.rerender(
      <ConfigProvider>
        <AntApp>
          <ParameterSlider
            temperature={s.config.temperature}
            maxTokens={s.config.maxTokens}
            activePreset={s.activePreset}
            onTemperatureChange={(v) => useConfigStore.getState().setTemperature(v)}
            onMaxTokensChange={(v) => useConfigStore.getState().setMaxTokens(v)}
            onPresetChange={(k) => useConfigStore.getState().switchPreset(k)}
          />
        </AntApp>
      </ConfigProvider>,
    )
  }

  return { ...result, rerenderFromStore }
}

describe('ParameterSlider 参数预设', () => {
  beforeEach(() => {
    useConfigStore.getState().initConfig()
  })

  it('渲染三套预设切换项，默认高亮平衡', () => {
    renderSlider()

    const segmented = document.querySelector('.ant-segmented')!
    const labels = Array.from(segmented.querySelectorAll('.ant-segmented-item-label')).map(
      (el) => el.textContent,
    )
    expect(labels).toEqual(['精确', '平衡', '创意'])
    expect(segmented.querySelector('.ant-segmented-item-selected')?.textContent).toContain('平衡')
  })

  it('点击切换后温度与最大长度跟随变化，滑块刻度高亮同步移动', () => {
    const { rerenderFromStore } = renderSlider()

    act(() => clickPreset('精确'))

    const { config, activePreset } = useConfigStore.getState()
    expect(activePreset).toBe('precise')
    expect(config.temperature).toBe(0.2)
    expect(config.maxTokens).toBe(1024)

    // 组件由 props 驱动，store 变化后需以最新 props 重渲染
    rerenderFromStore()
    // 刻度上“精确”应处于激活样式
    expect(document.querySelector('.preset-mark-active')?.textContent).toBe('精确')

    act(() => clickPreset('创意'))
    rerenderFromStore()
    expect(useConfigStore.getState().activePreset).toBe('creative')
    expect(useConfigStore.getState().config.temperature).toBe(1.2)
    expect(document.querySelector('.preset-mark-active')?.textContent).toBe('创意')
  })

  it('改参数 → 切走 → 切回：输入框回到之前调好的值', () => {
    const { rerenderFromStore } = renderSlider()

    // 通过数字输入框把温度调成 1.5
    const temperatureInput = getNumberInput('0.7')
    act(() => {
      fireEvent.change(temperatureInput, { target: { value: '1.5' } })
      fireEvent.keyDown(temperatureInput, { key: 'Enter', keyCode: 13 })
    })
    expect(useConfigStore.getState().config.temperature).toBe(1.5)

    // 切到精确再切回平衡
    act(() => clickPreset('精确'))
    rerenderFromStore()
    act(() => clickPreset('平衡'))
    rerenderFromStore()

    expect(getNumberInput('1.5')).toBeTruthy()
  })

  it('越界的数字输入失焦后不生效并给出原因，值回退', async () => {
    renderSlider()
    const { min, max } = PARAMETER_LIMITS.temperature

    const temperatureInput = getNumberInput('0.7')
    act(() => {
      fireEvent.focus(temperatureInput)
      fireEvent.change(temperatureInput, { target: { value: String(max + 1) } })
      fireEvent.blur(temperatureInput)
    })

    // 越界未应用
    expect(useConfigStore.getState().config.temperature).toBe(0.7)
    // 给出原因（antd message warning）
    const warning = await screen.findByText(new RegExp(`必须在 ${min}-${max}`))
    expect(warning).toBeInTheDocument()

    // 输入框回到上一个有效值
    expect(getNumberInput('0.7')).toBeTruthy()
  })

  it('非数字输入失焦后不生效并提示需要数字', async () => {
    renderSlider()

    const maxTokensInput = getNumberInput('2048')
    act(() => {
      fireEvent.focus(maxTokensInput)
      fireEvent.change(maxTokensInput, { target: { value: 'abc' } })
      fireEvent.blur(maxTokensInput)
    })

    expect(useConfigStore.getState().config.maxTokens).toBe(2048)
    expect(await screen.findByText(/需要输入一个数字/)).toBeInTheDocument()
  })

  it('Max Tokens 非整数输入不生效并提示', async () => {
    renderSlider()

    const maxTokensInput = getNumberInput('2048')
    act(() => {
      fireEvent.focus(maxTokensInput)
      fireEvent.change(maxTokensInput, { target: { value: '1000.5' } })
      fireEvent.blur(maxTokensInput)
    })

    expect(useConfigStore.getState().config.maxTokens).toBe(2048)
    expect(await screen.findByText(/必须是整数/)).toBeInTheDocument()
  })

  it('滑块键盘拖动表现保持：更新当前预设', () => {
    renderSlider()

    const sliderHandles = document.querySelectorAll('.ant-slider-handle')
    expect(sliderHandles.length).toBeGreaterThanOrEqual(2)
    const temperatureHandle = sliderHandles[0] as HTMLElement

    act(() => {
      temperatureHandle.focus()
      fireEvent.keyDown(temperatureHandle, { key: 'ArrowRight', keyCode: 39 })
    })

    const value = useConfigStore.getState().config.temperature
    expect(value).toBeGreaterThan(0.7)
    expect(value).toBeLessThanOrEqual(2)
  })

  it('修改当前预设不会改动另外两份', () => {
    renderSlider()
    const creativeBefore = useConfigStore.getState().presets.creative
    const preciseBefore = useConfigStore.getState().presets.precise

    const temperatureInput = getNumberInput('0.7')
    act(() => {
      fireEvent.change(temperatureInput, { target: { value: '0.4' } })
      fireEvent.keyDown(temperatureInput, { key: 'Enter', keyCode: 13 })
    })

    expect(useConfigStore.getState().presets.creative).toEqual(creativeBefore)
    expect(useConfigStore.getState().presets.precise).toEqual(preciseBefore)
    expect(useConfigStore.getState().presets.balanced.temperature).toBe(0.4)
  })
})
