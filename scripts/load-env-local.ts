import * as fs from 'fs'

/** Lee .env.local (si existe) para los scripts de mantenimiento; no modifica process.env. */
export function loadEnvLocal(): Record<string, string> {
  const out: Record<string, string> = {}
  if (!fs.existsSync('.env.local')) return out
  for (const line of fs.readFileSync('.env.local', 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i < 0) continue
    let v = t.slice(i + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    out[t.slice(0, i).trim()] = v
  }
  return out
}
