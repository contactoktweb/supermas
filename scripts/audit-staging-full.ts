import { Client } from 'pg';

async function audit() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  console.log('--- CONECTADO A POSTGRESQL STAGING ---');

  // 1. Tablas y RLS status
  const tablesRes = await client.query(`
    SELECT 
      c.relname as table_name,
      c.relrowsecurity as rls_enabled,
      c.relforcerowsecurity as rls_forced
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' 
      AND c.relkind = 'r'
    ORDER BY c.relname;
  `);

  console.log('\n=== 1. TABLAS PÚBLICAS Y ESTADO RLS ===');
  console.log(JSON.stringify(tablesRes.rows, null, 2));

  // 2. Columnas por tabla, tipos, nullability, defaults
  const columnsRes = await client.query(`
    SELECT 
      table_name,
      column_name,
      ordinal_position,
      data_type,
      udt_name,
      is_nullable,
      column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position;
  `);

  // 3. Primary keys
  const pkRes = await client.query(`
    SELECT
      tc.table_name, 
      kcu.column_name,
      tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    WHERE tc.constraint_type = 'PRIMARY KEY'
      AND tc.table_schema = 'public'
    ORDER BY tc.table_name, kcu.ordinal_position;
  `);

  // 4. Foreign keys
  const fkRes = await client.query(`
    SELECT
      tc.table_name, 
      kcu.column_name, 
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name,
      tc.constraint_name,
      rc.delete_rule,
      rc.update_rule
    FROM information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    JOIN information_schema.referential_constraints AS rc
      ON rc.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' 
      AND tc.table_schema = 'public'
    ORDER BY tc.table_name, kcu.column_name;
  `);

  // 5. Unique constraints
  const uqRes = await client.query(`
    SELECT
      tc.table_name,
      kcu.column_name,
      tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    WHERE tc.constraint_type = 'UNIQUE'
      AND tc.table_schema = 'public'
    ORDER BY tc.table_name, tc.constraint_name, kcu.ordinal_position;
  `);

  // 6. Check constraints
  const chkRes = await client.query(`
    SELECT
      tc.table_name,
      tc.constraint_name,
      cc.check_clause
    FROM information_schema.table_constraints tc
    JOIN information_schema.check_constraints cc
      ON tc.constraint_name = cc.constraint_name
      AND tc.constraint_schema = cc.constraint_schema
    WHERE tc.constraint_type = 'CHECK'
      AND tc.table_schema = 'public'
    ORDER BY tc.table_name, tc.constraint_name;
  `);

  // 7. Índices existentes y FKs sin índice
  const indexesRes = await client.query(`
    SELECT
      tablename,
      indexname,
      indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
    ORDER BY tablename, indexname;
  `);

  // 8. Políticas RLS
  const policiesRes = await client.query(`
    SELECT
      schemaname,
      tablename,
      policyname,
      permissive,
      roles,
      cmd,
      qual,
      with_check
    FROM pg_policies
    WHERE schemaname = 'public'
    ORDER BY tablename, policyname;
  `);

  // 9. Funciones y procedures en public
  const funcsRes = await client.query(`
    SELECT
      p.proname as function_name,
      pg_get_function_identity_arguments(p.oid) as arguments,
      t.typname as return_type,
      p.prosecdef as is_security_definer,
      p.proleakproof as is_leakproof,
      p.proconfig as config_params
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_type t ON t.oid = p.prorettype
    WHERE n.nspname = 'public'
    ORDER BY p.proname;
  `);

  // 10. Triggers en public
  const triggersRes = await client.query(`
    SELECT
      trigger_schema,
      event_object_table,
      trigger_name,
      event_manipulation,
      action_statement,
      action_orientation,
      action_timing
    FROM information_schema.triggers
    WHERE trigger_schema = 'public'
    ORDER BY event_object_table, trigger_name;
  `);

  // 11. Conteo de filas en todas las tablas
  const counts: Record<string, number> = {};
  for (const t of tablesRes.rows) {
    try {
      const c = await client.query(`SELECT COUNT(*)::int as count FROM public."${t.table_name}";`);
      counts[t.table_name] = c.rows[0].count;
    } catch (err: any) {
      counts[t.table_name] = -1;
    }
  }

  // 12. Análisis de Multi-Tenant: ¿Qué tablas tienen company_id, location_id?
  const tenantCols: Record<string, { has_company_id: boolean; company_nullable: string; has_location_id: boolean; location_nullable: string }> = {};
  for (const t of tablesRes.rows) {
    const cols = columnsRes.rows.filter((c: any) => c.table_name === t.table_name);
    const compCol = cols.find((c: any) => c.column_name === 'company_id');
    const locCol = cols.find((c: any) => c.column_name === 'location_id');
    tenantCols[t.table_name] = {
      has_company_id: !!compCol,
      company_nullable: compCol ? compCol.is_nullable : 'N/A',
      has_location_id: !!locCol,
      location_nullable: locCol ? locCol.is_nullable : 'N/A',
    };
  }

  // 13. Verificaciones de integridad contable
  const unlinkedAccountingEntries = await client.query(`
    SELECT e.id, e.entry_number, e.status, COUNT(l.id)::int as lines_count
    FROM public.accounting_entries e
    LEFT JOIN public.accounting_entry_lines l ON l.entry_id = e.id
    GROUP BY e.id, e.entry_number, e.status
    HAVING COUNT(l.id) = 0;
  `);

  const unbalancedAccountingEntries = await client.query(`
    SELECT 
      e.id, 
      e.entry_number, 
      e.status, 
      COALESCE(SUM(l.debit_amount), 0) as total_debit, 
      COALESCE(SUM(l.credit_amount), 0) as total_credit,
      ABS(COALESCE(SUM(l.debit_amount), 0) - COALESCE(SUM(l.credit_amount), 0)) as diff
    FROM public.accounting_entries e
    JOIN public.accounting_entry_lines l ON l.entry_id = e.id
    GROUP BY e.id, e.entry_number, e.status
    HAVING ABS(COALESCE(SUM(l.debit_amount), 0) - COALESCE(SUM(l.credit_amount), 0)) > 0.001;
  `);

  // 14. Verificaciones de Kardex vs Stock Levels
  const orphanStockLevels = await client.query(`
    SELECT sl.id, sl.product_id, sl.location_id, sl.quantity
    FROM public.stock_levels sl
    LEFT JOIN public.products p ON p.id = sl.product_id
    WHERE p.id IS NULL;
  `);

  const orphanMovements = await client.query(`
    SELECT im.id, im.product_id, im.location_id, im.quantity_in, im.quantity_out
    FROM public.inventory_movements im
    LEFT JOIN public.products p ON p.id = im.product_id
    WHERE p.id IS NULL;
  `);

  const kardexVsStockMismatch = await client.query(`
    WITH mov_summary AS (
      SELECT 
        product_id, 
        location_id, 
        SUM(quantity_in - quantity_out) as calculated_stock
      FROM public.inventory_movements
      GROUP BY product_id, location_id
    )
    SELECT 
      sl.product_id,
      sl.location_id,
      sl.quantity as recorded_stock,
      COALESCE(ms.calculated_stock, 0) as calculated_stock,
      (sl.quantity - COALESCE(ms.calculated_stock, 0)) as diff
    FROM public.stock_levels sl
    LEFT JOIN mov_summary ms 
      ON ms.product_id = sl.product_id AND ms.location_id = sl.location_id
    WHERE ABS(sl.quantity - COALESCE(ms.calculated_stock, 0)) > 0.001;
  `);

  // 15. Roles y Permisos
  const rolesCount = await client.query(`
    SELECT r.code as role_code, COUNT(rp.permission_id)::int as permissions_count
    FROM public.roles r
    LEFT JOIN public.role_permissions rp ON rp.role_id = r.id
    GROUP BY r.code
    ORDER BY r.code;
  `);

  // Guardar resultado completo
  const reportData = {
    tables: tablesRes.rows,
    columns: columnsRes.rows,
    primary_keys: pkRes.rows,
    foreign_keys: fkRes.rows,
    unique_constraints: uqRes.rows,
    check_constraints: chkRes.rows,
    indexes: indexesRes.rows,
    policies: policiesRes.rows,
    functions: funcsRes.rows,
    triggers: triggersRes.rows,
    row_counts: counts,
    tenant_columns: tenantCols,
    integrity: {
      unlinked_accounting_entries: unlinkedAccountingEntries.rows,
      unbalanced_accounting_entries: unbalancedAccountingEntries.rows,
      orphan_stock_levels: orphanStockLevels.rows,
      orphan_movements: orphanMovements.rows,
      kardex_stock_mismatch: kardexVsStockMismatch.rows,
    },
    roles_permissions: rolesCount.rows,
  };

  const fs = await import('fs');
  fs.writeFileSync('scripts/audit_output.json', JSON.stringify(reportData, null, 2));
  console.log('\n✅ Auditoría completa extraída y guardada en scripts/audit_output.json');

  await client.end();
}

audit().catch((e) => {
  console.error('Error en auditoría:', e);
  process.exit(1);
});
