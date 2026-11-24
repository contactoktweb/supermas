import { computeVatInclusiveLine } from '@/lib/tax/vat-inclusive'

/**
 * Valores de una línea del POS. El precio de catálogo YA INCLUYE el IVA: el cliente paga
 * cantidad x precio (menos descuento) y de ese total se desglosan la base y el IVA.
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

export function computePOSLineAmounts(
  quantity: number,
  unitPriceWithVat: number,
  discountPercent: number,
  taxRatePercent: number
): POSLineAmounts {
  const line = computeVatInclusiveLine(quantity, unitPriceWithVat, discountPercent, taxRatePercent)
  return { subtotal: line.grossBase, discountAmount: line.discountAmount, taxAmount: line.taxAmount, total: line.total }
}
