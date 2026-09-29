import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

async function runOnboarding() {
  const client = new pg.Client({
    connectionString: process.env.DIRECT_URL,
    ssl: { rejectUnauthorized: false },
  })

  await client.connect()

  console.log('====================================================')
  console.log('1. PRE-VALIDACIÓN OBLIGATORIA')
  console.log('====================================================')

  const cCount = await client.query('SELECT count(*) FROM public.companies;')
  const lCount = await client.query('SELECT count(*) FROM public.locations;')
  const ulCount = await client.query('SELECT count(*) FROM public.user_locations;')

  console.log('companies count:     ', cCount.rows[0].count)
  console.log('locations count:     ', lCount.rows[0].count)
  console.log('user_locations count:', ulCount.rows[0].count)

  if (cCount.rows[0].count !== '0' || lCount.rows[0].count !== '0' || ulCount.rows[0].count !== '0') {
    throw new Error('Pre-validación fallida: las tablas no están en 0.')
  }

  const uRes = await client.query(`
    SELECT u.id, u.email, u.company_id, r.code as role_code
    FROM public.users u
    JOIN public.roles r ON u.role_id = r.id
    WHERE u.email = 'samirdurant234@gmail.com';
  `)

  if (uRes.rows.length === 0) {
    throw new Error('Usuario superadministrador no encontrado.')
  }

  const admin = uRes.rows[0]
  console.log('Superadministrador encontrado:', admin)

  if (admin.role_code !== 'SUPERADMIN' || admin.company_id !== null) {
    throw new Error('Pre-validación fallida: el usuario debe tener role SUPERADMIN y company_id NULL.')
  }

  console.log('✅ Pre-validación 100% superada. Iniciando transacción atómica...')

  console.log('\n====================================================')
  console.log('2. EJECUCIÓN TRANSACCIONAL (BEGIN ... COMMIT)')
  console.log('====================================================')

  try {
    await client.query('BEGIN')

    // 2.1 Crear Empresa
    console.log('-> Insertando en public.companies...')
    const compInsert = await client.query(`
      INSERT INTO public.companies (
        business_name,
        trade_name,
        tax_id,
        verification_digit,
        tax_regime,
        economic_activity_code,
        address,
        city,
        department,
        country,
        phone,
        email,
        invoice_email,
        currency,
        status
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
      ) RETURNING id, business_name, trade_name, tax_id;
    `, [
      'Super Más S.A.S.',
      'Distribuidora Super Más',
      '900842109',
      '4',
      'RESPONSABLE_DE_IVA',
      '4711',
      'Calle 50 # 45-20',
      'Medellín',
      'Antioquia',
      'Colombia',
      '+57 300 123 4567',
      'contacto@supermas.com.co',
      'facturacion@supermas.com.co',
      'COP',
      'ACTIVE',
    ])

    const companyId = compInsert.rows[0].id
    console.log('   Empresa creada con ID:', companyId)

    // 2.2 Asignar company_id a public.users
    console.log('-> Asignando company_id en public.users al superadmin...')
    await client.query(`
      UPDATE public.users 
      SET company_id = $1, updated_at = NOW()
      WHERE id = $2;
    `, [companyId, admin.id])

    // 2.3 Crear primera Bodega
    console.log('-> Insertando en public.locations...')
    const locInsert = await client.query(`
      INSERT INTO public.locations (
        company_id,
        code,
        name,
        type,
        status,
        address,
        city,
        department,
        phone,
        email,
        is_ecommerce_source,
        is_store_point,
        allow_inventory_ops,
        allow_sales,
        allow_purchases,
        allow_transfers
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
      ) RETURNING id, code, name, type;
    `, [
      companyId,
      'BOD-01',
      'Bodega Principal Medellín',
      'WAREHOUSE',
      'ACTIVE',
      'Calle 50 # 45-20',
      'Medellín',
      'Antioquia',
      '+57 300 123 4567',
      'bodega@supermas.com.co',
      false,
      false,
      true,
      true,
      true,
      true,
    ])

    const locationId = locInsert.rows[0].id
    console.log('   Bodega creada con ID:', locationId)

    // 2.4 Asignar user_locations
    console.log('-> Insertando en public.user_locations...')
    await client.query(`
      INSERT INTO public.user_locations (
        user_id,
        location_id,
        is_primary
      ) VALUES (
        $1, $2, $3
      );
    `, [admin.id, locationId, true])

    // 2.5 Sincronizar raw_app_meta_data en auth.users
    console.log('-> Actualizando raw_app_meta_data en auth.users...')
    await client.query(`
      UPDATE auth.users
      SET raw_app_meta_data = raw_app_meta_data || jsonb_build_object('company_id', $1::text)
      WHERE id = $2;
    `, [companyId, admin.id])

    await client.query('COMMIT')
    console.log('✅ COMMIT ejecutado con éxito. Transacción consolidada.')
  } catch (txErr) {
    await client.query('ROLLBACK')
    console.error('❌ Error en transacción, ROLLBACK ejecutado:', txErr)
    throw txErr
  }

  console.log('\n====================================================')
  console.log('3. POST-VALIDACIÓN INMEDIATA EN POSTGRESQL')
  console.log('====================================================')

  const cFinal = await client.query('SELECT count(*) FROM public.companies;')
  const lFinal = await client.query('SELECT count(*) FROM public.locations;')
  const ulFinal = await client.query('SELECT count(*) FROM public.user_locations;')

  console.log(`companies count:      ${cFinal.rows[0].count} (Esperado: 1) -> ${cFinal.rows[0].count === '1' ? 'OK ✅' : 'FAIL ❌'}`)
  console.log(`locations count:      ${lFinal.rows[0].count} (Esperado: 1) -> ${lFinal.rows[0].count === '1' ? 'OK ✅' : 'FAIL ❌'}`)
  console.log(`user_locations count: ${ulFinal.rows[0].count} (Esperado: 1) -> ${ulFinal.rows[0].count === '1' ? 'OK ✅' : 'FAIL ❌'}`)

  const uFinal = await client.query(`
    SELECT u.id, u.email, u.company_id, c.trade_name as company_name, r.code as role_code
    FROM public.users u
    JOIN public.roles r ON u.role_id = r.id
    LEFT JOIN public.companies c ON u.company_id = c.id
    WHERE u.id = $1;
  `, [admin.id])

  console.log('Usuario post-onboarding:', uFinal.rows[0])

  const authFinal = await client.query('SELECT id, email, raw_app_meta_data FROM auth.users WHERE id = $1;', [admin.id])
  console.log('Auth user post-onboarding app_metadata:', authFinal.rows[0].raw_app_meta_data)

  await client.end()
}

runOnboarding().catch((e) => {
  console.error(e)
  process.exit(1)
})
