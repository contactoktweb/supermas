import { supabaseClient } from '@/lib/supabase/client'
import type { LightIconName } from '@/components/ui/Icon'

export interface SearchResultItem {
  id: string
  category: 'modules' | 'products' | 'customers' | 'suppliers' | 'invoices' | 'remissions' | 'locations'
  categoryLabel: string
  title: string
  subtitle: string
  badge?: string
  badgeTone?: 'blue' | 'green' | 'amber' | 'red' | 'gray'
  iconName: LightIconName
  destinationView: string
  destinationRoute: string
  meta?: string
}

const PRODUCT_LIMIT = 4
const RECORD_LIMIT = 3

const formatCOP = (value: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value)

/** Quita los caracteres con significado en los filtros de PostgREST (comodines, comas y paréntesis). */
function toFilterTerm(query: string): string {
  return query.replace(/[%_,()*\\]/g, ' ').trim()
}

/**
 * Busca registros reales (productos, clientes, proveedores, facturas, remisiones y bodegas)
 * para el buscador global. RLS limita los resultados a la empresa del usuario.
 */
export async function searchRecords(query: string): Promise<SearchResultItem[]> {
  const term = toFilterTerm(query)
  if (term.length < 2) return []
  const like = `%${term}%`

  const [products, customers, suppliers, invoices, remissions, locations] = await Promise.all([
    supabaseClient
      .from('products')
      .select('id, name, sku, public_sale_price, unit_of_measure, categories(name)')
      .eq('is_active', true)
      .or(`name.ilike.${like},sku.ilike.${like},barcode.ilike.${like}`)
      .limit(PRODUCT_LIMIT),
    supabaseClient
      .from('customers')
      .select('id, company_name, first_name, last_name, document_type, document_number, city, customer_category')
      .or(`company_name.ilike.${like},first_name.ilike.${like},last_name.ilike.${like},document_number.ilike.${like}`)
      .limit(RECORD_LIMIT),
    supabaseClient
      .from('suppliers')
      .select('id, name, tax_id, contact_name, city')
      .or(`name.ilike.${like},legal_name.ilike.${like},tax_id.ilike.${like}`)
      .limit(RECORD_LIMIT),
    supabaseClient
      .from('electronic_invoices')
      .select('id, full_number, internal_number, total_amount, dian_status, document_type')
      .or(`full_number.ilike.${like},internal_number.ilike.${like}`)
      .limit(RECORD_LIMIT),
    supabaseClient
      .from('remissions')
      .select('id, code, status, delivery_city')
      .ilike('code', like)
      .limit(RECORD_LIMIT),
    supabaseClient
      .from('locations')
      .select('id, name, code, city, type')
      .or(`name.ilike.${like},code.ilike.${like},city.ilike.${like}`)
      .limit(RECORD_LIMIT),
  ])

  const list: SearchResultItem[] = []

  for (const p of (products.data || []) as any[]) {
    list.push({
      id: `prod-${p.id}`,
      category: 'products',
      categoryLabel: 'Productos',
      title: p.name,
      subtitle: `SKU: ${p.sku}${p.categories?.name ? ` • ${p.categories.name}` : ''}`,
      badge: p.public_sale_price ? formatCOP(Number(p.public_sale_price)) : p.unit_of_measure,
      badgeTone: 'green',
      iconName: 'products',
      destinationView: 'Inventario',
      destinationRoute: `/inventario?q=${encodeURIComponent(p.sku)}`,
    })
  }

  for (const c of (customers.data || []) as any[]) {
    const name = c.company_name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Cliente'
    list.push({
      id: `cust-${c.id}`,
      category: 'customers',
      categoryLabel: 'Clientes',
      title: name,
      subtitle: `${c.document_type || 'DOC'}: ${c.document_number}${c.city ? ` • ${c.city}` : ''}`,
      badge: c.customer_category === 'WHOLESALE' ? 'Mayorista' : 'Cliente',
      badgeTone: 'blue',
      iconName: 'customers',
      destinationView: 'Clientes',
      destinationRoute: `/clientes?q=${encodeURIComponent(c.document_number || name)}`,
    })
  }

  for (const s of (suppliers.data || []) as any[]) {
    list.push({
      id: `sup-${s.id}`,
      category: 'suppliers',
      categoryLabel: 'Proveedores',
      title: s.name,
      subtitle: `NIT: ${s.tax_id}${s.contact_name ? ` • Contacto: ${s.contact_name}` : ''}`,
      badge: s.city || 'Proveedor',
      badgeTone: 'amber',
      iconName: 'suppliers',
      destinationView: 'Proveedores',
      destinationRoute: `/proveedores?q=${encodeURIComponent(s.tax_id || s.name)}`,
    })
  }

  for (const inv of (invoices.data || []) as any[]) {
    const number = inv.full_number || inv.internal_number
    const accepted = inv.dian_status === 'ACCEPTED'
    list.push({
      id: `inv-${inv.id}`,
      category: 'invoices',
      categoryLabel: 'Facturación',
      title: number,
      subtitle: `Total: ${formatCOP(Number(inv.total_amount || 0))}`,
      badge: accepted ? 'Aceptada DIAN' : 'Pendiente DIAN',
      badgeTone: accepted ? 'green' : 'amber',
      iconName: 'invoices',
      destinationView: 'Facturación',
      destinationRoute: `/facturacion?q=${encodeURIComponent(number)}`,
    })
  }

  for (const rem of (remissions.data || []) as any[]) {
    list.push({
      id: `rem-${rem.id}`,
      category: 'remissions',
      categoryLabel: 'Remisiones',
      title: `Remisión ${rem.code}`,
      subtitle: rem.delivery_city ? `Destino: ${rem.delivery_city}` : 'Despacho de mercancía',
      badge: rem.status === 'DELIVERED' ? 'Entregada' : 'En curso',
      badgeTone: 'blue',
      iconName: 'remisiones',
      destinationView: 'Remisiones',
      destinationRoute: `/remisiones?q=${encodeURIComponent(rem.code)}`,
    })
  }

  for (const loc of (locations.data || []) as any[]) {
    list.push({
      id: `loc-${loc.id}`,
      category: 'locations',
      categoryLabel: 'Bodegas',
      title: loc.name,
      subtitle: `Código: ${loc.code}${loc.city ? ` • ${loc.city}` : ''}`,
      badge: loc.type === 'STORE_POINT' ? 'Punto de venta' : 'Bodega',
      badgeTone: 'gray',
      iconName: 'warehouse',
      destinationView: 'Bodegas',
      destinationRoute: `/bodegas/${loc.id}`,
    })
  }

  return list
}
