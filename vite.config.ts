import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

/** Preconnect to the Supabase project so the first auth/data call is faster. */
function supabasePreconnect(url: string | undefined): Plugin {
  return {
    name: 'bartrrr:supabase-preconnect',
    transformIndexHtml() {
      if (!url || !/^https:\/\//.test(url)) return []
      return [
        {
          tag: 'link',
          attrs: { rel: 'preconnect', href: new URL(url).origin, crossorigin: '' },
          injectTo: 'head',
        },
      ]
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')

  if (mode === 'production' && env.VITE_DEMO_MODE === 'true') {
    console.warn('\n[bartrrr] VITE_DEMO_MODE=true: this build includes sample users and the demo login picker.\n')
  }

  return {
    plugins: [react(), tailwindcss(), supabasePreconnect(env.VITE_SUPABASE_URL)],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      target: 'es2022',
      // Off by default: anything in dist/ is publicly downloadable from Pages.
      // Set SOURCEMAP=true when a CI step uploads maps to an error tracker
      // and deletes them before deploy.
      sourcemap: process.env.SOURCEMAP === 'true' ? 'hidden' : false,
      // maplibre-gl is ~1 MB on its own and is only loaded when a map mounts
      chunkSizeWarningLimit: 1200,
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
  }
})
