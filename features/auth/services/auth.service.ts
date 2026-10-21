/**
 * SUPER MÁS ERP/POS - Servicio Fiduciario de Autenticación y Perfil Supabase
 *
 * Conecta con Supabase Auth real y recupera el perfil completo del colaborador
 * validando la cadena de seguridad:
 * auth.users -> public.users -> public.roles -> role_permissions -> permissions
 */

import { supabaseClient } from '@/lib/supabase/client'
import { getCachedUserProfile, invalidateSessionContext } from '@/lib/supabase/session-context'
import { CHANGE_PASSWORD_API_PATH, isPasswordChangeRequired } from '@/lib/auth/password-change-flag'
import { AuthUser, LoginCredentials, UserRoleCode } from '../types'
import type { ChangePasswordInput } from '../schemas/password-policy.schema'

/** Vida mínima de la cookie de sesión al re-sincronizarla (segundos). */
const MIN_COOKIE_TTL_SECONDS = 60

/** Resultado del cambio de contraseña inicial una vez aplicado en el servidor. */
export type InitialPasswordChangeOutcome = 'SESSION_REFRESHED' | 'SIGN_IN_REQUIRED'

/** Estado de la sesión local respecto al cambio obligatorio de contraseña. */
export type PendingPasswordChangeStatus = 'NO_SESSION' | 'PENDING' | 'NOT_REQUIRED'

export class AuthService {
  /**
   * Sincroniza cookies de sesión en el navegador para que Next.js Middleware
   * y las funciones de servidor puedan validar la autenticación sin demoras.
   */
  /** Público: se usa también al refrescar el token para que el servidor no reciba una cookie vencida. */
  syncAuthCookies(accessToken: string | null, roleCode: string | null, expiresInSeconds: number = 604800): void {
    if (typeof document === 'undefined') return

    const secure = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : ''

    if (accessToken) {
      document.cookie = `sb-access-token=${encodeURIComponent(accessToken)}; path=/; max-age=${expiresInSeconds}; SameSite=Lax${secure}`
      if (roleCode) {
        document.cookie = `sb-user-role=${encodeURIComponent(roleCode)}; path=/; max-age=${expiresInSeconds}; SameSite=Lax${secure}`
      }
    } else {
      document.cookie = `sb-access-token=; path=/; max-age=0; SameSite=Lax`
      document.cookie = `sb-user-role=; path=/; max-age=0; SameSite=Lax`
    }
  }

