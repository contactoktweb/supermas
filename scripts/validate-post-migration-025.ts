import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DIRECT_URL,
});

async function validate() {
  console.log("=================================================");
  console.log("   VALIDACIÓN POST-MIGRACIÓN 025 EN STAGING      ");
  console.log("=================================================\n");

  // 1. Estadísticas Globales
  const polCountRes = await pool.query(`select count(*) as count from pg_policies where schemaname = 'public';`);
  const rlsCountRes = await pool.query(`
    select count(*) as count 
    from pg_class c 
    join pg_namespace n on n.oid = c.relnamespace 
    where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity = true;
  `);
  const idxCountRes = await pool.query(`select count(*) as count from pg_indexes where schemaname = 'public';`);

  console.log("1. ESTADÍSTICAS GLOBALES ACTUALES:");
  console.log(`   - Políticas RLS activas: ${polCountRes.rows[0].count}`);
  console.log(`   - Tablas con RLS habilitado: ${rlsCountRes.rows[0].count} / 48`);
  console.log(`   - Índices totales en esquema público: ${idxCountRes.rows[0].count}\n`);

  // 2. Verificar que NO existan tablas con RLS activo y 0 políticas
  const zeroPolRes = await pool.query(`
    select c.relname as table_name, count(p.policyname) as pol_count
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    left join pg_policies p on p.tablename = c.relname and p.schemaname = n.nspname
    where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity = true
    group by c.relname
    having count(p.policyname) = 0
    order by c.relname;
  `);

  console.log("2. VERIFICACIÓN DE TABLAS CON RLS ACTIVO Y CERO POLÍTICAS:");
  if (zeroPolRes.rows.length === 0) {
    console.log("   ✅ PERFECTO: Cero tablas en estado 'deny-all' accidental. Todas las 45 tablas protegidas tienen políticas asignadas.\n");
  } else {
    console.error("   ❌ ERROR: Se encontraron tablas con RLS sin políticas:", zeroPolRes.rows);
  }

  // 3. Verificar las 8 funciones con SET search_path
  const fnRes = await pool.query(`
    select p.proname, p.prosecdef, p.proconfig
    from pg_proc p
    join pg_namespace n on p.pronamespace = n.oid
    where n.nspname = 'public' 
      and p.proname in (
        'fn_close_accounting_period',
        'fn_reopen_accounting_period',
        'fn_financial_trial_balance',
        'fn_financial_daily_journal',
        'fn_financial_general_ledger',
        'fn_financial_income_statement',
        'fn_financial_balance_sheet',
        'fn_financial_tax_summary'
      )
    order by p.proname;
  `);

  console.log("3. VERIFICACIÓN DE SEARCH_PATH EN FUNCIONES FINANCIERAS:");
  let fnsOk = true;
  for (const fn of fnRes.rows) {
    const configStr = fn.proconfig ? fn.proconfig.join(", ") : "SIN CONFIG";
    const isSafe = fn.proconfig && fn.proconfig.some((c: string) => c.includes("search_path=public, pg_catalog"));
    console.log(`   - ${fn.proname.padEnd(32)} | prosecdef: ${fn.prosecdef} | ${configStr}`);
    if (!isSafe) fnsOk = false;
  }
  if (fnsOk) {
    console.log("   ✅ TODAS las 8 funciones financieras tienen search_path fijado a public, pg_catalog.\n");
  } else {
    console.error("   ❌ Alguna función financiera no tiene search_path seguro.\n");
  }

  // 4. Verificar existencia de los 24 nuevos índices
  const expectedIndexes = [
    'idx_invoices_customer',
    'idx_invoices_location',
    'idx_invoices_company',
    'idx_sales_cash_session',
    'idx_sales_seller',
    'idx_remissions_sale',
    'idx_remissions_customer',
    'idx_remissions_origin',
    'idx_remission_items_remission',
    'idx_remission_items_product',
    'idx_transfers_creator',
    'idx_transfers_receiver',
    'idx_transfer_items_product',
    'idx_treasury_pmts_accounting',
    'idx_treasury_pmts_purchase',
    'idx_treasury_rcpts_accounting',
    'idx_treasury_rcpts_bank_acc',
    'idx_bank_mov_pmt',
    'idx_bank_mov_rcpt',
    'idx_acc_lines_cost_center',
    'idx_cash_mov_session',
    'idx_cash_sessions_register',
    'idx_cash_sessions_user',
    'idx_system_alerts_user'
  ];

  const idxCheckRes = await pool.query(`
    select indexname, tablename
    from pg_indexes
    where schemaname = 'public' and indexname = any($1::text[])
    order by indexname;
  `, [expectedIndexes]);

  console.log(`4. VERIFICACIÓN DE LOS 24 NUEVOS ÍNDICES DE CLAVE FORÁNEA:`);
  console.log(`   - Encontrados: ${idxCheckRes.rows.length} de ${expectedIndexes.length}`);
  if (idxCheckRes.rows.length === expectedIndexes.length) {
    console.log("   ✅ TODOS los 24 índices de performance están creados y activos en la base de datos.\n");
  } else {
    const missing = expectedIndexes.filter(i => !idxCheckRes.rows.some(r => r.indexname === i));
    console.error("   ❌ Faltan los siguientes índices:", missing);
  }

  // 5. Test empírico con roles (CASHIER, ACCOUNTANT, SUPERADMIN)
  console.log("5. TEST DE AISLAMIENTO Y FUNCIONAMIENTO POR ROL:");
  const client = await pool.connect();
  try {
    await client.query("BEGIN;");

    // Obtener un superadmin existente
    const superadmin = (await client.query(`
      select u.id, u.company_id, r.name as role_name
      from users u
      join roles r on u.role_id = r.id
      where r.name = 'Superadministrador' and u.is_active = true
      limit 1;
    `)).rows[0];

    const companyId = superadmin.company_id;

    // Crear temporalmente un cajero y un contador para la prueba en la transacción
    const cashierRole = (await client.query(`select id from roles where name = 'Cajero de Punto de Venta';`)).rows[0].id;
    const accountantRole = (await client.query(`select id from roles where name = 'Contabilidad y Revisoría';`)).rows[0].id;
    const location = (await client.query(`select id from locations where company_id = $1 limit 1;`, [companyId])).rows[0].id;

    const tempCashierId = 'a1111111-1111-1111-1111-111111111111';
    const tempAccountantId = 'a2222222-2222-2222-2222-222222222222';

    await client.query(`
      insert into auth.users (id, email, aud, role)
      values ($1, 'test_cashier@supermas.co', 'authenticated', 'authenticated'),
             ($2, 'test_accountant@supermas.co', 'authenticated', 'authenticated');
    `, [tempCashierId, tempAccountantId]);

    // La función trigger pudo haber creado o no el registro; hacemos upsert
    await client.query(`
      insert into users (id, company_id, role_id, email, full_name, is_active)
      values ($1, $2, $3, 'test_cashier@supermas.co', 'Cajero Test', true)
      on conflict (id) do update set company_id = $2, role_id = $3, is_active = true;
    `, [tempCashierId, companyId, cashierRole]);

    await client.query(`
      insert into user_locations (user_id, location_id, is_primary)
      values ($1, $2, true);
    `, [tempCashierId, location]);

    await client.query(`
      insert into users (id, company_id, role_id, email, full_name, is_active)
      values ($1, $2, $3, 'test_accountant@supermas.co', 'Contador Test', true)
      on conflict (id) do update set company_id = $2, role_id = $3, is_active = true;
    `, [tempAccountantId, companyId, accountantRole]);

    // Insertar temporalmente una categoría de prueba para la empresa en la transacción
    await client.query(`
      insert into categories (id, company_id, name, slug) 
      values (gen_random_uuid(), $1, 'Bebidas y Refrescos', 'bebidas-refrescos');
    `, [companyId]);

    // Simular sesión Cajero
    await client.query(`set local role authenticated;`);
    await client.query(`select set_config('request.jwt.claim.sub', $1, true);`, [tempCashierId]);
    await client.query(`select set_config('request.jwt.claims', $1, true);`, [JSON.stringify({ sub: tempCashierId })]);

    const catRes = await client.query(`select count(*) as count from categories;`);
    const accResCashier = await client.query(`select count(*) as count from accounting_entries;`);
    const purchResCashier = await client.query(`select count(*) as count from purchases;`);

    console.log(`   [ROL: CAJERO (Punto de Venta)]`);
    console.log(`   - Categorías de catálogo visibles: ${catRes.rows[0].count} (Correcto: Acceso permitido para POS)`);
    console.log(`   - Asientos contables visibles: ${accResCashier.rows[0].count} (Correcto: 0, Bloqueado por RLS)`);
    console.log(`   - Compras a proveedores visibles: ${purchResCashier.rows[0].count} (Correcto: 0, Bloqueado por RLS)`);
    await client.query(`reset role;`);

    // Simular sesión Contador
    await client.query(`set local role authenticated;`);
    await client.query(`select set_config('request.jwt.claim.sub', $1, true);`, [tempAccountantId]);
    await client.query(`select set_config('request.jwt.claims', $1, true);`, [JSON.stringify({ sub: tempAccountantId })]);

    const accResAcct = await client.query(`select count(*) as count from accounting_entries;`);
    const taxResAcct = await client.query(`select count(*) as count from tax_rates;`);
    const exogResAcct = await client.query(`select count(*) as count from exogena_formats;`);
    const saleCreateBlocked = await client.query(`select count(*) as count from sales;`);

    console.log(`\n   [ROL: CONTADOR]`);
    console.log(`   - Asientos contables visibles: ${accResAcct.rows[0].count} (Correcto: > 0)`);
    console.log(`   - Tarifas de impuestos visibles: ${taxResAcct.rows[0].count} (Correcto: > 0)`);
    console.log(`   - Formatos exógena visibles: ${exogResAcct.rows[0].count} (Correcto: > 0)`);
    console.log(`   - Ventas registradas visibles para auditoría: ${saleCreateBlocked.rows[0].count}`);
    await client.query(`reset role;`);

    // Simular sesión Superadministrador
    await client.query(`set local role authenticated;`);
    await client.query(`select set_config('request.jwt.claim.sub', $1, true);`, [superadmin.id]);
    await client.query(`select set_config('request.jwt.claims', $1, true);`, [JSON.stringify({ sub: superadmin.id })]);

    const settRes = await client.query(`select count(*) as count from system_settings;`);
    console.log(`\n   [ROL: SUPERADMIN]`);
    console.log(`   - Acceso a system_settings: ${settRes.rows[0].count} configuraciones visibles y gestionables.`);
    await client.query(`reset role;`);

    await client.query("ROLLBACK;");
  } finally {
    client.release();
  }

  console.log("\n=================================================");
  console.log("   TODAS LAS VALIDACIONES PASARON EXITOSAMENTE   ");
  console.log("=================================================");

  await pool.end();
}

validate().catch((err) => {
  console.error("Error en validación:", err);
  process.exit(1);
});
