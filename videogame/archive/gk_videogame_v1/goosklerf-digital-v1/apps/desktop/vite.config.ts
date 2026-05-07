import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@gk/engine': path.resolve(__dirname, '../../packages/engine/src/index.ts'),
      '@gk/cards':  path.resolve(__dirname, '../../packages/cards/src/index.ts'),
      '@gk/ai':     path.resolve(__dirname, '../../packages/ai/src/index.ts'),
      '@gk/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
})
