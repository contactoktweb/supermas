/** Ruta de la vista impresa para el cliente (15 × 20 cm) de una venta. */
export const CUSTOMER_RECEIPT_CASH_PARAM = 'recibido'

export function customerReceiptHref(saleId: string, options: { cashReceived?: number } = {}): string {
  const base = `/facturacion/cliente/${encodeURIComponent(saleId)}`
  const cash = options.cashReceived
  return cash !== undefined && Number.isFinite(cash) && cash > 0 ? `${base}?${CUSTOMER_RECEIPT_CASH_PARAM}=${Math.round(cash * 100) / 100}` : base
}
