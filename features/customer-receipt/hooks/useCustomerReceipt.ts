'use client'

import { useEffect, useState } from 'react'
import { customerReceiptService } from '../services/customer-receipt.service'
import { CustomerReceiptData } from '../types'

export type CustomerReceiptState =
  | { status: 'loading' }
  | { status: 'not_found' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: CustomerReceiptData }

export function useCustomerReceipt(saleId: string, cashReceived?: number): CustomerReceiptState {
  const [state, setState] = useState<CustomerReceiptState>({ status: 'loading' })

  useEffect(() => {
    let alive = true
    setState({ status: 'loading' })
    customerReceiptService
      .getBySaleId(saleId, { cashReceived })
      .then((data) => {
        if (alive) setState(data ? { status: 'ready', data } : { status: 'not_found' })
      })
      .catch((e: unknown) => {
        if (alive) setState({ status: 'error', message: e instanceof Error ? e.message : 'No se pudo cargar el comprobante.' })
      })
    return () => {
      alive = false
    }
  }, [saleId, cashReceived])

  return state
}
