/**
 * ==============================================================================
 * SCRIPT DE BOOTSTRAP SEGURO: PRIMER SUPERADMINISTRADOR
 * ERP SUPER MÁS S.A.S. — Supabase PostgreSQL
 * ==============================================================================
 *
 * Objetivo:
 * Crear el PRIMER usuario del sistema directamente mediante la Admin API de Supabase
 * usando la clave de servicio (SUPABASE_SERVICE_ROLE_KEY).
 *
 * REGLAS DE SEGURIDAD CRÍTICAS:
 * 1. NO depende de registro público abierto (signUp) en el navegador.
 * 2. Valida previamente que COUNT(*) en auth.users sea estrictamente 0.
 * 3. Si ya existe cualquier usuario registrado, ABORTA inmediatamente para impedir
 *    la creación o elevación de privilegios no autorizada.
 * 4. Deja el correo confirmado automáticamente (email_confirm: true).
 * 5. El registro público en Supabase Auth debe permanecer DESHABILITADO.
 *
 * Uso:
 * pnpm exec tsx scripts/bootstrap-first-admin.ts <email> <password> <nombre_completo>
 * O mediante variables en .env.local:
 * BOOTSTRAP_ADMIN_EMAIL=... BOOTSTRAP_ADMIN_PASSWORD=... BOOTSTRAP_ADMIN_NAME=...
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ ERROR DE CONFIGURACIÓN:')
  console.error('   Se requieren NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local')
  console.error('   para ejecutar el bootstrap administrativo.')
  process.exit(1)
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function bootstrapFirstAdmin() {
  const email = process.argv[2] || process.env.BOOTSTRAP_ADMIN_EMAIL
  const password = process.argv[3] || process.env.BOOTSTRAP_ADMIN_PASSWORD
  const fullName = process.argv[4] || process.env.BOOTSTRAP_ADMIN_NAME || 'Superadministrador Inicial'

  if (!email || !password) {
    console.log('====================================================================')
    console.log('🔐 BOOTSTRAP ADMINISTRATIVO — ERP SUPER MÁS')
    console.log('====================================================================')
    console.log('Uso:')
    console.log('  pnpm exec tsx scripts/bootstrap-first-admin.ts <email> <password> "<nombre>"')
    console.log('\nEjemplo:')
    console.log('  pnpm exec tsx scripts/bootstrap-first-admin.ts admin@supermas.com.co MiPasswordSeguro123! "Mauricio Andrade"')
    process.exit(1)
  }

  console.log('====================================================================')
  console.log('🔐 INICIANDO BOOTSTRAP SEGURO DEL PRIMER ADMINISTRADOR')
  console.log('====================================================================')
  console.log(`📧 Correo objetivo: ${email}`)
  console.log(`👤 Nombre completo: ${fullName}`)

  try {
    // 1. Verificar si ya existen usuarios en auth.users
    const { data: usersList, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1,
    })

    if (listErr) {
      console.error('❌ Error al consultar usuarios existentes en Supabase Auth:', listErr.message)
      process.exit(1)
    }

    if (usersList && usersList.users.length > 0) {
      console.error('\n🚨 ACCESO DENEGADO POR REGLA DE SEGURIDAD:')
      console.error('   Ya existen usuarios registrados en el sistema.')
      console.error('   El script de bootstrap administrativo solo puede ejecutarse en una base de datos limpia.')
      console.error('   Para registrar nuevos colaboradores, use el módulo de Usuarios dentro del ERP.')
      process.exit(1)
    }

    // 2. Crear el primer usuario mediante Admin API con metadata de bootstrap
    console.log('\n⏳ Creando usuario en Supabase Auth con confirmación inmediata...')
    const { data: createdUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
      },
      app_metadata: {
        role: 'SUPERADMIN',
        is_bootstrap_admin: true,
      },
    })

    if (createErr) {
      console.error('❌ Error al crear el usuario en Supabase Auth:', createErr.message)
      process.exit(1)
    }

    console.log(`✅ Usuario creado en auth.users con ID: ${createdUser.user.id}`)

    // 3. Confirmar la sincronización en public.users
    const { data: publicProfile, error: profileErr } = await supabaseAdmin
      .from('users')
      .select('id, email, full_name, role_id, company_id, is_active')
      .eq('id', createdUser.user.id)
      .single()

    if (profileErr) {
      console.warn('⚠️ Advertencia: No se pudo verificar el perfil en public.users de inmediato:', profileErr.message)
    } else {
      const { data: superadminRole } = await supabaseAdmin
        .from('roles')
        .select('id')
        .eq('code', 'SUPERADMIN')
        .single()

      if (!superadminRole || publicProfile.role_id !== superadminRole.id) {
        console.error('🚨 FALLO FIDUCIARIO: El trigger handle_new_auth_user NO asignó el rol SUPERADMIN.')
        console.error(`   Rol recibido: ${publicProfile.role_id}, Rol esperado: ${superadminRole?.id}`)
        process.exit(1)
      }

      console.log('✅ Perfil sincronizado legítimamente por trigger PostgreSQL en public.users:')
      console.log(`   - Email: ${publicProfile.email}`)
      console.log(`   - Rol ID: ${publicProfile.role_id} (SUPERADMIN)`)
      console.log(`   - Company ID: ${publicProfile.company_id ?? 'NULL (Esperado antes de Onboarding)'}`)
      console.log(`   - Activo: ${publicProfile.is_active}`)
    }

    console.log('\n====================================================================')
    console.log('🎉 BOOTSTRAP COMPLETADO CON ÉXITO')
    console.log('🔒 REGLA DE CIERRE:')
    console.log('   El registro público en Supabase Auth debe permanecer deshabilitado.')
    console.log('   Ahora puede iniciar sesión en la aplicación con estas credenciales.')
    console.log('====================================================================')
  } catch (err: any) {
    console.error('❌ Error inesperado durante el bootstrap:', err.message)
    process.exit(1)
  }
}

bootstrapFirstAdmin()
