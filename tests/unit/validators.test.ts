import { describe, it, expect } from 'vitest';
import { validateParameterValue } from '../../src/utils/validators';

describe('validateParameterValue', () => {
  it('合法值返回 null', () => {
    expect(validateParameterValue('temperature', 0)).toBeNull();
    expect(validateParameterValue('temperature', 2)).toBeNull();
    expect(validateParameterValue('temperature', 1.3)).toBeNull();
    expect(validateParameterValue('maxTokens', 100)).toBeNull();
    expect(validateParameterValue('maxTokens', 8192)).toBeNull();
    expect(validateParameterValue('maxTokens', 2048)).toBeNull();
  });

  it('读数越界返回范围原因', () => {
    expect(validateParameterValue('temperature', -0.1)).toContain('0 ~ 2');
    expect(validateParameterValue('temperature', 2.1)).toContain('0 ~ 2');
    expect(validateParameterValue('maxTokens', 99)).toContain('100 ~ 8192');
    expect(validateParameterValue('maxTokens', 8193)).toContain('100 ~ 8192');
  });

  it('不是数字时返回原因', () => {
    expect(validateParameterValue('temperature', null)).toContain('数字');
    expect(validateParameterValue('temperature', undefined)).toContain('数字');
    expect(validateParameterValue('temperature', NaN)).toContain('数字');
    expect(validateParameterValue('temperature', Infinity)).toContain('数字');
    expect(validateParameterValue('maxTokens', null)).toContain('数字');
    expect(validateParameterValue('maxTokens', 'abc')).toContain('数字');
  });

  it('maxTokens 需为整数', () => {
    expect(validateParameterValue('maxTokens', 100.5)).toContain('整数');
  });
});
