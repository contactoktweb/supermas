'use client'

/**
 * SUPER MÁS ERP/POS - Proveedor y Contexto de Autenticación
 *
 * Mantiene el estado de la sesión activa de Supabase Auth,
 * sincroniza los eventos del ciclo de vida de autenticación
 * y expone verificaciones fiduciarias de permisos basadas en PostgreSQL.
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import { supabaseClient } from '@/lib/supabase/client'
import { authService } from '../services/auth.service'
import { AuthUser, LoginCredentials, UserRoleCode } from '../types'

interface AuthContextValue {
  user: AuthUser | null
  isLoading: boolean
  isAuthenticated: boolean
  error: string | null
  signIn: (credentials: LoginCredentials) => Promise<AuthUser>
  signOut: () => Promise<void>
  refreshUser: () => Promise<void>
  hasPermission: (permissionCode: string) => boolean
  hasAnyPermission: (permissionCodes: string[]) => boolean
  hasRole: (roles: UserRoleCode[]) => boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  // Carga o refresco del usuario desde la base de datos
  const refreshUser = useCallback(async () => {
    try {
      setError(null)
      const currentUser = await authService.getCurrentUser()
      setUser(currentUser)
    } catch (err: any) {
      console.error('Error al refrescar usuario autenticado:', err)
      setError(err?.message || 'Error al validar la sesión.')
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Inicialización al montar el cliente y escucha de eventos Supabase Auth
  useEffect(() => {
    let isMounted = true

    // 1. Carga inicial
    refreshUser()

    // 2. Suscripción a cambios de sesión de Supabase
    const { data: authListener } = supabaseClient.auth.onAuthStateChange(async (event: string, session: any) => {
      if (!isMounted) return

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session?.user) {
          const profile = await authService.fetchUserProfile(session.user.id)
          if (isMounted) {
            setUser(profile)
            setIsLoading(false)
          }
        }
      } else if (event === 'SIGNED_OUT') {
        if (isMounted) {
          setUser(null)
          setIsLoading(false)
        }
      }
    })

    return () => {
      isMounted = false
      authListener?.subscription?.unsubscribe()
    }
  }, [refreshUser])

  // Inicio de sesión
  const signIn = useCallback(async (credentials: LoginCredentials): Promise<AuthUser> => {
    setIsLoading(true)
    setError(null)
    try {
      const loggedUser = await authService.signIn(credentials)
      setUser(loggedUser)
      return loggedUser
    } catch (err: any) {
      setError(err?.message || 'Error al iniciar sesión.')
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Cierre de sesión
  const signOut = useCallback(async () => {
    setIsLoading(true)
    try {
      await authService.signOut()
      setUser(null)
    } catch (err: any) {
      console.error('Error durante signOut:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Verificación de permiso individual (SUPERADMIN tiene acceso total a los 42 permisos)
  const hasPermission = useCallback(
    (permissionCode: string): boolean => {
      if (!user) return false
      if (user.roleCode === 'SUPERADMIN') return true
      return user.permissions.includes(permissionCode)
    },
    [user]
  )

  // Verificación si posee al menos uno de los permisos indicados
  const hasAnyPermission = useCallback(
    (permissionCodes: string[]): boolean => {
      if (!user) return false
      if (user.roleCode === 'SUPERADMIN') return true
      return permissionCodes.some((code) => user.permissions.includes(code))
    },
    [user]
  )

  // Verificación por rol
  const hasRole = useCallback(
    (roles: UserRoleCode[]): boolean => {
      if (!user) return false
      return roles.includes(user.roleCode)
    },
    [user]
  )

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: Boolean(user),
      error,
      signIn,
      signOut,
      refreshUser,
      hasPermission,
      hasAnyPermission,
      hasRole,
    }),
    [user, isLoading, error, signIn, signOut, refreshUser, hasPermission, hasAnyPermission, hasRole]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth debe ser utilizado dentro de un AuthProvider.')
  }
  return context
}
