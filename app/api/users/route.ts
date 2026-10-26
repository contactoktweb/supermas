import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireServerUser, requireAnyPermission, AuthError, ServerUser } from '@/lib/auth/server-auth'
import { CreateUserSchema, UpdateUserRequestSchema } from '@/features/users/schemas/user.schema'
import { canAssignRole, isAdminRole, PROTECTED_ROLE } from '@/features/users/services/role-assignment'
import { User, UserRole, UserStatus } from '@/features/users/types'
import { MUST_CHANGE_PASSWORD_KEY } from '@/lib/auth/password-change-flag'
import { generateTemporaryPassword } from '@/lib/auth/temporary-password'

/** Duración del baneo en Supabase Auth para cuentas desactivadas (~100 años) y valor que lo retira. */
const AUTH_BAN_DURATION_INACTIVE = '876000h'
const AUTH_BAN_DURATION_NONE = 'none'

/** Paginación de la Admin API de Auth al buscar una cuenta huérfana por correo. */
const AUTH_LIST_PAGE_SIZE = 200
const AUTH_LIST_MAX_PAGES = 100

const USER_SELECT = `
  id,
  company_id,
  role_id,
  email,
  full_name,
  phone,
  avatar_url,
  is_active,
  assigned_cash_register_id,
  last_login_at,
  created_at,
  updated_at,
  roles:role_id ( id, code, name ),
  cash_registers:assigned_cash_register_id ( id, code, name ),
  user_locations (
    location_id,
    is_primary,
    locations:location_id ( id, code, name )
  )
`

const NO_STORE = { 'Cache-Control': 'no-store' }

function jsonError(error: string, status: number) {
  return NextResponse.json({ success: false, error }, { status, headers: NO_STORE })
}

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

  const assignedCashRegisterId = row.assigned_cash_register_id || null
  const assignedCashRegisterName = row.cash_registers?.name || null

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
    assignedCashRegisterId,
    assignedCashRegisterName,
    avatar: row.avatar_url || initials,
    createdAt: row.created_at || new Date().toISOString(),
    lastLoginAt: row.last_login_at || null,
  }
}

async function authenticate(request: NextRequest, permissions: string[]): Promise<ServerUser | NextResponse> {
  try {
    const caller = await requireServerUser(request)
    await requireAnyPermission(caller, permissions)
    return caller
  } catch (e) {
    if (e instanceof AuthError) return jsonError(e.message, e.status)
    throw e
  }
}

/** Las sedes y la caja asignadas deben pertenecer a la empresa del llamante; la caja, a una de las sedes. */
async function validateCompanyAssignments(
  companyId: string,
  locationIds: string[] | undefined,
  cashRegisterId: string | null | undefined,
  effectiveLocationIds: string[]
): Promise<string | null> {
  if (locationIds && locationIds.length > 0) {
    const uniqueIds = Array.from(new Set(locationIds))
    if (uniqueIds.length !== locationIds.length) return 'Hay sedes repetidas en la asignación.'
    const { data: rows, error } = await supabaseAdmin
      .from('locations')
      .select('id')
      .eq('company_id', companyId)
      .in('id', uniqueIds)
    if (error || (rows || []).length !== uniqueIds.length) {
      return 'Una o más sedes asignadas no existen en su empresa.'
    }
  }

  if (cashRegisterId) {
    const { data: reg, error } = await supabaseAdmin
      .from('cash_registers')
      .select('id, location_id, name, company_id')
      .eq('id', cashRegisterId)
      .maybeSingle()
    if (error || !reg || reg.company_id !== companyId) {
      return 'La caja registradora asignada no existe en su empresa.'
    }
    if (!effectiveLocationIds.includes(reg.location_id)) {
      return `La caja registradora seleccionada (${reg.name}) no pertenece a la sede o punto de venta asignado.`
    }
  }

  return null
}

/** Busca una cuenta de Supabase Auth por correo recorriendo todas las páginas (listUsers no filtra por email). */
async function findAuthUserIdByEmail(email: string): Promise<string | null> {
  for (let page = 1; page <= AUTH_LIST_MAX_PAGES; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: AUTH_LIST_PAGE_SIZE })
    if (error) throw new Error('No se pudo consultar el sistema de autenticación.')
    const users = data?.users || []
    const found = users.find((u: { id: string; email?: string }) => u.email?.toLowerCase() === email)
    if (found) return found.id
    if (users.length < AUTH_LIST_PAGE_SIZE) return null
  }
  throw new Error('No se pudo verificar el correo en el sistema de autenticación.')
}

