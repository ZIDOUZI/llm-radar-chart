import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/api/v2': {
        target: 'https://artificialanalysis.ai',
        changeOrigin: true,
      },
    },
  },
})
