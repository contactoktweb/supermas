/**
 * SUPER MÁS ERP/POS - Repositorio de Usuarios (UserRepository)
 *
 * Conecta exclusivamente a PostgreSQL / Supabase Real (public.users,
 * public.roles, public.user_locations, public.locations, public.audit_logs).
 * Respeta Row Level Security (RLS) y aislamiento multiempresa por company_id.
 */

import { supabaseClient } from '@/lib/supabase/client'
import { resolveUserCompanyId } from '@/lib/supabase/tenant'
import { User, UserFilters, UserStats, UserRole, UserStatus } from '../types'
import { AuditLogEntry } from '@/features/audit/types'

function mapDbUserToDomain(row: any): User {
  const fullName = row.full_name || row.email || ''
  const nameParts = fullName.trim().split(/\s+/)
  const firstName = nameParts[0] || ''
  const lastName = nameParts.slice(1).join(' ') || ''
  const initials = `${firstName.charAt(0)}${lastName.charAt(0) || firstName.charAt(1) || ''}`.toUpperCase()

  const roleCode = (row.roles?.code || row.role_code || 'SELLER') as UserRole
  const status: UserStatus = row.is_active ? 'ACTIVE' : 'INACTIVE'

  const locs = (row.user_locations || []).map((ul: any) => ({
    id: ul.location_id,
    name: ul.locations?.name || '',
    isPrimary: ul.is_primary,
  }))

  const locationIds = locs.map((l: any) => l.id)
  const primaryLoc = locs.find((l: any) => l.isPrimary) || locs[0]
  const locationName =
    locs.length > 1
      ? `Múltiples Sedes (${locs.length})`
      : primaryLoc?.name || 'Consolidado General'

  return {
    id: row.id,
    name: fullName,
    firstName,
    lastName,
    email: row.email || '',
    username: row.email ? row.email.split('@')[0] : '',
    phone: row.phone || '',
    role: roleCode,
    status,
    locationIds,
    locationName,
    avatar: row.avatar_url || initials,
    createdAt: row.created_at || new Date().toISOString(),
    lastLoginAt: row.last_login_at || null,
  }
}

export class UserRepository {
  /**
   * Consulta el listado de usuarios con filtros aplicados desde PostgreSQL.
   */
  async getUsers(filters: UserFilters = {}): Promise<User[]> {
    let query = supabaseClient
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
        created_at,
        updated_at,
        roles:role_id ( id, code, name ),
        user_locations (
          location_id,
          is_primary,
          locations:location_id ( id, code, name )
        )
      `)

    if (filters.status && filters.status !== 'ALL') {
      query = query.eq('is_active', filters.status === 'ACTIVE')
    }

    const { data, error } = await query

    if (error) {
      console.error('Error al consultar usuarios en Supabase:', error)
      throw new Error(`Error al consultar usuarios: ${error.message}`)
    }

    let users = (data || []).map(mapDbUserToDomain)

    if (filters.role && filters.role !== 'ALL') {
      users = users.filter((u) => u.role === filters.role)
    }

    if (filters.locationId && filters.locationId !== 'ALL') {
      users = users.filter((u) => u.locationIds?.includes(filters.locationId!))
    }

    if (filters.searchQuery && filters.searchQuery.trim()) {
      const q = filters.searchQuery.toLowerCase().trim()
      users = users.filter(
        (u) =>
          u.name?.toLowerCase().includes(q) ||
          u.email?.toLowerCase().includes(q) ||
          u.username?.toLowerCase().includes(q) ||
          u.phone?.toLowerCase().includes(q) ||
          u.role?.toLowerCase().includes(q) ||
          u.locationName?.toLowerCase().includes(q)
      )
    }

    return users.sort((a, b) => a.name.localeCompare(b.name))
  }

  /**
   * Obtiene un usuario por ID desde PostgreSQL.
   */
  async getUserById(id: string): Promise<User | null> {
    const { data, error } = await supabaseClient
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
        created_at,
        updated_at,
        roles:role_id ( id, code, name ),
        user_locations (
          location_id,
          is_primary,
          locations:location_id ( id, code, name )
        )
      `)
      .eq('id', id)
      .maybeSingle()

