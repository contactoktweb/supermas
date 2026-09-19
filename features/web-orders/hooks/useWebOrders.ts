'use client'

/**
 * SUPER MÁS ERP/POS - Hook Principal de Pedidos Web
 *
 * Encapsula la gestión de estado de pedidos, filtros reactivos con debounce,
 * paginación, métricas del dashboard y mutaciones del ciclo de vida.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { webOrderService } from '../services/web-order.service'
import {
  WebOrder,
  WebOrderFilters,
  WebOrderStats,
  WebOrderChecklist,
  InventoryCheckResult,
} from '../types'

export function useWebOrders() {
  const [orders, setOrders] = useState<WebOrder[]>([])
  const [stats, setStats] = useState<WebOrderStats | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [statsLoading, setStatsLoading] = useState<boolean>(true)
  const [actionLoading, setActionLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Filtros reactivos
  const [filters, setFilters] = useState<WebOrderFilters>({
    search: '',
    status: 'ALL',
    channel: 'ALL',
    paymentMethod: 'ALL',
    locationId: 'ALL',
    invoiceStatus: 'ALL',
    sortBy: 'date',
    sortOrder: 'desc',
    page: 1,
    pageSize: 10,
  })

  const [total, setTotal] = useState<number>(0)
  const [totalPages, setTotalPages] = useState<number>(1)

  // Referencia para debounce de búsqueda
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [debouncedSearch, setDebouncedSearch] = useState<string>('')

  const handleSearchChange = (term: string) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(term)
      setFilters((prev) => ({ ...prev, page: 1 }))
    }, 300)
  }

  // Carga de estadísticas
  const fetchStats = useCallback(async () => {
    try {
      setStatsLoading(true)
      const data = await webOrderService.getStats()
      setStats(data)
    } catch (err: any) {
      console.error('Error al obtener estadísticas de pedidos web:', err)
    } finally {
      setStatsLoading(false)
    }
  }, [])

  // Carga de pedidos con filtros
  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const result = await webOrderService.getOrders({
        ...filters,
        search: debouncedSearch,
      })
      setOrders(result.orders)
      setTotal(result.total)
      setTotalPages(result.totalPages)
    } catch (err: any) {
      setError(err.message || 'Error al cargar los pedidos web.')
    } finally {
      setLoading(false)
    }
  }, [filters, debouncedSearch])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  const showToast = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message })
    setTimeout(() => {
      setFeedback(null)
    }, 4500)
  }

  // Acciones de ciclo de vida
  const confirmOrder = async (orderId: string) => {
    try {
      setActionLoading(true)
      const updated = await webOrderService.confirmOrder(orderId)
      showToast('success', `Pedido ${updated.orderNumber} confirmado. Stock reservado con éxito.`)
      await Promise.all([fetchOrders(), fetchStats()])
      return updated
    } catch (err: any) {
      showToast('error', err.message || 'Error al confirmar pedido.')
      throw err
    } finally {
      setActionLoading(false)
    }
  }

  const startPreparation = async (orderId: string) => {
    try {
      setActionLoading(true)
      const updated = await webOrderService.startPreparation(orderId)
      showToast('success', `Pedido ${updated.orderNumber} pasó a estado de Preparación.`)
      await Promise.all([fetchOrders(), fetchStats()])
      return updated
    } catch (err: any) {
      showToast('error', err.message || 'Error al iniciar preparación.')
      throw err
    } finally {
      setActionLoading(false)
    }
  }

  const completePreparationChecklist = async (orderId: string, checklist: WebOrderChecklist) => {
    try {
      setActionLoading(true)
      const updated = await webOrderService.completePreparationChecklist(orderId, checklist)
      showToast(
        'success',
        `Alistamiento verificado para ${updated.orderNumber}. Pedido Listo para Despacho.`
      )
      await Promise.all([fetchOrders(), fetchStats()])
      return updated
    } catch (err: any) {
      showToast('error', err.message || 'Error al completar checklist.')
      throw err
    } finally {
      setActionLoading(false)
    }
  }

  const dispatchOrder = async (
    orderId: string,
    dispatchData: { courier: string; trackingNumber: string; deliveryNotes?: string }
  ) => {
    try {
      setActionLoading(true)
      const updated = await webOrderService.dispatchOrder(orderId, dispatchData)
      showToast(
        'success',
        `Pedido ${updated.orderNumber} despachado (${updated.courier} - ${updated.trackingNumber}). Venta generada.`
      )
      await Promise.all([fetchOrders(), fetchStats()])
      return updated
    } catch (err: any) {
      showToast('error', err.message || 'Error al despachar pedido.')
      throw err
    } finally {
      setActionLoading(false)
    }
  }

  const deliverOrder = async (orderId: string, notes?: string) => {
    try {
      setActionLoading(true)
      const updated = await webOrderService.deliverOrder(orderId, notes)
      showToast('success', `Pedido ${updated.orderNumber} marcado como Entregado a satisfacción.`)
      await Promise.all([fetchOrders(), fetchStats()])
      return updated
    } catch (err: any) {
      showToast('error', err.message || 'Error al registrar entrega.')
      throw err
    } finally {
      setActionLoading(false)
    }
  }

  const generateInvoice = async (orderId: string) => {
    try {
      setActionLoading(true)
      const updated = await webOrderService.generateInvoice(orderId)
      showToast(
        'success',
        `Factura Electrónica ${updated.invoiceNumber} emitida y validada exitosamente.`
      )
      await Promise.all([fetchOrders(), fetchStats()])
      return updated
    } catch (err: any) {
      showToast('error', err.message || 'Error al generar factura.')
      throw err
    } finally {
      setActionLoading(false)
    }
  }

  const cancelOrder = async (orderId: string, reason: string) => {
    try {
      setActionLoading(true)
      const updated = await webOrderService.cancelOrder(orderId, reason)
      showToast('success', `Pedido ${updated.orderNumber} cancelado. Reserva de inventario liberada.`)
      await Promise.all([fetchOrders(), fetchStats()])
      return updated
    } catch (err: any) {
      showToast('error', err.message || 'Error al cancelar pedido.')
      throw err
    } finally {
      setActionLoading(false)
    }
  }

  const checkAvailability = async (
    items: { productId: string; quantity: number }[]
  ): Promise<InventoryCheckResult[]> => {
    return webOrderService.checkAvailability(items)
  }

  const exportToCsv = async () => {
    try {
      setActionLoading(true)
      const csv = await webOrderService.exportOrdersToCsv(filters)
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.setAttribute('href', url)
      link.setAttribute('download', `pedidos_web_supermas_${new Date().toISOString().slice(0, 10)}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      showToast('success', 'Archivo CSV exportado exitosamente.')
    } catch (err: any) {
      showToast('error', err.message || 'Error al exportar pedidos.')
    } finally {
      setActionLoading(false)
    }
  }

  return {
    orders,
    stats,
    loading,
    statsLoading,
    actionLoading,
    error,
    feedback,
    filters,
    total,
    totalPages,
    setFilters,
    handleSearchChange,
    confirmOrder,
    startPreparation,
    completePreparationChecklist,
    dispatchOrder,
    deliverOrder,
    generateInvoice,
    cancelOrder,
    checkAvailability,
    exportToCsv,
    refresh: () => Promise.all([fetchOrders(), fetchStats()]),
  }
}
