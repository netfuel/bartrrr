#!/usr/bin/env node
/**
 * Sweep orphaned listing photos (T-05).
 *
 * Photos are uploaded as soon as they're picked, before a listing or profile
 * is saved, so an abandoned Create listing page (tab closed), a failed
 * cleanup after an edit, or an interrupted account deletion leaves files in
 * the listing-photos bucket that nothing points at. Migration 014's
 * public.orphaned_photo_paths() lists them; SQL can't delete Storage files,
 * so this script deletes them through the Storage API.
 *
 * Dry run by default: prints what it would delete. Pass --delete to act.
 *
 *   SUPABASE_URL=https://<ref>.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   node scripts/sweep-orphan-photos.mjs [--delete] [--older-than "7 days"] [--batch 100]
 *
 * VITE_SUPABASE_URL is accepted in place of SUPABASE_URL. The service role
 * key bypasses Row Level Security: keep it out of the browser, the repo and
 * shell history (read it from a secrets manager or a file only you can read).
 *
 * Exit codes: 0 done (or nothing to do), 1 some deletes failed, 2 bad
 * arguments or setup.
 */
import { createClient } from '@supabase/supabase-js'

const BUCKET = 'listing-photos'
const PAGE = 1000 // orphaned_photo_paths returns at most 1000 rows per call

function usage(message) {
  if (message) console.error(`sweep-orphan-photos: ${message}`)
  console.error('Usage: node scripts/sweep-orphan-photos.mjs [--delete] [--older-than "7 days"] [--batch 100]')
  process.exit(2)
}

function parseArgs(argv) {
  const opts = { delete: false, olderThan: '7 days', batch: 100 }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    const value = () => {
      const v = arg.includes('=') ? arg.slice(arg.indexOf('=') + 1) : argv[++i]
      if (v === undefined || v === '') usage(`${arg} needs a value`)
      return v
    }
    if (arg === '--delete') opts.delete = true
    else if (arg === '--dry-run') opts.delete = false
    else if (arg === '--older-than' || arg.startsWith('--older-than=')) opts.olderThan = value()
    else if (arg === '--batch' || arg.startsWith('--batch=')) {
      opts.batch = Number(value())
      if (!Number.isInteger(opts.batch) || opts.batch < 1 || opts.batch > 1000) usage('--batch must be 1–1000')
    } else if (arg === '--help' || arg === '-h') usage()
    else usage(`unknown argument ${arg}`)
  }
  return opts
}

function formatBytes(n) {
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`
  if (n >= 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${n} B`
}

async function listOrphans(supabase, olderThan) {
  const all = []
  let after = null
  for (;;) {
    const { data, error } = await supabase.rpc('orphaned_photo_paths', {
      older_than: olderThan,
      after_path: after,
      max_rows: PAGE,
    })
    if (error) {
      if (error.code === 'PGRST202') {
        throw new Error('orphaned_photo_paths() not found: apply migration 014 first')
      }
      throw new Error(`orphaned_photo_paths failed: ${error.message}`)
    }
    all.push(...data)
    if (data.length < PAGE) return all
    after = data[data.length - 1].path
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url) usage('set SUPABASE_URL (or VITE_SUPABASE_URL)')
  if (!key) usage('set SUPABASE_SERVICE_ROLE_KEY (Supabase → Project Settings → API keys)')

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })

  const orphans = await listOrphans(supabase, opts.olderThan)
  const bytes = orphans.reduce((sum, o) => sum + (Number(o.bytes) || 0), 0)
  const mode = opts.delete ? 'Deleting' : 'Dry run: would delete'
  console.log(`${mode} ${orphans.length} orphaned photo(s) older than ${opts.olderThan} (${formatBytes(bytes)}) from ${BUCKET}`)
  if (orphans.length === 0) return 0

  if (!opts.delete) {
    for (const o of orphans) console.log(`  ${o.path}  ${o.created_at}  ${formatBytes(Number(o.bytes) || 0)}`)
    console.log('Nothing deleted. Run again with --delete to remove them.')
    return 0
  }

  let deleted = 0
  let failed = 0
  for (let i = 0; i < orphans.length; i += opts.batch) {
    const paths = orphans.slice(i, i + opts.batch).map((o) => o.path)
    const { data, error } = await supabase.storage.from(BUCKET).remove(paths)
    if (error) {
      failed += paths.length
      console.error(`  batch ${i / opts.batch + 1}: ${error.message}`)
      continue
    }
    // remove() returns the objects it deleted; anything missing was already gone or refused
    const removed = new Set((data ?? []).map((o) => o.name))
    deleted += removed.size
    failed += paths.length - removed.size
    for (const p of paths) if (!removed.has(p)) console.warn(`  not deleted: ${p}`)
    console.log(`  batch ${i / opts.batch + 1}: deleted ${removed.size} of ${paths.length}`)
  }
  console.log(`Deleted ${deleted} of ${orphans.length}.${failed ? ` ${failed} failed.` : ''}`)
  return failed > 0 ? 1 : 0
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(`sweep-orphan-photos: ${err.message}`)
    process.exit(2)
  },
)