    if (error) {
      console.error(`Error al obtener usuario ${id}:`, error)
      throw new Error(`Error al consultar usuario: ${error.message}`)
    }

    if (!data) return null
    return mapDbUserToDomain(data)
  }

  /**
   * Consulta las estadísticas globales de usuarios.
   */
  async getStats(): Promise<UserStats> {
    const users = await this.getUsers()

    const totalUsersCount = users.length
    const activeUsersCount = users.filter((u) => u.status === 'ACTIVE').length
    const inactiveUsersCount = users.filter((u) => u.status === 'INACTIVE').length

    // Conectados en los últimos 7 días
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    const recentlyConnectedCount = users.filter(
      (u) => u.lastLoginAt && new Date(u.lastLoginAt).getTime() >= sevenDaysAgo
    ).length

    const usersByRole: Record<UserRole, number> = {
      SUPERADMIN: 0,
      ADMIN: 0,
      WAREHOUSE_ADMIN: 0,
      POINT_ADMIN: 0,
      ACCOUNTANT: 0,
      SELLER: 0,
      CASHIER: 0,
    }

    users.forEach((u) => {
      if (usersByRole[u.role] !== undefined) {
        usersByRole[u.role]++
      }
    })

    return {
      totalUsersCount,
      activeUsersCount,
      inactiveUsersCount,
      recentlyConnectedCount,
      usersByRole,
    }
  }

  /**
   * Registra un nuevo usuario en PostgreSQL.
   */
  async createUser(
    data: Omit<User, 'id' | 'createdAt' | 'lastLoginAt' | 'avatar' | 'name' | 'locationName'> & {
      id?: string
      companyId?: string
    }
  ): Promise<User> {
    const companyId = data.companyId || (await resolveUserCompanyId())

    // Resolver role_id según código de rol
    const { data: roleRow, error: roleError } = await supabaseClient
      .from('roles')
      .select('id')
      .eq('code', data.role)
      .single()

    if (roleError || !roleRow) {
      throw new Error(`No se encontró el rol especificado: ${data.role}`)
    }

    const userId = data.id || crypto.randomUUID()
    const fullName = `${data.firstName.trim()} ${data.lastName.trim()}`
    const initials = `${data.firstName.charAt(0)}${data.lastName.charAt(0) || data.firstName.charAt(1) || ''}`.toUpperCase()

    const { error: insertUserError } = await supabaseClient
      .from('users')
      .upsert(
        {
          id: userId,
          company_id: companyId,
          role_id: roleRow.id,
          email: data.email.toLowerCase().trim(),
          full_name: fullName,
          phone: data.phone || null,
          is_active: data.status === 'ACTIVE',
          avatar_url: initials,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      )

    if (insertUserError) {
      console.error('Error al registrar usuario en Supabase:', insertUserError)
      throw new Error(`Error al registrar usuario: ${insertUserError.message}`)
    }

    // Insertar asignaciones a bodegas
    if (data.locationIds && data.locationIds.length > 0) {
      const locRows = data.locationIds.map((locId, idx) => ({
        user_id: userId,
        location_id: locId,
        is_primary: idx === 0,
      }))
      const { error: locError } = await supabaseClient
        .from('user_locations')
        .insert(locRows)

      if (locError) {
        console.error('Error al asociar bodegas al usuario:', locError)
      }
    }

    const created = await this.getUserById(userId)
    if (!created) {
      throw new Error('No se pudo recuperar el usuario recién creado.')
    }
    return created
  }

  /**
   * Actualiza un usuario existente en PostgreSQL.
   */
  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    const current = await this.getUserById(id)
    if (!current) {
      throw new Error(`No se encontró el usuario con ID ${id}`)
    }

    const updatesPayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    }

    if (updates.firstName !== undefined || updates.lastName !== undefined) {
      const fName = updates.firstName ?? current.firstName
      const lName = updates.lastName ?? current.lastName
      updatesPayload.full_name = `${fName} ${lName}`.trim()
      updatesPayload.avatar_url = `${fName.charAt(0)}${lName.charAt(0) || fName.charAt(1) || ''}`.toUpperCase()
    }

    if (updates.email !== undefined) {
      updatesPayload.email = updates.email.toLowerCase().trim()
    }

    if (updates.phone !== undefined) {
      updatesPayload.phone = updates.phone
    }

    if (updates.status !== undefined) {
      updatesPayload.is_active = updates.status === 'ACTIVE'
    }

    if (updates.role !== undefined) {
      const { data: roleRow, error: roleError } = await supabaseClient
        .from('roles')
        .select('id')
        .eq('code', updates.role)
        .single()

      if (roleError || !roleRow) {
        throw new Error(`No se encontró el rol especificado: ${updates.role}`)
      }
      updatesPayload.role_id = roleRow.id
    }

    const { error: updateError } = await supabaseClient
      .from('users')
      .update(updatesPayload)
      .eq('id', id)

    if (updateError) {
      console.error('Error al actualizar usuario en Supabase:', updateError)
      throw new Error(`Error al actualizar usuario: ${updateError.message}`)
    }

    // Sincronizar bodegas asignadas si se proporcionaron
    if (updates.locationIds !== undefined) {
      await supabaseClient.from('user_locations').delete().eq('user_id', id)
      if (updates.locationIds.length > 0) {
        const locRows = updates.locationIds.map((locId, idx) => ({
          user_id: id,
          location_id: locId,
          is_primary: idx === 0,
        }))
        const { error: locError } = await supabaseClient
          .from('user_locations')
          .insert(locRows)

        if (locError) {
          console.error('Error al actualizar asignaciones de bodega:', locError)
        }
      }
    }

    const updated = await this.getUserById(id)
    if (!updated) {
      throw new Error('No se pudo recuperar el usuario recién actualizado.')
    }
    return updated
  }

  /**
   * Activa o desactiva lógicamente a un usuario.
   */
  async setStatus(id: string, status: UserStatus): Promise<User> {
    return this.updateUser(id, { status })
  }

  /**
   * Consulta la actividad histórica reciente de un usuario desde public.audit_logs.
   */
  async getUserActivity(userId: string): Promise<AuditLogEntry[]> {
    const { data, error } = await supabaseClient
      .from('audit_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error(`Error al consultar auditoría del usuario ${userId}:`, error)
      return []
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      timestamp: row.created_at,
      userId: row.user_id,
      userName: row.user_name || 'Usuario',
      userRole: 'Colaborador',
      action: row.action,
      module: row.module,
      entityType: row.entity_name || 'GENERIC',
      entityId: row.entity_id || '',
      entityReference: row.entity_id || '',
      level: 'INFO',
      result: 'SUCCESS',
      ipAddress: row.ip_address || '127.0.0.1',
      details: row.action,
      previousValue: row.previous_value,
      newValue: row.new_value,
    }))
  }

  /**
   * Obtiene las bodegas y puntos de venta activos del sistema desde PostgreSQL.
   */
  async getLocations(): Promise<Array<{ id: string; code: string; name: string; type: string }>> {
    const { data, error } = await supabaseClient
      .from('locations')
      .select('id, code, name, type')
      .order('name')

    if (error) {
      console.error('Error al consultar bodegas en Supabase:', error)
      return []
    }

    return (data || []).map((loc: any) => ({
      id: loc.id,
      code: loc.code,
      name: loc.name,
      type: loc.type,
    }))
  }
}

export const userRepository = new UserRepository()
