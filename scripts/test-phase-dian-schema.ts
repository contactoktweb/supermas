/**
 * SUITE DE VALIDACIÓN RIGUROSA: MIGRACIÓN 053 Y MODELO DE DATOS DIAN (DIAN-2 & DIAN-3)
 * SUPER MÁS ERP/POS — STAGING POSTGRESQL
 */

import { Client } from 'pg'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

async function runDianSchemaTests() {
  const connStr = process.env.DATABASE_URL || process.env.DIRECT_URL
  if (!connStr) {
    throw new Error('No connection string available.')
  }

  const client = new Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false },
  })

  await client.connect()
  console.log('================================================================================')
  console.log('🧾 SUITE DE VALIDACIÓN: ESQUEMA Y REGLAS DE INTEGRIDAD DIAN (DIAN-2 & DIAN-3)')
  console.log('================================================================================\n')

  try {
    // -------------------------------------------------------------------------
    // 1. VERIFICACIÓN DE ESTRUCTURA Y COLUMNAS NUEVAS
    // -------------------------------------------------------------------------
    console.log('--- 1. VERIFICACIÓN DE COLUMNAS EN electronic_invoices ---')
    const colsRes = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'electronic_invoices';
    `)
    const colMap = new Map(colsRes.rows.map((r) => [r.column_name, r]))

    const expectedCols = [
      'id', 'company_id', 'location_id', 'sale_id', 'customer_id',
      'prefix', 'number', 'document_type', 'cufe', 'original_invoice_id',
      'return_id', 'idempotency_key', 'environment', 'software_id',
      'xml_unsigned', 'xml_signed', 'application_response_xml',
      'dian_status_code', 'dian_validation_errors', 'retry_count', 'last_retry_at'
    ]

    for (const c of expectedCols) {
      if (!colMap.has(c)) {
        throw new Error(`Columna esperada "${c}" no fue encontrada en electronic_invoices.`)
      }
    }
    console.log(`✅ Columnas verificadas (${colMap.size} columnas en electronic_invoices).\n`)

    // -------------------------------------------------------------------------
    // 2. VERIFICACIÓN DE TABLA dian_software_config
    // -------------------------------------------------------------------------
    console.log('--- 2. VERIFICACIÓN DE TABLA dian_software_config ---')
    const softColsRes = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'dian_software_config';
    `)
    const softCols = softColsRes.rows.map((r) => r.column_name)
    const expectedSoftCols = [
      'id', 'company_id', 'software_id', 'software_name', 'pin_secret_ref',
      'environment', 'operation_mode', 'certificate_alias', 'certificate_secret_ref',
      'certificate_issuer', 'test_set_id', 'is_active', 'created_at', 'updated_at'
    ]

    for (const sc of expectedSoftCols) {
      if (!softCols.includes(sc)) {
        throw new Error(`Columna "${sc}" no encontrada en dian_software_config.`)
      }
    }
    console.log('✅ Tabla dian_software_config verificada con soporte de referencias seguras.\n')

    // -------------------------------------------------------------------------
    // 3. PRUEBA TRANSACCIONAL DE CONSTRAINTS (BEGIN ... ROLLBACK)
    // -------------------------------------------------------------------------
    console.log('--- 3. PRUEBAS DE REGLAS DE INTEGRIDAD Y RESTRICCIONES (ENROLLADAS) ---')
    await client.query('BEGIN;')

    // Obtener IDs de prueba desde una venta existente
    const saleRes = await client.query('SELECT id, company_id, location_id, customer_id FROM sales LIMIT 1;')
    if (saleRes.rows.length === 0) {
      throw new Error('No se encontró ninguna venta en la base de datos para pruebas.')
    }
    const sampleSale = saleRes.rows[0]
    const companyA = sampleSale.company_id
    const locationId = sampleSale.location_id
    const customerId = sampleSale.customer_id
    const existingSaleId = sampleSale.id

    // Test 3.1: Factura (INVOICE) sin sale_id DEBE FALLAR
    let failedAsExpected = false
    await client.query('SAVEPOINT sp1;')
    try {
      await client.query(`
        INSERT INTO electronic_invoices (
          company_id, location_id, sale_id, customer_id, prefix, number,
          document_type, subtotal_amount, tax_amount, total_amount, dian_status
        ) VALUES (
          $1, $2, NULL, $3, 'FE', 999901,
          'INVOICE', 100000, 19000, 119000, 'PENDING'
        );
      `, [companyA, locationId, customerId])
    } catch (err: any) {
      if (err.message.includes('chk_electronic_invoices_doc_relationships')) {
        failedAsExpected = true
      }
      await client.query('ROLLBACK TO SAVEPOINT sp1;')
    }
    if (!failedAsExpected) {
      throw new Error('Fallo de seguridad: Se permitió insertar una factura INVOICE sin sale_id.')
    }
    console.log('✅ chk_electronic_invoices_doc_relationships bloqueó exitosamente factura sin sale_id.')

    // Test 3.2: Factura con sale_id se inserta exitosamente
    const invRes = await client.query(`
      INSERT INTO electronic_invoices (
        company_id, location_id, sale_id, customer_id, prefix, number,
        document_type, subtotal_amount, tax_amount, total_amount, dian_status,
        idempotency_key, environment
      ) VALUES (
        $1, $2, $3, $4, 'FE', 999901,
        'INVOICE', 100000, 19000, 119000, 'PENDING',
        'idem-test-001', 'HABILITACION'
      ) RETURNING id;
    `, [companyA, locationId, existingSaleId, customerId])
    const originalInvoiceId = invRes.rows[0].id
    console.log('✅ Factura válida con sale_id insertada exitosamente.')

    // Test 3.3: Nota Crédito sin original_invoice_id DEBE FALLAR
    failedAsExpected = false
    await client.query('SAVEPOINT sp2;')
    try {
      await client.query(`
        INSERT INTO electronic_invoices (
          company_id, location_id, sale_id, customer_id, prefix, number,
          document_type, subtotal_amount, tax_amount, total_amount, dian_status,
          original_invoice_id
        ) VALUES (
          $1, $2, NULL, $3, 'NC', 999902,
          'CREDIT_NOTE', 50000, 9500, 59500, 'PENDING',
          NULL
        );
      `, [companyA, locationId, customerId])
    } catch (err: any) {
      if (err.message.includes('chk_electronic_invoices_doc_relationships')) {
        failedAsExpected = true
      }
      await client.query('ROLLBACK TO SAVEPOINT sp2;')
    }
    if (!failedAsExpected) {
      throw new Error('Fallo de seguridad: Se permitió insertar una Nota Crédito sin original_invoice_id.')
    }
    console.log('✅ chk_electronic_invoices_doc_relationships bloqueó exitosamente Nota Crédito sin original_invoice_id.')

    // Test 3.4: Nota Crédito con original_invoice_id se inserta exitosamente
    await client.query(`
      INSERT INTO electronic_invoices (
        company_id, location_id, sale_id, customer_id, prefix, number,
        document_type, subtotal_amount, tax_amount, total_amount, dian_status,
        original_invoice_id, idempotency_key, environment
      ) VALUES (
        $1, $2, NULL, $3, 'NC', 999902,
        'CREDIT_NOTE', 50000, 9500, 59500, 'PENDING',
        $4, 'idem-test-002', 'HABILITACION'
      );
    `, [companyA, locationId, customerId, originalInvoiceId])
    console.log('✅ Nota Crédito con original_invoice_id insertada exitosamente.')

    // Test 3.5: Duplicación de idempotency_key dentro de la misma empresa DEBE FALLAR
    failedAsExpected = false
    await client.query('SAVEPOINT sp3;')
    try {
      await client.query(`
        INSERT INTO electronic_invoices (
          company_id, location_id, sale_id, customer_id, prefix, number,
          document_type, subtotal_amount, tax_amount, total_amount, dian_status,
          idempotency_key
        ) VALUES (
          $1, $2, $3, $4, 'FE', 999903,
          'INVOICE', 100000, 19000, 119000, 'PENDING',
          'idem-test-001'
        );
      `, [companyA, locationId, existingSaleId, customerId])
    } catch (err: any) {
      if (err.message.includes('uq_electronic_invoices_company_idempotency')) {
        failedAsExpected = true
      }
      await client.query('ROLLBACK TO SAVEPOINT sp3;')
    }
    if (!failedAsExpected) {
      throw new Error('Fallo de idempotencia: Se permitió duplicar idempotency_key en la misma empresa.')
    }
    console.log('✅ uq_electronic_invoices_company_idempotency evitó duplicación de clave de idempotencia.')

    // Test 3.6: Inmutabilidad de dian_events (Prohibición UPDATE y DELETE)
    const eventRes = await client.query(`
      INSERT INTO dian_events (
        invoice_id, company_id, event_type, status, environment, payload_sent
      ) VALUES (
        $1, $2, 'INVOICE_GENERATED', 'SUCCESS', 'HABILITACION', '{"test": true}'::jsonb
      ) RETURNING id;
    `, [originalInvoiceId, companyA])
    const eventId = eventRes.rows[0].id

    failedAsExpected = false
    await client.query('SAVEPOINT sp4;')
    try {
      await client.query('UPDATE dian_events SET status = $1 WHERE id = $2;', ['ERROR', eventId])
    } catch (err: any) {
      if (err.message.includes('INMUTABILIDAD FISCAL')) {
        failedAsExpected = true
      }
      await client.query('ROLLBACK TO SAVEPOINT sp4;')
    }
    if (!failedAsExpected) {
      throw new Error('Fallo de inmutabilidad: Se permitió UPDATE sobre dian_events.')
    }
    console.log('✅ trg_prevent_dian_event_modification bloqueó UPDATE sobre dian_events.')

    failedAsExpected = false
    await client.query('SAVEPOINT sp5;')
    try {
      await client.query('DELETE FROM dian_events WHERE id = $1;', [eventId])
    } catch (err: any) {
      if (err.message.includes('INMUTABILIDAD FISCAL')) {
        failedAsExpected = true
      }
      await client.query('ROLLBACK TO SAVEPOINT sp5;')
    }
    if (!failedAsExpected) {
      throw new Error('Fallo de inmutabilidad: Se permitió DELETE sobre dian_events.')
    }
    console.log('✅ trg_prevent_dian_event_modification bloqueó DELETE sobre dian_events.')

    // Rollback para garantizar ZERO POLLUTION
    await client.query('ROLLBACK;')
    console.log('✅ Transacción de prueba revertida (ROLLBACK) satisfactoriamente.\n')

    // -------------------------------------------------------------------------
    // 4. VERIFICACIÓN DE ZERO POLLUTION POST-TEST
    // -------------------------------------------------------------------------
    console.log('--- 4. COMPROBACIÓN FINAL DE ZERO POLLUTION ---')
    const finalCounts = await client.query(`
      SELECT
        (SELECT COUNT(*)::int FROM electronic_invoices) as invoices,
        (SELECT COUNT(*)::int FROM dian_resolutions) as resolutions,
        (SELECT COUNT(*)::int FROM dian_events) as events,
        (SELECT COUNT(*)::int FROM dian_software_config) as configs,
        (SELECT COUNT(*)::int FROM companies) as companies,
        (SELECT COUNT(*)::int FROM sales) as sales,
        (SELECT COUNT(*)::int FROM customers) as customers,
        (SELECT COUNT(*)::int FROM returns) as returns,
        (SELECT COUNT(*)::int FROM audit_logs) as audit_logs;
    `)
    const row = finalCounts.rows[0]
    console.log('Conteos finales en base de datos:', row)

    if (row.invoices !== 0 || row.resolutions !== 0 || row.events !== 0 || row.configs !== 0) {
      throw new Error(`Contaminación detectada en tablas DIAN: ${JSON.stringify(row)}`)
    }

    if (row.companies !== 5 || row.sales !== 4 || row.customers !== 15 || row.returns !== 3) {
      throw new Error(`Regresión detectada en tablas core: ${JSON.stringify(row)}`)
    }

    console.log('✅ ZERO POLLUTION 100% GARANTIZADO: 0 registros en tablas DIAN, integridad core intacta.\n')
  } catch (err) {
    console.error('❌ Error en suite de pruebas DIAN:', err)
    throw err
  } finally {
    await client.end()
  }
}

runDianSchemaTests().catch((err) => {
  console.error(err)
  process.exit(1)
})
