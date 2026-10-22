/**
 * SUPER MÁS ERP/POS — Permisos de precios para la interfaz (RBAC 057).
 * Solo deciden qué se muestra: la base vuelve a validar todo en las RPC y triggers de 069.
 */

import type { AuthUser } from '@/features/auth/types'

const PRICE_ADMIN_ROLES = ['ADMIN', 'SUPERADMIN']

export function canApprovePrices(user: AuthUser | null): boolean {
  if (!user) return false
  return PRICE_ADMIN_ROLES.includes(user.roleCode) || user.permissions.includes('prices.approve')
}

export function canRequestPrices(user: AuthUser | null): boolean {
  if (!user) return false
  return canApprovePrices(user) || user.permissions.includes('prices.request')
}