async function setAuthBan(userId: string, inactive: boolean): Promise<boolean> {
  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    ban_duration: inactive ? AUTH_BAN_DURATION_INACTIVE : AUTH_BAN_DURATION_NONE,
  })
  if (error) console.error('Error al actualizar el bloqueo de acceso en Supabase Auth:', error.message)
  return !error
}

async function syncUserLocations(userId: string, locationIds: string[]): Promise<boolean> {
  const { error: delErr } = await supabaseAdmin.from('user_locations').delete().eq('user_id', userId)
  if (delErr) {
    console.error('Error al limpiar sedes del usuario:', delErr)
    return false
  }
  if (locationIds.length === 0) return true
  const rows = locationIds.map((locId, idx) => ({ user_id: userId, location_id: locId, is_primary: idx === 0 }))
  const { error: insErr } = await supabaseAdmin.from('user_locations').insert(rows)
  if (insErr) {
    console.error('Error al asociar sedes al usuario:', insErr)
    return false
  }
  return true
}

async function fetchCompanyUser(userId: string, companyId: string) {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select(USER_SELECT)
    .eq('id', userId)
    .eq('company_id', companyId)
    .maybeSingle()
  if (error) {
    console.error('Error al consultar el usuario:', error)
    return null
  }
  return data
}

export async function POST(request: NextRequest) {
  try {
    // 0. Quién llama: sesión verificada contra Supabase Auth + permiso de crear usuarios.
    //    (El middleware solo comprueba que exista una cookie; aquí se valida de verdad.)
    const auth = await authenticate(request, ['users.create'])
    if (auth instanceof NextResponse) return auth
    const caller = auth

    const parsed = CreateUserSchema.safeParse(await request.json())
    if (!parsed.success) {
      return jsonError(parsed.error.issues.map((i) => i.message).join('. '), 400)
    }

    const data = parsed.data
    const email = data.email.toLowerCase().trim()

    // 1. La empresa es SIEMPRE la del usuario que crea (no se acepta companyId del navegador)
    const companyId = caller.companyId

    // 1.1 Matriz de asignación de roles: solo ADMIN/SUPERADMIN asignan roles y nadie asigna SUPERADMIN.
    if (!canAssignRole(caller.roleCode, data.role)) {
      return jsonError(
        data.role === PROTECTED_ROLE
          ? 'El rol SUPERADMIN no se asigna desde la aplicación.'
          : 'Solo un administrador puede asignar roles a los usuarios.',
        403
      )
    }

    // 1.2 Sedes y caja de la empresa del llamante
    const assignmentError = await validateCompanyAssignments(
      companyId,
      data.locationIds,
      data.assignedCashRegisterId,
      data.locationIds
    )
    if (assignmentError) return jsonError(assignmentError, 400)

    // 2. Verificar duplicidad de email en public.users
    const { data: existingUsers, error: existingErr } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .limit(1)

    if (existingErr) {
      console.error('Error al verificar el correo en public.users:', existingErr)
      return jsonError('No se pudo verificar el correo electrónico.', 500)
    }
    if ((existingUsers || []).length > 0) {
      return jsonError(`El correo electrónico ${email} ya se encuentra registrado en el sistema.`, 400)
    }

    // 3. Resolver role_id en base de datos
    const { data: roleRow, error: roleError } = await supabaseAdmin
      .from('roles')
      .select('id, code')
      .eq('code', data.role)
      .single()

    if (roleError || !roleRow) {
      return jsonError('No se encontró el rol especificado.', 400)
    }

    // 4. Contraseña de acceso: la del administrador (ya validada contra la política por el schema)
    //    o una temporal aleatoria generada aquí, que se devuelve una sola vez y nunca se registra.
    const temporaryPassword = data.password ? undefined : generateTemporaryPassword()
    const initialPassword = data.password ?? (temporaryPassword as string)
    const fullName = `${data.firstName.trim()} ${data.lastName.trim()}`
    const authAttributes = {
      password: initialPassword,
      app_metadata: {
        role: data.role,
        company_id: companyId,
        // La contraseña la definió un administrador: el usuario debe cambiarla al ingresar.
        [MUST_CHANGE_PASSWORD_KEY]: true,
      },
      user_metadata: {
        full_name: fullName,
        phone: data.phone || null,
      },
    }

    // 5. Verificar si ya existe en auth.users (caso huérfano de intentos previos)
    let authUserId: string | null = await findAuthUserIdByEmail(email)

    if (authUserId) {
      // Cuenta huérfana en Auth (sin fila en public.users). Esta ruta solo la usa un administrador
      // (matriz de roles), y le asigna una nueva contraseña.
      const { error: authUpdateErr } = await supabaseAdmin.auth.admin.updateUserById(authUserId, authAttributes)
      if (authUpdateErr) {
        console.error('Error en supabaseAdmin.auth.admin.updateUserById:', authUpdateErr.message)
        return jsonError('No se pudo actualizar la cuenta en el sistema de autenticación.', 400)
      }
    } else {
      const { data: createdAuth, error: authCreateErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        email_confirm: true,
        ...authAttributes,
      })

      if (authCreateErr || !createdAuth?.user) {
        console.error('Error en supabaseAdmin.auth.admin.createUser:', authCreateErr)
        return jsonError('No se pudo crear la cuenta en el sistema de autenticación.', 400)
      }
      authUserId = createdAuth.user.id as string
    }

    // 6. Inserción / sincronización en public.users
    const initials = `${data.firstName.charAt(0)}${data.lastName.charAt(0) || data.firstName.charAt(1) || ''}`.toUpperCase()
    const isActive = data.status === 'ACTIVE'

    const { error: upsertErr } = await supabaseAdmin
      .from('users')
      .upsert(
        {
          id: authUserId,
          company_id: companyId,
          role_id: roleRow.id,
          email,
          full_name: fullName,
          phone: data.phone || null,
          is_active: isActive,
          assigned_cash_register_id: data.assignedCashRegisterId || null,
          avatar_url: initials,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      )

    if (upsertErr) {
      console.error('Error al insertar en public.users:', upsertErr)
      return jsonError('No se pudo registrar el usuario en el ERP.', 500)
    }

    // 6.1 Una cuenta creada como inactiva tampoco puede iniciar sesión.
    if (!isActive && !(await setAuthBan(authUserId, true))) {
      return jsonError('Usuario creado, pero no se pudo bloquear su acceso. Desactívelo de nuevo.', 500)
    }

    // 7. Asociar sedes en user_locations
    if (data.locationIds.length > 0 && !(await syncUserLocations(authUserId, data.locationIds))) {
      return jsonError('Usuario creado, pero no se pudieron asignar sus sedes. Edítelo para asignarlas.', 500)
    }

    // 8. Recuperar registro completo formateado
    const finalRow = await fetchCompanyUser(authUserId, companyId)
    if (!finalRow) {
      return jsonError('Usuario creado pero no se pudo recuperar el perfil.', 500)
    }

    return NextResponse.json(
      {
        success: true,
        data: mapDbUserToDomain(finalRow),
        ...(temporaryPassword ? { temporaryPassword } : {}),
      },
      { headers: NO_STORE }
    )
  } catch (err) {
    console.error('Error inesperado en POST /api/users:', err)
    return jsonError('Error interno del servidor al registrar colaborador.', 500)
  }
}

