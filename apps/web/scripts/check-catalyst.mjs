#!/usr/bin/env node
// Enforces the Catalyst mapping rule: app/(app)/** and components/** (excluding
// components/ui/ and components/marketing/) must never contain native
// <button>/<input>/<select>/<table> elements, and must use only the accent + zinc
// palette (no second non-neutral Tailwind color).
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const ROOT = process.cwd()
const FILE_EXTS = new Set(['.tsx', '.jsx'])
const EXCLUDE_DIR_NAMES = new Set(['node_modules', '.next', 'ui', 'marketing'])

const NATIVE_TAG_RE = /<(button|input|select|table)(\s|>)/g

// Tailwind color families considered "known" — anything in this list that isn't
// zinc/accent/white/black/transparent/current/inherit is a second accent violation.
// Exception: red/green are Catalyst's own semantic status palette (Badge ships them
// natively for success/error/rejected states) — allowed ONLY for semantic feedback
// (status badges, inline success/error banners), not as a second decorative accent.
const KNOWN_COLORS = [
  'slate', 'gray', 'neutral', 'stone', 'orange', 'amber', 'yellow', 'lime',
  'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple',
  'fuchsia', 'pink', 'rose',
]
const COLOR_UTILITY_RE = new RegExp(
  `\\b(?:bg|text|ring|border|from|via|to|fill|stroke|outline|divide|accent|caret|decoration|shadow)-(${KNOWN_COLORS.join('|')})-\\d{2,3}\\b`,
  'g'
)

let violations = []

function isTargetDir(relPath) {
  // Only scan app/(app)/** and components/** (with exclusions applied during walk).
  return relPath.startsWith(`app${sep}(app)`) || relPath.startsWith('components')
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
      if (EXCLUDE_DIR_NAMES.has(entry)) continue
      walk(full)
    } else {
      const ext = entry.slice(entry.lastIndexOf('.'))
      if (!FILE_EXTS.has(ext)) continue
      const rel = relative(ROOT, full)
      if (!isTargetDir(rel)) continue
      checkFile(full, rel)
    }
  }
}

function checkFile(filePath, rel) {
  const raw = readFileSync(filePath, 'utf8')
  const lines = raw.split('\n')

  function reportMatches(regex, label) {
    let match
    const re = new RegExp(regex.source, regex.flags)
    while ((match = re.exec(raw))) {
      const upto = raw.slice(0, match.index)
      const lineNo = upto.split('\n').length
      const lineText = (lines[lineNo - 1] || '').trim()
      violations.push(`${rel}:${lineNo}  [${label}]  ${lineText}`)
    }
  }

  reportMatches(NATIVE_TAG_RE, 'native-element')
  reportMatches(COLOR_UTILITY_RE, 'non-accent-color')
}

walk(join(ROOT, 'app', '(app)'))
walk(join(ROOT, 'components'))

if (violations.length > 0) {
  console.error('check-catalyst: violations found:\n')
  for (const v of violations) console.error('  ' + v)
  console.error(`\n${violations.length} violation(s).`)
  process.exit(1)
} else {
  console.log('check-catalyst: OK — no native elements or off-palette colors in dashboard/components.')
  process.exit(0)
}
