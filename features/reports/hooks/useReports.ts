'use client'

import { useState, useEffect, useCallback, useTransition } from 'react'
import { reportService, DEFAULT_ANALYTICS_USER } from '../services/report.service'
import {
  ReportType,
  ReportPeriod,
  ReportFilterCriteria,
  ReportDashboardOverview,
  SalesReportData,
  PurchasesReportData,
  InventoryReportData,
  KardexReportData,
  CostsReportData,
  WarehousesReportData,
  CustomersReportData,
  SuppliersReportData,
  CashRegistersReportData,
  BillingReportData,
  AccountingReportData,
  EcommerceReportData,
  ReportCardNavInfo,
  UserReportContext,
  ExportFormat,
} from '../types'

export interface UseReportsOptions {
  initialType?: ReportType
  initialPeriod?: ReportPeriod
  initialLocationId?: string
  user?: UserReportContext
}

export function useReports(options: UseReportsOptions = {}) {
  const {
    initialType = 'OVERVIEW',
    initialPeriod = 'THIS_MONTH',
    initialLocationId = 'ALL',
    user = DEFAULT_ANALYTICS_USER,
  } = options

  const [isPending, startTransition] = useTransition()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null)

  // Filtros activos
  const [reportType, setReportType] = useState<ReportType>(initialType)
  const [period, setPeriod] = useState<ReportPeriod>(initialPeriod)
  const [locationId, setLocationId] = useState<string>(initialLocationId)
  const [secondLocationId, setSecondLocationId] = useState<string>('loc-002')
  const [categoryId, setCategoryId] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')

  // Opciones de filtros
  const [filterOptions, setFilterOptions] = useState<{
    locations: { value: string; label: string; code?: string }[]
    categories: { value: string; label: string }[]
    brands: { value: string; label: string }[]
    users: { value: string; label: string }[]
    periods: { value: string; label: string }[]
  }>({
    locations: [],
    categories: [],
    brands: [],
    users: [],
    periods: [],
  })

  // Datasets de reportes
  const [navCards, setNavCards] = useState<ReportCardNavInfo[]>([])
  const [dashboardData, setDashboardData] = useState<ReportDashboardOverview | null>(null)
  const [salesData, setSalesData] = useState<SalesReportData | null>(null)
  const [purchasesData, setPurchasesData] = useState<PurchasesReportData | null>(null)
  const [inventoryData, setInventoryData] = useState<InventoryReportData | null>(null)
  const [kardexData, setKardexData] = useState<KardexReportData | null>(null)
  const [costsData, setCostsData] = useState<CostsReportData | null>(null)
  const [warehousesData, setWarehousesData] = useState<WarehousesReportData | null>(null)
  const [customersData, setCustomersData] = useState<CustomersReportData | null>(null)
  const [suppliersData, setSuppliersData] = useState<SuppliersReportData | null>(null)
  const [cashData, setCashData] = useState<CashRegistersReportData | null>(null)
  const [billingData, setBillingData] = useState<BillingReportData | null>(null)
  const [accountingData, setAccountingData] = useState<AccountingReportData | null>(null)
  const [ecommerceData, setEcommerceData] = useState<EcommerceReportData | null>(null)

  // Drawer de detalle analítico
  const [detailItem, setDetailItem] = useState<{
    type: 'SALE' | 'PURCHASE' | 'PRODUCT' | 'CUSTOMER' | 'SUPPLIER' | 'REGISTER'
    id: string
    title: string
    data: any
  } | null>(null)

  // Carga de opciones de selectores
  useEffect(() => {
    async function loadOptions() {
      try {
        const [opts, cards] = await Promise.all([
          reportService.getFilterOptions(),
          reportService.getNavigationCards(user),
        ])
        setFilterOptions(opts)
        setNavCards(cards)
      } catch (err) {
        console.error('Error loading filter options:', err)
      }
    }
    loadOptions()
  }, [user])

  // Carga reactiva de datos según el reporte activo y filtros
  const fetchReportData = useCallback(async () => {
    setLoading(true)
    setError(null)

    const criteria: ReportFilterCriteria = {
      reportType,
      period,
      locationId: locationId !== 'ALL' ? locationId : undefined,
      secondLocationId: secondLocationId !== 'ALL' ? secondLocationId : undefined,
      categoryId: categoryId !== 'ALL' ? categoryId : undefined,
      searchQuery: searchQuery || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    }

    try {
      switch (reportType) {
        case 'OVERVIEW': {
          const res = await reportService.getDashboard(criteria, user)
          setDashboardData(res)
          break
        }
        case 'SALES': {
          const res = await reportService.getSalesReport(criteria, user)
          setSalesData(res)
          break
        }
        case 'PURCHASES': {
          const res = await reportService.getPurchasesReport(criteria, user)
          setPurchasesData(res)
          break
        }
        case 'INVENTORY': {
          const res = await reportService.getInventoryReport(criteria, user)
          setInventoryData(res)
          break
        }
        case 'KARDEX': {
          const res = await reportService.getKardexReport(criteria, user)
          setKardexData(res)
          break
        }
        case 'COSTS': {
          const res = await reportService.getCostsReport(criteria, user)
          setCostsData(res)
          break
        }
        case 'WAREHOUSES': {
          const res = await reportService.getWarehousesReport(criteria, user)
          setWarehousesData(res)
          break
        }
        case 'CUSTOMERS': {
          const res = await reportService.getCustomersReport(criteria, user)
          setCustomersData(res)
          break
        }
        case 'SUPPLIERS': {
          const res = await reportService.getSuppliersReport(criteria, user)
          setSuppliersData(res)
          break
        }
        case 'CASH': {
          const res = await reportService.getCashRegistersReport(criteria, user)
          setCashData(res)
          break
        }
        case 'BILLING': {
          const res = await reportService.getBillingReport(criteria, user)
          setBillingData(res)
          break
        }
        case 'ACCOUNTING': {
          const res = await reportService.getAccountingReport(criteria, user)
          setAccountingData(res)
          break
        }
        case 'ECOMMERCE': {
          const res = await reportService.getEcommerceReport(criteria, user)
          setEcommerceData(res)
          break
        }
      }
    } catch (err: any) {
      console.error('Error fetching report:', err)
      setError(err.message || 'Error al procesar el reporte solicitado.')
    } finally {
      setLoading(false)
    }
  }, [
    reportType,
    period,
    locationId,
    secondLocationId,
    categoryId,
    searchQuery,
    startDate,
    endDate,
    user,
  ])

  useEffect(() => {
    fetchReportData()
  }, [fetchReportData])

  // Notificaciones Toast
  const showToast = useCallback(
    (text: string, type: 'success' | 'error' | 'info' = 'success') => {
      setToastMessage({ text, type })
      setTimeout(() => setToastMessage(null), 4000)
    },
    []
  )

  // Manejador de exportación
  const exportReport = useCallback(
    async (format: ExportFormat) => {
      try {
        const criteria: ReportFilterCriteria = {
          reportType,
          period,
          locationId: locationId !== 'ALL' ? locationId : undefined,
          secondLocationId: secondLocationId !== 'ALL' ? secondLocationId : undefined,
          categoryId: categoryId !== 'ALL' ? categoryId : undefined,
          searchQuery: searchQuery || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        }

        await reportService.exportReportData({
          reportType,
          format,
          criteria,
          user,
        })

        showToast(`Reporte exportado exitosamente en formato ${format}`, 'success')
      } catch (err: any) {
        showToast(err.message || 'Error al exportar reporte', 'error')
      }
    },
    [
      reportType,
      period,
      locationId,
      secondLocationId,
      categoryId,
      searchQuery,
      startDate,
      endDate,
      user,
      showToast,
    ]
  )

  return {
    loading: loading || isPending,
    error,
    toastMessage,
    showToast,
    reportType,
    setReportType: (t: ReportType) => startTransition(() => setReportType(t)),
    period,
    setPeriod: (p: ReportPeriod) => startTransition(() => setPeriod(p)),
    locationId,
    setLocationId: (l: string) => startTransition(() => setLocationId(l)),
    secondLocationId,
    setSecondLocationId: (l: string) => startTransition(() => setSecondLocationId(l)),
    categoryId,
    setCategoryId: (c: string) => startTransition(() => setCategoryId(c)),
    searchQuery,
    setSearchQuery,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    filterOptions,
    navCards,
    dashboardData,
    salesData,
    purchasesData,
    inventoryData,
    kardexData,
    costsData,
    warehousesData,
    customersData,
    suppliersData,
    cashData,
    billingData,
    accountingData,
    ecommerceData,
    detailItem,
    setDetailItem,
    exportReport,
    refetch: fetchReportData,
  }
}
