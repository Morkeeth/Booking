#!/usr/bin/env node
/**
 * Run npm start at a specific time. Use 07:59 so the script is already logged in
 * and has the form filled when slots open at 08:00 (script waits until 08:00 to click Search).
 * Usage: node run-at.js [HH:MM]
 *   node run-at.js 07:59  → start at 7:59, script prewarms then clicks at 08:00
 *   Without args: runs npm start immediately.
 */

import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

const targetTimeStr = process.argv[2] // e.g. "08:00" or "20:00"

function parseHHMM(str) {
  const [h, m] = str.split(':').map(Number)
  if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return null
  return { h, m }
}

function nextAt(h, m) {
  const now = new Date()
  let next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0)
  if (next <= now) next.setDate(next.getDate() + 1)
  return next
}

function runNow() {
  console.log('Starting booking script...')
  const child = spawn('npm', ['start'], {
    stdio: 'inherit',
    shell: true,
    cwd: __dirname
  })
  child.on('exit', (code) => process.exit(code ?? 0))
}

if (!targetTimeStr) {
  runNow()
  process.exit(0)
}

const parsed = parseHHMM(targetTimeStr)
if (!parsed) {
  console.error('Usage: node run-at.js [HH:MM]  (e.g. 08:00 or 20:00)')
  process.exit(1)
}

const target = nextAt(parsed.h, parsed.m)
const delay = target - Date.now()
console.log(`Will run npm start at ${target.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} (in ${Math.round(delay / 1000)}s)`)
setTimeout(runNow, delay)