function sameOrderedList(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((value, idx) => value === b[idx])
}

/**
 * Edita un usuario de la empresa del llamante: perfil, sedes, caja, rol y estado.
 * Toda la autorización se decide aquí (y la base de datos la refuerza con el trigger 076).
 */
export async function PATCH(request: NextRequest) {
  try {
    const auth = await authenticate(request, ['users.update', 'users.activate'])
    if (auth instanceof NextResponse) return auth
    const caller = auth

    const parsed = UpdateUserRequestSchema.safeParse(await request.json())
    if (!parsed.success) {
      return jsonError(parsed.error.issues.map((i) => i.message).join('. '), 400)
    }
    const { id, updates } = parsed.data

    const targetRow = await fetchCompanyUser(id, caller.companyId)
    if (!targetRow) return jsonError('Usuario no encontrado.', 404)
    const current = mapDbUserToDomain(targetRow)
    const isSelf = id === caller.userId

    // Cambios efectivos respecto al estado actual
    const nextFirstName = updates.firstName?.trim() ?? current.firstName
    const nextLastName = updates.lastName?.trim() ?? current.lastName
    const nextEmail = updates.email?.toLowerCase().trim() ?? current.email
    const nextPhone = updates.phone ?? current.phone
    const nextLocationIds = updates.locationIds ?? current.locationIds
    const nextCashRegisterId =
      updates.assignedCashRegisterId !== undefined ? updates.assignedCashRegisterId || null : current.assignedCashRegisterId || null

    const nameChanged = nextFirstName !== current.firstName || nextLastName !== current.lastName
    const emailChanged = nextEmail !== current.email
    const phoneChanged = nextPhone !== current.phone
    const locationsChanged = !sameOrderedList(nextLocationIds, current.locationIds)
    const cashRegisterChanged = nextCashRegisterId !== (current.assignedCashRegisterId || null)
    const profileChanged = nameChanged || emailChanged || phoneChanged || locationsChanged || cashRegisterChanged
    const roleChanged = updates.role !== undefined && updates.role !== current.role
    const statusChanged = updates.status !== undefined && updates.status !== current.status

    // Reglas de autorización
    if (current.role === PROTECTED_ROLE && !isSelf) {
      return jsonError('Las cuentas SUPERADMIN no se modifican desde la aplicación.', 403)
    }
    if (isSelf && (roleChanged || statusChanged)) {
      return jsonError('No puede cambiar su propio rol ni su estado.', 403)
    }
    if (isAdminRole(current.role) && !isSelf && !caller.isAdmin) {
      return jsonError('Solo un administrador puede modificar cuentas de administrador.', 403)
    }
    if (roleChanged && !canAssignRole(caller.roleCode, updates.role as string)) {
      return jsonError(
        updates.role === PROTECTED_ROLE
          ? 'El rol SUPERADMIN no se asigna desde la aplicación.'
          : 'Solo un administrador puede asignar roles a los usuarios.',
        403
      )
    }
    if (statusChanged && !caller.isAdmin && !(await caller.can('users.activate'))) {
      return jsonError('No tienes permiso para activar o desactivar usuarios.', 403)
    }
    if (profileChanged && !caller.isAdmin && !(await caller.can('users.update'))) {
      return jsonError('No tienes permiso para editar usuarios.', 403)
    }

    if (!profileChanged && !roleChanged && !statusChanged) {
      return NextResponse.json({ success: true, data: current }, { headers: NO_STORE })
    }

    if (locationsChanged || cashRegisterChanged) {
      const assignmentError = await validateCompanyAssignments(
        caller.companyId,
        locationsChanged ? nextLocationIds : undefined,
        nextCashRegisterId,
        nextLocationIds
      )
      if (assignmentError) return jsonError(assignmentError, 400)
    }

    if (emailChanged) {
      const { data: duplicates, error: duplicateErr } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('email', nextEmail)
        .neq('id', id)
        .limit(1)
      if (duplicateErr) {
        console.error('Error al verificar el correo en public.users:', duplicateErr)
        return jsonError('No se pudo verificar el correo electrónico.', 500)
      }
      if ((duplicates || []).length > 0) return jsonError(`El correo electrónico ${nextEmail} ya se encuentra registrado en el sistema.`, 400)
    }

    const payload: Record<string, string | boolean | null> = { updated_at: new Date().toISOString() }
    if (nameChanged) {
      payload.full_name = `${nextFirstName} ${nextLastName}`.trim()
      payload.avatar_url = `${nextFirstName.charAt(0)}${nextLastName.charAt(0) || nextFirstName.charAt(1) || ''}`.toUpperCase()
    }
    if (emailChanged) payload.email = nextEmail
    if (phoneChanged) payload.phone = nextPhone || null
    if (cashRegisterChanged) payload.assigned_cash_register_id = nextCashRegisterId

    if (roleChanged) {
      const { data: roleRow, error: roleError } = await supabaseAdmin
        .from('roles')
        .select('id')
        .eq('code', updates.role as string)
        .single()
      if (roleError || !roleRow) return jsonError('No se encontró el rol especificado.', 400)
      payload.role_id = roleRow.id
    }

    // Estado: primero el acceso en Auth (ban / unban), luego la fila del ERP.
    const deactivating = statusChanged && updates.status === 'INACTIVE'
    if (statusChanged) {
      if (!(await setAuthBan(id, deactivating))) {
        return jsonError('No se pudo actualizar el acceso del usuario en el sistema de autenticación.', 500)
      }
      payload.is_active = !deactivating
    }

    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update(payload)
      .eq('id', id)
      .eq('company_id', caller.companyId)

    if (updateError) {
      console.error('Error al actualizar usuario:', updateError)
      if (statusChanged) await setAuthBan(id, !deactivating)
      return jsonError('No se pudo actualizar el usuario.', 500)
    }

    if (locationsChanged && !(await syncUserLocations(id, nextLocationIds))) {
      return jsonError('Usuario actualizado, pero no se pudieron asignar sus sedes. Intente de nuevo.', 500)
    }

    const updatedRow = await fetchCompanyUser(id, caller.companyId)
    if (!updatedRow) return jsonError('Usuario actualizado pero no se pudo recuperar el perfil.', 500)

    return NextResponse.json({ success: true, data: mapDbUserToDomain(updatedRow) }, { headers: NO_STORE })
  } catch (err) {
    console.error('Error inesperado en PATCH /api/users:', err)
    return jsonError('Error interno del servidor al actualizar el colaborador.', 500)
  }
}
