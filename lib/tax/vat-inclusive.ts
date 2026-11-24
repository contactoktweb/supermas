/**
 * Precios de venta con IVA INCLUIDO (regla del negocio): el precio del producto es lo que paga
 * el cliente y de él se desglosan la base y el IVA. Misma fórmula y redondeo a centavos que el
 * servidor (fn_execute_pos_sale 096 y fn_create_sale_with_payments_internal / fn_create_public_web_order 097).
 */

/** Redondeo a centavos, como NUMERIC(15,2) en el servidor. */
export const roundMoney = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100

/** Precio antes de IVA de un precio con IVA incluido. */
export function priceBeforeVat(priceWithVat: number, vatRatePercent: number): number {
  return roundMoney((priceWithVat * 100) / (100 + (Number(vatRatePercent) || 0)))
}

export interface VatInclusiveLine {
  /** Base sin IVA antes del descuento. */
  grossBase: number
  /** Descuento expresado sobre la base (grossBase - descuento = taxableBase). */
  discountAmount: number
  /** Base gravable (sin IVA, después del descuento). */
  taxableBase: number
  /** IVA contenido en el total. */
  taxAmount: number
  /** Lo que paga el cliente por la línea (taxableBase + taxAmount). */
  total: number
}

export function computeVatInclusiveLine(
  quantity: number,
  unitPriceWithVat: number,
  discountPercent: number,
  vatRatePercent: number
): VatInclusiveLine {
  const rate = Number(vatRatePercent) || 0
  const gross = roundMoney(quantity * unitPriceWithVat)
  const total = roundMoney(gross - roundMoney(gross * ((Number(discountPercent) || 0) / 100)))
  const taxableBase = roundMoney((total * 100) / (100 + rate))
  const grossBase = roundMoney((gross * 100) / (100 + rate))
  return {
    grossBase,
    discountAmount: roundMoney(grossBase - taxableBase),
    taxableBase,
    taxAmount: roundMoney(total - taxableBase),
    total,
  }
}
