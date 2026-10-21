/**
 * SUPER MÁS ERP/POS - Etiquetas del módulo de Devoluciones (condición y destino de la mercancía)
 */

import { DamagedGoodsDestination, DamagedGoodsStatus, ReturnItemCondition } from './types'

export const RETURN_ITEM_CONDITION_LABELS: Record<ReturnItemCondition, string> = {
  BUENO: 'Buen estado',
  MAL_ESTADO: 'Mal estado',
}

export const DAMAGED_DESTINATION_LABELS: Record<DamagedGoodsDestination, string> = {
  PRODUCCION: 'Producción',
  PROVEEDOR: 'Proveedor',
}

export const DAMAGED_STATUS_LABELS: Record<DamagedGoodsStatus, string> = {
  PENDIENTE: 'Pendiente de enviar',
  ENVIADO: 'Enviado',
}

/** Mínimo de caracteres de la nota cuando la mercancía va a producción sin sede seleccionada. */
export const MIN_PRODUCTION_NOTES_LENGTH = 5
