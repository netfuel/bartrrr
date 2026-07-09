import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    watch: {
      // Agent worktrees and archives live inside the repo; watching them
      // makes dev-server startup and HMR crawl.
      ignored: ['**/.claude/**', '**/_archive/**'],
    },
  },
})
