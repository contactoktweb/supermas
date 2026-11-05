import type { TaxProfile } from '../types'

/**
 * Cuenta auxiliar de inventario según el IVA del producto (migración 094).
 * Debe coincidir con public.fn_inventory_account_for_iva, que la asigna en la base.
 * null: producto al 0 % sin clasificar (debe clasificarse como exento o excluido).
 */
export function inventoryAccountCodeForTax(taxProfile: TaxProfile | string, ratePercent: number): string | null {
  if (taxProfile === 'EXCLUIDO') return '143504.01'
  if (taxProfile === 'EXENTO') return '143503.01'
  if (taxProfile === 'IVA_0') return null
  const rate = Number(ratePercent) || 0
  if (rate === 5) return '143502.01'
  if (rate > 0) return '143501.01'
  return null
}
