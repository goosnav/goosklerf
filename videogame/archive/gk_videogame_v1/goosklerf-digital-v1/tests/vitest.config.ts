import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@gk/shared': path.resolve(__dirname, '../packages/shared/src/index.ts'),
      '@gk/cards': path.resolve(__dirname, '../packages/cards/src/index.ts'),
      '@gk/engine': path.resolve(__dirname, '../packages/engine/src/index.ts'),
      '@gk/ai': path.resolve(__dirname, '../packages/ai/src/index.ts'),
    },
  },
})
