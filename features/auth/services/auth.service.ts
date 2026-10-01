/**
 * SUPER MÁS ERP/POS - Servicio Fiduciario de Autenticación y Perfil Supabase
 *
 * Conecta con Supabase Auth real y recupera el perfil completo del colaborador
 * validando la cadena de seguridad:
 * auth.users -> public.users -> public.roles -> role_permissions -> permissions
 */

import { supabaseClient } from '@/lib/supabase/client'
import { AuthUser, LoginCredentials, UserRoleCode } from '../types'

export class AuthService {
  /**
   * Sincroniza cookies de sesión en el navegador para que Next.js Middleware
   * y las funciones de servidor puedan validar la autenticación sin demoras.
   */
  private syncAuthCookies(accessToken: string | null, roleCode: string | null, expiresInSeconds: number = 604800): void {
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
      this.syncAuthCookies(null, null)
    }
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
