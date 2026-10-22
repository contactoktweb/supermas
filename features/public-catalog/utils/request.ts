/**
 * SUPER MÁS ERP/POS - Lectura y validación de parámetros de la API Pública de Catálogos
 *
 * Todos los valores llegan desde clientes externos: se acotan y se validan contra listas cerradas.
 */

import { PublicCatalogFilters, StockAvailabilityLevel } from '../types'

/** Tope de elementos por página para la API pública (evita consultas masivas). */
export const PUBLIC_CATALOG_MAX_PAGE_SIZE = 100
export const PUBLIC_CATALOG_DEFAULT_PAGE_SIZE = 12

export type PublicCatalogChannel = 'supermas' | 'distributor'

const AVAILABILITY_LEVELS: readonly StockAvailabilityLevel[] = ['AVAILABLE', 'LOW_STOCK', 'OUT_OF_STOCK']
const SORT_FIELDS: readonly NonNullable<PublicCatalogFilters['sortBy']>[] = ['name', 'price', 'sku']
const SORT_ORDERS: readonly NonNullable<PublicCatalogFilters['sortOrder']>[] = ['asc', 'desc']

function pickAllowed<T extends string>(value: string | null, allowed: readonly T[]): T | undefined {
  return value !== null && (allowed as readonly string[]).includes(value) ? (value as T) : undefined
}

function parseOptionalNumber(value: string | null): number | undefined {
  if (value === null || value.trim() === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined
}

export function parsePublicPageSize(searchParams: URLSearchParams): number {
  const raw = searchParams.get('limit') ?? searchParams.get('pageSize')
  const parsed = raw === null ? PUBLIC_CATALOG_DEFAULT_PAGE_SIZE : parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed < 1) return PUBLIC_CATALOG_DEFAULT_PAGE_SIZE
  return Math.min(parsed, PUBLIC_CATALOG_MAX_PAGE_SIZE)
}

export function parsePublicPage(searchParams: URLSearchParams): number {
  const parsed = parseInt(searchParams.get('page') ?? '1', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
}

/** Canal solicitado: `channel` o `catalogo` (supermas | distributor | distribuidora). */
export function parsePublicChannel(searchParams: URLSearchParams): PublicCatalogChannel {
  const value = searchParams.get('channel') || searchParams.get('catalogo')
  return value === 'distributor' || value === 'distribuidora' ? 'distributor' : 'supermas'
}

/**
 * Empresa solicitada (query `companyId` o cabecera `x-company-id`).
 * El servicio solo la acepta si es un UUID de una empresa ACTIVA.
 */
export function readPublicCompanyId(request: Request, searchParams: URLSearchParams): string | undefined {
  return searchParams.get('companyId') || request.headers.get('x-company-id') || undefined
}

/** Filtros de listado del catálogo, validados y acotados. */
export function parsePublicCatalogFilters(request: Request, searchParams: URLSearchParams): PublicCatalogFilters {
  return {
    search: searchParams.get('search') || searchParams.get('q') || undefined,
    category: searchParams.get('category') || undefined,
    brand: searchParams.get('brand') || undefined,
    availability: pickAllowed(searchParams.get('availability'), AVAILABILITY_LEVELS),
    minPrice: parseOptionalNumber(searchParams.get('minPrice')),
    maxPrice: parseOptionalNumber(searchParams.get('maxPrice')),
    directPurchase: searchParams.has('directPurchase') ? searchParams.get('directPurchase') === 'true' : undefined,
    sortBy: pickAllowed(searchParams.get('sortBy'), SORT_FIELDS) || 'name',
    sortOrder: pickAllowed(searchParams.get('sortOrder'), SORT_ORDERS) || 'asc',
    page: parsePublicPage(searchParams),
    pageSize: parsePublicPageSize(searchParams),
    companyId: readPublicCompanyId(request, searchParams),
  }
}
