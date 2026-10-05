import { Client } from 'pg'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const MAIN_COMPANY_ID = 'd06ecec2-c3c9-4a02-94db-9ef81c556226'

async function cleanup() {
  const client = new Client({ connectionString: process.env.DIRECT_URL })
  await client.connect()

  console.log('🧹 INICIANDO LIMPIEZA ZERO-POLLUTION COMPLETA...')

  try {
    await client.query('BEGIN')
    await client.query("SET LOCAL app.is_test_cleanup = 'true'")

    // 1. Get test product IDs
    const testProdRes = await client.query(
      `SELECT id FROM products WHERE sku ILIKE '%TEST%' OR name ILIKE '%TEST%'`
    )
    const testProdIds = testProdRes.rows.map((r) => r.id)
    console.log(`Identificados ${testProdIds.length} productos de prueba.`)

    if (testProdIds.length > 0) {
      await client.query(`DELETE FROM quote_items WHERE product_id = ANY($1)`, [testProdIds])
      await client.query(`DELETE FROM return_items WHERE product_id = ANY($1)`, [testProdIds])
      await client.query(`DELETE FROM purchase_receipt_items WHERE product_id = ANY($1)`, [testProdIds])
      await client.query(`DELETE FROM product_prices WHERE product_id = ANY($1)`, [testProdIds])
      await client.query(`DELETE FROM web_order_items WHERE product_id = ANY($1)`, [testProdIds])
      await client.query(`DELETE FROM remission_items WHERE product_id = ANY($1)`, [testProdIds])
      await client.query(`DELETE FROM transfer_items WHERE product_id = ANY($1)`, [testProdIds])
      await client.query(`DELETE FROM sale_items WHERE product_id = ANY($1)`, [testProdIds])
      await client.query(`DELETE FROM purchase_items WHERE product_id = ANY($1)`, [testProdIds])
      await client.query(`DELETE FROM inventory_movements WHERE product_id = ANY($1)`, [testProdIds])
      await client.query(`DELETE FROM stock_levels WHERE product_id = ANY($1)`, [testProdIds])
      const delP = await client.query(`DELETE FROM products WHERE id = ANY($1) RETURNING id`, [testProdIds])
      console.log(`  - ${delP.rows.length} productos de prueba eliminados.`)
    }

    // 2. Get test location IDs
    const testLocRes = await client.query(
      `SELECT id FROM locations WHERE code ILIKE '%TEST%' OR name ILIKE '%TEST%' OR code ILIKE 'BOD-A%' OR code ILIKE 'BOD-B%' OR code ILIKE 'BOD-REM%' OR code ILIKE 'BOD-DEV%'`
    )
    const testLocIds = testLocRes.rows.map((r) => r.id)
    console.log(`Identificadas ${testLocIds.length} bodegas de prueba.`)

    if (testLocIds.length > 0) {
      await client.query(`DELETE FROM quotes WHERE location_id = ANY($1)`, [testLocIds])
      await client.query(`DELETE FROM returns WHERE location_id = ANY($1)`, [testLocIds])
      await client.query(`DELETE FROM customer_payments WHERE location_id = ANY($1)`, [testLocIds])
      await client.query(`DELETE FROM purchase_receipts WHERE location_id = ANY($1)`, [testLocIds])
      await client.query(`DELETE FROM supplier_payments WHERE location_id = ANY($1)`, [testLocIds])
      await client.query(`DELETE FROM cash_sessions WHERE cash_register_id IN (SELECT id FROM cash_registers WHERE location_id = ANY($1))`, [testLocIds])
      await client.query(`DELETE FROM cash_registers WHERE location_id = ANY($1)`, [testLocIds])
      await client.query(`DELETE FROM bank_movements WHERE location_id = ANY($1)`, [testLocIds])
      await client.query(`DELETE FROM treasury_receipts WHERE location_id = ANY($1)`, [testLocIds])
      await client.query(`DELETE FROM treasury_payments WHERE location_id = ANY($1)`, [testLocIds])
      await client.query(`DELETE FROM accounting_entries WHERE location_id = ANY($1)`, [testLocIds])
      await client.query(`DELETE FROM system_alerts WHERE location_id = ANY($1)`, [testLocIds])
      await client.query(`DELETE FROM purchase_items WHERE purchase_id IN (SELECT id FROM purchases WHERE location_id = ANY($1))`, [testLocIds])
      await client.query(`DELETE FROM purchases WHERE location_id = ANY($1)`, [testLocIds])
      await client.query(`DELETE FROM sale_items WHERE sale_id IN (SELECT id FROM sales WHERE location_id = ANY($1))`, [testLocIds])
      await client.query(`DELETE FROM sales WHERE location_id = ANY($1)`, [testLocIds])
      await client.query(`DELETE FROM transfer_items WHERE transfer_id IN (SELECT id FROM transfers WHERE origin_location_id = ANY($1) OR destination_location_id = ANY($1))`, [testLocIds])
      await client.query(`DELETE FROM transfers WHERE origin_location_id = ANY($1) OR destination_location_id = ANY($1)`, [testLocIds])
      await client.query(`DELETE FROM inventory_movements WHERE location_id = ANY($1)`, [testLocIds])
      await client.query(`DELETE FROM stock_levels WHERE location_id = ANY($1)`, [testLocIds])
      await client.query(`DELETE FROM user_locations WHERE location_id = ANY($1)`, [testLocIds])
      const delL = await client.query(`DELETE FROM locations WHERE id = ANY($1) RETURNING id`, [testLocIds])
      console.log(`  - ${delL.rows.length} bodegas de prueba eliminadas.`)
    }

    // 3. Test users
    const testUsersRes = await client.query(
      `SELECT id FROM users WHERE email LIKE '%@supermas.test' OR email LIKE '%@supermas.local' OR email LIKE '%@staging%'`
    )
    const testUserIds = testUsersRes.rows.map((r) => r.id)
    if (testUserIds.length > 0) {
      await client.query(`DELETE FROM user_locations WHERE user_id = ANY($1)`, [testUserIds])
      await client.query(`DELETE FROM cash_movements WHERE session_id IN (SELECT id FROM cash_sessions WHERE user_id = ANY($1))`, [testUserIds])
      await client.query(`DELETE FROM cash_sessions WHERE user_id = ANY($1)`, [testUserIds])
      await client.query(`DELETE FROM audit_logs WHERE user_id = ANY($1)`, [testUserIds])
      const delU = await client.query(`DELETE FROM users WHERE id = ANY($1) RETURNING id`, [testUserIds])
      console.log(`  - ${delU.rows.length} usuarios de prueba eliminados.`)
    }

    // 4. Test audit logs
    const delA = await client.query(
      `DELETE FROM audit_logs WHERE user_name ILIKE '%TEST%' OR new_value::text ILIKE '%TEST%' RETURNING id`
    )
    console.log(`  - ${delA.rows.length} auditorías de prueba eliminadas.`)

    await client.query('COMMIT')
    console.log('🎉 ZERO POLLUTION TOTAL ALCANZADO.')
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('❌ Error durante la limpieza:', err)
  } finally {
    await client.end()
  }
}

cleanup()