  /**
   * Inicia sesión con credenciales reales en Supabase Auth.
   * Carga el perfil fiduciario y los permisos directamente desde PostgreSQL.
   */
  async signIn(credentials: LoginCredentials): Promise<AuthUser> {
    const email = credentials.email.trim().toLowerCase()
    const password = credentials.password

    if (!email || !password) {
      throw new Error('Debe ingresar correo electrónico y contraseña.')
    }

    const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
      email,
      password,
    })

    if (authError || !authData.user) {
      const msg = authError?.message || ''
      if (msg.includes('Invalid login credentials') || msg.includes('invalid_credentials')) {
        throw new Error('Credenciales inválidas. Verifique su correo electrónico y contraseña.')
      }
      if (msg.includes('Email not confirmed')) {
        throw new Error('El correo electrónico no ha sido confirmado en Supabase Auth.')
      }
      throw new Error(authError?.message || 'Error al autenticar con el servidor.')
    }

    // Consultar el perfil real desde public.users
    const userProfile = await this.fetchUserProfile(authData.user.id)

    if (!userProfile) {
      await supabaseClient.auth.signOut()
      this.syncAuthCookies(null, null)
      throw new Error('El usuario está autenticado en Supabase Auth pero no tiene un perfil registrado en public.users.')
    }

    if (!userProfile.isActive) {
      await supabaseClient.auth.signOut()
      this.syncAuthCookies(null, null)
      throw new Error('Esta cuenta de usuario se encuentra inactiva o suspendida. Contacte al administrador.')
    }

    // Registrar última conexión en PostgreSQL bajo RLS
    try {
      await supabaseClient
        .from('users')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', authData.user.id)
    } catch {
      // No bloquear el login si el update falla de forma no crítica
    }

    // Sincronizar cookies para Middleware
    if (authData.session?.access_token) {
      this.syncAuthCookies(
        authData.session.access_token,
        userProfile.roleCode,
        authData.session.expires_in || 604800
      )
    }

    return userProfile
  }

  /**
   * Cierra la sesión activa en Supabase Auth y purga cookies locales.
   */
  async signOut(): Promise<void> {
    try {
      await supabaseClient.auth.signOut()
    } finally {
      invalidateSessionContext()
      this.syncAuthCookies(null, null)
    }
  }

  /**
   * Solicita el restablecimiento de contraseña enviando un enlace seguro a través de Supabase Auth.
   */
  async requestPasswordReset(email: string, redirectTo?: string): Promise<void> {
    const cleanEmail = email.trim().toLowerCase()
    if (!cleanEmail) {
      throw new Error('Debe ingresar un correo electrónico válido.')
    }

    let targetRedirect = redirectTo
    if (!targetRedirect) {
      if (typeof window !== 'undefined') {
        targetRedirect = `${window.location.origin}/recuperar-contrasena`
      } else {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000'
        targetRedirect = `${appUrl.replace(/\/$/, '')}/recuperar-contrasena`
      }
    }

    const { error } = await supabaseClient.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: targetRedirect,
    })

    if (error) {
      console.error('Error al solicitar recuperación de contraseña en Supabase Auth:', error)
      throw new Error(error.message || 'No fue posible procesar la solicitud de recuperación.')
    }
  }

  /**
   * Actualiza la contraseña del usuario en Supabase Auth tras verificar el token de recuperación.
   */
  async updatePassword(newPassword: string): Promise<void> {
    if (!newPassword || newPassword.length < 6) {
      throw new Error('La contraseña debe tener al menos 6 caracteres.')
    }

    const { error } = await supabaseClient.auth.updateUser({
      password: newPassword,
    })

    if (error) {
      console.error('Error al actualizar contraseña en Supabase Auth:', error)
      throw new Error(error.message || 'Error al actualizar la contraseña.')
    }
  }

  /**
   * Indica si la sesión actual tiene pendiente el cambio de la contraseña inicial
   * (bandera `must_change_password` de app_metadata, incluida en el JWT).
   */
  async getPendingPasswordChangeStatus(): Promise<PendingPasswordChangeStatus> {
    const { data } = await supabaseClient.auth.getSession()
    const session = data.session
    // La cookie del middleware se alinea con la sesión local; si quedara desfasada, el
    // middleware y esta verificación se redirigirían mutuamente.
    if (!session?.user) {
      this.syncAuthCookies(null, null)
      return 'NO_SESSION'
    }
    const secondsToExpiry = session.expires_at ? session.expires_at - Math.floor(Date.now() / 1000) : session.expires_in
    this.syncAuthCookies(session.access_token, null, Math.max(MIN_COOKIE_TTL_SECONDS, secondsToExpiry || 0))
    return isPasswordChangeRequired(session.user.app_metadata) ? 'PENDING' : 'NOT_REQUIRED'
  }

  /**
   * Cambia la contraseña inicial asignada por un administrador. El servidor valida la política,
   * aplica el cambio y quita la bandera; luego se refresca la sesión para obtener un JWT sin ella.
   */
  async changeInitialPassword(input: ChangePasswordInput): Promise<InitialPasswordChangeOutcome> {
    const { data: sessionData } = await supabaseClient.auth.getSession()
    const accessToken = sessionData.session?.access_token
    if (!accessToken) {
      throw new Error('Su sesión expiró. Ingrese de nuevo con su contraseña actual.')
    }

    let result: { success?: boolean; error?: string } | null = null
    let responseOk = false
    try {
      const response = await fetch(CHANGE_PASSWORD_API_PATH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(input),
      })
      responseOk = response.ok
      result = await response.json().catch(() => null)
    } catch {
      throw new Error('No hay conexión con el servidor. Verifique su red e intente de nuevo.')
    }
    if (!responseOk || !result?.success) {
      throw new Error(result?.error || 'No fue posible actualizar la contraseña.')
    }

    const { data: refreshed, error: refreshError } = await supabaseClient.auth.refreshSession()
    const session = refreshed?.session
    if (refreshError || !session || isPasswordChangeRequired(session.user.app_metadata)) {
      await this.signOut()
      return 'SIGN_IN_REQUIRED'
    }

    const profile = await this.fetchUserProfile(session.user.id)
    this.syncAuthCookies(session.access_token, profile?.roleCode || null, session.expires_in || 3600)
    return 'SESSION_REFRESHED'
  }

  /**
   * Obtiene el usuario actualmente autenticado desde la sesión activa de Supabase.
   */
  async getCurrentUser(): Promise<AuthUser | null> {
    try {
      const { data: sessionData } = await supabaseClient.auth.getSession()
      if (!sessionData.session?.user) {
        this.syncAuthCookies(null, null)
        return null
      }

      const userProfile = await this.fetchUserProfile(sessionData.session.user.id)
      if (userProfile && !userProfile.isActive) {
        await this.signOut()
        return null
      }

      if (userProfile && sessionData.session.access_token) {
        this.syncAuthCookies(
          sessionData.session.access_token,
          userProfile.roleCode,
          sessionData.session.expires_in || 604800
        )
      }

      return userProfile
    } catch (err) {
      console.error('Error al recuperar sesión de usuario en AuthService:', err)
      return null
    }
  }

  /**
   * Consulta el perfil completo del usuario, su rol y los permisos granulares
   * asociados directamente en PostgreSQL bajo las políticas RLS.
   */
  async fetchUserProfile(userId: string): Promise<AuthUser | null> {
    // Memoizado por sesión en el navegador: el arranque (StrictMode, SIGNED_IN, getCurrentUser)
    // comparte una sola lectura de users/role_permissions/user_locations.
    return getCachedUserProfile(userId, () => this.loadUserProfile(userId))
  }

  private async loadUserProfile(userId: string): Promise<AuthUser | null> {
    try {
      // 1. Obtener usuario + rol desde public.users y public.roles
      const { data: profileData, error: profileError } = await supabaseClient
        .from('users')
        .select(`
          id,
          company_id,
          role_id,
          email,
          full_name,
          phone,
          avatar_url,
          is_active,
          last_login_at,
          roles (
            id,
            code,
            name,
            description
          )
        `)
        .eq('id', userId)
        .maybeSingle()

      if (profileError || !profileData) {
        if (profileError) {
          console.error('Error al consultar perfil public.users:', profileError.message)
        }
        return null
      }

      const rawRole = (profileData as any).roles
      const roleCode = (rawRole?.code || 'SELLER') as UserRoleCode
      const roleName = rawRole?.name || 'Usuario'
      const roleDescription = rawRole?.description || null

      // 2. Obtener permisos granulares asignados al rol desde role_permissions -> permissions
      const { data: rolePermsData, error: permsError } = await supabaseClient
        .from('role_permissions')
        .select(`
          permissions (
            code
          )
        `)
        .eq('role_id', profileData.role_id)

      if (permsError) {
        console.warn('Advertencia al consultar permisos de rol:', permsError.message)
      }

      const permissions: string[] = []
      if (rolePermsData && Array.isArray(rolePermsData)) {
        for (const rp of rolePermsData) {
          const perm = (rp as any).permissions
          if (perm?.code && typeof perm.code === 'string') {
            permissions.push(perm.code)
          }
        }
      }

      // 3. Obtener bodegas asignadas al usuario
      const { data: userLocsData } = await supabaseClient
        .from('user_locations')
        .select('location_id, is_primary')
        .eq('user_id', userId)

      const locationIds = (userLocsData || []).map((l: any) => l.location_id)

      // Generar iniciales del avatar
      const names = (profileData.full_name || 'U').trim().split(/\s+/)
      const avatar = names.length > 1
        ? `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase()
        : names[0].slice(0, 2).toUpperCase()

      return {
        id: profileData.id,
        email: profileData.email,
        fullName: profileData.full_name,
        phone: profileData.phone,
        avatar,
        avatarUrl: profileData.avatar_url,
        companyId: profileData.company_id,
        roleId: profileData.role_id,
        roleCode,
        roleName,
        roleDescription,
        permissions,
        locationIds,
        isActive: Boolean(profileData.is_active),
        lastLoginAt: profileData.last_login_at,
      }
    } catch (err) {
      console.error('Error crítico al resolver perfil de usuario en PostgreSQL:', err)
      return null
    }
  }
}

export const authService = new AuthService()
