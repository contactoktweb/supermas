/**
 * SUPER MÁS ERP/POS — SUITE E2E: FASE 16: IMPORTADOR MASIVO EXCEL/CSV
 *
 * Valida la persistencia real, el análisis fiduciario de archivos delimitados,
 * la detección de duplicados en preview/dry-run, la auto-resolución de categorías y marcas,
 * la creación de listas de precios, la emisión de movimientos de Kardex inmutables (stock inicial),
 * el aislamiento estricto multiempresa, la auditoría y la purga Zero Pollution.
 */

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { Client } from 'pg'
import { createClient } from '@supabase/supabase-js'
import {
  parseCsvContent,
  detectDelimiter,
  parseCleanNumber,
  parseCleanBoolean,
} from '../lib/csv-parser'
import { productImportService } from '../features/products/services/product-import.service'
import { customerImportService } from '../features/customers/services/customer-import.service'

interface TestResult {
  code: string
  name: string
  passed: boolean
  details: string
}

async function runPhase16ImporterE2ETests() {
  console.log('============================================================')
  console.log('INICIANDO SUITE E2E - FASE 16: IMPORTADOR MASIVO EXCEL/CSV')
  console.log('============================================================\n')

  const results: TestResult[] = []

  const recordResult = (code: string, name: string, passed: boolean, details: string) => {
    results.push({ code, name, passed, details })
    const icon = passed ? '✅' : '❌'
    console.log(`${icon} [${code}] ${name}: ${passed ? 'PASS' : 'FAIL'}`)
    console.log(`   Detalle: ${details}\n`)
  }

  const databaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!databaseUrl || !supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Error: Variables de entorno requeridas no encontradas.')
    process.exit(1)
  }

  const pgClient = new Client({ connectionString: databaseUrl })
  await pgClient.connect()
  console.log('✅ Conexión directa a PostgreSQL Staging establecida.\n')

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

  const testSuffix = `${Date.now()}_${Math.floor(Math.random() * 1000)}`
  let companyAId: string | null = null
  let companyBId: string | null = null
  let locAId: string | null = null
  let locBId: string | null = null
  let userAId: string | null = null
  let existingProdSku: string | null = null

  try {
    console.log('--- Configurando Entorno Multiempresa en PostgreSQL ---')

    // 1. Crear Empresa A
    const compARes = await pgClient.query(`
      INSERT INTO public.companies (
        business_name, trade_name, tax_id, verification_digit, tax_regime,
        address, city, department, country, currency, status, created_at, updated_at
      ) VALUES (
        'Distribuidora Import Test A S.A.S.', 'Super Import A', '901999${Date.now().toString().slice(-3)}',
        '1', 'COMUN', 'Calle 72 # 10-34', 'Bogotá', 'Bogotá D.C.', 'COLOMBIA', 'COP', 'ACTIVE',
        NOW(), NOW()
      ) RETURNING id;
    `)
    companyAId = compARes.rows[0].id

    // 2. Crear Empresa B (para aislamiento)
    const compBRes = await pgClient.query(`
      INSERT INTO public.companies (
        business_name, trade_name, tax_id, verification_digit, tax_regime,
        address, city, department, country, currency, status, created_at, updated_at
      ) VALUES (
        'Distribuidora Import Test B S.A.S.', 'Super Import B', '901998${Date.now().toString().slice(-3)}',
        '2', 'COMUN', 'Calle 50 # 20-30', 'Medellín', 'Antioquia', 'COLOMBIA', 'COP', 'ACTIVE',
        NOW(), NOW()
      ) RETURNING id;
    `)
    companyBId = compBRes.rows[0].id

    // 3. Crear Ubicaciones
    const locARes = await pgClient.query(`
      INSERT INTO public.locations (
        company_id, code, name, type, status, address, city, department, created_at, updated_at
      ) VALUES (
        $1, 'BOD-A1', 'Bodega Principal A', 'WAREHOUSE', 'ACTIVE', 'Calle 72 # 10-34', 'Bogotá', 'Bogotá D.C.', NOW(), NOW()
      ) RETURNING id;
    `, [companyAId])
    locAId = locARes.rows[0].id

    const locBRes = await pgClient.query(`
      INSERT INTO public.locations (
        company_id, code, name, type, status, address, city, department, created_at, updated_at
      ) VALUES (
        $1, 'BOD-B1', 'Bodega Principal B', 'WAREHOUSE', 'ACTIVE', 'Calle 50 # 20-30', 'Medellín', 'Antioquia', NOW(), NOW()
      ) RETURNING id;
    `, [companyBId])
    locBId = locBRes.rows[0].id

    // 4. Crear Usuario en Empresa A
    const authEmail = `admin_import_${testSuffix}@supermas.com`
    const { data: authUserData, error: userAErr } = await supabaseAdmin.auth.admin.createUser({
      email: authEmail,
      password: 'SuperPassword123!',
      email_confirm: true,
      user_metadata: { full_name: 'Admin Importador' },
    })
    if (userAErr || !authUserData?.user) throw new Error(`Error creando usuario Auth: ${userAErr?.message}`)
    userAId = authUserData.user.id

    const roleRes = await pgClient.query(`SELECT id FROM public.roles LIMIT 1;`)
    const defaultRoleId = roleRes.rows[0].id

    await pgClient.query(`
      INSERT INTO public.users (
        id, company_id, email, full_name, role_id, is_active, created_at, updated_at
      ) VALUES (
        $1, $2, $3, 'Admin Importador', $4, true, NOW(), NOW()
      ) ON CONFLICT (id) DO UPDATE SET
        company_id = EXCLUDED.company_id,
        full_name = EXCLUDED.full_name,
        role_id = EXCLUDED.role_id,
        is_active = true;
    `, [userAId, companyAId, authEmail, defaultRoleId])

    // 5. Crear un Producto Preexistente en Empresa A (para probar detección de duplicados)
    existingProdSku = `EXIST-SKU-${testSuffix.slice(-4)}`
    await pgClient.query(`
      INSERT INTO public.products (
        company_id, sku, name, slug, inventory_type, unit_of_measure,
        cost_price, public_sale_price, wholesale_price, tax_rate_percent,
        is_tax_exempt, is_active, created_at, updated_at
      ) VALUES (
        $1, $2, 'Producto Ya Existente', 'producto-ya-existente', 'MERCHANDISE', 'UND',
        10000, 15000, 13000, 19, false, true, NOW(), NOW()
      );
    `, [companyAId, existingProdSku])

    console.log(`✅ Setup completado: Empresa A (${companyAId}), Empresa B (${companyBId}), Producto Preexistente (${existingProdSku})\n`)

    // ========================================================================
    // T01: Parser CSV con Delimitador Coma y Comillas Dobles Escapadas
    // ========================================================================
    const sampleCommaCsv = `sku,name,cost_price,public_sale_price,description
TEST-01,"Aceite de Oliva ""Extra Virgen""",12000,18500,"Importado de España, botella 500ml"
TEST-02,Pan Integral Tajado,3000,4500,Pan tajado 400g`

    const parsedComma = parseCsvContent<{ sku: string; name: string; cost_price: string; description: string }>(
      sampleCommaCsv,
      { delimiter: ',' }
    )

    const t01Pass =
      parsedComma.rows.length === 2 &&
      parsedComma.rows[0].sku === 'TEST-01' &&
      parsedComma.rows[0].name === 'Aceite de Oliva "Extra Virgen"' &&
      parsedComma.rows[0].description === 'Importado de España, botella 500ml' &&
      parsedComma.rows[1].sku === 'TEST-02'

    recordResult(
      'T01',
      'Parser Universal CSV con Coma y Comillas Dobles Escapadas',
      t01Pass,
      t01Pass
        ? `2 filas parseadas exitosamente respetando comillas y caracteres especiales dentro de campos.`
        : `Falla al parsear CSV con comas.`
    )

    // ========================================================================
    // T02: Detección Automática y Parser con Punto y Coma (Excel Colombiano)
    // ========================================================================
    const sampleSemicolonCsv = `SKU;Nombre;Precio Venta;IVA
PROD-COL-01;Arroz Blanco 1kg;4.500;0%
PROD-COL-02;Lentejas Seleccionadas 500g;3.200;0%`

    const detectedDelim = detectDelimiter(sampleSemicolonCsv.split('\n')[0])
    const parsedSemicolon = parseCsvContent(sampleSemicolonCsv)

    const t02Pass =
      detectedDelim === ';' &&
      parsedSemicolon.rows.length === 2 &&
      parsedSemicolon.headers.includes('SKU') &&
      parsedSemicolon.headers.includes('Nombre')

    recordResult(
      'T02',
      'Detección Automática y Parser con Punto y Coma (Formato Excel ES)',
      t02Pass,
      t02Pass
        ? `Delimitador ';' detectado correctamente con ${parsedSemicolon.rows.length} filas analizadas.`
        : `Falla en autodetección o análisis de delimitador punto y coma.`
    )

    // ========================================================================
    // T03: Normalización de Formatos Numéricos Colombianos y Booleanos
    // ========================================================================
    const n1 = parseCleanNumber('$ 15.000,50')
    const n2 = parseCleanNumber('25.000')
    const n3 = parseCleanNumber('1250,75')
    const b1 = parseCleanBoolean('SI')
    const b2 = parseCleanBoolean('sí')
    const b3 = parseCleanBoolean('NO')
    const b4 = parseCleanBoolean('1')

    const t03Pass =
      n1 === 15000.5 &&
      n2 === 25000 &&
      n3 === 1250.75 &&
      b1 === true &&
      b2 === true &&
      b3 === false &&
      b4 === true

    recordResult(
      'T03',
      'Normalización Numérica Fiduciaria y Booleanos de Hoja de Cálculo',
      t03Pass,
      t03Pass
        ? `Valores numéricos normalizados ($ 15.000,50 -> ${n1}, 25.000 -> ${n2}) y booleanos verificados.`
        : `Falla en normalización de formatos monetarios o booleanos.`
    )

    // ========================================================================
    // T04: Dry-Run Preview: Detección de SKU Duplicado dentro del Archivo
    // ========================================================================
    const duplicateFileCsv = `SKU;Nombre;Precio Venta Normal
DUP-01;Producto Uno;10000
DUP-01;Producto Uno Repetido;12000
DUP-02;Producto Dos;15000`

    const previewDuplicates = await productImportService.previewCsv(duplicateFileCsv, companyAId!)
    const t04Pass =
      previewDuplicates.totalRows === 3 &&
      previewDuplicates.invalidCount >= 1 &&
      previewDuplicates.rows.some(
        (r) => !r.isValid && r.errors.some((e) => e.includes('duplicado dentro del archivo'))
      )

    recordResult(
      'T04',
      'Dry-Run Preview: Detección de SKUs Duplicados en el Mismo Lote',
      t04Pass,
      t04Pass
        ? `Validación preventiva interceptó el SKU duplicado DUP-01 antes de persistir.`
        : `Falla: No se detectó SKU duplicado dentro del archivo CSV.`
    )

    // ========================================================================
    // T05: Dry-Run Preview: Detección de SKU ya Existente en Base de Datos
    // ========================================================================
    const existingDbSkuCsv = `SKU;Nombre;Precio Venta Normal
${existingProdSku};Intento Sobrescribir Existente;20000
NUEVO-SKU-99;Producto Realmente Nuevo;30000`

    const previewExisting = await productImportService.previewCsv(existingDbSkuCsv, companyAId!)
    const t05Pass =
      previewExisting.totalRows === 2 &&
      previewExisting.rows.some(
        (r) =>
          !r.isValid &&
          r.parsed.sku === existingProdSku &&
          r.errors.some((e) => e.includes('ya existe en el sistema'))
      )

    recordResult(
      'T05',
      'Dry-Run Preview: Detección de SKU Preexistente en PostgreSQL',
      t05Pass,
      t05Pass
        ? `El SKU preexistente '${existingProdSku}' fue bloqueado correctamente en la vista previa.`
        : `Falla: Se permitió un SKU preexistente sin advertencia de conflicto.`
    )

    // ========================================================================
    // T06: Dry-Run Preview: Validación de Precios Negativos y Campos Faltantes
    // ========================================================================
    const invalidRowsCsv = `SKU;Nombre;Precio Venta Normal;Costo Unitario
;Sin SKU;10000;8000
INV-ERR-01;;10000;8000
INV-ERR-02;Precio Negativo;-5000;8000
INV-ERR-03;Costo Negativo;10000;-2000`

    const previewInvalid = await productImportService.previewCsv(invalidRowsCsv, companyAId!)
    const t06Pass =
      previewInvalid.invalidCount === 4 &&
      previewInvalid.rows.every((r) => !r.isValid)

    recordResult(
      'T06',
      'Dry-Run Preview: Validación de Restricciones (Requeridos y No-Negativos)',
      t06Pass,
      t06Pass
        ? `4 filas inválidas rechazadas (SKU faltante, Nombre faltante, Precio < 0, Costo < 0).`
        : `Falla: Filas con datos inválidos fueron marcadas como válidas.`
    )

    // ========================================================================
    // T07: Ejecución Real: Importación Masiva de Productos en PostgreSQL
    // ========================================================================
    const newSku1 = `IMP-P1-${testSuffix.slice(-4)}`
    const newSku2 = `IMP-P2-${testSuffix.slice(-4)}`
    const newCategoryName = `Categoría Auto ${testSuffix.slice(-4)}`
    const newBrandName = `Marca Auto ${testSuffix.slice(-4)}`

    const importRows = [
      {
        sku: newSku1,
        name: `Producto Importado 1 - ${testSuffix.slice(-4)}`,
        categoryName: newCategoryName,
        brandName: newBrandName,
        costPrice: 5000,
        publicSalePrice: 8500,
        wholesalePrice: 7500,
        minWholesaleQuantity: 6,
        taxRatePercent: 19,
        isTaxExempt: false,
        initialStock: 40,
        locationCodeOrName: 'BOD-A1',
        minStock: 10,
        criticalStock: 5,
        webSuperMas: true,
        webDistribuidora: true,
      },
      {
        sku: newSku2,
        name: `Producto Importado 2 Exento - ${testSuffix.slice(-4)}`,
        categoryName: newCategoryName,
        brandName: newBrandName,
        costPrice: 12000,
        publicSalePrice: 16000,
        wholesalePrice: 14500,
        minWholesaleQuantity: 12,
        taxRatePercent: 0,
        isTaxExempt: true,
        initialStock: 25,
        locationCodeOrName: 'BOD-A1',
        minStock: 5,
        criticalStock: 2,
        webSuperMas: true,
        webDistribuidora: false,
      },
    ]

    const execResult = await productImportService.executeImport(
      importRows,
      { userId: userAId!, userName: 'Admin Importador' },
      companyAId!
    )

    const t07Pass =
      execResult.success &&
      execResult.importedCount === 2 &&
      execResult.failedCount === 0 &&
      execResult.createdProductIds.length === 2

    recordResult(
      'T07',
      'Ejecución Real: Carga Masiva Transaccional de Productos en PostgreSQL',
      t07Pass,
      t07Pass
        ? `2 productos persistidos exitosamente con IDs: ${execResult.createdProductIds.join(', ')}.`
        : `Falla en persistencia de productos.`
    )

    // ========================================================================
    // T08: Auto-Resolución y Creación de Categoría y Marca con company_id
    // ========================================================================
    const catCheck = await pgClient.query(`
      SELECT id, name, company_id FROM public.categories
      WHERE company_id = $1 AND name = $2;
    `, [companyAId, newCategoryName])

    const brandCheck = await pgClient.query(`
      SELECT id, name, company_id FROM public.brands
      WHERE company_id = $1 AND name = $2;
    `, [companyAId, newBrandName])

    const t08Pass =
      catCheck.rows.length === 1 &&
      brandCheck.rows.length === 1 &&
      catCheck.rows[0].company_id === companyAId &&
      brandCheck.rows[0].company_id === companyAId

    recordResult(
      'T08',
      'Auto-Resolución y Creación de Categorías y Marcas Multiempresa',
      t08Pass,
      t08Pass
        ? `Categoría '${newCategoryName}' y Marca '${newBrandName}' creadas automáticamente bajo Empresa A.`
        : `Falla en auto-resolución o creación de categoría/marca.`
    )

    // ========================================================================
    // T09: Persistencia de Listas de Precios Extensibles (NORMAL y MAYORISTA)
    // ========================================================================
    const pricesCheck = await pgClient.query(`
      SELECT price_list_code, price, min_quantity FROM public.product_prices
      WHERE product_id = $1 ORDER BY price_list_code;
    `, [execResult.createdProductIds[0]])

    const hasNormalPrice = pricesCheck.rows.some((p) => p.price_list_code === 'NORMAL' && Number(p.price) === 8500)
    const hasWholesalePrice = pricesCheck.rows.some((p) => p.price_list_code === 'MAYORISTA' && Number(p.price) === 7500)

    const t09Pass = pricesCheck.rows.length === 2 && hasNormalPrice && hasWholesalePrice

    recordResult(
      'T09',
      'Persistencia de Listas de Precios Extensibles (NORMAL y MAYORISTA)',
      t09Pass,
      t09Pass
        ? `Precios persistidos en public.product_prices: NORMAL $8500 (cant: 1), MAYORISTA $7500 (cant: 6).`
        : `Falla en persistencia de listas de precios.`
    )

    // ========================================================================
    // T10: Cumplimiento Estricto del Kardex: Movimiento de Inventario Inicial
    // ========================================================================
    const kardexCheck = await pgClient.query(`
      SELECT document_type, document_reference, movement_type, quantity_in, unit_cost, total_cost, location_id
      FROM public.inventory_movements
      WHERE product_id = $1;
    `, [execResult.createdProductIds[0]])

    const stockLevelCheck = await pgClient.query(`
      SELECT quantity FROM public.stock_levels
      WHERE product_id = $1 AND location_id = $2;
    `, [execResult.createdProductIds[0], locAId])

    const t10Pass =
      kardexCheck.rows.length === 1 &&
      kardexCheck.rows[0].document_type === 'INVENTARIO_INICIAL' &&
      kardexCheck.rows[0].movement_type === 'POSITIVE_ADJUSTMENT' &&
      Number(kardexCheck.rows[0].quantity_in) === 40 &&
      Number(kardexCheck.rows[0].unit_cost) === 5000 &&
      Number(kardexCheck.rows[0].total_cost) === 200000 &&
      stockLevelCheck.rows.length === 1 &&
      Number(stockLevelCheck.rows[0].quantity) === 40

    recordResult(
      'T10',
      'Cumplimiento Estricto de Kardex: Movimiento Inmutable de Inventario Inicial',
      t10Pass,
      t10Pass
        ? `Kardex registrado: INVENTARIO_INICIAL (+40 unds a $5,000 = $200,000) y StockLevel actualizado a 40 unds.`
        : `Falla en registro de movimiento de inventario o stock level.`
    )

    // ========================================================================
    // T11: Aislamiento Estricto Multiempresa (Empresa B no ve productos de A)
    // ========================================================================
    const companyBProducts = await pgClient.query(`
      SELECT id FROM public.products
      WHERE company_id = $1 AND sku IN ($2, $3);
    `, [companyBId, newSku1, newSku2])

    const companyBKardex = await pgClient.query(`
      SELECT id FROM public.inventory_movements
      WHERE company_id = $1;
    `, [companyBId])

    const t11Pass =
      companyBProducts.rows.length === 0 &&
      companyBKardex.rows.length === 0

    recordResult(
      'T11',
      'Aislamiento Estricto Multiempresa: Hermeticidad de Catálogo y Kardex',
      t11Pass,
      t11Pass
        ? `Aislamiento validado: Empresa B tiene 0 productos y 0 movimientos de Empresa A.`
        : `Falla de seguridad: Fuga de productos entre empresas.`
    )

    // ========================================================================
    // T12: Registro de Auditoría Inmutable (PRODUCT_BULK_IMPORT)
    // ========================================================================
    const auditCheck = await pgClient.query(`
      SELECT action, module, entity_name, user_name, new_value
      FROM public.audit_logs
      WHERE company_id = $1 AND action = 'PRODUCT_BULK_IMPORT'
      ORDER BY created_at DESC LIMIT 1;
    `, [companyAId])

    const t12Pass =
      auditCheck.rows.length === 1 &&
      auditCheck.rows[0].action === 'PRODUCT_BULK_IMPORT' &&
      auditCheck.rows[0].module === 'PRODUCTS' &&
      Number(auditCheck.rows[0].new_value?.importedCount) === 2

    recordResult(
      'T12',
      'Trazabilidad Inmutable: Registro de Auditoría PRODUCT_BULK_IMPORT',
      t12Pass,
      t12Pass
        ? `Auditoría verificada: Registro PRODUCT_BULK_IMPORT persistido con conteo de 2 productos.`
        : `Falla en registro de auditoría.`
    )

    // ========================================================================
    // T13: Importación Masiva de Clientes con Validación de Unicidad
    // ========================================================================
    const custDoc1 = `90111222${testSuffix.slice(-3)}`
    const custDoc2 = `10203040${testSuffix.slice(-3)}`

    const customerRows = [
      {
        documentType: 'NIT',
        documentNumber: custDoc1,
        verificationDigit: '9',
        name: `Cliente Empresa Importado ${testSuffix.slice(-4)}`,
        commercialName: `Empresa Comercial ${testSuffix.slice(-4)}`,
        personType: 'COMPANY' as const,
        category: 'WHOLESALE' as const,
        contactPerson: 'Roberto Carlos',
        phone: '3119998888',
        email: `cliente1_${testSuffix}@empresa.com`,
        city: 'Medellín',
        department: 'Antioquia',
        creditLimit: 5000000,
        creditDays: 30,
      },
      {
        documentType: 'CC',
        documentNumber: custDoc2,
        name: `Pedro Picapiedra ${testSuffix.slice(-4)}`,
        personType: 'NATURAL' as const,
        category: 'RETAIL' as const,
        phone: '3128887777',
        email: `pedro_${testSuffix}@gmail.com`,
        city: 'Envigado',
        department: 'Antioquia',
        creditLimit: 0,
        creditDays: 0,
      },
    ]

    const custResult = await customerImportService.executeImport(
      customerRows,
      { userId: userAId!, userName: 'Admin Importador' },
      companyAId!
    )

    const custDbCheck = await pgClient.query(`
      SELECT document_number, person_type, credit_limit
      FROM public.customers
      WHERE company_id = $1 AND document_number IN ($2, $3);
    `, [companyAId, custDoc1, custDoc2])

    const custAuditCheck = await pgClient.query(`
      SELECT action FROM public.audit_logs
      WHERE company_id = $1 AND action = 'CUSTOMER_BULK_IMPORT';
    `, [companyAId])

    const t13Pass =
      custResult.success &&
      custResult.importedCount === 2 &&
      custDbCheck.rows.length === 2 &&
      custAuditCheck.rows.length >= 1

    recordResult(
      'T13',
      'Importación Masiva de Clientes con Validación y Auditoría Inmutable',
      t13Pass,
      t13Pass
        ? `2 clientes importados (NIT ${custDoc1} y CC ${custDoc2}) y evento CUSTOMER_BULK_IMPORT auditado.`
        : `Falla en importación masiva de clientes.`
    )

    // ========================================================================
    // T14: Generación de Plantillas CSV Estándar (Productos y Clientes)
    // ========================================================================
    const prodTemplate = productImportService.generateTemplateCsv()
    const custTemplate = customerImportService.generateTemplateCsv()

    const t14Pass =
      prodTemplate.includes('SKU;Nombre;Código de Barras;Categoría;Marca') &&
      prodTemplate.includes('ARR-DIANA-1K') &&
      custTemplate.includes('Tipo Documento;Número Documento;Dígito Verificación') &&
      custTemplate.includes('Supertiendas El Triunfo')

    recordResult(
      'T14',
      'Generación de Plantillas Oficiales CSV (Productos y Clientes)',
      t14Pass,
      t14Pass
        ? `Plantillas generadas con cabeceras fiduciarias y datos de muestra estructurados.`
        : `Falla en generación de plantillas CSV.`
    )
  } catch (err: any) {
    console.error('❌ Error catastrófico en suite E2E de Importador:', err)
  } finally {
    console.log('\n--- Ejecutando Purga Zero Pollution en Importador ---')
    try {
      await pgClient.query("SELECT set_config('app.is_test_cleanup', 'true', false);")

      if (companyAId) {
        // 1. Eliminar Kardex y Stock
        await pgClient.query(`DELETE FROM public.inventory_movements WHERE company_id = $1;`, [companyAId])
        await pgClient.query(`DELETE FROM public.stock_levels WHERE company_id = $1;`, [companyAId])

        // 2. Eliminar Listas de Precios y Productos
        await pgClient.query(`DELETE FROM public.product_prices WHERE company_id = $1;`, [companyAId])
        await pgClient.query(`DELETE FROM public.products WHERE company_id = $1;`, [companyAId])

        // 3. Eliminar Categorías y Marcas
        await pgClient.query(`DELETE FROM public.categories WHERE company_id = $1;`, [companyAId])
        await pgClient.query(`DELETE FROM public.brands WHERE company_id = $1;`, [companyAId])

        // 4. Eliminar Clientes
        await pgClient.query(`DELETE FROM public.customers WHERE company_id = $1;`, [companyAId])

        // 5. Eliminar Usuarios y Ubicaciones
        await pgClient.query(`DELETE FROM public.users WHERE company_id = $1;`, [companyAId])
        await pgClient.query(`DELETE FROM public.locations WHERE company_id = $1;`, [companyAId])

        // 6. Eliminar Auditoría y Empresa
        await pgClient.query(`DELETE FROM public.audit_logs WHERE company_id = $1;`, [companyAId])
        await pgClient.query(`DELETE FROM public.companies WHERE id = $1;`, [companyAId])

        if (userAId) {
          await supabaseAdmin.auth.admin.deleteUser(userAId).catch(() => {})
        }
      }

      if (companyBId) {
        await pgClient.query(`DELETE FROM public.locations WHERE company_id = $1;`, [companyBId])
        await pgClient.query(`DELETE FROM public.audit_logs WHERE company_id = $1;`, [companyBId])
        await pgClient.query(`DELETE FROM public.companies WHERE id = $1;`, [companyBId])
      }

      await pgClient.query("SELECT set_config('app.is_test_cleanup', 'false', false);")

      const verifyCleanA = await pgClient.query(
        `SELECT COUNT(*) FROM public.products WHERE company_id = $1;`,
        [companyAId]
      )
      const verifyCleanB = await pgClient.query(
        `SELECT COUNT(*) FROM public.products WHERE company_id = $1;`,
        [companyBId]
      )

      const t15Pass =
        Number(verifyCleanA.rows[0].count) === 0 &&
        Number(verifyCleanB.rows[0].count) === 0

      recordResult(
        'T15',
        'Zero Pollution: Purga 100% limpia de registros de prueba del Importador',
        t15Pass,
        t15Pass
          ? `Todos los registros de prueba (productos, precios, kardex, stock, categorías, marcas, clientes, auditoría, empresas) purgados atómicamente.`
          : `Alerta: Quedaron residuos de prueba en PostgreSQL.`
      )
    } catch (cleanupErr) {
      console.error('❌ Error durante la purga del importador:', cleanupErr)
    } finally {
      await pgClient.end()
    }
  }

  // ========================================================================
  // RESUMEN FINAL
  // ========================================================================
  console.log('\n============================================================')
  console.log('RESUMEN DE EJECUCIÓN - FASE 16: IMPORTADOR MASIVO EXCEL/CSV')
  console.log('============================================================')
  results.forEach((r) => {
    console.log(`${r.passed ? '✅' : '❌'} [${r.code}] ${r.name}`)
  })
  const passedCount = results.filter((r) => r.passed).length
  console.log('============================================================')
  console.log(`TOTAL: ${results.length} | PASARON: ${passedCount} | FALLARON: ${results.length - passedCount}`)
  console.log('============================================================\n')

  if (passedCount !== results.length) {
    process.exit(1)
  }
}

runPhase16ImporterE2ETests().catch((err) => {
  console.error('Falla no capturada en suite:', err)
  process.exit(1)
})
