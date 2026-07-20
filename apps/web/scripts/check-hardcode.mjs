#!/usr/bin/env node
// Scans app/, components/, lib/ (excluding components/ui/) for hardcoded values that
// should go through tokens/env: hex colors, console.log, `as any`, and literal API secrets.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()
const SCAN_DIRS = ['app', 'components', 'lib']
const EXCLUDE_DIRS = new Set(['node_modules', '.next', 'ui'])
const FILE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx'])

const HEX_RE = /#[0-9a-fA-F]{3,8}\b/g
const CONSOLE_LOG_RE = /console\.log\s*\(/g
const AS_ANY_RE = /\bas\s+any\b/g
const SECRET_RE = /\bsk-(proj-)?[A-Za-z0-9_-]{20,}\b/g

let violations = []

function stripComments(src) {
  // Remove /* */ and // comments (best-effort, not perfect for strings containing // ) —
  // good enough to avoid flagging hex codes inside comments.
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => ' '.repeat(m.length))
    .replace(/(^|[^:])\/\/.*$/gm, (m, p1) => p1 + ' '.repeat(m.length - p1.length))
}

function walk(dir) {
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return
  }
  for (const entry of entries) {
    const full = join(dir, entry)
    let st
    try {
      st = statSync(full)
    } catch {
      continue
    }
    if (st.isDirectory()) {
      if (EXCLUDE_DIRS.has(entry)) continue
      walk(full)
    } else {
      const ext = entry.slice(entry.lastIndexOf('.'))
      if (!FILE_EXTS.has(ext)) continue
      checkFile(full)
    }
  }
}

function checkFile(filePath) {
  const raw = readFileSync(filePath, 'utf8')
  const src = stripComments(raw)
  const rel = relative(ROOT, filePath)
  const lines = raw.split('\n')

  function reportMatches(regex, label) {
    let match
    const re = new RegExp(regex.source, regex.flags)
    while ((match = re.exec(src))) {
      const upto = src.slice(0, match.index)
      const lineNo = upto.split('\n').length
      const lineText = (lines[lineNo - 1] || '').trim()
      violations.push(`${rel}:${lineNo}  [${label}]  ${lineText}`)
    }
  }

  reportMatches(HEX_RE, 'hex-color')
  reportMatches(CONSOLE_LOG_RE, 'console.log')
  reportMatches(AS_ANY_RE, 'as-any')
  reportMatches(SECRET_RE, 'hardcoded-secret')
}

for (const dir of SCAN_DIRS) {
  walk(join(ROOT, dir))
}

if (violations.length > 0) {
  console.error('check-hardcode: violations found:\n')
  for (const v of violations) console.error('  ' + v)
  console.error(`\n${violations.length} violation(s).`)
  process.exit(1)
} else {
  console.log('check-hardcode: OK — no hardcoded colors, console.log, as-any, or secrets found.')
  process.exit(0)
}
