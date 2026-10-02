import { Client } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
  const client = new Client({ connectionString: process.env.DIRECT_URL });
  await client.connect();

  const tables = [
    'customers',
    'sales',
    'sale_items',
    'treasury_receipts',
    'customer_payments',
    'cash_registers',
    'cash_sessions',
    'cash_movements',
    'bank_accounts',
    'bank_movements',
    'audit_logs'
  ];

  console.log('=== ESQUEMA DE TABLAS PARA CLIENTES Y CXC ===');
  for (const t of tables) {
    const res = await client.query(
      `SELECT column_name, data_type, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1
       ORDER BY ordinal_position;`,
      [t]
    );
    if (res.rows.length === 0) {
      console.log(`\n--- TABLE: ${t} (NO EXISTE) ---`);
    } else {
      console.log(`\n--- TABLE: ${t} (${res.rows.length} columnas) ---`);
      for (const r of res.rows) {
        console.log(`  ${r.column_name.padEnd(25)} (${r.data_type}, nullable: ${r.is_nullable}, default: ${r.column_default})`);
      }
    }
  }

  console.log('\n=== RESTRICCIONES (CONSTRAINTS) ===');
  const cRes = await client.query(`
    SELECT c.relname, con.conname, pg_get_constraintdef(con.oid) as def
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = con.connamespace
    WHERE n.nspname = 'public' AND c.relname IN ('customers', 'sales', 'sale_items', 'treasury_receipts', 'customer_payments');
  `);
  for (const r of cRes.rows) {
    console.log(`  [${r.relname}] ${r.conname}: ${r.def}`);
  }

  console.log('\n=== DISPARADORES (TRIGGERS) ===');
  const trigRes = await client.query(`
    SELECT event_object_table, trigger_name, action_timing, event_manipulation, action_statement
    FROM information_schema.triggers
    WHERE trigger_schema = 'public' AND event_object_table IN ('customers', 'sales', 'sale_items', 'treasury_receipts', 'customer_payments')
    ORDER BY event_object_table, trigger_name;
  `);
  console.table(trigRes.rows);

  console.log('\n=== POLÍTICAS RLS ===');
  const polRes = await client.query(`
    SELECT tablename, policyname, cmd, permissive, roles, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN ('customers', 'sales', 'sale_items', 'treasury_receipts', 'customer_payments')
    ORDER BY tablename, cmd, policyname;
  `);
  for (const r of polRes.rows) {
    console.log(`  [${r.tablename}] ${r.policyname} (${r.cmd}): USING (${r.qual}) WITH CHECK (${r.with_check})`);
  }

  await client.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
