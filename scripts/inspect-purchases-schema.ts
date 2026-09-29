import { Client } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
  const client = new Client({ connectionString: process.env.DIRECT_URL });
  await client.connect();

  const tables = [
    'suppliers',
    'purchases',
    'purchase_items',
    'treasury_payments',
    'treasury_receipts'
  ];

  console.log('=== COLUMNAS DE TABLAS DE COMPRAS ===');
  for (const t of tables) {
    const res = await client.query(
      `SELECT column_name, data_type, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1
       ORDER BY ordinal_position;`,
      [t]
    );
    console.log(`\n--- TABLE: ${t} ---`);
    for (const r of res.rows) {
      console.log(`  ${r.column_name.padEnd(25)} (${r.data_type}, nullable: ${r.is_nullable}, default: ${r.column_default})`);
    }
  }

  console.log('\n=== RESTRICCIONES (CONSTRAINTS) ===');
  const cRes = await client.query(`
    SELECT c.relname, con.conname, pg_get_constraintdef(con.oid) as def
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = con.connamespace
    WHERE n.nspname = 'public' AND c.relname IN ('suppliers', 'purchases', 'purchase_items', 'treasury_payments');
  `);
  for (const r of cRes.rows) {
    console.log(`  [${r.relname}] ${r.conname}: ${r.def}`);
  }

  console.log('\n=== DISPARADORES (TRIGGERS) ===');
  const trigRes = await client.query(`
    SELECT event_object_table, trigger_name, action_timing, event_manipulation, action_statement
    FROM information_schema.triggers
    WHERE trigger_schema = 'public' AND event_object_table IN ('suppliers', 'purchases', 'purchase_items', 'treasury_payments')
    ORDER BY event_object_table, trigger_name;
  `);
  console.table(trigRes.rows);

  console.log('\n=== POLÍTICAS RLS ===');
  const polRes = await client.query(`
    SELECT tablename, policyname, cmd, permissive, roles, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN ('suppliers', 'purchases', 'purchase_items', 'treasury_payments')
    ORDER BY tablename, cmd, policyname;
  `);
  for (const r of polRes.rows) {
    console.log(`[${r.tablename}] ${r.cmd} - ${r.policyname} (roles: ${r.roles})`);
    console.log(`   QUAL: ${r.qual}`);
    console.log(`   WITH CHECK: ${r.with_check}`);
  }

  console.log('\n=== CUENTAS PUC RELACIONADAS CON COMPRAS ===');
  const accRes = await client.query(`
    SELECT code, name, nature
    FROM accounting_accounts
    WHERE code IN ('1435', '2205', '2365', '2367', '2368', '2408', '1110', '1105')
    ORDER BY code;
  `);
  console.table(accRes.rows);

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
