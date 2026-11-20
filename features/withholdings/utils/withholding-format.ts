import type { WithholdingAppliesTo, WithholdingBaseType, WithholdingType } from '../types'

export const WITHHOLDING_TYPE_LABELS: Record<WithholdingType, string> = {
  RETEFUENTE: 'Retención en la fuente',
  RETEIVA: 'ReteIVA',
  RETEICA: 'ReteICA',
}

export const WITHHOLDING_APPLIES_TO_LABELS: Record<WithholdingAppliesTo, string> = {
  PURCHASES: 'Compras',
  SALES: 'Ventas',
  BOTH: 'Compras y ventas',
}

export const WITHHOLDING_BASE_LABELS: Record<WithholdingBaseType, string> = {
  SUBTOTAL: 'Base (valor antes de IVA)',
  TAX_AMOUNT: 'Valor del IVA',
}

const money = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 2 })
const rate = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 4 })

export const formatWithholdingMoney = (value: number): string => money.format(Number.isFinite(value) ? value : 0)
export const formatWithholdingRate = (value: number): string => `${rate.format(value)} %`
