/**
 * SUPER MÁS ERP/POS - IVA de los precios publicados en los catálogos públicos
 *
 * Los precios del producto se guardan ANTES de IVA; la venta suma el IVA con la misma regla
 * que fn_create_sale_with_payments_internal (079) y fn_create_public_web_order (086):
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

/** Precio con IVA redondeado a centavos, como lo calcula la venta. */
export function priceWithVat(priceBeforeTax: number, vatRatePercent: number): number {
  return Math.round(priceBeforeTax * (100 + vatRatePercent)) / 100
}
