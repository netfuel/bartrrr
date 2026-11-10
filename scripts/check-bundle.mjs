#!/usr/bin/env node
/**
 * U-02 Bundle budget. Run after `npm run build`.
 *
 * Fails when:
 * - the main entry chunk (the <script type="module"> in dist/index.html),
 *   plus every chunk it imports statically, is over BUDGET_KB gzipped:
 *   that's what a first visit downloads before anything renders
 * - maplibre-gl is reachable from the entry through static imports: it's
 *   ~300 KB gzipped and must stay behind a dynamic import() for the map
 *
 * Usage: node scripts/check-bundle.mjs [distDir]   (BUDGET_KB=250 by default)
 */
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

const dist = path.resolve(process.argv[2] ?? 'dist')
const BUDGET_KB = Number(process.env.BUDGET_KB ?? 250)
const assets = path.join(dist, 'assets')

if (!fs.existsSync(path.join(dist, 'index.html')) || !fs.existsSync(assets)) {
  console.error(`check-bundle: no build in ${dist}. Run \`npm run build\` first.`)
  process.exit(2)
}

const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8')
const entryMatch = html.match(/<script[^>]+type="module"[^>]+src="\/?(assets\/[^"]+\.js)"/)
if (!entryMatch) {
  console.error('check-bundle: could not find the entry <script type="module"> in dist/index.html')
  process.exit(2)
}
const entry = path.basename(entryMatch[1])

const read = (file) => fs.readFileSync(path.join(assets, file))
const gzipKB = (buf) => zlib.gzipSync(buf, { level: 9 }).length / 1024

/** Static imports only: `import … from "./x.js"`, `import "./x.js"`, `export … from "./x.js"`. */
function staticImports(file) {
  const src = read(file).toString('utf8')
  const out = new Set()
  const re = /(?:^|[;\n}])\s*(?:import|export)\s*(?:[\w*{}\s,$]+?\s*from\s*)?["'](\.\/[^"']+\.js)["']/g
  for (let m = re.exec(src); m; m = re.exec(src)) out.add(path.basename(m[1]))
  return [...out]
}

/** Everything that loads with the entry before it can run. */
const initial = new Set()
const queue = [entry]
while (queue.length) {
  const f = queue.shift()
  if (initial.has(f) || !fs.existsSync(path.join(assets, f))) continue
  initial.add(f)
  queue.push(...staticImports(f))
}

const rows = [...initial].map((f) => ({ file: f, raw: read(f).length / 1024, gz: gzipKB(read(f)) }))
rows.sort((a, b) => b.gz - a.gz)
const entryGz = rows.find((r) => r.file === entry).gz
const totalGz = rows.reduce((s, r) => s + r.gz, 0)

const isMaplibre = (f) => /maplibre/i.test(f) || /maplibre-gl|setWorkerUrl|maplibregl/.test(read(f).toString('utf8').slice(0, 200_000))
const maplibreInInitial = [...initial].filter(isMaplibre)
const maplibreChunks = fs.readdirSync(assets).filter((f) => /maplibre/i.test(f))

console.log(`Entry chunk: ${entry} ${entryGz.toFixed(1)} KB gzip`)
console.log(`Initial JS (entry + static imports, ${rows.length} files): ${totalGz.toFixed(1)} KB gzip, budget ${BUDGET_KB} KB`)
for (const r of rows) console.log(`  ${r.gz.toFixed(1).padStart(7)} KB gz  ${r.raw.toFixed(1).padStart(8)} KB raw  ${r.file}`)
console.log(`maplibre chunks in dist/assets: ${maplibreChunks.join(', ') || 'none'}`)

const problems = []
if (totalGz > BUDGET_KB) problems.push(`initial JS is ${totalGz.toFixed(1)} KB gzip, over the ${BUDGET_KB} KB budget`)
if (maplibreInInitial.length) problems.push(`maplibre is loaded with the entry chunk (${maplibreInInitial.join(', ')}); keep it behind import()`)

if (problems.length) {
  for (const p of problems) console.error(`FAIL: ${p}`)
  process.exit(1)
}
console.log('OK: within budget, maplibre stays lazy')
