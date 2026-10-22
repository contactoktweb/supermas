'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { DianNoteRequest } from '../services/dian-api.client'
import { invoiceService } from '../services/invoice.service'
import {
  Invoice,
  InvoiceFilters,
  InvoiceStats,
  GenerateInvoicePayload,
  InvoiceUserContext,
  InvoiceType,
  DIANStatus,
  InvoiceStatus,
} from '../types'

export function useInvoices() {
  // Contexto real del usuario autenticado (permisos desde PostgreSQL). La seguridad efectiva
  // la aplican el servidor (/api/dian) y las funciones SQL; esto solo ajusta la interfaz.
  const { user: authUser } = useAuth()
  const userContext = useMemo<InvoiceUserContext>(() => {
    const dbPerms = new Set(authUser?.permissions || [])
    const isAdmin = authUser?.roleCode === 'ADMIN' || authUser?.roleCode === 'SUPERADMIN'
    const has = (p: string) => isAdmin || dbPerms.has(p)
    const permissions: string[] = []
    if (has('invoices.read')) permissions.push('invoice.read', 'invoice.download', 'invoice.export')
    if (has('invoices.create')) permissions.push('invoice.create')
    // Notas crédito/débito: permiso invoices.cancel ("Emitir notas crédito y cancelaciones DIAN")
    if (has('invoices.cancel')) permissions.push('invoice.credit_note')
    if (has('invoices.create') || has('dian.manage')) permissions.push('invoice.send_dian')
    if (has('invoices.cancel')) permissions.push('invoice.cancel')
    return {
      userId: authUser?.id || '',
      userName: authUser?.fullName || 'Usuario',
      userRole: authUser?.roleCode || '',
      permissions,
    }
  }, [authUser])

  // List & Filter States
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [activeTab, setActiveTab] = useState<string>('Todas')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedType, setSelectedType] = useState<InvoiceType | 'ALL'>('ALL')
  const [selectedDianStatus, setSelectedDianStatus] = useState<DIANStatus | 'ALL'>('ALL')
  const [selectedLocation, setSelectedLocation] = useState<string>('ALL')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // Stats State
  const [stats, setStats] = useState<InvoiceStats>({
    totalGenerated: 0,
    electronicSent: 0,
    pendingDIAN: 0,
    rejectedDIAN: 0,
    cancelledCount: 0,
    totalAmountBilled: 0,
    creditNotesCount: 0,
    creditNotesTotal: 0,
    currency: 'COP',
  })
  const [statsLoading, setStatsLoading] = useState(true)

  // Drawer Detail State
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  // Modals States
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false)
  const [pendingSales, setPendingSales] = useState<any[]>([])
  const [pendingSalesLoading, setPendingSalesLoading] = useState(false)

  const [invoiceForCreditNote, setInvoiceForCreditNote] = useState<Invoice | null>(null)
  const [isCreditNoteModalOpen, setIsCreditNoteModalOpen] = useState(false)

  const [invoiceForCancel, setInvoiceForCancel] = useState<Invoice | null>(null)
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false)

  const [invoiceForXml, setInvoiceForXml] = useState<Invoice | null>(null)
  const [isXmlModalOpen, setIsXmlModalOpen] = useState(false)

  // Action Loading states
  const [actionLoading, setActionLoading] = useState(false)

  const isMountedRef = useRef(true)

  // 1. Fetch Stats
  const fetchStats = useCallback(async () => {
    try {
      setStatsLoading(true)
      const data = await invoiceService.getInvoiceStats(userContext)
      if (isMountedRef.current) {
        setStats(data)
      }
    } catch (err) {
      console.error('Error al cargar estadísticas de facturación:', err)
    } finally {
      if (isMountedRef.current) {
        setStatsLoading(false)
      }
    }
  }, [userContext])

  // 2. Fetch Invoices List
  const fetchInvoices = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const filters: InvoiceFilters = {
        query: searchQuery,
        tab: activeTab,
        type: selectedType,
        dianStatus: selectedDianStatus,
        locationId: selectedLocation,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        page,
        pageSize,
      }
      const res = await invoiceService.list(filters, userContext)
      if (isMountedRef.current) {
        setInvoices(res.data)
        setTotal(res.total)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al cargar facturas'
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
    selectedType,
    selectedDianStatus,
    selectedLocation,
    dateFrom,
    dateTo,
    page,
    pageSize,
    userContext,
  ])

  useEffect(() => {
    isMountedRef.current = true
    fetchInvoices()
    fetchStats()
    return () => {
      isMountedRef.current = false
    }
  }, [fetchInvoices, fetchStats])

  // 3. Load Pending Sales for Invoicing
  const loadPendingSales = useCallback(async () => {
    try {
      setPendingSalesLoading(true)
      const sales = await invoiceService.getSalesPendingInvoicing(userContext)
      if (isMountedRef.current) {
        setPendingSales(sales)
      }
    } catch (err) {
      console.error('Error al cargar ventas pendientes:', err)
    } finally {
      if (isMountedRef.current) {
        setPendingSalesLoading(false)
      }
    }
  }, [userContext])

  const openGenerateModal = () => {
    setIsGenerateModalOpen(true)
    loadPendingSales()
  }

  // 4. Generate Invoice from Sale
  const handleGenerateInvoice = async (payload: GenerateInvoicePayload) => {
    try {
      setActionLoading(true)
      const newInv = await invoiceService.generateFromSale(payload, userContext)
      setIsGenerateModalOpen(false)
      await fetchInvoices()
      await fetchStats()
      setSelectedInvoice(newInv)
      setIsDrawerOpen(true)
      return newInv
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al generar la factura'
      throw new Error(msg)
    } finally {
      setActionLoading(false)
    }
  }

  // 5. Send or Retry DIAN Transmission
  const handleSendToDIAN = async (invoiceId: string) => {
    try {
      setActionLoading(true)
      const res = await invoiceService.sendToDIAN(invoiceId, userContext)
      await fetchInvoices()
      await fetchStats()
      if (selectedInvoice && selectedInvoice.id === invoiceId) {
        setSelectedInvoice(res.invoice)
      }
      return res
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al transmitir a la DIAN'
      throw new Error(msg)
    } finally {
      setActionLoading(false)
    }
  }

  // 5b. Consultar estado del envío en la DIAN (TrackId)
  const handleCheckDianStatus = async (invoiceId: string) => {
    try {
      setActionLoading(true)
      const res = await invoiceService.checkDianStatus(invoiceId, userContext)
      await fetchInvoices()
      await fetchStats()
      if (selectedInvoice && selectedInvoice.id === invoiceId) {
        setSelectedInvoice(res.invoice)
      }
      return res
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al consultar el estado en la DIAN'
      throw new Error(msg)
    } finally {
      setActionLoading(false)
    }
  }

  // 6. Nota crédito / débito electrónica (la emite el servidor)
  const handleCreateNote = async (note: DianNoteRequest, idempotencyKey: string) => {
    try {
      setActionLoading(true)
      const res = await invoiceService.createNote(note, idempotencyKey, userContext)
      await fetchInvoices()
      await fetchStats()
      const errors = res.errors?.length ? ` ${res.errors.join(' | ')}` : ''
      return { message: `${res.message}${errors}`, documentNumber: res.documentNumber }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al emitir la nota'
      throw new Error(msg)
    } finally {
      setActionLoading(false)
    }
  }

  // 7. Cancel Invoice
  const handleCancelInvoice = async (invoiceId: string, reason: string) => {
    try {
      setActionLoading(true)
      const cancelled = await invoiceService.cancelInvoice({ invoiceId, reason }, userContext)
      setIsCancelModalOpen(false)
      setInvoiceForCancel(null)
      await fetchInvoices()
      await fetchStats()
      if (selectedInvoice && selectedInvoice.id === invoiceId) {
        setSelectedInvoice(cancelled)
      }
      return cancelled
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al anular la factura'
      throw new Error(msg)
    } finally {
      setActionLoading(false)
    }
  }

  // 8. Open Modals Helpers
  const openDetailDrawer = (invoice: Invoice) => {
    setSelectedInvoice(invoice)
    setIsDrawerOpen(true)
    // Detalle completo (líneas reales, resolución, eventos DIAN)
    invoiceService
      .getById(invoice.id, userContext)
      .then((full) => setSelectedInvoice((cur) => (cur && cur.id === full.id ? full : cur)))
      .catch(() => undefined)
  }


  const openCreditNoteModal = (invoice: Invoice) => {
    setInvoiceForCreditNote(invoice)
    setIsCreditNoteModalOpen(true)
    // La nota necesita las líneas reales de la venta y las notas ya emitidas
    invoiceService
      .getById(invoice.id, userContext)
      .then((full) => setInvoiceForCreditNote((cur) => (cur && cur.id === full.id ? full : cur)))
      .catch(() => undefined)
  }

  const openCancelModal = (invoice: Invoice) => {
    setInvoiceForCancel(invoice)
    setIsCancelModalOpen(true)
  }

  const openXmlModal = (invoice: Invoice) => {
    setInvoiceForXml(invoice)
    setIsXmlModalOpen(true)
  }

  return {
    userContext,
    canIssueNotes: userContext.permissions.includes('invoice.credit_note'),
    // Data & stats
    invoices,
    total,
    loading,
    error,
    stats,
    statsLoading,
    refreshInvoices: fetchInvoices,
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
    selectedType,
    setSelectedType: (type: InvoiceType | 'ALL') => {
      setSelectedType(type)
      setPage(1)
    },
    selectedDianStatus,
    setSelectedDianStatus: (st: DIANStatus | 'ALL') => {
      setSelectedDianStatus(st)
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
    // Drawer
    selectedInvoice,
    isDrawerOpen,
    openDetailDrawer,
    closeDetailDrawer: () => setIsDrawerOpen(false),
    // Generate Modal
    isGenerateModalOpen,
    openGenerateModal,
    closeGenerateModal: () => setIsGenerateModalOpen(false),
    pendingSales,
    pendingSalesLoading,
    loadPendingSales,
    handleGenerateInvoice,
    // Credit Note Modal
    invoiceForCreditNote,
    isCreditNoteModalOpen,
    openCreditNoteModal,
    closeCreditNoteModal: () => {
      setIsCreditNoteModalOpen(false)
      setInvoiceForCreditNote(null)
    },
    handleCreateNote,
    // Cancel Modal
    invoiceForCancel,
    isCancelModalOpen,
    openCancelModal,
    closeCancelModal: () => {
      setIsCancelModalOpen(false)
      setInvoiceForCancel(null)
    },
    handleCancelInvoice,
    // XML Modal
    invoiceForXml,
    isXmlModalOpen,
    openXmlModal,
    closeXmlModal: () => {
      setIsXmlModalOpen(false)
      setInvoiceForXml(null)
    },
    // DIAN Actions
    handleSendToDIAN,
    handleCheckDianStatus,
    actionLoading,
  }
}
