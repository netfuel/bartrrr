import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

/** Unit tests (layer 2) and mail Worker tests (layer 5). Files: src/**\/*.test.ts(x), workers/mail/src/**\/*.test.ts */
export default defineConfig((env) =>
  mergeConfig(viteConfig(env), {
    test: {
      environment: 'jsdom',
      // workers/mail tests opt into the node environment with a docblock
      include: ['src/**/*.test.{ts,tsx}', 'workers/mail/src/**/*.test.ts'],
      setupFiles: ['./src/test/setup.ts'],
      env: { VITE_DEMO_MODE: 'true', VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' },
      coverage: { provider: 'v8', include: ['src/lib/**', 'src/stores/**'] },
    },
  }),
)
