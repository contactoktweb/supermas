import { documentSearchHref } from '@/hooks/useDocumentSearchParam'
import { SourceDocumentType } from '../types'

/** Módulo donde se consulta cada tipo de documento que mueve el inventario. */
const SOURCE_DOCUMENT_ROUTES: Partial<Record<SourceDocumentType, string>> = {
  PURCHASE_RECEIPT: '/recepciones',
  PURCHASE_INVOICE: '/compras',
  POS_SALE: '/ventas',
  ELECTRONIC_INVOICE: '/facturacion',
  WAREHOUSE_TRANSFER: '/transferencias',
  CUSTOMER_RETURN: '/devoluciones',
  REMISSION_ORDER: '/remisiones',
}

/**
 * Enlace al documento origen de un movimiento, ya filtrado por su número.
 * Los ajustes y reversiones no tienen un módulo aparte: su detalle es el propio movimiento.
 */
export function sourceDocumentHref(type: SourceDocumentType, documentNumber: string): string | null {
  const route = SOURCE_DOCUMENT_ROUTES[type]
  return route && documentNumber ? documentSearchHref(route, documentNumber) : null
}
