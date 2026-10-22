import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/main/index.ts'),
          service: resolve('src/service/index.ts'),
        },
      },
    },
  },
  preload: { plugins: [externalizeDepsPlugin()] },
  renderer: { plugins: [react()], build: { minify: true } },
})
