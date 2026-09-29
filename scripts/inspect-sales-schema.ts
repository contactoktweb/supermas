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
    'electronic_invoices',
    'tax_rates',
    'accounting_entries',
    'accounting_entry_lines',
    'audit_logs'
  ];

  for (const t of tables) {
    const res = await client.query(
      `SELECT column_name, data_type, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1
       ORDER BY ordinal_position;`,
      [t]
    );
    console.log(`\n=== TABLE: ${t} ===`);
    console.table(res.rows);
  }

  // Check constraints on stock_levels and sales
  const cRes = await client.query(`
    SELECT c.relname, con.conname, pg_get_constraintdef(con.oid) as def
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = con.connamespace
    WHERE n.nspname = 'public' AND c.relname IN ('stock_levels', 'sales', 'sale_items', 'electronic_invoices');
  `);
  console.log('\n=== CONSTRAINTS ===');
  console.table(cRes.rows);

  // Check triggers on inventory_movements, sales, electronic_invoices
  const trigRes = await client.query(`
    SELECT event_object_table, trigger_name, action_timing, event_manipulation, action_statement
    FROM information_schema.triggers
    WHERE trigger_schema = 'public'
    ORDER BY event_object_table, trigger_name;
  `);
  console.log('\n=== TRIGGERS ===');
  console.table(trigRes.rows);

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
