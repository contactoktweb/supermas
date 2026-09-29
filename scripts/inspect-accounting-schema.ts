import { Client } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
  const client = new Client({ connectionString: process.env.DIRECT_URL });
  await client.connect();

  console.log('=== AUDITORÍA DEL MÓDULO CONTABLE (PASO 13) ===');

  // 1. Tablas contables
  const tables = [
    'accounting_accounts',
    'accounting_periods',
    'cost_centers',
    'accounting_entries',
    'accounting_entry_lines'
  ];

  for (const t of tables) {
    const exists = await client.query(
      `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1);`,
      [t]
    );
    console.log(`\n--- TABLA: ${t} (Existe: ${exists.rows[0].exists}) ---`);
    if (exists.rows[0].exists) {
      const res = await client.query(
        `SELECT column_name, data_type, is_nullable, column_default
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1
         ORDER BY ordinal_position;`,
        [t]
      );
      for (const r of res.rows) {
        console.log(`  ${r.column_name.padEnd(25)} (${r.data_type}, nullable: ${r.is_nullable}, default: ${r.column_default})`);
      }
    }
  }

  // 2. Constraints en tablas contables
  console.log('\n=== RESTRICCIONES (CONSTRAINTS) ===');
  const cRes = await client.query(`
    SELECT c.relname, con.conname, pg_get_constraintdef(con.oid) as def
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = con.connamespace
    WHERE n.nspname = 'public' AND c.relname IN ('accounting_accounts', 'accounting_periods', 'cost_centers', 'accounting_entries', 'accounting_entry_lines');
  `);
  for (const r of cRes.rows) {
    console.log(`  [${r.relname}] ${r.conname}: ${r.def}`);
  }

  // 3. Triggers contables
  console.log('\n=== DISPARADORES CONTABLES (TRIGGERS) ===');
  const trigRes = await client.query(`
    SELECT event_object_table, trigger_name, action_timing, event_manipulation, action_statement
    FROM information_schema.triggers
    WHERE trigger_schema = 'public' AND event_object_table IN ('accounting_accounts', 'accounting_periods', 'cost_centers', 'accounting_entries', 'accounting_entry_lines')
    ORDER BY event_object_table, trigger_name;
  `);
  console.table(trigRes.rows);

  // 4. Funciones de triggers contables
  console.log('\n=== FUNCIONES DE VALIDACIÓN CONTABLE ===');
  const procRes = await client.query(`
    SELECT proname, prosrc
    FROM pg_proc
    WHERE proname IN ('fn_prevent_entries_on_closed_period', 'fn_enforce_accounting_double_entry', 'fn_prevent_posted_accounting_mutation', 'fn_prevent_posted_entry_lines_mutation');
  `);
  for (const r of procRes.rows) {
    console.log(`\n>>> FUNCIÓN: ${r.proname}\n${r.prosrc}`);
  }

  // 5. Políticas RLS
  console.log('\n=== POLÍTICAS RLS CONTABLES ===');
  const polRes = await client.query(`
    SELECT tablename, policyname, cmd, permissive, roles, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN ('accounting_accounts', 'accounting_periods', 'cost_centers', 'accounting_entries', 'accounting_entry_lines')
    ORDER BY tablename, cmd, policyname;
  `);
  for (const r of polRes.rows) {
    console.log(`[${r.tablename}] ${r.cmd} - ${r.policyname} (roles: ${r.roles})`);
    console.log(`   QUAL: ${r.qual}`);
    console.log(`   WITH CHECK: ${r.with_check}`);
  }

  // 6. Conteo de cuentas PUC existentes
  const pucCount = await client.query('SELECT count(*)::int as count FROM accounting_accounts;');
  console.log(`\nCuentas PUC registradas: ${pucCount.rows[0].count}`);

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
