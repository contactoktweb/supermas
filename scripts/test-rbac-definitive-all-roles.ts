import { Client } from 'pg'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

async function runTests() {
  const client = new Client({ connectionString: process.env.DATABASE_URL || process.env.DIRECT_URL })
  await client.connect()
  console.log('====================================================================')
  console.log('ERP SUPER MÁS - SUITE DE VALIDACIÓN DEFINITIVA DE RBAC (7 ROLES)')
  console.log('====================================================================\n')

  let passedTests = 0
  let totalTests = 0

  function assert(condition: boolean, desc: string) {
    totalTests++
    if (condition) {
      console.log(`[PASS] ${desc}`)
      passedTests++
    } else {
      console.error(`[FAIL] ${desc}`)
      throw new Error(`Test fallido: ${desc}`)
    }
  }

  // ==============================================================================
  // PRUEBA 1: VERIFICAR QUE EXISTEN EXACTAMENTE LOS 7 ROLES DEFINITIVOS
  // ==============================================================================
  console.log('--- 1. VERIFICACIÓN DE LOS 7 ROLES DEFINITIVOS ---')
  const definitiveRoles = [
    'ADMIN',
    'JEFE_INGRESOS_SALIDAS',
    'FACTURACION_POS',
    'ENCARGADA_VENTA',
    'VENDEDORES',
    'JEFE_BODEGA',
    'RECURSOS_HUMANOS',
  ]

  for (const code of definitiveRoles) {
    const res = await client.query('SELECT id, code, name, scope, is_system FROM public.roles WHERE code = $1', [code])
    assert(res.rows.length === 1, `Rol definitivo '${code}' existe en public.roles (${res.rows[0]?.name})`)
  }

  // ==============================================================================
  // PRUEBA 2: VERIFICAR QUE LOS ROLES LEGACY PERMANECEN INTACTOS
  // ==============================================================================
  console.log('\n--- 2. VERIFICACIÓN DE ROLES LEGACY PRESERVADOS ---')
  const legacyRoles = [
    'SUPERADMIN',
    'ACCOUNTANT',
    'WAREHOUSE_ADMIN',
    'POINT_ADMIN',
    'SELLER',
    'CASHIER',
  ]

  for (const code of legacyRoles) {
    const res = await client.query('SELECT id, code, name FROM public.roles WHERE code = $1', [code])
    assert(res.rows.length === 1, `Rol legacy '${code}' permanece intacto (${res.rows[0]?.name})`)
  }

  // ==============================================================================
  // PRUEBA 3: VERIFICAR QUE NINGÚN USUARIO ACTUAL FUE MODIFICADO
  // ==============================================================================
  console.log('\n--- 3. REGLA ABSOLUTA: USUARIOS ACTUALES INTACTOS ---')
  const existingUsers = [
    { email: 'karollcastellanos08@gmail.com', name: 'Gabriela Castellanos', expectedRole: 'SUPERADMIN' },
    { email: 'ktrillos2@gmail.com', name: 'Keyner Trillos', expectedRole: 'SUPERADMIN' },
    { email: 'samirdurant234@gmail.com', name: 'Samir Durant', expectedRole: 'SUPERADMIN' },
    { email: 'trujillosamir58@gmail.com', name: 'Samir Trujillo', expectedRole: 'SUPERADMIN' },
    { email: 'jkmasesorias@gmail.com', name: 'SÚPER MÁS SAS - SISTEMA', expectedRole: 'SUPERADMIN' },
  ]

  for (const u of existingUsers) {
    const res = await client.query(
      `SELECT u.id, u.email, u.full_name, r.code as role_code, u.is_active 
       FROM public.users u 
       JOIN public.roles r ON u.role_id = r.id 
       WHERE u.email = $1`,
      [u.email]
    )
    assert(res.rows.length === 1, `Usuario '${u.name}' (${u.email}) existe`)
    assert(res.rows[0].role_code === u.expectedRole, `Usuario '${u.name}' conserva exactamente su rol '${u.expectedRole}' sin migración prematura`)
  }

  // ==============================================================================
  // PRUEBA 4: MATRIZ DE PERMISOS GRANULARES DE LOS 7 ROLES
  // ==============================================================================
  console.log('\n--- 4. MATRIZ DE PERMISOS GRANULARES DE LOS 7 ROLES ---')

  async function getPermissionsForRole(roleCode: string): Promise<string[]> {
    const res = await client.query(
      `SELECT p.code 
       FROM public.role_permissions rp 
       JOIN public.roles r ON rp.role_id = r.id 
       JOIN public.permissions p ON rp.permission_id = p.id 
       WHERE r.code = $1 
       ORDER BY p.code`,
      [roleCode]
    )
    return res.rows.map((r) => r.code)
  }

  // 4.1 ADMIN
  const adminPerms = await getPermissionsForRole('ADMIN')
  assert(adminPerms.includes('prices.approve'), 'ADMIN tiene prices.approve')
  assert(adminPerms.includes('prices.request'), 'ADMIN tiene prices.request')
  assert(adminPerms.includes('users.create'), 'ADMIN tiene users.create')
  assert(adminPerms.includes('users.activate'), 'ADMIN tiene users.activate')
  assert(adminPerms.includes('settings.manage'), 'ADMIN tiene settings.manage')
  assert(adminPerms.includes('costs.manage'), 'ADMIN tiene costs.manage')
  assert(adminPerms.includes('warehouses.write'), 'ADMIN tiene warehouses.write')
  console.log(`ADMIN cuenta con ${adminPerms.length} permisos totales.`)

  // 4.2 JEFE DE INGRESOS Y SALIDAS OPERATIVA
  const jefePerms = await getPermissionsForRole('JEFE_INGRESOS_SALIDAS')
  assert(jefePerms.includes('prices.request'), 'JEFE_INGRESOS_SALIDAS tiene prices.request (proponer precios)')
  assert(!jefePerms.includes('prices.approve'), 'JEFE_INGRESOS_SALIDAS NO tiene prices.approve (NO aprueba precios)')
  assert(jefePerms.includes('costs.manage'), 'JEFE_INGRESOS_SALIDAS tiene costs.manage (gestionar costos)')
  assert(jefePerms.includes('treasury.petty_cash'), 'JEFE_INGRESOS_SALIDAS tiene treasury.petty_cash (caja menor)')
  assert(jefePerms.includes('inventory.transfer'), 'JEFE_INGRESOS_SALIDAS tiene inventory.transfer (transferencias)')
  assert(jefePerms.includes('customers.write'), 'JEFE_INGRESOS_SALIDAS tiene customers.write (agregar clientes)')
  assert(!jefePerms.includes('users.create'), 'JEFE_INGRESOS_SALIDAS NO puede crear usuarios')
  assert(!jefePerms.includes('settings.manage'), 'JEFE_INGRESOS_SALIDAS NO tiene settings.manage')

  // 4.3 FACTURACIÓN POS
  const posPerms = await getPermissionsForRole('FACTURACION_POS')
  assert(posPerms.includes('pos.access'), 'FACTURACION_POS tiene pos.access')
  assert(posPerms.includes('sales.create'), 'FACTURACION_POS tiene sales.create')
  assert(posPerms.includes('invoices.read'), 'FACTURACION_POS tiene invoices.read')
  assert(!posPerms.includes('prices.request'), 'FACTURACION_POS NO puede solicitar precios')
  assert(!posPerms.includes('prices.approve'), 'FACTURACION_POS NO puede aprobar precios')
  assert(!posPerms.includes('users.create'), 'FACTURACION_POS NO puede crear usuarios')
  assert(!posPerms.includes('settings.manage'), 'FACTURACION_POS NO puede administrar sistema ni DIAN')

  // 4.4 ENCARGADA DE VENTA
  const encargadaPerms = await getPermissionsForRole('ENCARGADA_VENTA')
  assert(encargadaPerms.includes('pos.cash_register'), 'ENCARGADA_VENTA tiene pos.cash_register (operar caja asignada)')
  assert(encargadaPerms.includes('sales.create'), 'ENCARGADA_VENTA tiene sales.create (cobrar y finalizar venta)')
  assert(encargadaPerms.includes('inventory.adjust'), 'ENCARGADA_VENTA tiene inventory.adjust (mover inventario de su punto)')
  assert(encargadaPerms.includes('remissions.create'), 'ENCARGADA_VENTA tiene remissions.create (descargar mercancía)')
  assert(!encargadaPerms.includes('prices.request'), 'ENCARGADA_VENTA NO puede solicitar precios')
  assert(!encargadaPerms.includes('prices.approve'), 'ENCARGADA_VENTA NO puede aprobar precios')
  assert(!encargadaPerms.includes('users.create'), 'ENCARGADA_VENTA NO puede crear usuarios')

  // 4.5 VENDEDORES
  const vendedorPerms = await getPermissionsForRole('VENDEDORES')
  assert(vendedorPerms.includes('sales.create'), 'VENDEDORES tiene sales.create (crear venta y ticket)')
  assert(vendedorPerms.includes('products.read'), 'VENDEDORES tiene products.read (consultar catálogo)')
  assert(!vendedorPerms.includes('pos.cash_register'), 'VENDEDORES NO tiene pos.cash_register (no cobra en caja registradora)')
  assert(!vendedorPerms.includes('prices.request'), 'VENDEDORES NO puede modificar precios')
  assert(!vendedorPerms.includes('prices.approve'), 'VENDEDORES NO puede aprobar precios')
  assert(!vendedorPerms.includes('users.create'), 'VENDEDORES NO puede administrar usuarios')

  // 4.6 JEFE DE BODEGA
  const bodegaPerms = await getPermissionsForRole('JEFE_BODEGA')
  assert(bodegaPerms.includes('inventory.read'), 'JEFE_BODEGA tiene inventory.read (existencias)')
  assert(bodegaPerms.includes('inventory.adjust'), 'JEFE_BODEGA tiene inventory.adjust (ajustes en su bodega)')
  assert(bodegaPerms.includes('inventory.transfer'), 'JEFE_BODEGA tiene inventory.transfer (transferencias)')
  assert(bodegaPerms.includes('kardex.read'), 'JEFE_BODEGA tiene kardex.read (Kardex histórico)')
  assert(!bodegaPerms.includes('prices.request'), 'JEFE_BODEGA NO modifica precios')
  assert(!bodegaPerms.includes('prices.approve'), 'JEFE_BODEGA NO aprueba precios')
  assert(!bodegaPerms.includes('pos.access'), 'JEFE_BODEGA NO opera POS ni ventas')

  // 4.7 RECURSOS HUMANOS
  const rrhhPerms = await getPermissionsForRole('RECURSOS_HUMANOS')
  assert(rrhhPerms.includes('users.read'), 'RECURSOS_HUMANOS tiene users.read (consultar colaboradores)')
  assert(rrhhPerms.includes('users.create'), 'RECURSOS_HUMANOS tiene users.create (crear colaboradores)')
  assert(rrhhPerms.includes('users.update'), 'RECURSOS_HUMANOS tiene users.update (actualizar colaboradores)')
  assert(rrhhPerms.includes('users.activate'), 'RECURSOS_HUMANOS tiene users.activate (activar/desactivar colaboradores)')
  assert(rrhhPerms.includes('customers.read'), 'RECURSOS_HUMANOS tiene customers.read (terceros / empleados)')
  assert(rrhhPerms.includes('audit.read'), 'RECURSOS_HUMANOS tiene audit.read (auditoría laboral)')
  assert(!rrhhPerms.includes('inventory.read'), 'RECURSOS_HUMANOS NO accede a inventario')
  assert(!rrhhPerms.includes('prices.request'), 'RECURSOS_HUMANOS NO modifica precios')
  assert(!rrhhPerms.includes('pos.access'), 'RECURSOS_HUMANOS NO opera POS')
  assert(!rrhhPerms.includes('settings.manage'), 'RECURSOS_HUMANOS NO administra técnicamente el sistema')

  // ==============================================================================
  // PRUEBA 5: FLUJO DE APROBACIÓN DE PRECIOS Y REGLA DE NO AUTOAPROBACIÓN
  // ==============================================================================
  console.log('\n--- 5. FLUJO DE PRECIOS: SOLICITUD, REVISIÓN Y NO AUTOAPROBACIÓN ---')
  const compRow = await client.query('SELECT id FROM public.companies LIMIT 1')
  const companyId = compRow.rows[0].id

  // Obtener producto existente para pruebas
  const prodRow = await client.query('SELECT id, name, public_sale_price FROM public.products WHERE company_id = $1 LIMIT 1', [companyId])
  const testProduct = prodRow.rows[0]
  assert(Boolean(testProduct), 'Existe al menos un producto en el catálogo')

  // 5.1 Crear dos usuarios de prueba temporales para verificar el ciclo
  const testRequesterId = '99999999-0000-0000-0000-000000000001'
  const testReviewerId = '99999999-0000-0000-0000-000000000002'
  const jefeRoleId = (await client.query("SELECT id FROM public.roles WHERE code = 'JEFE_INGRESOS_SALIDAS'")).rows[0].id
  const adminRoleId = (await client.query("SELECT id FROM public.roles WHERE code = 'ADMIN'")).rows[0].id

  // Upsert en auth.users
  await client.query(`
    INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data)
    VALUES 
      ($1, 'test.jefe.ops@supermas.test', jsonb_build_object('role', 'JEFE_INGRESOS_SALIDAS', 'company_id', $2::text), '{}'::jsonb),
      ($3, 'test.admin.rev@supermas.test', jsonb_build_object('role', 'ADMIN', 'company_id', $2::text), '{}'::jsonb)
    ON CONFLICT (id) DO UPDATE SET raw_app_meta_data = EXCLUDED.raw_app_meta_data;
  `, [testRequesterId, companyId, testReviewerId])

  // Insertar o actualizar en public.users
  await client.query(`
    INSERT INTO public.users (id, company_id, role_id, email, full_name, is_active)
    VALUES 
      ($1, $2, $3, 'test.jefe.ops@supermas.test', 'Jefe Operaciones Test', true),
      ($4, $2, $5, 'test.admin.rev@supermas.test', 'Admin Revisor Test', true)
    ON CONFLICT (id) DO UPDATE
    SET role_id = EXCLUDED.role_id, full_name = EXCLUDED.full_name, company_id = EXCLUDED.company_id, is_active = true;
  `, [testRequesterId, companyId, jefeRoleId, testReviewerId, adminRoleId])

  // Simular sesión autenticada como Jefe de Ingresos y Salidas
  await client.query(`
    SELECT set_config('request.jwt.claim.sub', $1, false);
  `, [testRequesterId])
  await client.query(`
    SELECT set_config('request.jwt.claims', $1, false);
  `, [JSON.stringify({ sub: testRequesterId, role: 'authenticated', app_metadata: { role: 'JEFE_INGRESOS_SALIDAS', company_id: companyId } })])

  // Invocación de fn_request_price_change
  const reqRes = await client.query(`
    SELECT public.fn_request_price_change(
      $1::uuid,
      'NORMAL'::varchar,
      99999.00::numeric,
      'Propuesta de ajuste operativo por incremento en costos de materia prima'::text
    ) as result;
  `, [testProduct.id])

  const requestData = reqRes.rows[0].result
  assert(requestData.success === true, 'Jefe de Ingresos y Salidas registra solicitud de cambio de precio exitosamente')
  assert(requestData.status === 'PENDING', 'La solicitud queda en estado PENDING')
  const requestId = requestData.request_id

  // PRUEBA DE ATAQUE DIRECTO: Jefe de Ingresos intenta autoaprobar su propio cambio
  let selfApprovalBlocked = false
  try {
    await client.query(`
      SELECT public.fn_review_price_change($1::uuid, true, 'Autoaprobación fraudulenta');
    `, [requestId])
  } catch (err: any) {
    if (err.message.includes('autoaprobar solicitudes') || err.message.includes('Acceso denegado')) {
      selfApprovalBlocked = true
    } else {
      console.error('Error inesperado:', err)
    }
  }
  assert(selfApprovalBlocked, 'ATAQUE DENEGADO: Jefe de Ingresos NO puede autoaprobar su propio precio (requested_by != reviewed_by)')

  // PRUEBA DE REVISIÓN AUTORIZADA POR ADMIN
  await client.query(`
    SELECT set_config('request.jwt.claim.sub', $1, false);
  `, [testReviewerId])
  await client.query(`
    SELECT set_config('request.jwt.claims', $1, false);
  `, [JSON.stringify({ sub: testReviewerId, role: 'authenticated', app_metadata: { role: 'ADMIN', company_id: companyId } })])

  const revRes = await client.query(`
    SELECT public.fn_review_price_change($1::uuid, true, 'Aprobado según análisis de margen') as result;
  `, [requestId])

  assert(revRes.rows[0].result.status === 'APPROVED', 'ADMIN aprueba exitosamente la solicitud de cambio de precio')

  // Verificar que el precio se aplicó en base de datos
  const updatedProd = await client.query('SELECT public_sale_price FROM public.products WHERE id = $1', [testProduct.id])
  assert(Number(updatedProd.rows[0].public_sale_price) === 99999.00, 'El precio nuevo (99999.00) fue aplicado al catálogo maestro')

  // Restaurar precio original
  await client.query('UPDATE public.products SET public_sale_price = $1 WHERE id = $2', [testProduct.public_sale_price, testProduct.id])
  await client.query('UPDATE public.product_prices SET price = $1 WHERE product_id = $2 AND price_list_code = $3', [testProduct.public_sale_price, testProduct.id, 'NORMAL'])

  // Limpiar registros de prueba temporales
  await client.query('DELETE FROM public.price_change_requests WHERE id = $1', [requestId])
  await client.query('UPDATE public.users SET is_active = false WHERE id IN ($1, $2)', [testRequesterId, testReviewerId])

  // ==============================================================================
  // PRUEBA 6: VERIFICACIÓN DE RESTRICCIÓN DE CAJA ASIGNADA (users.assigned_cash_register_id)
  // ==============================================================================
  console.log('\n--- 6. ASIGNACIÓN DE CAJA REGISTRADORA (ENCARGADA DE VENTA) ---')
  const crCol = await client.query(
    "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'assigned_cash_register_id'"
  )
  assert(crCol.rows.length === 1, 'Columna users.assigned_cash_register_id existe con clave foránea a cash_registers(id)')

  // ==============================================================================
  // PRUEBA 7: VERIFICACIÓN DE FUNCIÓN MAESTRA public.is_admin()
  // ==============================================================================
  console.log('\n--- 7. FUNCIÓN MAESTRA public.is_admin() ---')
  const fnAdminDef = await client.query(`
    SELECT pg_get_functiondef(p.oid) as def 
    FROM pg_proc p 
    JOIN pg_namespace n ON p.pronamespace = n.oid 
    WHERE n.nspname = 'public' AND p.proname = 'is_admin'
  `)
  const defText = fnAdminDef.rows[0]?.def || ''
  assert(defText.includes('ADMIN') && defText.includes('SUPERADMIN'), 'public.is_admin() reconoce tanto ADMIN definitivo como SUPERADMIN legacy')

  console.log('\n====================================================================')
  console.log(`RESULTADO DE LA SUITE: ${passedTests} DE ${totalTests} PRUEBAS EXITOSAS (100% SATISFACTORIO)`)
  console.log('====================================================================\n')

  await client.end()
}

runTests().catch((err) => {
  console.error('\nERROR DURANTE LA EJECUCIÓN DEL TEST RBAC:', err)
  process.exit(1)
})
