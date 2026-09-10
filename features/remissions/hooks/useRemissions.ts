'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { remissionService } from '../services/remission.service'
import {
  Remission,
  RemissionFilters,
  RemissionStats,
  CreateRemissionPayload,
  CreateFromSalePayload,
  DispatchRemissionPayload,
  DeliverRemissionPayload,
  RemissionUserContext,
  RemissionStatus,
} from '../types'

export function useRemissions() {
  const [userContext] = useState<RemissionUserContext>({
    userId: 'usr-admin-01',
    userName: 'Admin Mauricio',
    userRole: 'Administrador',
    permissions: [
      'remission.read',
      'remission.create',
      'remission.update',
      'remission.dispatch',
      'remission.receive',
      'remission.cancel',
      'remission.export',
    ],
  })

  // List & Filter States
  const [remissions, setRemissions] = useState<Remission[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [activeTab, setActiveTab] = useState<string>('Todas')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<RemissionStatus | 'ALL'>('ALL')
  const [selectedLocation, setSelectedLocation] = useState<string>('ALL')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // Stats State
  const [stats, setStats] = useState<RemissionStats>({
    totalRemissions: 0,
    pendingDispatch: 0,
    inTransit: 0,
    delivered: 0,
    cancelled: 0,
    deliveredUnits: 0,
    uniqueCustomers: 0,
  })
  const [statsLoading, setStatsLoading] = useState(true)

  // Drawer Detail State
  const [selectedRemission, setSelectedRemission] = useState<Remission | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  // New Remission Drawer (Wizard)
  const [isNewRemissionOpen, setIsNewRemissionOpen] = useState(false)

  // From Sale Modal
  const [isFromSaleModalOpen, setIsFromSaleModalOpen] = useState(false)
  const [pendingSales, setPendingSales] = useState<any[]>([])
  const [pendingSalesLoading, setPendingSalesLoading] = useState(false)

  // Dispatch Modal
  const [remissionForDispatch, setRemissionForDispatch] = useState<Remission | null>(null)
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false)

  // Deliver Modal
  const [remissionForDeliver, setRemissionForDeliver] = useState<Remission | null>(null)
  const [isDeliverModalOpen, setIsDeliverModalOpen] = useState(false)

  // Cancel Modal
  const [remissionForCancel, setRemissionForCancel] = useState<Remission | null>(null)
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false)

  // Action Loading states
  const [actionLoading, setActionLoading] = useState(false)

  const isMountedRef = useRef(true)

  // 1. Fetch Stats
  const fetchStats = useCallback(async () => {
    try {
      setStatsLoading(true)
      const data = await remissionService.getRemissionStats(userContext)
      if (isMountedRef.current) {
        setStats(data)
      }
    } catch (err) {
      console.error('Error al cargar estadísticas de remisiones:', err)
    } finally {
      if (isMountedRef.current) {
        setStatsLoading(false)
      }
    }
  }, [userContext])

  // 2. Fetch Remissions List
  const fetchRemissions = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const filters: RemissionFilters = {
        query: searchQuery,
        tab: activeTab,
        status: selectedStatus,
        locationId: selectedLocation,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        page,
        pageSize,
      }
      const res = await remissionService.list(filters, userContext)
      if (isMountedRef.current) {
        setRemissions(res.data)
        setTotal(res.total)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al cargar remisiones'
      if (isMountedRef.current) {
        setError(msg)
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false)
      }
    }
  }, [
    searchQuery,
    activeTab,
    selectedStatus,
    selectedLocation,
    dateFrom,
    dateTo,
    page,
    pageSize,
    userContext,
  ])

  useEffect(() => {
    isMountedRef.current = true
    fetchRemissions()
    fetchStats()
    return () => {
      isMountedRef.current = false
    }
  }, [fetchRemissions, fetchStats])

  // 3. Load Pending Sales for Remission
  const loadPendingSales = useCallback(async () => {
    try {
      setPendingSalesLoading(true)
      const sales = await remissionService.getSalesPendingRemission(userContext)
      if (isMountedRef.current) {
        setPendingSales(sales)
      }
    } catch (err) {
      console.error('Error al cargar ventas pendientes de remisión:', err)
    } finally {
      if (isMountedRef.current) {
        setPendingSalesLoading(false)
      }
    }
  }, [userContext])

  const openFromSaleModal = () => {
    setIsFromSaleModalOpen(true)
    loadPendingSales()
  }

  // 4. Create Remission Handler
  const handleCreateRemission = async (payload: CreateRemissionPayload) => {
    try {
      setActionLoading(true)
      const created = await remissionService.create(payload, userContext)
      setIsNewRemissionOpen(false)
      await fetchRemissions()
      await fetchStats()
      setSelectedRemission(created)
      setIsDrawerOpen(true)
      return created
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al crear remisión'
      throw new Error(msg)
    } finally {
      setActionLoading(false)
    }
  }

  // 5. Create from Sale Handler
  const handleCreateFromSale = async (payload: CreateFromSalePayload) => {
    try {
      setActionLoading(true)
      const created = await remissionService.createFromSale(payload, userContext)
      setIsFromSaleModalOpen(false)
      await fetchRemissions()
      await fetchStats()
      setSelectedRemission(created)
      setIsDrawerOpen(true)
      return created
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al generar remisión desde venta'
      throw new Error(msg)
    } finally {
      setActionLoading(false)
    }
  }

  // 6. Dispatch Handler
  const handleConfirmDispatch = async (payload: DispatchRemissionPayload) => {
    try {
      setActionLoading(true)
      const dispatched = await remissionService.dispatch(payload, userContext)
      setIsDispatchModalOpen(false)
      setRemissionForDispatch(null)
      await fetchRemissions()
      await fetchStats()
      if (selectedRemission && selectedRemission.id === payload.remissionId) {
        setSelectedRemission(dispatched)
      }
      return dispatched
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al despachar remisión'
      throw new Error(msg)
    } finally {
      setActionLoading(false)
    }
  }

  // 7. Deliver Handler
  const handleConfirmDeliver = async (payload: DeliverRemissionPayload) => {
    try {
      setActionLoading(true)
      const delivered = await remissionService.deliver(payload, userContext)
      setIsDeliverModalOpen(false)
      setRemissionForDeliver(null)
      await fetchRemissions()
      await fetchStats()
      if (selectedRemission && selectedRemission.id === payload.remissionId) {
        setSelectedRemission(delivered)
      }
      return delivered
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al confirmar entrega'
      throw new Error(msg)
    } finally {
      setActionLoading(false)
    }
  }

  // 8. Cancel Handler
  const handleConfirmCancel = async (remissionId: string, reason: string) => {
    try {
      setActionLoading(true)
      const cancelled = await remissionService.cancel({ remissionId, reason }, userContext)
      setIsCancelModalOpen(false)
      setRemissionForCancel(null)
      await fetchRemissions()
      await fetchStats()
      if (selectedRemission && selectedRemission.id === remissionId) {
        setSelectedRemission(cancelled)
      }
      return cancelled
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al anular remisión'
      throw new Error(msg)
    } finally {
      setActionLoading(false)
    }
  }

  // Open Helpers
  const openDetailDrawer = (rem: Remission) => {
    setSelectedRemission(rem)
    setIsDrawerOpen(true)
  }

  const openDispatchModal = (rem: Remission) => {
    setRemissionForDispatch(rem)
    setIsDispatchModalOpen(true)
  }

  const openDeliverModal = (rem: Remission) => {
    setRemissionForDeliver(rem)
    setIsDeliverModalOpen(true)
  }

  const openCancelModal = (rem: Remission) => {
    setRemissionForCancel(rem)
    setIsCancelModalOpen(true)
  }

  return {
    userContext,
    // Data & stats
    remissions,
    total,
    loading,
    error,
    stats,
    statsLoading,
    refreshRemissions: fetchRemissions,
    refreshStats: fetchStats,
    // Filters & Pagination
    activeTab,
    setActiveTab: (tab: string) => {
      setActiveTab(tab)
      setPage(1)
    },
    searchQuery,
    setSearchQuery: (q: string) => {
      setSearchQuery(q)
      setPage(1)
    },
    selectedStatus,
    setSelectedStatus: (st: RemissionStatus | 'ALL') => {
      setSelectedStatus(st)
      setPage(1)
    },
    selectedLocation,
    setSelectedLocation: (loc: string) => {
      setSelectedLocation(loc)
      setPage(1)
    },
    dateFrom,
    setDateFrom: (d: string) => {
      setDateFrom(d)
      setPage(1)
    },
    dateTo,
    setDateTo: (d: string) => {
      setDateTo(d)
      setPage(1)
    },
    page,
    setPage,
    pageSize,
    setPageSize,
    // Drawer Detail
    selectedRemission,
    isDrawerOpen,
    openDetailDrawer,
    closeDetailDrawer: () => setIsDrawerOpen(false),
    // New Remission Drawer Wizard
    isNewRemissionOpen,
    openNewRemission: () => setIsNewRemissionOpen(true),
    closeNewRemission: () => setIsNewRemissionOpen(false),
    handleCreateRemission,
    // From Sale Modal
    isFromSaleModalOpen,
    openFromSaleModal,
    closeFromSaleModal: () => setIsFromSaleModalOpen(false),
    pendingSales,
    pendingSalesLoading,
    handleCreateFromSale,
    // Dispatch Modal
    remissionForDispatch,
    isDispatchModalOpen,
    openDispatchModal,
    closeDispatchModal: () => {
      setIsDispatchModalOpen(false)
      setRemissionForDispatch(null)
    },
    handleConfirmDispatch,
    // Deliver Modal
    remissionForDeliver,
    isDeliverModalOpen,
    openDeliverModal,
    closeDeliverModal: () => {
      setIsDeliverModalOpen(false)
      setRemissionForDeliver(null)
    },
    handleConfirmDeliver,
    // Cancel Modal
    remissionForCancel,
    isCancelModalOpen,
    openCancelModal,
    closeCancelModal: () => {
      setIsCancelModalOpen(false)
      setRemissionForCancel(null)
    },
    handleConfirmCancel,
    actionLoading,
  }
}
