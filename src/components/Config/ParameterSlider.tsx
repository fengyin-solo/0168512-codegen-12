
import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { Slider, InputNumber, Typography, Row, Col, Segmented, message } from 'antd';
import type { PresetKey } from '../../types';
import { PRESET_ORDER, PRESET_META, PARAMETER_LIMITS } from '../../types';
import { useConfigStore } from '../../stores/configStore';
import type { ParameterUpdateResult } from '../../stores/configStore';
import './ParameterSlider.css';

const { Text } = Typography;

interface NumericParameterInputProps {
  /** 当前受控数值 */
  value: number;
  /** 允许范围与步长 */
  min: number;
  max: number;
  step: number;
  /** 是否要求整数 */
  integer?: boolean;
  /** 字段名，用于拼装错误提示 */
  label: string;
  /** 校验通过后的回调（store 会再次兜底校验） */
  onApply: (value: number) => ParameterUpdateResult;
}

/**
 * 带非法输入兜底的数字输入框：
 * - 输入非数字 / 越界时不生效，失焦或按回车时给出原因并回退到上一个有效值
 * - 拖动滑块等外部 value 变化照常同步
 */
function NumericParameterInput({
  value,
  min,
  max,
  step,
  integer = false,
  label,
  onApply,
}: NumericParameterInputProps) {
  const [invalid, setInvalid] = useState(false);
  // 拒绝提交时递增 key，强制 InputNumber 回到受控的上一个有效值
  const [resetKey, setResetKey] = useState(0);

  // 拖动滑块等外部 value 变化时清除错误态
  useEffect(() => {
    setInvalid(false);
  }, [value]);

  /** 校验已解析的数字是否满足整数与范围要求 */
  const validateNumber = (next: number): ParameterUpdateResult => {
    if (Number.isNaN(next) || !Number.isFinite(next)) {
      return { ok: false, reason: `${label} 需要输入一个数字` };
    }
    if (integer && !Number.isInteger(next)) {
      return { ok: false, reason: `${label} 必须是整数` };
    }
    if (next < min || next > max) {
      return { ok: false, reason: `${label} 必须在 ${min}-${max} 之间` };
    }
    return { ok: true };
  };

  /** 拒绝一次输入：标记错误、提示原因、回退到上一个有效值 */
  const reject = (result: ParameterUpdateResult) => {
    setInvalid(true);
    setResetKey((key) => key + 1);
    message.warning(result.reason!);
  };

  /**
   * 结算输入框原始文本：
   * rc-input-number 对“abc”这类无法解析的内容不会触发 onChange，
   * 因此失焦 / 回车时直接读取输入框文本做校验
   */
  const commitRaw = (rawValue: string) => {
    const trimmed = rawValue.trim();
    if (trimmed === '') {
      reject({ ok: false, reason: `${label} 需要输入一个数字` });
      return;
    }
    const parsed = Number(trimmed);
    const check = validateNumber(parsed);
    if (!check.ok) {
      reject(check);
      return;
    }
    const result = onApply(parsed);
    if (!result.ok) {
      reject(result);
    }
  };

  return (
    <InputNumber
      key={resetKey}
      step={step}
      value={value}
      status={invalid ? 'error' : undefined}
      onChange={(next) => {
        setInvalid(false);
        if (next === null) {
          return;
        }
        // 输入过程中可解析为数字时即时应用（拖动/输入表现不变），
        // 越界等情况先不生效，等失焦 / 回车时统一给出原因
        const check = validateNumber(next);
        if (!check.ok) {
          return;
        }
        const result = onApply(next);
        if (!result.ok) {
          reject(result);
        }
      }}
      onBlur={(event) => commitRaw((event.target as HTMLInputElement).value)}
      onPressEnter={(event) => commitRaw((event.target as HTMLInputElement).value)}
      style={{ width: '100%' }}
    />
  );
}

interface ParameterSliderProps {
  temperature: number;
  maxTokens: number;
  activePreset: PresetKey;
  onTemperatureChange: (value: number) => void;
  onMaxTokensChange: (value: number) => void;
  onPresetChange: (key: PresetKey) => void;
}

/**
 * 参数滑块组件
 */
export function ParameterSlider({
  temperature,
  maxTokens,
  activePreset,
  onTemperatureChange,
  onMaxTokensChange,
  onPresetChange,
}: ParameterSliderProps) {
  const setTemperature = useConfigStore((state) => state.setTemperature);
  const setMaxTokens = useConfigStore((state) => state.setMaxTokens);

  const temperatureMarks = PRESET_ORDER.reduce<Record<number, ReactNode>>(
    (marks, key) => {
      const position = PRESET_ORDER.indexOf(key); // 精确=0、平衡=1、创意=2
      marks[position] = (
        <span className={`preset-mark${key === activePreset ? ' preset-mark-active' : ''}`}>
          {PRESET_META[key].label}
        </span>
      );
      return marks;
    },
    {},
  );

  return (
    <div className="parameter-slider">
      {/* 预设切换 */}
      <div className="parameter-item">
        <div className="parameter-header">
          <label className="input-label">参数预设</label>
          <Text type="secondary" className="parameter-value">
            当前：{PRESET_META[activePreset].label}
          </Text>
        </div>
        <Segmented
          block
          value={activePreset}
          onChange={(value) => onPresetChange(value as PresetKey)}
          options={PRESET_ORDER.map((key) => ({
            value: key,
            label: PRESET_META[key].label,
          }))}
        />
        <Text type="secondary" className="parameter-hint">
          {PRESET_META[activePreset].description}，切换后温度与最大长度随之变化
        </Text>
      </div>

      {/* Temperature */}
      <div className="parameter-item">
        <div className="parameter-header">
          <label className="input-label">Temperature</label>
          <Text type="secondary" className="parameter-value">
            {temperature.toFixed(1)}
          </Text>
        </div>
        <Row gutter={16}>
          <Col span={16}>
            <Slider
              min={PARAMETER_LIMITS.temperature.min}
              max={PARAMETER_LIMITS.temperature.max}
              step={PARAMETER_LIMITS.temperature.step}
              value={temperature}
              onChange={onTemperatureChange}
              marks={temperatureMarks}
            />
          </Col>
          <Col span={8}>
            <NumericParameterInput
              value={temperature}
              min={PARAMETER_LIMITS.temperature.min}
              max={PARAMETER_LIMITS.temperature.max}
              step={PARAMETER_LIMITS.temperature.step}
              label="Temperature"
              onApply={setTemperature}
            />
          </Col>
        </Row>
        <Text type="secondary" className="parameter-hint">
          较低的值使输出更确定，较高的值使输出更随机
        </Text>
      </div>

      {/* Max Tokens */}
      <div className="parameter-item">
        <div className="parameter-header">
          <label className="input-label">Max Tokens</label>
        </div>
        <Row gutter={16}>
          <Col span={16}>
            <Slider
              min={PARAMETER_LIMITS.maxTokens.min}
              max={PARAMETER_LIMITS.maxTokens.max}
              step={PARAMETER_LIMITS.maxTokens.step}
              value={maxTokens}
              onChange={onMaxTokensChange}
            />
          </Col>
          <Col span={8}>
            <NumericParameterInput
              value={maxTokens}
              min={PARAMETER_LIMITS.maxTokens.min}
              max={PARAMETER_LIMITS.maxTokens.max}
              step={PARAMETER_LIMITS.maxTokens.step}
              integer
              label="Max Tokens"
              onApply={setMaxTokens}
            />
          </Col>
        </Row>
        <Text type="secondary" className="parameter-hint">
          控制回复的最大长度
        </Text>
      </div>
    </div>
  );
}
