/**
 * SUPER MÁS ERP/POS — Plan de cambios de precio al editar un producto.
 *
 * Separa lo que el formulario envía en dos grupos:
 * - `priceChanges`: listas cuyo precio cambia o que se crean. Viajan a la RPC
 *   fn_submit_price_changes, que decide en la base si se aplican (aprobador) o
 *   quedan pendientes de aprobación (migración 069).
 * - `metadataTiers`: listas existentes cuya cantidad mínima, estado o vigencia cambian.
 *   Se guardan conservando el nombre y el precio vigentes, de modo que la escritura
 *   directa nunca modifica un precio.
 */

import { PriceChangeInput, PriceTier } from '../types'

export interface PriceChangePlanInput {
  /** Listas actuales del producto (reales o sintetizadas desde las columnas planas). */
  existingTiers: PriceTier[]
  /** Precio público vigente (products.public_sale_price). */
  currentNormalPrice: number
  /** Precio mayorista vigente (products.wholesale_price). */
  currentWholesalePrice: number
  /** Listas enviadas por el formulario. */
  desiredTiers: PriceTier[]
}

export interface PriceChangePlan {
  priceChanges: PriceChangeInput[]
  metadataTiers: PriceTier[]
}

export function roundMoney(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100
}

function normalizeCode(code: string): string {
  return code.trim().toUpperCase()
}

function normalizeDate(value?: string | null): number | null {
  if (!value) return null
  const time = new Date(value).getTime()
  return Number.isNaN(time) ? null : time
}

function hasMetadataChanges(current: PriceTier, desired: PriceTier): boolean {
  return (
    Number(current.minQuantity ?? 1) !== Number(desired.minQuantity ?? 1) ||
    Boolean(current.isActive ?? true) !== Boolean(desired.isActive ?? true) ||
    normalizeDate(current.startDate) !== normalizeDate(desired.startDate) ||
    normalizeDate(current.endDate) !== normalizeDate(desired.endDate)
  )
}

export function planPriceChanges({
  existingTiers,
  currentNormalPrice,
  currentWholesalePrice,
  desiredTiers,
}: PriceChangePlanInput): PriceChangePlan {
  const existingByCode = new Map<string, PriceTier>()
  existingTiers.forEach((tier) => existingByCode.set(normalizeCode(tier.code), tier))

  const priceChanges: PriceChangeInput[] = []
  const metadataTiers: PriceTier[] = []

  desiredTiers.forEach((desired) => {
    const code = normalizeCode(desired.code)
    const existing = existingByCode.get(code)
    const desiredPrice = roundMoney(desired.price)

    let currentPrice: number | null = null
    if (existing) currentPrice = roundMoney(existing.price)
    else if (code === 'NORMAL') currentPrice = roundMoney(currentNormalPrice)
    else if (code === 'MAYORISTA') currentPrice = roundMoney(currentWholesalePrice)

    const isNewList = currentPrice === null
    const priceChanged = isNewList ? desiredPrice > 0 : desiredPrice !== currentPrice

    if (priceChanged) {
      priceChanges.push({
        priceListCode: code,
        priceListName: desired.name.trim(),
        proposedPrice: desiredPrice,
        currentPrice,
        minQuantity: Number(desired.minQuantity ?? 1),
        isActive: desired.isActive ?? true,
        startDate: desired.startDate || null,
        endDate: desired.endDate || null,
      })
    }

    // Solo listas ya existentes: el precio enviado es siempre el vigente.
    if (existing && currentPrice !== null && hasMetadataChanges(existing, desired)) {
      metadataTiers.push({
        ...desired,
        code,
        name: existing.name,
        price: currentPrice,
      })
    }
  })

  return { priceChanges, metadataTiers }
}

/** Variación porcentual de un precio (null si el precio vigente es 0 o la lista es nueva). */
export function calculatePriceVariation(currentPrice: number | null | undefined, proposedPrice: number): number | null {
  if (currentPrice === null || currentPrice === undefined || currentPrice <= 0) return null
  return Math.round(((proposedPrice - currentPrice) / currentPrice) * 10000) / 100
}

/** Texto de variación con signo explícito: "+12,5 %" / "-3 %". */
export function formatPriceVariation(variation: number | null): string {
  if (variation === null) return 'Lista nueva'
  const sign = variation > 0 ? '+' : ''
  return `${sign}${variation.toLocaleString('es-CO', { maximumFractionDigits: 2 })} %`
}
