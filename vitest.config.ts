import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

/** Unit tests (layer 2). Files: src/**\/*.test.ts(x) */
export default defineConfig((env) =>
  mergeConfig(viteConfig(env), {
    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.{ts,tsx}'],
      setupFiles: ['./src/test/setup.ts'],
      env: { VITE_DEMO_MODE: 'true', VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' },
      coverage: { provider: 'v8', include: ['src/lib/**', 'src/stores/**'] },
    },
  }),
)
