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
  build: {
    target: 'es2022',
    sourcemap: 'hidden',
    // mapbox-gl is ~1.7 MB on its own and is only loaded when a map mounts
    chunkSizeWarningLimit: 1800,
    rolldownOptions: {
      output: {
        // Long-lived vendor chunks: app deploys don't bust these caches
        codeSplitting: {
          groups: [
            { name: 'vendor-react', test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/ },
            { name: 'vendor-supabase', test: /node_modules[\\/]@supabase[\\/]/ },
            { name: 'vendor-zod', test: /node_modules[\\/]zod[\\/]/ },
          ],
        },
      },
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
