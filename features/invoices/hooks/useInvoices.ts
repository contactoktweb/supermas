'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { invoiceService } from '../services/invoice.service'
import {
  Invoice,
  InvoiceFilters,
  InvoiceStats,
  GenerateInvoicePayload,
  CreditNotePayload,
  InvoiceUserContext,
  InvoiceType,
  DIANStatus,
  InvoiceStatus,
} from '../types'

export function useInvoices() {
  const [userContext] = useState<InvoiceUserContext>({
    userId: 'usr-admin-01',
    userName: 'Admin Mauricio',
    userRole: 'Administrador',
    permissions: [
      'invoice.read',
      'invoice.create',
      'invoice.send_dian',
      'invoice.download',
      'invoice.cancel',
      'invoice.credit_note',
      'invoice.export',
    ],
  })

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

  // 6. Create Credit Note
  const handleCreateCreditNote = async (payload: CreditNotePayload) => {
    try {
      setActionLoading(true)
      const nc = await invoiceService.createCreditNote(payload, userContext)
      setIsCreditNoteModalOpen(false)
      setInvoiceForCreditNote(null)
      await fetchInvoices()
      await fetchStats()
      setSelectedInvoice(nc)
      setIsDrawerOpen(true)
      return nc
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al crear Nota Crédito'
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
  }

  const openCreditNoteModal = (invoice: Invoice) => {
    setInvoiceForCreditNote(invoice)
    setIsCreditNoteModalOpen(true)
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
    handleGenerateInvoice,
    // Credit Note Modal
    invoiceForCreditNote,
    isCreditNoteModalOpen,
    openCreditNoteModal,
    closeCreditNoteModal: () => {
      setIsCreditNoteModalOpen(false)
      setInvoiceForCreditNote(null)
    },
    handleCreateCreditNote,
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
    actionLoading,
  }
}
