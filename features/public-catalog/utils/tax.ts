/**
 * SUPER MÁS ERP/POS - IVA de los precios publicados en los catálogos públicos
 *
 * Los precios del producto se guardan CON IVA incluido; la venta desglosa el IVA con la misma regla
 * que fn_create_sale_with_payments_internal y fn_create_public_web_order (097):
 * exento (is_tax_exempt) o tratamiento EXENTO / EXCLUIDO → 0 %, si no tax_rate_percent.
 */

export interface ProductTaxRow {
  tax_rate_percent: number | string | null
  is_tax_exempt: boolean | null
  iva_treatment: string | null
}

export function effectiveVatRatePercent(row: ProductTaxRow): number {
  if (row.is_tax_exempt === true || row.iva_treatment === 'EXENTO' || row.iva_treatment === 'EXCLUIDO') {
    return 0
  }
  const rate = Number(row.tax_rate_percent ?? 0)
  return Number.isFinite(rate) && rate > 0 ? rate : 0
}

export { priceBeforeVat } from '@/lib/tax/vat-inclusive'
