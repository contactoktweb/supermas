import { supabaseAdmin } from '../lib/supabase/admin'
import * as fs from 'fs'

if (fs.existsSync('.env.local')) {
  const envContent = fs.readFileSync('.env.local', 'utf8')
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx !== -1) {
      const k = trimmed.substring(0, idx).trim()
      let v = trimmed.substring(idx + 1).trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1)
      }
      process.env[k] = v
    }
  }
}

async function inspectSales() {
  const { data: sales, error } = await supabaseAdmin.from('sales').select('*').limit(1)
  console.log('Sale sample keys:', sales && sales[0] ? Object.keys(sales[0]) : null, error)
  console.log('Sale sample data:', sales ? sales[0] : null)
}

inspectSales().catch(e => { console.error(e); process.exit(1); })
