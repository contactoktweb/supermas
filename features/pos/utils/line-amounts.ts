/**
 * Valores de una línea del POS. El precio de catálogo YA INCLUYE el IVA: el cliente paga
 * cantidad x precio (menos descuento) y de ese total se desglosan la base y el IVA.
 * Misma fórmula que fn_execute_pos_sale (migración 096), redondeando a centavos.
 *
 * - subtotal: base sin IVA antes del descuento.
 * - discountAmount: descuento sobre la base (subtotal - descuento + IVA = total).
 * - taxAmount: IVA contenido en el total.
 * - total: lo que paga el cliente por la línea.
 */
export interface POSLineAmounts {
  subtotal: number
  discountAmount: number
  taxAmount: number
  total: number
}

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100

export function computePOSLineAmounts(
  quantity: number,
  unitPriceWithVat: number,
  discountPercent: number,
  taxRatePercent: number
): POSLineAmounts {
  const rate = Number(taxRatePercent) || 0
  const gross = round2(quantity * unitPriceWithVat)
  const total = round2(gross - round2(gross * ((discountPercent || 0) / 100)))
  const taxable = round2((total * 100) / (100 + rate))
  const subtotal = round2((gross * 100) / (100 + rate))
  return {
    subtotal,
    discountAmount: round2(subtotal - taxable),
    taxAmount: round2(total - taxable),
    total,
  }
}
