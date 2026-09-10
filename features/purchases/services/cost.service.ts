/**
 * SUPER MÁS ERP/POS - Servicio de Cálculo y Actualización de Costos de Inventario
 *
 * Cumple con la regla maestra contable:
 * El costo debe poder calcularse por producto + bodega.
 * Método primario: Promedio Ponderado Móvil.
 * Estructura extensible para PEPS / FIFO.
 * NUNCA utiliza el precio de venta como costo.
 */

export interface CostCalculationInput {
  currentStock: number
  currentAverageCost: number
  incomingQuantity: number
  incomingUnitCost: number
}

export interface CostCalculationResult {
  previousAverageCost: number
  newAverageCost: number
  previousStock: number
  incomingQuantity: number
  resultingStock: number
  inventoryValueAtCost: number
  method: 'PROMEDIO_PONDERADO' | 'PEPS_FIFO'
}

export class CostService {
  /**
   * Calcula el nuevo costo promedio ponderado tras una recepción de compra o entrada valorizada.
   * Fórmula: ((Stock Actual * Costo Promedio Actual) + (Cantidad Entrada * Costo Unitario Entrada)) / (Stock Total Resultante)
   */
  calculateWeightedAverageCost(
    inputOrStock: CostCalculationInput | number,
    currentAverageCost?: number,
    incomingQuantity?: number,
    incomingUnitCost?: number
  ): CostCalculationResult | number {
    let input: CostCalculationInput
    const isPositional = typeof inputOrStock === 'number'

    if (isPositional) {
      input = {
        currentStock: inputOrStock,
        currentAverageCost: currentAverageCost || 0,
        incomingQuantity: incomingQuantity || 0,
        incomingUnitCost: incomingUnitCost || 0,
      }
    } else {
      input = inputOrStock
    }

    const prevStock = Math.max(0, input.currentStock)
    const prevCost = Math.max(0, input.currentAverageCost)
    const inQty = Math.max(0, input.incomingQuantity)
    const inCost = Math.max(0, input.incomingUnitCost)

    const resultingStock = prevStock + inQty

    let newAverageCost = prevCost

    if (resultingStock <= 0) {
      newAverageCost = inCost > 0 ? inCost : prevCost
    } else if (prevStock === 0) {
      // Si no había stock previo, el costo de la entrada define el nuevo costo promedio
      newAverageCost = inCost
    } else if (inQty === 0) {
      // Sin entrada, mantiene el costo previo
      newAverageCost = prevCost
    } else {
      const prevTotalValue = prevStock * prevCost
      const inTotalValue = inQty * inCost
      newAverageCost = Math.round((prevTotalValue + inTotalValue) / resultingStock)
    }

    if (isPositional) {
      return newAverageCost
    }

    const inventoryValueAtCost = Math.round(resultingStock * newAverageCost)

    return {
      previousAverageCost: prevCost,
      newAverageCost,
      previousStock: prevStock,
      incomingQuantity: inQty,
      resultingStock,
      inventoryValueAtCost,
      method: 'PROMEDIO_PONDERADO',
    }
  }

  /**
   * Arquitectura preparada para costeo PEPS / FIFO por lotes y capas de compra.
   */
  calculateFIFODispatch(
    lots: { lotId: string; availableQty: number; unitCost: number }[],
    requestedQuantity: number
  ): {
    dispatchedLots: { lotId: string; quantity: number; unitCost: number; subtotal: number }[]
    totalCost: number
    remainingQuantity: number
  } {
    let remainingToDispatch = requestedQuantity
    let totalCost = 0
    const dispatchedLots = []

    for (const lot of lots) {
      if (remainingToDispatch <= 0) break
      if (lot.availableQty <= 0) continue

      const qtyFromLot = Math.min(lot.availableQty, remainingToDispatch)
      const subtotal = qtyFromLot * lot.unitCost
      totalCost += subtotal
      remainingToDispatch -= qtyFromLot

      dispatchedLots.push({
        lotId: lot.lotId,
        quantity: qtyFromLot,
        unitCost: lot.unitCost,
        subtotal,
      })
    }

    return {
      dispatchedLots,
      totalCost,
      remainingQuantity: remainingToDispatch,
    }
  }
}

export const costService = new CostService()
