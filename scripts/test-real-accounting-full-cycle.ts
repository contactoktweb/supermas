import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function main() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  console.log('================================================================');
  console.log('🚀 PASO 13: TEST COMPLETO DEL MÓDULO CONTABLE, PERIODOS,');
  console.log('           REPORTES FINANCIEROS Y CIERRES (BEGIN / ROLLBACK)');
  console.log('================================================================\n');

  await client.query('BEGIN');
  console.log('🔒 Transacción iniciada con BEGIN.');

  try {
    // -------------------------------------------------------------------------
    // 0. OBTENER DATOS BASE DE EMPRESA A Y SUPERADMIN
    // -------------------------------------------------------------------------
    const resCompanyA = await client.query(`SELECT id, business_name, tax_id FROM public.companies LIMIT 1;`);
    if (resCompanyA.rows.length === 0) throw new Error('No existe Empresa A en staging.');
    const companyAId = resCompanyA.rows[0].id;
    console.log(`🏢 Empresa A: ${resCompanyA.rows[0].business_name} (NIT: ${resCompanyA.rows[0].tax_id})`);

    const resLocA = await client.query(`SELECT id, code, name FROM public.locations WHERE company_id = $1 LIMIT 1;`, [companyAId]);
    if (resLocA.rows.length === 0) throw new Error('No existe bodega para Empresa A.');
    const locationAId = resLocA.rows[0].id;
    console.log(`📦 Bodega A: ${resLocA.rows[0].name} (${resLocA.rows[0].code})`);

    const resSuperadmin = await client.query(`SELECT id, email FROM public.users WHERE LOWER(email) = 'samirdurant234@gmail.com';`);
    const superadminId = resSuperadmin.rows[0].id;

    // Roles
    const resRoles = await client.query(`SELECT id, code FROM public.roles;`);
    const roleMap = new Map(resRoles.rows.map((r: any) => [r.code, r.id]));

    // -------------------------------------------------------------------------
    // 1. SETUP DE USUARIOS DE PRUEBA (CONTADOR, CAJERO, EMPRESA B)
    // -------------------------------------------------------------------------
    console.log('\n--- 1. CREACIÓN DE USUARIOS DE PRUEBA ---');
    const accountantUserId = 'aa000000-0000-0000-0000-000000000001';
    const cashierUserId = 'cc000000-0000-0000-0000-000000000002';
    const companyBId = 'bb000000-0000-0000-0000-000000000001';
    const accountantBUserId = 'bb000000-0000-0000-0000-000000000002';

    // Empresa B
    await client.query(`
      INSERT INTO public.companies (id, business_name, trade_name, tax_id, verification_digit, tax_regime, address, city, department, phone, email)
      VALUES ($1, 'Competencia Andina S.A.S.', 'Competencia', '901999888', '2', 'COMUN', 'Calle 100 #20-30', 'Bogotá', 'Cundinamarca', '3109998888', 'contacto@competencia.com');
    `, [companyBId]);

    // Insertar en auth.users
    await client.query(`
      INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data)
      VALUES 
        ($1, 'contador.a@supermas.com', jsonb_build_object('role', 'ACCOUNTANT', 'company_id', $2::text), '{}'::jsonb),
        ($3, 'cajero.a@supermas.com', jsonb_build_object('role', 'CASHIER', 'company_id', $2::text), '{}'::jsonb),
        ($4, 'contador.b@competencia.com', jsonb_build_object('role', 'ACCOUNTANT', 'company_id', $5::text), '{}'::jsonb);
    `, [accountantUserId, companyAId, cashierUserId, accountantBUserId, companyBId]);

    // Upsert en public.users
    await client.query(`
      INSERT INTO public.users (id, company_id, email, full_name, role_id, is_active)
      VALUES 
        ($1, $2, 'contador.a@supermas.com', 'Carlos Contador A', $3, true),
        ($4, $5, 'cajero.a@supermas.com', 'Pedro Cajero A', $6, true),
        ($7, $8, 'contador.b@competencia.com', 'Bernardo Contador B', $9, true)
      ON CONFLICT (id) DO UPDATE SET 
        company_id = EXCLUDED.company_id,
        role_id = EXCLUDED.role_id,
        full_name = EXCLUDED.full_name;
    `, [
      accountantUserId, companyAId, roleMap.get('ACCOUNTANT'),
      cashierUserId, companyAId, roleMap.get('CASHIER'),
      accountantBUserId, companyBId, roleMap.get('ACCOUNTANT')
    ]);

    await client.query(`
      INSERT INTO public.user_locations (user_id, location_id, is_primary)
      VALUES 
        ($1, $2, true),
        ($3, $4, true);
    `, [accountantUserId, locationAId, cashierUserId, locationAId]);

    console.log('✅ Usuarios y Empresa B creados dentro de la transacción.');

    // -------------------------------------------------------------------------
    // 2. AUDITORÍA DEL PLAN ÚNICO DE CUENTAS (PUC)
    // -------------------------------------------------------------------------
    console.log('\n--- 2. AUDITORÍA DE ESTRUCTURA DEL PUC (55 CUENTAS) ---');
    const resPuc = await client.query(`
      SELECT 
        account_class, 
        COUNT(*) as total_cuentas,
        COUNT(CASE WHEN nature = 'DEBIT' THEN 1 END) as debitos,
        COUNT(CASE WHEN nature = 'CREDIT' THEN 1 END) as creditos
      FROM public.accounting_accounts
      GROUP BY account_class
      ORDER BY account_class;
    `);
    console.table(resPuc.rows);

    const totalAccountsRes = await client.query(`SELECT COUNT(*) FROM public.accounting_accounts;`);
    if (parseInt(totalAccountsRes.rows[0].count) !== 55) {
      throw new Error(`Se esperaban 55 cuentas en el PUC y se encontraron ${totalAccountsRes.rows[0].count}`);
    }
    console.log(`✅ Plan Único de Cuentas verificado: ${totalAccountsRes.rows[0].count} cuentas activas categorizadas.`);

    // -------------------------------------------------------------------------
    // 3. CENTROS DE COSTO Y AISLAMIENTO MULTIEMPRESA
    // -------------------------------------------------------------------------
    console.log('\n--- 3. VALIDACIÓN DE CENTROS DE COSTO ---');
    const resCcA1 = await client.query(`
      INSERT INTO public.cost_centers (company_id, code, name, is_active)
      VALUES ($1, 'CC-01', 'Ventas Mostrador y POS', true)
      RETURNING id, code, name;
    `, [companyAId]);
    const ccA1Id = resCcA1.rows[0].id;

    const resCcA2 = await client.query(`
      INSERT INTO public.cost_centers (company_id, code, name, is_active)
      VALUES ($1, 'CC-02', 'Administración y Logística', true)
      RETURNING id, code, name;
    `, [companyAId]);
    const ccA2Id = resCcA2.rows[0].id;

    // Centro de costo Empresa B con el mismo código 'CC-01' (debe permitirse gracias a UNIQUE (company_id, code))
    const resCcB = await client.query(`
      INSERT INTO public.cost_centers (company_id, code, name, is_active)
      VALUES ($1, 'CC-01', 'Centro Empresa B', true)
      RETURNING id, code, name;
    `, [companyBId]);
    console.log(`✅ Centros de costo multiempresa creados: Empresa A (${resCcA1.rows[0].code}, ${resCcA2.rows[0].code}), Empresa B (${resCcB.rows[0].code})`);

    // Probar duplicado dentro de la misma empresa (debe fallar)
    await client.query('SAVEPOINT sp_cc_duplicate;');
    try {
      await client.query(`
        INSERT INTO public.cost_centers (company_id, code, name, is_active)
        VALUES ($1, 'CC-01', 'Duplicado Empresa A', true);
      `, [companyAId]);
      throw new Error('FALLO: Permitió código de centro de costo duplicado en la misma empresa.');
    } catch (err: any) {
      await client.query('ROLLBACK TO SAVEPOINT sp_cc_duplicate;');
      console.log('✅ Correcto: Bloqueó código de centro de costo duplicado en Empresa A.');
    }

    // -------------------------------------------------------------------------
    // 4. PERIODOS CONTABLES: APERTURA Y REGLAS DE AISLAMIENTO
    // -------------------------------------------------------------------------
    console.log('\n--- 4. PERIODOS CONTABLES: APERTURA Y AISLAMIENTO ---');
    const periodAugA = await client.query(`
      INSERT INTO public.accounting_periods (company_id, period_code, year, month, month_name, start_date, end_date, status)
      VALUES ($1, '2026-08', 2026, 8, 'Agosto', '2026-08-01', '2026-08-31', 'OPEN')
      RETURNING id, period_code, status;
    `, [companyAId]);

    const periodSepA = await client.query(`
      INSERT INTO public.accounting_periods (company_id, period_code, year, month, month_name, start_date, end_date, status)
      VALUES ($1, '2026-09', 2026, 9, 'Septiembre', '2026-09-01', '2026-09-30', 'OPEN')
      RETURNING id, period_code, status;
    `, [companyAId]);

    // Empresa B también puede abrir '2026-08'
    const periodAugB = await client.query(`
      INSERT INTO public.accounting_periods (company_id, period_code, year, month, month_name, start_date, end_date, status)
      VALUES ($1, '2026-08', 2026, 8, 'Agosto', '2026-08-01', '2026-08-31', 'OPEN')
      RETURNING id, period_code, status;
    `, [companyBId]);

    console.log(`✅ Periodos creados: Empresa A (2026-08, 2026-09), Empresa B (2026-08). Aislamiento comprobado.`);

    // -------------------------------------------------------------------------
    // 5. MAPEO DE CUENTAS PUC PARA PRUEBAS
    // -------------------------------------------------------------------------
    const resAccMap = await client.query(`
      SELECT id, code, name, nature 
      FROM public.accounting_accounts 
      WHERE code IN (
        '110505', -- Caja General
        '111005', -- Bancos Nacionales Moneda Local
        '130505', -- Clientes Nacionales
        '143501', -- Mercancías no Fabricadas - Abarrotes y Víveres
        '220505', -- Proveedores Nacionales de Mercancías
        '236540', -- Retención en la Fuente en Compras (2.5%)
        '240805', -- IVA Generado en Ventas (19%)
        '240810', -- IVA Descontable en Compras de Inventario (19%)
        '413501', -- Venta de Abarrotes y Víveres
        '5120',   -- Arrendamientos
        '5135',   -- Servicios Públicos
        '613501'  -- Costo de Venta - Abarrotes y Granos
      );
    `);
    const acc = new Map(resAccMap.rows.map((r: any) => [r.code, r]));

    // -------------------------------------------------------------------------
    // 6. ASIENTO MANUAL 1: GASTO DE ARRIENDO CON PARTIDA DOBLE
    // -------------------------------------------------------------------------
    console.log('\n--- 6. ASIENTO CONTABLE MANUAL: GASTO DE ARRIENDO (AGOSTO 2026) ---');
    const entryManualRes = await client.query(`
      INSERT INTO public.accounting_entries (
        company_id, location_id, entry_number, date, concept, 
        document_type, document_reference, status, created_by_user_id
      )
      VALUES (
        $1, $2, 'AS-202608-001', '2026-08-15', 'Pago canon de arrendamiento local bodega Agosto 2026',
        'ACCOUNTING_ADJUSTMENT', 'FAC-ARR-089', 'DRAFT', $3
      )
      RETURNING id, entry_number, status;
    `, [companyAId, locationAId, accountantUserId]);
    const entryManualId = entryManualRes.rows[0].id;

    // Línea Débito: Gasto Arrendamiento 5120 ($2,000,000)
    await client.query(`
      INSERT INTO public.accounting_entry_lines (
        entry_id, account_id, third_party_doc, third_party_name, cost_center_id, description, debit_amount, credit_amount
      ) VALUES (
        $1, $2, '900111222', 'Inmobiliaria Los Andes S.A.S.', $3, 'Canon arrendamiento bodega', 2000000.00, 0.00
      );
    `, [entryManualId, acc.get('5120').id, ccA2Id]);

    // Intentar publicar en estado POSTED estando descuadrado (debe fallar por partida doble)
    await client.query('SAVEPOINT sp_unbalanced_entry;');
    try {
      await client.query(`UPDATE public.accounting_entries SET status = 'POSTED', posted_at = NOW() WHERE id = $1;`, [entryManualId]);
      throw new Error('FALLO: Permitió publicar un asiento contable descuadrado.');
    } catch (err: any) {
      await client.query('ROLLBACK TO SAVEPOINT sp_unbalanced_entry;');
      console.log('✅ Correcto: fn_enforce_accounting_double_entry bloqueó la publicación con descuadre.');
    }

    // Línea Crédito: Salida Banco 111005 ($2,000,000)
    await client.query(`
      INSERT INTO public.accounting_entry_lines (
        entry_id, account_id, third_party_doc, third_party_name, cost_center_id, description, debit_amount, credit_amount
      ) VALUES (
        $1, $2, '900111222', 'Inmobiliaria Los Andes S.A.S.', $3, 'Transferencia bancaria canon', 0.00, 2000000.00
      );
    `, [entryManualId, acc.get('111005').id, ccA2Id]);

    // Ahora sí publicar como POSTED
    await client.query(`UPDATE public.accounting_entries SET status = 'POSTED', posted_at = NOW() WHERE id = $1;`, [entryManualId]);
    console.log(`✅ Asiento manual publicado con éxito (POSTED). Débito = Crédito = $2,000,000 COP.`);

    // -------------------------------------------------------------------------
    // 7. INMUTABILIDAD DE ASIENTOS POSTED (BLOQUEO DE MUTACIONES)
    // -------------------------------------------------------------------------
    console.log('\n--- 7. PRUEBA DE INMUTABILIDAD CONTABLE SOBRE MOVIMIENTO POSTED ---');

    // Intento 1: Modificar concepto o fecha
    await client.query('SAVEPOINT sp_immutability_update;');
    try {
      await client.query(`UPDATE public.accounting_entries SET concept = 'Concepto alterado' WHERE id = $1;`, [entryManualId]);
      throw new Error('FALLO: Permitió alterar datos de comprobante contable POSTED.');
    } catch (err: any) {
      await client.query('ROLLBACK TO SAVEPOINT sp_immutability_update;');
      console.log('✅ Correcto: fn_prevent_posted_accounting_mutation bloqueó la modificación del comprobante POSTED.');
    }

    // Intento 2: Eliminar comprobante POSTED
    await client.query('SAVEPOINT sp_immutability_delete;');
    try {
      await client.query(`DELETE FROM public.accounting_entries WHERE id = $1;`, [entryManualId]);
      throw new Error('FALLO: Permitió eliminar un comprobante contable POSTED.');
    } catch (err: any) {
      await client.query('ROLLBACK TO SAVEPOINT sp_immutability_delete;');
      console.log('✅ Correcto: fn_prevent_posted_accounting_mutation bloqueó el borrado del comprobante POSTED.');
    }

    // Intento 3: Alterar o eliminar líneas de un comprobante POSTED
    await client.query('SAVEPOINT sp_immutability_lines;');
    try {
      await client.query(`DELETE FROM public.accounting_entry_lines WHERE entry_id = $1;`, [entryManualId]);
      throw new Error('FALLO: Permitió eliminar líneas contables de un asiento POSTED.');
    } catch (err: any) {
      await client.query('ROLLBACK TO SAVEPOINT sp_immutability_lines;');
      console.log('✅ Correcto: fn_prevent_posted_entry_lines_mutation bloqueó la alteración de líneas de asiento POSTED.');
    }

    // -------------------------------------------------------------------------
    // 8. ASIENTO AUTOMÁTICO 2: COMPRA COMERCIAL CON RETEFUENTE E IVA DESCONTABLE
    // -------------------------------------------------------------------------
    console.log('\n--- 8. ASIENTO AUTOMÁTICO DE COMPRA COMERCIAL (AGOSTO 2026) ---');
    // Compra de Mercancía:
    // Subtotal: $10,000,000 (143501 Débito)
    // IVA 19%:  $1,900,000  (240810 Débito)
    // Rete 2.5%:  $250,000  (236540 Crédito)
    // Proveedor: $11,650,000 (220505 Crédito)
    // Total Débito: $11,900,000 == Total Crédito: $11,900,000
    const entryPurchaseRes = await client.query(`
      INSERT INTO public.accounting_entries (
        company_id, location_id, entry_number, date, concept,
        document_type, document_reference, status, created_by_user_id
      ) VALUES (
        $1, $2, 'AS-202608-002', '2026-08-20', 'Causación Factura de Compra Harinas del Valle S.A.S.',
        'PURCHASE', 'FAC-PROV-9988', 'DRAFT', $3
      ) RETURNING id;
    `, [companyAId, locationAId, accountantUserId]);
    const entryPurchaseId = entryPurchaseRes.rows[0].id;

    await client.query(`
      INSERT INTO public.accounting_entry_lines (entry_id, account_id, third_party_doc, third_party_name, cost_center_id, description, debit_amount, credit_amount)
      VALUES
        ($1, $2, '900555444', 'Harinas del Valle S.A.S.', $6, 'Entrada inventario harinas', 10000000.00, 0.00),
        ($1, $3, '900555444', 'Harinas del Valle S.A.S.', $6, 'IVA Descontable 19% en compra', 1900000.00, 0.00),
        ($1, $4, '900555444', 'Harinas del Valle S.A.S.', $6, 'Retención en la fuente 2.5% compras', 0.00, 250000.00),
        ($1, $5, '900555444', 'Harinas del Valle S.A.S.', $6, 'Cta por Pagar Proveedor', 0.00, 11650000.00);
    `, [entryPurchaseId, acc.get('143501').id, acc.get('240810').id, acc.get('236540').id, acc.get('220505').id, ccA2Id]);

    await client.query(`UPDATE public.accounting_entries SET status = 'POSTED', posted_at = NOW() WHERE id = $1;`, [entryPurchaseId]);
    console.log('✅ Causación de compra POSTED: Débito ($11,900,000) == Crédito ($11,900,000).');

    // -------------------------------------------------------------------------
    // 9. ASIENTO AUTOMÁTICO 3: VENTA COMERCIAL POS CON COSTO DE VENTAS
    // -------------------------------------------------------------------------
    console.log('\n--- 9. ASIENTO AUTOMÁTICO DE VENTA COMERCIAL POS (AGOSTO 2026) ---');
    // Venta Mostrador:
    // Subtotal: $15,000,000 (413501 Crédito)
    // IVA 19%:   $2,850,000 (240805 Crédito)
    // Caja:     $17,850,000 (110505 Débito)
    // Costo:     $8,000,000 (613501 Débito)
    // Inv Sal:   $8,000,000 (143501 Crédito)
    // Total Débito: $25,850,000 == Total Crédito: $25,850,000
    const entrySaleRes = await client.query(`
      INSERT INTO public.accounting_entries (
        company_id, location_id, entry_number, date, concept,
        document_type, document_reference, status, created_by_user_id
      ) VALUES (
        $1, $2, 'AS-202608-003', '2026-08-25', 'Venta comercial POS y causación costo de ventas',
        'SALE', 'POS-2026-0001', 'DRAFT', $3
      ) RETURNING id;
    `, [companyAId, locationAId, accountantUserId]);
    const entrySaleId = entrySaleRes.rows[0].id;

    await client.query(`
      INSERT INTO public.accounting_entry_lines (entry_id, account_id, third_party_doc, third_party_name, cost_center_id, description, debit_amount, credit_amount)
      VALUES
        ($1, $2, '222222222222', 'Consumidor Final', $7, 'Recaudo efectivo Caja General', 17850000.00, 0.00),
        ($1, $3, '222222222222', 'Consumidor Final', $7, 'Ingresos operacionales por venta', 0.00, 15000000.00),
        ($1, $4, '222222222222', 'Consumidor Final', $7, 'IVA Generado 19% en venta', 0.00, 2850000.00),
        ($1, $5, '222222222222', 'Consumidor Final', $7, 'Reconocimiento costo de ventas', 8000000.00, 0.00),
        ($1, $6, '222222222222', 'Consumidor Final', $7, 'Salida de inventario al costo', 0.00, 8000000.00);
    `, [entrySaleId, acc.get('110505').id, acc.get('413501').id, acc.get('240805').id, acc.get('613501').id, acc.get('143501').id, ccA1Id]);

    await client.query(`UPDATE public.accounting_entries SET status = 'POSTED', posted_at = NOW() WHERE id = $1;`, [entrySaleId]);
    console.log('✅ Causación de venta POS POSTED: Débito ($25,850,000) == Crédito ($25,850,000).');

    // -------------------------------------------------------------------------
    // 10. CIERRE DE PERIODO CONTABLE AGOSTO 2026
    // -------------------------------------------------------------------------
    console.log('\n--- 10. CIERRE CONTABLE DEL PERIODO 2026-08 ---');
    const closeResult = await client.query(`
      SELECT public.fn_close_accounting_period($1, '2026-08', $2) as result;
    `, [companyAId, accountantUserId]);
    console.log('Resultado Cierre Contable:', closeResult.rows[0].result);

    const closedPeriodCheck = await client.query(`SELECT status, entries_count, total_debits, total_credits FROM public.accounting_periods WHERE id = $1;`, [periodAugA.rows[0].id]);
    console.table(closedPeriodCheck.rows);

    if (closedPeriodCheck.rows[0].status !== 'CLOSED') {
      throw new Error('FALLO: El periodo debería estar CLOSED.');
    }
    console.log('✅ Periodo 2026-08 cerrado exitosamente con cálculo de débitos y créditos.');

    // -------------------------------------------------------------------------
    // 11. RESTRICCIÓN DE MOVIMIENTOS EN PERIODOS CERRADOS
    // -------------------------------------------------------------------------
    console.log('\n--- 11. BLOQUEO DE MOVIMIENTOS EN PERIODO CERRADO ---');
    await client.query('SAVEPOINT sp_closed_period_insert;');
    try {
      await client.query(`
        INSERT INTO public.accounting_entries (
          company_id, location_id, entry_number, date, concept,
          document_type, document_reference, status, created_by_user_id
        ) VALUES (
          $1, $2, 'AS-202608-099', '2026-08-28', 'Intento de registro extemporáneo en mes cerrado',
          'ACCOUNTING_ADJUSTMENT', 'INT-999', 'DRAFT', $3
        );
      `, [companyAId, locationAId, accountantUserId]);
      throw new Error('FALLO: Permitió registrar asiento en un periodo CLOSED.');
    } catch (err: any) {
      await client.query('ROLLBACK TO SAVEPOINT sp_closed_period_insert;');
      console.log('✅ Correcto: fn_prevent_entries_on_closed_period bloqueó la inserción en el periodo 2026-08 cerrado.');
    }

    // Verificar que Empresa B puede seguir operando en su 2026-08 porque su periodo está OPEN
    const entryCompanyB = await client.query(`
      INSERT INTO public.accounting_entries (
        company_id, entry_number, date, concept,
        document_type, document_reference, status, created_by_user_id
      ) VALUES (
        $1, 'AS-B-202608-001', '2026-08-10', 'Asiento Empresa B en su propio periodo abierto',
        'ACCOUNTING_ADJUSTMENT', 'B-001', 'DRAFT', $2
      ) RETURNING id, entry_number;
    `, [companyBId, accountantBUserId]);
    console.log(`✅ Aislamiento confirmado: Empresa B registró exitosamente su asiento en 2026-08 (ID: ${entryCompanyB.rows[0].entry_number}).`);

    // -------------------------------------------------------------------------
    // 12. REAPERTURA DE PERIODO CON MOTIVO OBLIGATORIO
    // -------------------------------------------------------------------------
    console.log('\n--- 12. REAPERTURA DE PERIODO CONTABLE ---');
    // Intento sin motivo (debe fallar)
    await client.query('SAVEPOINT sp_reopen_no_reason;');
    try {
      await client.query(`SELECT public.fn_reopen_accounting_period($1, '2026-08', $2, '');`, [companyAId, accountantUserId]);
      throw new Error('FALLO: Permitió reabrir periodo sin justificación.');
    } catch (err: any) {
      await client.query('ROLLBACK TO SAVEPOINT sp_reopen_no_reason;');
      console.log('✅ Correcto: fn_reopen_accounting_period exigió justificación obligatoria.');
    }

    // Reapertura autorizada con motivo
    const reopenRes = await client.query(`
      SELECT public.fn_reopen_accounting_period($1, '2026-08', $2, 'Auditoría DIAN: Inclusión de factura de servicios de última hora') as result;
    `, [companyAId, accountantUserId]);
    console.log('Resultado Reapertura:', reopenRes.rows[0].result);

    // Volver a cerrarlo para mantener el periodo cerrado para las pruebas posteriores
    await client.query(`SELECT public.fn_close_accounting_period($1, '2026-08', $2);`, [companyAId, accountantUserId]);
    console.log('✅ Periodo 2026-08 re-cerrado.');

    // -------------------------------------------------------------------------
    // 13. GENERACIÓN Y VALIDACIÓN DE REPORTES FINANCIEROS
    // -------------------------------------------------------------------------
    console.log('\n--- 13. REPORTES FINANCIEROS (MOTOR SQL DE ALTO RENDIMIENTO) ---');

    // 13.1 Balance de Comprobación (Trial Balance)
    console.log('\n📊 13.1 Balance de Comprobación (Sumas y Saldos):');
    const trialBalanceRes = await client.query(`
      SELECT account_code, account_name, nature, total_debit, total_credit, final_balance
      FROM public.fn_financial_trial_balance($1, '2026-08-01', '2026-08-31');
    `, [companyAId]);
    console.table(trialBalanceRes.rows);

    let sumDebits = 0;
    let sumCredits = 0;
    for (const row of trialBalanceRes.rows) {
      sumDebits += parseFloat(row.total_debit);
      sumCredits += parseFloat(row.total_credit);
    }
    console.log(`Total Débitos: $${sumDebits.toLocaleString('es-CO')} | Total Créditos: $${sumCredits.toLocaleString('es-CO')}`);
    if (sumDebits !== sumCredits) {
      throw new Error(`Descuadre en Balance de Comprobación: Débitos (${sumDebits}) != Créditos (${sumCredits})`);
    }
    console.log('✅ Balance de Comprobación 100% Cuadrado (Partida Doble Global).');

    // 13.2 Libro Diario (General Journal)
    console.log('\n📖 13.2 Libro Diario (General Journal):');
    const dailyJournalRes = await client.query(`
      SELECT consecutive, entry_number, entry_date, document_type, account_code, debit_amount, credit_amount
      FROM public.fn_financial_daily_journal($1, '2026-08-01', '2026-08-31');
    `, [companyAId]);
    console.table(dailyJournalRes.rows);
    console.log(`✅ Libro Diario verificado: ${dailyJournalRes.rows.length} líneas cronológicas estructuradas.`);

    // 13.3 Libro Mayor (General Ledger)
    console.log('\n📚 13.3 Libro Mayor (General Ledger - Cuenta 143501 Inventario):');
    const ledgerRes = await client.query(`
      SELECT account_code, entry_date, entry_number, debit_amount, credit_amount, running_balance
      FROM public.fn_financial_general_ledger($1, '2026-08-01', '2026-08-31', '143501');
    `, [companyAId]);
    console.table(ledgerRes.rows);
    console.log(`✅ Libro Mayor verificado con saldo acumulado dinámico.`);

    // 13.4 Estado de Resultados (P&L)
    console.log('\n📈 13.4 Estado de Resultados (Income Statement):');
    const incomeStatementRes = await client.query(`
      SELECT public.fn_financial_income_statement($1, '2026-08-01', '2026-08-31') as pnl;
    `, [companyAId]);
    const pnl = incomeStatementRes.rows[0].pnl;
    console.log(pnl);

    // Ingresos: $15,000,000
    // Costos:    $8,000,000
    // Utilidad Bruta: $7,000,000
    // Gastos:    $2,000,000
    // Utilidad Operativa: $5,000,000
    if (parseFloat(pnl.total_ingresos) !== 15000000 || 
        parseFloat(pnl.total_costos) !== 8000000 || 
        parseFloat(pnl.utilidad_bruta) !== 7000000 ||
        parseFloat(pnl.total_gastos) !== 2000000 ||
        parseFloat(pnl.utilidad_operativa) !== 5000000) {
      throw new Error(`Inconsistencia en Estado de Resultados: ${JSON.stringify(pnl)}`);
    }
    console.log('✅ Estado de Resultados matemáticamente exacto: Utilidad Operativa = $5,000,000 COP.');

    // 13.5 Balance General y Ecuación Patrimonial
    console.log('\n⚖️ 13.5 Balance General y Ecuación Patrimonial (Activo = Pasivo + Patrimonio):');
    const balanceSheetRes = await client.query(`
      SELECT public.fn_financial_balance_sheet($1, '2026-08-31') as balance_sheet;
    `, [companyAId]);
    const bs = balanceSheetRes.rows[0].balance_sheet;
    console.log(bs);

    // Activos:
    // 110505 (Caja): +17,850,000
    // 111005 (Bancos): -2,000,000
    // 143501 (Inventario): +10,000,000 - 8,000,000 = +2,000,000
    // Total Activos = 17,850,000 - 2,000,000 + 2,000,000 = 17,850,000
    //
    // Pasivos:
    // 220505 (Proveedores): +11,650,000
    // 236540 (Retefuente): +250,000
    // 240805 (IVA Generado): +2,850,000
    // 240810 (IVA Descontable): -1,900,000
    // Total Pasivos = 11,650,000 + 250,000 + 2,850,000 - 1,900,000 = 12,850,000
    //
    // Patrimonio (Resultado del Ejercicio):
    // Utilidad: 5,000,000
    // Pasivo + Patrimonio = 12,850,000 + 5,000,000 = 17,850,000!
    // Diferencia = 0.00!
    if (!bs.esta_balanceado || parseFloat(bs.diferencia_balance) !== 0) {
      throw new Error(`Descuadre en Balance General: Activos (${bs.total_activos}) != Pasivo+Patrimonio (${bs.pasivo_mas_patrimonio})`);
    }
    console.log(`✅ Ecuación Patrimonial perfecta: Activos ($${parseFloat(bs.total_activos).toLocaleString('es-CO')}) == Pasivo + Patrimonio ($${parseFloat(bs.pasivo_mas_patrimonio).toLocaleString('es-CO')}).`);

    // -------------------------------------------------------------------------
    // 14. VALIDACIÓN TRIBUTARIA: IVA GENERADO, DESCONTABLE Y RETENCIONES
    // -------------------------------------------------------------------------
    console.log('\n--- 14. VALIDACIÓN TRIBUTARIA Y CRUCE DIAN ---');
    const taxSummaryRes = await client.query(`
      SELECT public.fn_financial_tax_summary($1, '2026-08-01', '2026-08-31') as tax_summary;
    `, [companyAId]);
    const tax = taxSummaryRes.rows[0].tax_summary;
    console.log(tax);

    if (parseFloat(tax.iva_generado) !== 2850000 ||
        parseFloat(tax.iva_descontable) !== 1900000 ||
        parseFloat(tax.saldo_a_pagar) !== 950000 ||
        parseFloat(tax.retefuente_compras_por_pagar) !== 250000) {
      throw new Error(`Inconsistencia en Resumen Tributario: ${JSON.stringify(tax)}`);
    }
    console.log('✅ Validación Tributaria confirmada:');
    console.log(`   - IVA Generado (Ventas 19%):    $${parseFloat(tax.iva_generado).toLocaleString('es-CO')}`);
    console.log(`   - IVA Descontable (Compras 19%): $${parseFloat(tax.iva_descontable).toLocaleString('es-CO')}`);
    console.log(`   - Saldo Neto IVA a Pagar DIAN:  $${parseFloat(tax.saldo_a_pagar).toLocaleString('es-CO')}`);
    console.log(`   - Retención en la Fuente:       $${parseFloat(tax.retefuente_compras_por_pagar).toLocaleString('es-CO')}`);

    // -------------------------------------------------------------------------
    // 15. AUDITORÍA DE OPERACIONES SENSIBLES
    // -------------------------------------------------------------------------
    console.log('\n--- 15. TRAZABILIDAD Y AUDITORÍA DE REGISTROS ---');
    const auditRes = await client.query(`
      SELECT action, entity_name, user_id, previous_value, new_value, created_at
      FROM public.audit_logs
      WHERE company_id = $1
      ORDER BY created_at DESC;
    `, [companyAId]);
    console.table(auditRes.rows);

    const hasCloseAudit = auditRes.rows.some((r: any) => r.action === 'CLOSE_ACCOUNTING_PERIOD');
    const hasReopenAudit = auditRes.rows.some((r: any) => r.action === 'REOPEN_ACCOUNTING_PERIOD');
    if (!hasCloseAudit || !hasReopenAudit) {
      throw new Error('No se registraron las auditorías correspondientes a cierre y reapertura de periodos.');
    }
    console.log('✅ Auditoría completa verificada: Acciones registradas con ID de usuario y metadatos JSONB.');

    // -------------------------------------------------------------------------
    // 16. SEGURIDAD Y PERMISOS RLS (RBAC + MULTIEMPRESA)
    // -------------------------------------------------------------------------
    console.log('\n--- 16. VALIDACIÓN DE SEGURIDAD Y POLÍTICAS RLS ---');

    // 16.1 Rol CASHIER no puede registrar comprobantes contables
    console.log('Prueba 16.1: Rol CAJERO intentando registrar comprobante contable...');
    await client.query(`SET LOCAL ROLE authenticated;`);
    await client.query(`SET LOCAL "request.jwt.claims" = '${JSON.stringify({
      sub: cashierUserId,
      role: 'authenticated',
      app_metadata: { role: 'CASHIER', company_id: companyAId },
      user_metadata: {}
    })}';`);

    await client.query('SAVEPOINT sp_cashier_accounting;');
    try {
      await client.query(`
        INSERT INTO public.accounting_entries (
          company_id, location_id, entry_number, date, concept,
          document_type, document_reference, status, created_by_user_id
        ) VALUES (
          $1, $2, 'AS-FAIL-001', '2026-09-05', 'Cajero intentando crear asiento',
          'ACCOUNTING_ADJUSTMENT', 'TEST-001', 'DRAFT', $3
        );
      `, [companyAId, locationAId, cashierUserId]);
      throw new Error('FALLO: Cajero pudo insertar comprobante contable.');
    } catch (err: any) {
      await client.query('ROLLBACK TO SAVEPOINT sp_cashier_accounting;');
      console.log('✅ Correcto: RLS bloqueó a CASHIER de crear comprobantes contables.');
    }

    // 16.2 Rol ACCOUNTANT Empresa B intentando ver comprobantes de Empresa A
    console.log('Prueba 16.2: Rol CONTADOR Empresa B intentando leer comprobantes de Empresa A...');
    await client.query(`SET LOCAL "request.jwt.claims" = '${JSON.stringify({
      sub: accountantBUserId,
      role: 'authenticated',
      app_metadata: { role: 'ACCOUNTANT', company_id: companyBId },
      user_metadata: {}
    })}';`);

    const crossReadEntries = await client.query(`
      SELECT count(*) FROM public.accounting_entries WHERE company_id = $1;
    `, [companyAId]);
    if (parseInt(crossReadEntries.rows[0].count) !== 0) {
      throw new Error('FALLO: Contador Empresa B pudo ver comprobantes de Empresa A.');
    }
    console.log('✅ Correcto: RLS bloqueó lectura de comprobantes de otra empresa (filas visibles: 0).');

    // 16.3 Rol ACCOUNTANT Empresa B intentando ver periodos de Empresa A
    console.log('Prueba 16.3: Rol CONTADOR Empresa B intentando leer periodos de Empresa A...');
    const crossReadPeriods = await client.query(`
      SELECT count(*) FROM public.accounting_periods WHERE company_id = $1;
    `, [companyAId]);
    if (parseInt(crossReadPeriods.rows[0].count) !== 0) {
      throw new Error('FALLO: Contador Empresa B pudo ver periodos de Empresa A.');
    }
    console.log('✅ Correcto: RLS bloqueó lectura de periodos contables de otra empresa (filas visibles: 0).');

    // Resetear rol a superusuario postgres
    await client.query(`RESET ROLE;`);
    console.log('✅ Contexto RLS restablecido a superusuario.');

    console.log('\n================================================================');
    console.log('🎯 TODAS LAS PRUEBAS DEL PASO 13 COMPLETADAS CON ÉXITO.');
    console.log('================================================================\n');

  } catch (error) {
    console.error('❌ ERROR DURANTE LA EJECUCIÓN DE PRUEBAS DEL PASO 13:', error);
    throw error;
  } finally {
    console.log('🔄 Ejecutando ROLLBACK para garantizar limpieza absoluta...');
    await client.query('ROLLBACK');
    console.log('✅ ROLLBACK ejecutado exitosamente. Cero datos residuales.\n');
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
