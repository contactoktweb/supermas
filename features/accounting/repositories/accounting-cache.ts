import { onSessionContextInvalidated } from '@/lib/supabase/session-context'

/**
 * Caché de lecturas contables compartida por el módulo (solo navegador).
 *
 * Varias vistas y reportes leen los mismos datos (catálogo PUC, saldos, movimientos):
 * cada recurso se pide una sola vez, las llamadas concurrentes comparten la promesa y el
 * resultado se reutiliza durante un tiempo corto. Las mutaciones contables invalidan la
 * caché, igual que un cambio de sesión. En el servidor nunca se memoiza (evita mezclar usuarios).
 */

export const ACCOUNTING_CATALOG_TTL_MS = 5 * 60 * 1000
export const ACCOUNTING_DATA_TTL_MS = 60 * 1000

export interface CachedResource<T> {
  get: () => Promise<T>
  invalidate: () => void
}

const registry = new Set<CachedResource<unknown>>()
let sessionHookReady = false

function isBrowser(): boolean {
  return typeof window !== 'undefined'
}

function ensureSessionHook(): void {
  if (sessionHookReady || !isBrowser()) return
  sessionHookReady = true
  onSessionContextInvalidated(invalidateAccountingCache)
}

export function createCachedResource<T>(loader: () => Promise<T>, ttlMs: number): CachedResource<T> {
  let entry: { promise: Promise<T>; expiresAt: number } | null = null

  const resource: CachedResource<T> = {
    get() {
      if (!isBrowser()) return loader()
      ensureSessionHook()

      const now = Date.now()
      if (entry && entry.expiresAt > now) return entry.promise

      const current = { promise: loader(), expiresAt: Number.POSITIVE_INFINITY }
      entry = current
      current.promise.then(
        () => {
          if (entry === current) current.expiresAt = Date.now() + ttlMs
        },
        () => {
          if (entry === current) entry = null
        }
      )
      return current.promise
    },
    invalidate() {
      entry = null
    },
  }

  registry.add(resource as CachedResource<unknown>)
  return resource
}

/** Descarta todas las lecturas contables memoizadas (tras crear/reversar asientos, cambiar el PUC, etc.). */
export function invalidateAccountingCache(): void {
  registry.forEach((resource) => resource.invalidate())
}
