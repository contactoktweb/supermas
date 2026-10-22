/**
 * Canal entre la caja (POS) y la pantalla del cliente. Ambas ventanas corren en el mismo navegador
 * (la pantalla del cliente suele ir en un segundo monitor), así que basta BroadcastChannel:
 * sin servidor y sin datos sensibles (solo lo que el cliente ve en su factura).
 */

export const CUSTOMER_DISPLAY_CHANNEL = 'supermas-pos-customer-display'
export const CUSTOMER_DISPLAY_PATH = '/pos/pantalla-cliente'
export const CUSTOMER_DISPLAY_WINDOW = 'supermas-pantalla-cliente'

export interface CustomerDisplayItem {
  id: string
  name: string
  quantity: number
  unitOfMeasure: string
  unitPrice: number
  discountAmount: number
  total: number
}

export interface CustomerDisplayCart {
  customerName: string
  locationName: string
  items: CustomerDisplayItem[]
  subtotal: number
  discountTotal: number
  taxTotal: number
  totalAmount: number
  totalUnits: number
  /** Id del último producto agregado o modificado, para resaltarlo. */
  lastChangedItemId: string | null
}

export interface CustomerDisplaySale {
  saleNumber: string
  totalAmount: number
  amountPaid: number
  changeAmount: number
}

export type CustomerDisplayMessage =
  | { type: 'cart'; cart: CustomerDisplayCart }
  | { type: 'sale-completed'; sale: CustomerDisplaySale }
  /** La pantalla del cliente acaba de abrir y pide el estado actual. */
  | { type: 'request-state' }

export function openCustomerDisplayChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return null
  return new BroadcastChannel(CUSTOMER_DISPLAY_CHANNEL)
}

/** Abre (o enfoca si ya existe) la ventana de la pantalla del cliente. */
export function openCustomerDisplayWindow(): void {
  const popup = window.open(CUSTOMER_DISPLAY_PATH, CUSTOMER_DISPLAY_WINDOW, 'popup,width=1024,height=768')
  popup?.focus()
}
