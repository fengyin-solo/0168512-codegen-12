/// <reference types="vitest/config" />
import { defineConfig, mergeConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import viteConfig from './vite.config'

export default mergeConfig(
  viteConfig,
  defineConfig({
    plugins: [react()],
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./tests/setup.ts'],
      include: ['tests/unit/**/*.{test,spec}.{ts,tsx}'],
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
    },
  }),
)
