import { beforeAll, afterAll, afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  configurable: true,
})

// jsdom 缺少的浏览器 API（antd / rc-slider 依赖）
if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
}

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
;(globalThis as { ResizeObserver?: unknown }).ResizeObserver = ResizeObserverMock
;(window as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverMock

beforeAll(() => {
  // Setup before all tests
})

afterEach(() => {
  // 卸载测试组件
  cleanup()
  // Clear localStorage after each test
  localStorage.clear()
})

afterAll(() => {
  // Cleanup after all tests
})
