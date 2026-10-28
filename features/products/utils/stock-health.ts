import type { ProductStockHealth } from '../types'

/**
 * Estado de existencias de un producto con sus umbrales (mínimo y crítico).
 * Es la regla única que usan Productos, Inventario y el detalle por bodega.
 */
export function computeStockHealth(quantity: number, criticalStock: number, minStock: number): ProductStockHealth {
  if (quantity <= 0) return 'OUT_OF_STOCK'
  if (quantity <= criticalStock) return 'CRITICAL'
  if (quantity <= minStock) return 'LOW_STOCK'
  return 'AVAILABLE'
}
