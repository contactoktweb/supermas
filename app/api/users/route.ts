import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireServerUser, requireAnyPermission, AuthError } from '@/lib/auth/server-auth'
import { CreateUserSchema } from '@/features/users/schemas/user.schema'
import { User, UserRole, UserStatus } from '@/features/users/types'

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

export async function POST(request: NextRequest) {
  try {
    // 0. Quién llama: sesión verificada contra Supabase Auth + permiso de crear usuarios.
    //    (El middleware solo comprueba que exista una cookie; aquí se valida de verdad.)
    let caller
    try {
      caller = await requireServerUser(request)
      await requireAnyPermission(caller, ['users.create'])
    } catch (e) {
      if (e instanceof AuthError) return NextResponse.json({ success: false, error: e.message }, { status: e.status })
      throw e
    }

    const body = await request.json()

    // Validar datos de entrada
    const parsed = CreateUserSchema.safeParse(body)
    if (!parsed.success) {
      const errorMsg = parsed.error.issues.map((i) => i.message).join('. ')
      return NextResponse.json({ success: false, error: errorMsg }, { status: 400 })
    }

    const data = parsed.data
    const email = data.email.toLowerCase().trim()

    // 1. La empresa es SIEMPRE la del usuario que crea (no se acepta companyId del navegador)
    const companyId: string | undefined = caller.companyId

    // 1.1 Solo un ADMIN/SUPERADMIN puede crear cuentas con rol administrativo (evita escalar privilegios)
    if (['ADMIN', 'SUPERADMIN'].includes(String(data.role)) && !caller.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Solo un administrador puede crear usuarios con rol administrativo.' },
        { status: 403 }
      )
    }

    if (!companyId) {
      return NextResponse.json(
        { success: false, error: 'No se encontró una empresa activa en el sistema.' },
        { status: 400 }
      )
    }

    // 2. Verificar duplicidad de email en public.users
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id, email')
      .eq('email', email)
      .maybeSingle()

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: `El correo electrónico ${email} ya se encuentra registrado en el sistema.` },
        { status: 400 }
      )
    }

    // 3. Resolver role_id en base de datos
    const { data: roleRow, error: roleError } = await supabaseAdmin
      .from('roles')
      .select('id, code')
      .eq('code', data.role)
      .single()

    if (roleError || !roleRow) {
      return NextResponse.json(
        { success: false, error: `No se encontró el rol especificado: ${data.role}` },
        { status: 400 }
      )
    }

    // 3.1 Validar consistencia de caja registradora asignada (si se proporciona)
    if (data.assignedCashRegisterId) {
      const { data: reg, error: regErr } = await supabaseAdmin
        .from('cash_registers')
        .select('id, location_id, name')
        .eq('id', data.assignedCashRegisterId)
        .maybeSingle()

      if (regErr || !reg) {
        return NextResponse.json(
          { success: false, error: 'La caja registradora asignada no existe en el sistema.' },
          { status: 400 }
        )
      }

      if (!data.locationIds.includes(reg.location_id)) {
        return NextResponse.json(
          {
            success: false,
            error: `La caja registradora seleccionada (${reg.name}) no pertenece a la sede o punto de venta asignado.`,
          },
          { status: 400 }
        )
      }
    }

    // 4. Determinar contraseña de acceso (provista o temporal segura)
    const initialPassword = (data as any).password?.trim() || `SuperMas${new Date().getFullYear()}*`

    // 5. Verificar si ya existe en auth.users (caso huérfano de intentos previos)
    let authUserId: string | null = null
    const { data: authList } = await supabaseAdmin.auth.admin.listUsers()
    const foundAuth = authList?.users?.find((u) => u.email?.toLowerCase() === email)

    if (foundAuth) {
      // Cuenta huérfana en Auth (sin fila en public.users): solo un administrador puede repararla,
      // porque esta ruta le asigna una nueva contraseña.
      if (!caller.isAdmin) {
        return NextResponse.json(
          { success: false, error: 'El correo ya existe en el sistema de autenticación. Solo un administrador puede vincularlo.' },
          { status: 403 }
        )
      }
      authUserId = foundAuth.id
      // Actualizar metadatos y contraseña
      await supabaseAdmin.auth.admin.updateUserById(authUserId, {
        password: initialPassword,
        app_metadata: {
          role: data.role,
          company_id: companyId,
        },
        user_metadata: {
          full_name: `${data.firstName.trim()} ${data.lastName.trim()}`,
          phone: data.phone || null,
        },
      })
    } else {
      // Crear en auth.users
      const { data: createdAuth, error: authCreateErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: initialPassword,
        email_confirm: true,
        app_metadata: {
          role: data.role,
          company_id: companyId,
        },
        user_metadata: {
          full_name: `${data.firstName.trim()} ${data.lastName.trim()}`,
          phone: data.phone || null,
        },
      })

      if (authCreateErr || !createdAuth?.user) {
        console.error('Error en supabaseAdmin.auth.admin.createUser:', authCreateErr)
        return NextResponse.json(
          { success: false, error: authCreateErr?.message || 'Error al crear la cuenta en Supabase Auth.' },
          { status: 400 }
        )
      }
      authUserId = createdAuth.user.id
    }

    // 6. Inserción / Sincronización fiduciaria en public.users
    const fullName = `${data.firstName.trim()} ${data.lastName.trim()}`
    const initials = `${data.firstName.charAt(0)}${data.lastName.charAt(0) || data.firstName.charAt(1) || ''}`.toUpperCase()

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
          is_active: data.status === 'ACTIVE',
          assigned_cash_register_id: data.assignedCashRegisterId || null,
          avatar_url: initials,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      )

    if (upsertErr) {
      console.error('Error al insertar en public.users:', upsertErr)
      return NextResponse.json(
        { success: false, error: `Error al persistir usuario: ${upsertErr.message}` },
        { status: 500 }
      )
    }

    // 7. Asociar sedes en user_locations
    if (data.locationIds && data.locationIds.length > 0) {
      await supabaseAdmin.from('user_locations').delete().eq('user_id', authUserId)
      const locRows = data.locationIds.map((locId: string, idx: number) => ({
        user_id: authUserId,
        location_id: locId,
        is_primary: idx === 0,
      }))
      const { error: locErr } = await supabaseAdmin.from('user_locations').insert(locRows)
      if (locErr) {
        console.error('Error al asociar ubicaciones al usuario:', locErr)
      }
    }

    // 8. Recuperar registro completo formateado
    const { data: finalRow, error: fetchErr } = await supabaseAdmin
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
      `)
      .eq('id', authUserId)
      .single()

    if (fetchErr || !finalRow) {
      return NextResponse.json(
        { success: false, error: 'Usuario creado pero no se pudo recuperar el perfil.' },
        { status: 500 }
      )
    }

    const domainUser = mapDbUserToDomain(finalRow)

    return NextResponse.json({
      success: true,
      data: domainUser,
      assignedPassword: initialPassword,
    })
  } catch (err: any) {
    console.error('Error inesperado en POST /api/users:', err)
    return NextResponse.json(
      { success: false, error: err.message || 'Error interno del servidor al registrar colaborador.' },
      { status: 500 }
    )
  }
}
