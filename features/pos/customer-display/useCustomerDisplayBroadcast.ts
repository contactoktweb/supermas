'use client'

import { useEffect, useMemo, useRef } from 'react'
import type { POSCartItem, POSTicketReceipt, POSTotals } from '../types'
import {
  type CustomerDisplayCart,
  type CustomerDisplayMessage,
  openCustomerDisplayChannel,
} from './customerDisplayChannel'

interface BroadcastInput {
  cart: POSCartItem[]
  totals: POSTotals
  customerName: string
  locationName: string
  lastReceipt: POSTicketReceipt | null
}

/** Publica el carrito y las ventas cerradas para la pantalla del cliente. */
export function useCustomerDisplayBroadcast({ cart, totals, customerName, locationName, lastReceipt }: BroadcastInput) {
  const channelRef = useRef<BroadcastChannel | null>(null)
  const previousCartRef = useRef<POSCartItem[]>([])
  const lastChangedRef = useRef<string | null>(null)

  const snapshot: CustomerDisplayCart = useMemo(() => {
    const previous = new Map(previousCartRef.current.map((item) => [item.id, item.quantity]))
    const changed = cart.find((item) => previous.get(item.id) !== item.quantity)
    if (changed) lastChangedRef.current = changed.id
    else if (!cart.some((item) => item.id === lastChangedRef.current)) lastChangedRef.current = null
    previousCartRef.current = cart

    return {
      customerName,
      locationName,
      items: cart.map((item) => ({
        id: item.id,
        name: item.productName,
        quantity: item.quantity,
        unitOfMeasure: item.unitOfMeasure,
        unitPrice: item.unitPrice,
        discountAmount: item.discountAmount,
        total: item.total,
      })),
      subtotal: totals.subtotal,
      discountTotal: totals.discountTotal || totals.discountAmount || 0,
      taxTotal: totals.taxTotal || totals.taxAmount || 0,
      totalAmount: totals.totalAmount,
      totalUnits: totals.totalUnits,
      lastChangedItemId: lastChangedRef.current,
    }
  }, [cart, totals, customerName, locationName])

  const snapshotRef = useRef(snapshot)
  snapshotRef.current = snapshot

  useEffect(() => {
    const channel = openCustomerDisplayChannel()
    channelRef.current = channel
    if (!channel) return
    channel.onmessage = (event: MessageEvent<CustomerDisplayMessage>) => {
      if (event.data?.type === 'request-state') {
        channel.postMessage({ type: 'cart', cart: snapshotRef.current } satisfies CustomerDisplayMessage)
      }
    }
    return () => {
      channel.close()
      channelRef.current = null
    }
  }, [])

  useEffect(() => {
    channelRef.current?.postMessage({ type: 'cart', cart: snapshot } satisfies CustomerDisplayMessage)
  }, [snapshot])

  useEffect(() => {
    if (!lastReceipt) return
    channelRef.current?.postMessage({
      type: 'sale-completed',
      sale: {
        saleNumber: lastReceipt.invoiceNumber || lastReceipt.saleNumber,
        totalAmount: lastReceipt.totalAmount,
        amountPaid: lastReceipt.amountPaid,
        changeAmount: lastReceipt.changeAmount ?? lastReceipt.change ?? 0,
      },
    } satisfies CustomerDisplayMessage)
  }, [lastReceipt])
}
