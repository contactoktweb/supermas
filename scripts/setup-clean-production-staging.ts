import pg from 'pg'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const MAIN_COMPANY_ID = 'd06ecec2-c3c9-4a02-94db-9ef81c556226'
const MAIN_LOCATION_ID = 'd87117f6-fb86-4641-b2a2-9f4ed41a9374'
const SUPERADMIN_ROLE_ID = 'c0000000-0000-0000-0000-000000000001'

const ADMIN_EMAIL = 'samirdurant234@gmail.com'
const ADMIN_INITIAL_PASSWORD = 'Admin123'

async function runCleanAndSetupAdmin() {
  console.log('============================================================')
  console.log('INICIANDO LIMPIEZA FINAL Y CONFIGURACIÓN DE ADMINISTRADOR')
  console.log('============================================================\n')

  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL / DIRECT_URL no configurada')

  const pgClient = new pg.Client({ connectionString })
  await pgClient.connect()
  console.log('✅ Conexión directa a PostgreSQL establecida.')

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) throw new Error('Credenciales Supabase no configuradas')

  const adminSupabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  try {
    await pgClient.query('BEGIN')
    await pgClient.query("SET LOCAL app.is_test_cleanup = 'true'")

    // 1. Limpieza de cajas registradoras de prueba
    console.log('--- 1. Depuración de cajas registradoras ---')
    const delRegs = await pgClient.query(
      `DELETE FROM public.cash_registers WHERE code LIKE '%TEST%' OR code LIKE 'CAJA-A-%' RETURNING id, code;`
    )
    console.log(`  - Cajas de prueba eliminadas: ${delRegs.rowCount}`)

    // Asegurar que la caja principal oficial esté limpia y en estado CLOSED
    await pgClient.query(`
      UPDATE public.cash_registers
      SET code = 'CAJA-01',
          name = 'Caja Principal Mostrador',
          current_status = 'CLOSED',
          location_id = $1
      WHERE id = '4010ee18-d183-4b53-a4a9-1094d5d0d08a';
    `, [MAIN_LOCATION_ID])
    console.log('  - Caja principal oficial configurada: CAJA-01 (CLOSED).')

    // 2. Limpieza de audit logs que corresponden a pruebas
    console.log('\n--- 2. Depuración de registros de auditoría de prueba ---')
    const delAudits = await pgClient.query(`
      DELETE FROM public.audit_logs 
      WHERE user_name ILIKE '%TEST%' 
         OR entity_name ILIKE '%TEST%' 
         OR new_value::text ILIKE '%TEST%' 
         OR new_value::text ILIKE '%DEV-CLI%' 
         OR new_value::text ILIKE '%DEV-PRV%' 
         OR new_value::text ILIKE '%COM-%'
         OR user_name ILIKE '%Carlos Morales%'
         OR user_name ILIKE '%Analista Principal%'
         OR user_name ILIKE '%Gestor CxC%'
         OR user_name ILIKE '%Admin admin%'
         OR action IN ('PRODUCT_DELETED', 'PURCHASE_DELETED', 'LOCATION_DELETED', 'PROVEEDOR_DELETED', 'CATEGORY_DELETED', 'BRAND_DELETED');
    `)
    console.log(`  - Auditorías de prueba depuradas: ${delAudits.rowCount}`)

    // 3. Limpieza de usuarios de prueba en Supabase Auth
    console.log('\n--- 3. Depuración de usuarios de prueba en Supabase Auth ---')
    const { data: authList, error: listErr } = await adminSupabase.auth.admin.listUsers({ perPage: 1000 })
    if (listErr) throw listErr

    let deletedAuthCount = 0
    for (const u of authList.users) {
      const emailLower = (u.email || '').toLowerCase()
      if (emailLower !== ADMIN_EMAIL.toLowerCase() && emailLower !== 'ktrillos2@gmail.com') {
        await adminSupabase.auth.admin.deleteUser(u.id)
        deletedAuthCount++
      }
    }
    console.log(`  - Usuarios de prueba eliminados en Supabase Auth: ${deletedAuthCount}`)

    // 4. Configurar Usuario Administrador Inicial
    console.log('\n--- 4. Configuración del Usuario Administrador Inicial ---')
    let adminAuthUser = authList.users.find((u) => (u.email || '').toLowerCase() === ADMIN_EMAIL.toLowerCase())

    if (adminAuthUser) {
      console.log(`  - Usuario existente encontrado en Auth: ${adminAuthUser.id}`)
      // Actualizar contraseña a Admin123 y metadatos oficiales
      const { data: updatedAuth, error: updErr } = await adminSupabase.auth.admin.updateUserById(
        adminAuthUser.id,
        {
          password: ADMIN_INITIAL_PASSWORD,
          email_confirm: true,
          user_metadata: {
            full_name: 'Samir Durant',
            email_verified: true,
          },
          app_metadata: {
            role: 'SUPERADMIN',
            company_id: MAIN_COMPANY_ID,
            is_bootstrap_admin: true,
            provider: 'email',
            providers: ['email'],
          },
        }
      )
      if (updErr) throw updErr
      adminAuthUser = updatedAuth.user
      console.log('  - Contraseña actualizada a Admin123 y app_metadata configurada como SUPERADMIN.')
    } else {
      console.log('  - Creando usuario administrador inicial en Auth...')
      const { data: createdAuth, error: createErr } = await adminSupabase.auth.admin.createUser({
        email: ADMIN_EMAIL,
        password: ADMIN_INITIAL_PASSWORD,
        email_confirm: true,
        user_metadata: {
          full_name: 'Samir Durant',
        },
        app_metadata: {
          role: 'SUPERADMIN',
          company_id: MAIN_COMPANY_ID,
          is_bootstrap_admin: true,
        },
      })
      if (createErr || !createdAuth.user) throw createErr || new Error('Fallo al crear usuario admin')
      adminAuthUser = createdAuth.user
      console.log(`  - Usuario Auth creado exitosamente: ${adminAuthUser.id}`)
    }

    // Asegurar registro en public.users
    await pgClient.query(`
      INSERT INTO public.users (
        id, company_id, role_id, email, full_name, is_active, updated_at
      ) VALUES (
        $1, $2, $3, $4, 'Samir Durant', true, NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        company_id = EXCLUDED.company_id,
        role_id = EXCLUDED.role_id,
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        is_active = true,
        updated_at = NOW();
    `, [adminAuthUser.id, MAIN_COMPANY_ID, SUPERADMIN_ROLE_ID, ADMIN_EMAIL.toLowerCase()])
    console.log('  - Perfil en public.users sincronizado con rol SUPERADMIN y company_id oficial.')

    // Asegurar asignación de bodega en public.user_locations
    await pgClient.query(`
      INSERT INTO public.user_locations (user_id, location_id, is_primary, assigned_at)
      VALUES ($1, $2, true, NOW())
      ON CONFLICT (user_id, location_id) DO UPDATE SET is_primary = true;
    `, [adminAuthUser.id, MAIN_LOCATION_ID])
    console.log('  - Asignación a Bodega Principal San Luis confirmada.')

    await pgClient.query('COMMIT')
    console.log('\n✅ Transacción completada exitosamente.')
  } catch (err: any) {
    await pgClient.query('ROLLBACK')
    console.error('❌ Error durante la configuración:', err)
    throw err
  } finally {
    await pgClient.end()
  }
}

runCleanAndSetupAdmin().catch((err) => {
  console.error('Falla crítica:', err)
  process.exit(1)
})
