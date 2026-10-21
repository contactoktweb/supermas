/**
 * SUPER MÁS ERP/POS — Autenticación verificada en Route Handlers (servidor)
 *
 * El middleware solo comprueba que exista la cookie de sesión; NO valida el token ni el rol.
 * Toda API sensible debe llamar a requireServerUser(): valida el JWT contra Supabase Auth,
 * carga el usuario real (empresa, rol, estado) y expone un cliente con el JWT del usuario
 * para que las funciones SQL apliquen auth.uid(), RLS y permisos.
 */

import { NextRequest } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'

export interface ServerUser {
  userId: string
  email: string
  fullName: string
  companyId: string
  roleCode: string
  isAdmin: boolean
  /** Cliente Supabase que actúa COMO el usuario (RLS + auth.uid()) */
  userClient: SupabaseClient<any, 'public', any>
  /** Verifica un permiso con la función SQL has_permission (fuente de verdad del RBAC) */
  can: (permission: string) => Promise<boolean>
}

export class AuthError extends Error {
  constructor(message: string, public readonly status: 401 | 403) {
    super(message)
    this.name = 'AuthError'
  }
}

function extractToken(req: NextRequest): string | null {
  const header = req.headers.get('authorization') || ''
  if (header.toLowerCase().startsWith('bearer ')) return header.slice(7).trim() || null
  const cookie = req.cookies.get('sb-access-token')?.value
  return cookie ? decodeURIComponent(cookie) : null
}

export async function requireServerUser(req: NextRequest): Promise<ServerUser> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new AuthError('Servidor sin configuración de Supabase.', 401)
  }

  const token = extractToken(req)
  if (!token) throw new AuthError('Sesión requerida.', 401)

  const admin = createAdminClient()
  const { data: authData, error: authErr } = await admin.auth.getUser(token)
  if (authErr || !authData?.user) throw new AuthError('Sesión inválida o expirada.', 401)

  const { data: row, error: rowErr } = await admin
    .from('users')
    .select('id, email, full_name, company_id, is_active, roles ( code )')
    .eq('id', authData.user.id)
    .maybeSingle()
  if (rowErr || !row) throw new AuthError('Usuario no registrado en el ERP.', 403)
  if (!row.is_active) throw new AuthError('Usuario inactivo.', 403)
  if (!row.company_id) throw new AuthError('Usuario sin empresa asignada.', 403)

  const roleCode = String((row as any).roles?.code || '')
  const userClient = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })

  const cache = new Map<string, boolean>()
  const can = async (permission: string) => {
    if (cache.has(permission)) return cache.get(permission)!
    const { data, error } = await userClient.rpc('has_permission', { p_permission_code: permission })
    const ok = !error && data === true
    cache.set(permission, ok)
    return ok
  }

  return {
    userId: row.id,
    email: row.email,
    fullName: row.full_name,
    companyId: row.company_id,
    roleCode,
    isAdmin: roleCode === 'ADMIN' || roleCode === 'SUPERADMIN',
    userClient,
    can,
  }
}

/** Exige al menos uno de los permisos (ADMIN/SUPERADMIN siempre pasan vía has_permission). */
export async function requireAnyPermission(user: ServerUser, permissions: string[]): Promise<void> {
  if (user.isAdmin) return
  for (const p of permissions) {
    if (await user.can(p)) return
  }
  throw new AuthError(`Acceso denegado: requiere ${permissions.join(' o ')}.`, 403)
}
