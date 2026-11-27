#!/usr/bin/env node
/**
 * Build lib/client.js from src/ modules.
 *
 * The host evaluates exactly ONE client file per plugin (exports "./client"),
 * so the modular sources in src/ are compiled by simple ORDERED CONCATENATION:
 * every src file is a consecutive byte range of the closure, and joining them
 * in filename order reproduces the program exactly. The split was verified
 * byte-identical against the pre-split monolith (2026-11-27, v1.9.0).
 *
 * Invariant that keeps this safe: src filenames sort in dependency order
 * (numeric prefixes); nothing may depend on load order beyond that.
 *
 * Usage: node scripts/build-client.mjs
 *   (pack.ps1 runs this before packing; a staleness guard fails the pack
 *    if any src file is newer than the built lib/client.js)
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(ROOT, 'src')
const OUT = path.join(ROOT, 'lib', 'client.js')

const parts = fs
  .readdirSync(SRC)
  .filter((f) => f.endsWith('.js'))
  .sort()
  .map((f) => fs.readFileSync(path.join(SRC, f), 'utf8'))

if (parts.length === 0) {
  console.error('build-client: no src/*.js found — refusing to overwrite lib/client.js')
  process.exit(1)
}

const code = parts.join('')
// Parse check WITHOUT execution (vm.Script compiles as a program).
try {
  new vm.Script(code, { filename: 'client.js' })
} catch (error) {
  console.error('build-client: SYNTAX ERROR in built output:', error.message)
  process.exit(1)
}

const before = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : null
fs.writeFileSync(OUT, code)
const hash = crypto.createHash('sha256').update(code).digest('hex').slice(0, 16)
const lines = code.split('\n').length
const kb = Math.round(Buffer.byteLength(code) / 1024)
const changed = before === null ? '(new)' : before === code ? '(unchanged)' : '(changed)'
console.log(`build-client: ${parts.length} modules -> lib/client.js ${lines} lines / ${kb}KB sha256:${hash} ${changed}`)
