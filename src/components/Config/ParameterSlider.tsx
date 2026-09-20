
import { Slider, InputNumber, Typography, Row, Col, Segmented } from 'antd';
import type { PresetId } from '../../types';
import { PRESET_IDS, PRESET_LABELS } from '../../types';
import './ParameterSlider.css';

const { Text } = Typography;

interface ParameterSliderProps {
  temperature: number;
  maxTokens: number;
  activePreset: PresetId;
  temperatureError?: string;
  maxTokensError?: string;
  onTemperatureChange: (value: number) => void;
  onMaxTokensChange: (value: number | null) => void;
  onPresetChange: (preset: PresetId) => void;
}

/**
 * 参数滑块组件
 */
export function ParameterSlider({
  temperature,
  maxTokens,
  activePreset,
  temperatureError,
  maxTokensError,
  onTemperatureChange,
  onMaxTokensChange,
  onPresetChange,
}: ParameterSliderProps) {
  // 刻度上高亮当前预设，让滑块当前落在哪一套一目了然
  const presetMark = (id: PresetId) => (
    <span className={`preset-mark${activePreset === id ? ' preset-mark-active' : ''}`}>
      {PRESET_LABELS[id]}
    </span>
  );

  return (
    <div className="parameter-slider">
      {/* 预设切换：精确 / 平衡 / 创意 */}
      <Segmented
        block
        className="preset-switcher"
        options={PRESET_IDS.map((id) => ({ label: PRESET_LABELS[id], value: id }))}
        value={activePreset}
        onChange={(value) => onPresetChange(value as PresetId)}
      />

      {/* Temperature */}
      <div className="parameter-item">
        <div className="parameter-header">
          <label className="input-label">Temperature</label>
          <Text type="secondary" className="parameter-value">
            {temperature.toFixed(1)}
          </Text>
        </div>
        <Slider
          min={0}
          max={2}
          step={0.1}
          value={temperature}
          onChange={onTemperatureChange}
          marks={{
            0: presetMark('precise'),
            1: presetMark('balanced'),
            2: presetMark('creative'),
          }}
        />
        {temperatureError ? (
          <Text type="danger" className="parameter-error">
            {temperatureError}
          </Text>
        ) : (
          <Text type="secondary" className="parameter-hint">
            较低的值使输出更确定，较高的值使输出更随机
          </Text>
        )}
      </div>

      {/* Max Tokens */}
      <div className="parameter-item">
        <div className="parameter-header">
          <label className="input-label">Max Tokens</label>
        </div>
        <Row gutter={16}>
          <Col span={16}>
            <Slider
              min={100}
              max={8192}
              step={100}
              value={maxTokens}
              onChange={onMaxTokensChange}
            />
          </Col>
          <Col span={8}>
            <InputNumber
              min={100}
              max={8192}
              step={100}
              value={maxTokens}
              onChange={(value) => onMaxTokensChange(value)}
              status={maxTokensError ? 'error' : undefined}
              style={{ width: '100%' }}
            />
          </Col>
        </Row>
        {maxTokensError ? (
          <Text type="danger" className="parameter-error">
            {maxTokensError}
          </Text>
        ) : (
          <Text type="secondary" className="parameter-hint">
            控制回复的最大长度
          </Text>
        )}
      </div>
    </div>
  );
}
