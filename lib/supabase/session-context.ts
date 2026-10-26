import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseClient, supabaseClient } from './client'

/**
 * SUPER MÁS ERP/POS — Contexto de sesión memoizado (solo navegador)
 *
 * Evita que cada consulta del navegador repita `auth.getUser()` (petición de red) y la
 * lectura de `public.users` para conocer la empresa del usuario, y que el perfil
 * (rol, permisos y sedes) se pida varias veces en paralelo.
 *
 * - El uid se obtiene con `auth.getSession()` (lectura local de la sesión persistida).
 *   La autorización real la imponen RLS y las RPC en el servidor; el uid local solo
 *   decide qué fila de `public.users` leer, y esa lectura también pasa por RLS.
 * - Las peticiones concurrentes comparten la misma promesa.
 * - La caché se descarta en SIGNED_OUT, USER_UPDATED y cuando cambia el usuario de la sesión.
 * - En el servidor (o con un cliente distinto del singleton del navegador) no se memoiza nada.
 */

export interface SessionCompanyContext {
  userId: string
  companyId: string | null
  isActive: boolean | null
}

/** Datos mínimos del perfil que se reutilizan para resolver la empresa sin otra consulta. */
export interface SessionProfileLike {
  companyId: string | null
  isActive: boolean
}

interface CacheEntry<T> {
  userId: string
  promise: Promise<T>
}

let companyEntry: CacheEntry<SessionCompanyContext> | null = null
let profileEntry: CacheEntry<SessionProfileLike | null> | null = null
let authListenerReady = false
let lastKnownUserId: string | null = null

function isBrowser(): boolean {
  return typeof window !== 'undefined'
}

/** Solo se memoiza para el cliente singleton del navegador (misma sesión que la UI). */
export function isSharedBrowserClient(client: SupabaseClient): boolean {
  if (!isBrowser()) return false
  if (client === supabaseClient) return true
  try {
    return client === getSupabaseClient()
  } catch {
    return false
  }
}

const sessionInvalidationListeners = new Set<() => void>()

/** Descarta todo lo memoizado (empresa y perfil) y avisa a las cachés dependientes de la sesión. */
export function invalidateSessionContext(): void {
  companyEntry = null
  profileEntry = null
  sessionInvalidationListeners.forEach((listener) => listener())
}

/**
 * Registra una caché de datos que debe vaciarse cuando cambia la sesión
 * (cierre de sesión, cambio de usuario o actualización del usuario).
 */
export function onSessionContextInvalidated(listener: () => void): () => void {
  ensureAuthListener()
  sessionInvalidationListeners.add(listener)
  return () => {
    sessionInvalidationListeners.delete(listener)
  }
}

/** Descarta solo el perfil (rol, permisos, sedes); la empresa se conserva. */
export function invalidateCachedUserProfile(): void {
  profileEntry = null
}

function ensureAuthListener(): void {
  if (authListenerReady || !isBrowser()) return
  authListenerReady = true
  try {
    getSupabaseClient().auth.onAuthStateChange((event, session) => {
      const sessionUserId = session?.user?.id ?? null
      const userChanged = lastKnownUserId !== null && sessionUserId !== lastKnownUserId
      if (event === 'SIGNED_OUT' || event === 'USER_UPDATED' || userChanged) {
        invalidateSessionContext()
      }
      lastKnownUserId = sessionUserId
    })
  } catch {
    // Sin variables públicas de Supabase no hay sesión que escuchar.
    authListenerReady = false
  }
}

/**
 * uid del usuario de la sesión actual. En el navegador usa la sesión local (`getSession`);
 * en cualquier otro contexto conserva la validación remota (`getUser`).
 */
export async function getSessionUserId(client: SupabaseClient = supabaseClient): Promise<string | null> {
  if (isSharedBrowserClient(client)) {
    ensureAuthListener()
    const { data, error } = await client.auth.getSession()
    if (error) return null
    const userId = data.session?.user?.id ?? null
    if (lastKnownUserId !== null && userId !== lastKnownUserId) {
      invalidateSessionContext()
    }
    lastKnownUserId = userId
    return userId
  }

  const { data, error } = await client.auth.getUser()
  if (error) return null
  return data?.user?.id ?? null
}

interface CacheSlot<T> {
  get: () => CacheEntry<T> | null
  set: (entry: CacheEntry<T> | null) => void
}

function readThrough<T>(
  slot: CacheSlot<T>,
  userId: string,
  loader: () => Promise<T>,
  shouldKeep: (value: T) => boolean
): Promise<T> {
  const current = slot.get()
  if (current && current.userId === userId) return current.promise

  const entry: CacheEntry<T> = { userId, promise: loader() }
  slot.set(entry)
  const dropIfCurrent = () => {
    if (slot.get() === entry) slot.set(null)
  }
  entry.promise.then((value) => {
    if (!shouldKeep(value)) dropIfCurrent()
  }, dropIfCurrent)
  return entry.promise
}

const profileSlot: CacheSlot<SessionProfileLike | null> = {
  get: () => profileEntry,
  set: (entry) => {
    profileEntry = entry
  },
}

const companySlot: CacheSlot<SessionCompanyContext> = {
  get: () => companyEntry,
  set: (entry) => {
    companyEntry = entry
  },
}

/**
 * Perfil del usuario memoizado por sesión. Un resultado nulo (error de lectura) no se
 * conserva, para que el siguiente intento vuelva a consultar.
 */
export function getCachedUserProfile<T extends SessionProfileLike>(
  userId: string,
  loader: () => Promise<T | null>
): Promise<T | null> {
  if (!isBrowser()) return loader()
  ensureAuthListener()
  return readThrough<SessionProfileLike | null>(profileSlot, userId, loader, (value) => value !== null) as Promise<T | null>
}

async function loadCompanyContext(client: SupabaseClient, userId: string): Promise<SessionCompanyContext> {
  // Si el perfil completo ya está (o se está) cargando para este usuario, se reutiliza.
  if (profileEntry && profileEntry.userId === userId) {
    const profile = await profileEntry.promise.catch(() => null)
    if (profile) {
      return { userId, companyId: profile.companyId, isActive: profile.isActive }
    }
  }

  const { data, error } = await client
    .from('users')
    .select('company_id, is_active')
    .eq('id', userId)
    .maybeSingle()

  if (error || !data) {
    throw new Error('Tu usuario no tiene un perfil asignado; contacta al administrador.')
  }

  return { userId, companyId: data.company_id ?? null, isActive: data.is_active ?? null }
}

/**
 * Empresa (y estado activo) del usuario de la sesión, memoizada por sesión en el navegador.
 * Devuelve null si no hay sesión. Lanza si no existe el perfil en public.users.
 */
export async function getSessionCompanyContext(
  client: SupabaseClient = supabaseClient
): Promise<SessionCompanyContext | null> {
  const userId = await getSessionUserId(client)
  if (!userId) return null

  if (!isSharedBrowserClient(client)) {
    return loadCompanyContext(client, userId)
  }

  return readThrough(companySlot, userId, () => loadCompanyContext(client, userId), () => true)
}
