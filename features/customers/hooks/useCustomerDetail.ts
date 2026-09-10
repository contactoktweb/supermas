'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { customerService } from '../services/customer.service'
import {
  CustomerDetail,
  CustomerPaymentDTO,
  CustomerDocumentDTO,
  CustomerPaymentSummary,
  CustomerDocumentSummary,
} from '../types'

export function useCustomerDetail(customerId: string | null) {
  const [customer, setCustomer] = useState<CustomerDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isMountedRef = useRef(true)

  const fetchDetail = useCallback(async () => {
    if (!customerId) {
      setCustomer(null)
      return
    }

    try {
      setLoading(true)
      setError(null)
      const data = await customerService.getById(customerId)
      if (isMountedRef.current) {
        setCustomer(data)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al cargar detalle del cliente'
      if (isMountedRef.current) {
        setError(msg)
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false)
      }
    }
  }, [customerId])

  useEffect(() => {
    isMountedRef.current = true
    fetchDetail()
    return () => {
      isMountedRef.current = false
    }
  }, [fetchDetail])

  const addPayment = async (dto: CustomerPaymentDTO): Promise<CustomerPaymentSummary> => {
    const res = await customerService.addPayment(dto)
    await fetchDetail()
    return res
  }

  const addDocument = async (dto: CustomerDocumentDTO): Promise<CustomerDocumentSummary> => {
    const res = await customerService.addDocument(dto)
    await fetchDetail()
    return res
  }

  return {
    customer,
    loading,
    error,
    refresh: fetchDetail,
    addPayment,
    addDocument,
  }
}
