'use client'

import { useState, useEffect, useCallback } from 'react'
import { salesService } from '../services/sales.service'
import { SaleDetail, CreateInvoiceFromSaleDTO, CreateRemissionFromSaleDTO, CancelSaleDTO } from '../types'

export function useSaleDetail(saleId: string | null) {
  const [sale, setSale] = useState<SaleDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchDetail = useCallback(async () => {
    if (!saleId) {
      setSale(null)
      return
    }

    try {
      setLoading(true)
      setError(null)
      const data = await salesService.getById(saleId)
      setSale(data)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al cargar detalle de venta'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [saleId])

  useEffect(() => {
    fetchDetail()
  }, [fetchDetail])

  const generateInvoice = async (type: 'FACTURA_ELECTRONICA' | 'FACTURA_POS') => {
    if (!saleId) return
    await salesService.generateInvoiceForSale({ saleId, type })
    await fetchDetail()
  }

  const generateRemission = async (details: { driverName?: string; deliveredBy?: string; notes?: string }) => {
    if (!saleId) return
    await salesService.generateRemissionForSale({ saleId, ...details })
    await fetchDetail()
  }

  const cancelSale = async (reason: string) => {
    if (!saleId) return
    await salesService.cancelSale({ saleId, reason })
    await fetchDetail()
  }

  return {
    sale,
    loading,
    error,
    refresh: fetchDetail,
    generateInvoice,
    generateRemission,
    cancelSale,
  }
}
