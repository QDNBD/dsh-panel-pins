/**
 * Build-time generator for the pinyin table inlined into lib/client.js.
 *
 * The plugin ships with NO runtime dependency: the table is generated here
 * (dev machine only) and pasted into lib/client.js as a single-quoted string
 * literal, one `<han><ascii-pinyin>` record per GB2312 hanzi.
 *
 * Usage (from a scratch directory with the dev deps installed):
 *
 *   npm i pinyin-pro iconv-lite
 *   node scripts/gen-pinyin.mjs            # writes pinyin-table.txt next to it
 *
 * Then inject the table into lib/client.js — BY LINE, with a replacer
 * FUNCTION, for two reasons learned the hard way:
 *
 *   1. `String.replace` interprets `$&` / `$'` / `$1` in a string replacement,
 *      so a literal table must be passed as a function replacement.
 *   2. A placeholder round-trip (`'__X__'` -> `'table'`) leaves a doubled
 *      quote, and a regex like /const PINYIN_TABLE = '[^']*'/ truncates at the
 *      first quote and leaves half the table behind as stray source.
 *
 * The injector is therefore a per-line rewrite, never a regex over the
 * assignment.
 */
import iconv from 'iconv-lite'
import { pinyin } from 'pinyin-pro'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))

// GB2312: level 1 (0xB0..0xD7) = the 3755 common hanzi, level 2 (0xD8..0xF7)
// = 3008 rarer ones. Together they cover 6763 hanzi — anything outside
// (GBK-only characters such as 龘) simply falls back to literal matching.
const chars = []
for (let hi = 0xb0; hi <= 0xf7; hi++) {
  for (let lo = 0xa1; lo <= 0xfe; lo++) {
    let decoded
    try {
      decoded = iconv.decode(Buffer.from([hi, lo]), 'gbk')
    } catch {
      continue
    }
    if (!decoded || decoded.length !== 1) continue
    if (decoded < '\u4e00' || decoded > '\u9fff') continue
    chars.push(decoded)
  }
}

let table = ''
for (const ch of chars) {
  const full = (pinyin(ch, { pattern: 'full', toneType: 'none', type: 'array', v: true })[0] || '')
    .replace(/[^a-z]/g, '')
  if (!full) continue
  table += ch + full
}

const outFile = path.join(here, 'pinyin-table.txt')
fs.writeFileSync(outFile, table, 'utf8')
console.log('chars:', chars.length, '| bytes:', Buffer.byteLength(table, 'utf8'))
console.log('written:', outFile)
for (const probe of ['面板收纳', '更多', '插件市场', '自动化任务']) {
  console.log(
    ' ', probe,
    '->', pinyin(probe, { pattern: 'first', toneType: 'none', type: 'array' }).join(''),
    '|', pinyin(probe, { pattern: 'full', toneType: 'none', type: 'array' }).join(''),
  )
}
