import type { LocationWithMetrics } from '@/features/warehouses/types'

/** Sede/bodega mínima que necesita la vista de cajas. */
export type CashLocationOption = Pick<LocationWithMetrics, 'id' | 'name'>

export const ALL_LOCATIONS = 'ALL'

/** Base de apertura sugerida al abrir un turno (COP). */
export const DEFAULT_OPENING_FLOAT = 100000

/** Tiempo de permanencia del aviso de éxito (ms). */
export const TOAST_DURATION_MS = 6000

/**
 * Las animaciones globales (page-enter, hover de tarjetas y botones) no contemplan
 * prefers-reduced-motion; estas utilidades las anulan para quien lo solicite.
 */
export const REDUCED_MOTION_CLASS =
  'motion-reduce:animate-none! motion-reduce:transition-none! motion-reduce:transform-none!'

export function formatCOP(value: number | null | undefined): string {
  return `$${Number(value ?? 0).toLocaleString('es-CO')} COP`
}

export function formatSignedCOP(value: number): string {
  return value > 0 ? `+${formatCOP(value)}` : formatCOP(value)
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  return new Date(value).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })
}

export function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString('es-CO')
}

export type CashDifferenceKind = 'BALANCED' | 'SURPLUS' | 'SHORTAGE'

export function getDifferenceKind(difference: number): CashDifferenceKind {
  if (difference === 0) return 'BALANCED'
  return difference > 0 ? 'SURPLUS' : 'SHORTAGE'
}

export function getErrorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback
}
