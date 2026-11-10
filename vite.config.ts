import { defineConfig, loadEnv, searchForWorkspaceRoot, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { createRequire } from 'module'

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

/** The node_modules folder packages actually resolve from (may sit above the root). */
function nodeModulesDir() {
  const require = createRequire(path.join(process.cwd(), 'package.json'))
  // maplibre-gl/package.json isn't exported; its CSS is, and sits in dist/
  return path.resolve(path.dirname(require.resolve('maplibre-gl/dist/maplibre-gl.css')), '../..')
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
      fs: {
        // Agent worktrees (.claude/worktrees/*) resolve packages from the main
        // checkout's node_modules, outside the worktree root. Without this,
        // Vite refuses those files, and the map's `?url` worker import comes
        // back as the raw worker module instead of its URL (T-64).
        allow: [searchForWorkspaceRoot(process.cwd()), nodeModulesDir()],
      },
      watch: {
        // Agent worktrees and archives live inside the repo; watching them
        // makes dev-server startup and HMR crawl.
        // Anchored to this checkout: a bare '**/.claude/**' also matched every
        // file when the dev server runs inside a worktree, so edits never reloaded.
        ignored: [`${path.join(__dirname, '.claude')}/**`, `${path.join(__dirname, '_archive')}/**`],
      },
    },
  }
})
