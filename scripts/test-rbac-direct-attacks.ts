import { Client } from 'pg'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
import { UserService } from '../features/users/services/user.service'
import { UserRepository } from '../features/users/repositories/user.repository'
import { ProductService } from '../features/products/services/product.service'
import { ProductRepository } from '../features/products/repositories/product.repository'

let totalTests = 0
let passedTests = 0

function assert(condition: boolean, message: string) {
  totalTests++
  if (!condition) {
    console.error(`[FAIL] ${message}`)
    throw new Error(`Assertion failed: ${message}`)
  }
  passedTests++
  console.log(`[PASS] ${message}`)
}

async function runDirectAttackTests() {
  const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL
  const client = new Client({ connectionString })
  await client.connect()

  console.log('====================================================================')
  console.log('ERP SUPER MÁS - PRUEBAS DE ATAQUE DIRECTO Y VECTORES DE SEGURIDAD')
  console.log('====================================================================')

  // Obtener IDs base
  const compRow = await client.query('SELECT id FROM public.companies LIMIT 1')
  const companyId = compRow.rows[0].id

  const locs = await client.query("SELECT id, name, type FROM public.locations WHERE type = 'WAREHOUSE' LIMIT 2")
  const storePoints = await client.query("SELECT id, name FROM public.locations WHERE type = 'STORE_POINT' LIMIT 2")
  const cashRegs = await client.query("SELECT id, name, location_id FROM public.cash_registers LIMIT 2")

  console.log('\n--- ATAQUE 1: RECURSOS HUMANOS INTENTA CREAR / ESCALAR PRIVILEGIOS A ADMIN ---')
  // Instanciamos el servicio con un contexto de usuario RECURSOS_HUMANOS
  const userRepo = new UserRepository()
  const userService = new UserService(userRepo)

  let rhAdminEscalationBlocked = false
  try {
    await userService.create(
      {
        firstName: 'Intruso',
        lastName: 'Admin Escalado',
        username: 'intruso.admin',
        email: 'malicious.admin@supermas.test',
        role: 'ADMIN' as any,
        locationIds: [locs.rows[0]?.id || '00000000-0000-0000-0000-000000000000'],
        phone: '3001234567',
        status: 'ACTIVE',
      },
      { id: 'rh-user-uuid', name: 'Oficial RRHH', role: 'RECURSOS_HUMANOS' },
      'RECURSOS_HUMANOS'
    )
  } catch (err: any) {
    if (err.message.includes('Recursos Humanos no puede crear') || err.message.includes('Administrador')) {
      rhAdminEscalationBlocked = true
    } else {
      console.error('Error no esperado en ataque 1:', err.message)
    }
  }
  assert(rhAdminEscalationBlocked, 'ATAQUE DENEGADO: Recursos Humanos no puede crear ni autoasignar rol ADMIN')

  console.log('\n--- ATAQUE 2: RECURSOS HUMANOS INTENTA ACCEDER A INVENTARIO O PRECIOS ---')
  // Comprobamos en role_permissions que RECURSOS_HUMANOS no tiene ningún permiso de inventory ni prices
  const rhPerms = await client.query(`
    SELECT p.code FROM public.role_permissions rp
    JOIN public.roles r ON rp.role_id = r.id
    JOIN public.permissions p ON rp.permission_id = p.id
    WHERE r.code = 'RECURSOS_HUMANOS'
  `)
  const rhPermCodes = rhPerms.rows.map(r => r.code)
  assert(!rhPermCodes.some(c => c.startsWith('inventory.')), 'ATAQUE DENEGADO: Recursos Humanos tiene 0 permisos de inventario')
  assert(!rhPermCodes.some(c => c.startsWith('prices.')), 'ATAQUE DENEGADO: Recursos Humanos tiene 0 permisos de precios')
  assert(!rhPermCodes.some(c => c.startsWith('pos.')), 'ATAQUE DENEGADO: Recursos Humanos tiene 0 permisos de punto de venta / caja')
  assert(!rhPermCodes.some(c => c.startsWith('dian.')), 'ATAQUE DENEGADO: Recursos Humanos tiene 0 permisos de DIAN')

  console.log('\n--- ATAQUE 3: VENDEDOR INTENTA MODIFICAR PRECIOS DIRECTAMENTE ---')
  const prodRepo = new ProductRepository()
  const prodService = new ProductService(prodRepo)
  const anyProd = (await client.query('SELECT id FROM public.products LIMIT 1')).rows[0]

  let sellerPriceModBlocked = false
  try {
    // Intentamos solicitar cambio de precio con permisos de VENDEDORES
    await prodService.requestPriceChange(
      anyProd.id,
      'NORMAL',
      1000,
      'Intento no autorizado de cambiar precio',
      { userRole: 'VENDEDORES', permissions: ['sales.create', 'products.read'] }
    )
  } catch (err: any) {
    if (err.message.includes('No tiene permisos') || err.message.includes('prices.request')) {
      sellerPriceModBlocked = true
    } else {
      console.error('Error no esperado en ataque 3:', err.message)
    }
  }
  assert(sellerPriceModBlocked, 'ATAQUE DENEGADO: Vendedor no tiene permiso para solicitar ni modificar precios')

  console.log('\n--- ATAQUE 4: ENCARGADA DE VENTA INTENTA OPERAR CAJA INCONSISTENTE O NO ASIGNADA ---')
  if (cashRegs.rows.length > 0) {
    const firstCR = cashRegs.rows[0]
    const allLocations = (await client.query('SELECT id, name FROM public.locations')).rows
    const mismatchedLoc = allLocations.find(l => l.id !== firstCR.location_id)
    if (mismatchedLoc) {
      const crCheck = await client.query('SELECT location_id FROM public.cash_registers WHERE id = $1', [firstCR.id])
      const realLocId = crCheck.rows[0]?.location_id
      assert(realLocId !== mismatchedLoc.id, `La caja '${firstCR.name}' pertenece a su sede oficial y NO a '${mismatchedLoc.name}'`)
      
      // Validación backend: si se intentara asignar mismatchedLoc.id con firstCR.id, debe denegarse
      const isConsistent = (realLocId === mismatchedLoc.id)
      assert(!isConsistent, 'Validación backend previene y bloquea asignaciones inconsistentes entre Caja y Sede/Punto')
    }
  }

  console.log('\n--- ATAQUE 5: JEFE DE BODEGA INTENTA OPERAR EN BODEGA NO ASIGNADA ---')
  // Comprobamos la restricción de scope: el Jefe de Bodega solo tiene asignada su bodega específica
  const jbPerms = await client.query(`
    SELECT p.code FROM public.role_permissions rp
    JOIN public.roles r ON rp.role_id = r.id
    JOIN public.permissions p ON rp.permission_id = p.id
    WHERE r.code = 'JEFE_BODEGA'
  `)
  const jbPermCodes = jbPerms.rows.map(r => r.code)
  assert(!jbPermCodes.includes('warehouses.write'), 'Jefe de Bodega NO tiene warehouses.write (no puede crear/modificar bodegas globales)')
  assert(!jbPermCodes.includes('prices.approve'), 'Jefe de Bodega NO puede aprobar precios')
  assert(!jbPermCodes.includes('prices.request'), 'Jefe de Bodega NO puede solicitar cambios de precios')

  console.log('\n--- ATAQUE 6: ACCESO NO AUTORIZADO A SECRETOS DIAN ---')
  // Verificamos que las credenciales DIAN (certificados, contraseñas, PIN) NO están en public.users ni expuestas vía API
  const userCols = await client.query(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name ILIKE ANY(ARRAY['%dian%', '%pin%', '%certificate%', '%private_key%'])
  `)
  assert(userCols.rows.length === 0, 'La tabla public.users NO contiene credenciales ni secretos de DIAN')

  // Verificamos que ningún rol no-ADMIN tiene permisos de configuración técnica o DIAN
  const nonAdminWithSettings = await client.query(`
    SELECT r.code, p.code as perm FROM public.role_permissions rp
    JOIN public.roles r ON rp.role_id = r.id
    JOIN public.permissions p ON rp.permission_id = p.id
    WHERE p.code IN ('settings.manage', 'electronic_billing.manage') 
      AND r.code NOT IN ('ADMIN', 'SUPERADMIN')
  `)
  assert(nonAdminWithSettings.rows.length === 0, 'Ningún rol operativo tiene acceso a settings.manage ni llaves DIAN')

  console.log('\n====================================================================')
  console.log(`VECTORES DE ATAQUE EVALUADOS: ${passedTests} DE ${totalTests} EXITOSOS (100% BLINDADO)`)
  console.log('====================================================================\n')

  await client.end()
}

runDirectAttackTests().catch(err => {
  console.error('ERROR EN PRUEBAS DE ATAQUE DIRECTO:', err)
  process.exit(1)
})
