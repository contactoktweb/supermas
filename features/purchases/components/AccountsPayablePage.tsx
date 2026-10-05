'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { AppIcon, LightIconName } from '@/components/ui/Icon'
import { CustomSelect } from '@/components/ui/CustomSelect'
import {
  accountsPayableService,
  AccountPayableItem,
  AccountsPayableStats,
} from '../services/accounts-payable.service'
import { locationService, LocationOption } from '../services/location.service'
import { supplierService } from '../services/supplier.service'
import { SupplierOption } from '../types'
import { AccountsPayableTable } from './accounts-payable/AccountsPayableTable'
import { AccountsPayablePaymentModal } from './accounts-payable/AccountsPayablePaymentModal'
import { AccountsPayableHistoryModal } from './accounts-payable/AccountsPayableHistoryModal'

function useCountUp(target: number, duration: number = 600) {
  const [count, setCount] = useState(target)

  useEffect(() => {
    let startTimestamp: number | null = null
    const startVal = 0
    const endVal = target
    if (endVal === 0) {
      setCount(0)
      return
    }

    let animationFrameId: number

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp
      const progress = Math.min((timestamp - startTimestamp) / duration, 1)
      setCount(Math.floor(progress * (endVal - startVal) + startVal))
      if (progress < 1) {
        animationFrameId = requestAnimationFrame(step)
      } else {
        setCount(endVal)
      }
    }

    animationFrameId = requestAnimationFrame(step)
    return () => cancelAnimationFrame(animationFrameId)
  }, [target, duration])

  return count
}

interface CxpStatCardProps {
  title: string
  value: string | number
  iconName: LightIconName
  tone: 'blue' | 'red' | 'teal' | 'amber' | 'purple'
  badge: string
  note?: string
  isPositive?: boolean
  subtext?: string
  index: number
}

function CxpStatCard({
  title,
  value,
  iconName,
  tone,
  badge,
  note,
  isPositive = true,
  subtext,
  index,
}: CxpStatCardProps) {
  return (
    <article
      className={`dashboard-kpi-card tone-${tone}`}
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      <div className="kpi-card-header">
        <div className={`kpi-icon-wrap ${tone}`}>
          <AppIcon name={iconName} size={18} />
        </div>
        <span className="kpi-scope-badge">{badge}</span>
      </div>

      <div className="kpi-card-body">
        <span className="kpi-card-title">{title}</span>
        <div className="kpi-value-row">
          <strong className="kpi-card-value">{value}</strong>
        </div>
      </div>

      <div className="kpi-card-footer">
        {note && (
          <span
            className={`kpi-trend-pill ${
              isPositive ? 'trend-positive' : 'trend-warning'
            }`}
          >
            <AppIcon
              name={isPositive ? 'arrowUpRight' : 'warning'}
              size={12}
            />
            <span>{note}</span>
          </span>
        )}
        {subtext && <span className="kpi-subtext">{subtext}</span>}
      </div>
    </article>
  )
}

export function AccountsPayablePage() {
  const [items, setItems] = useState<AccountPayableItem[]>([])
  const [stats, setStats] = useState<AccountsPayableStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [isCostRedacted, setIsCostRedacted] = useState(false)

  // Filters
  const [query, setQuery] = useState('')
  const [supplierId, setSupplierId] = useState('ALL')
  const [locationId, setLocationId] = useState('ALL')
  const [status, setStatus] = useState<
    'ALL' | 'PENDIENTE' | 'PARCIAL' | 'VENCIDA' | 'PAGADA'
  >('ALL')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [sortField, setSortField] = useState('dueDate')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  // Filter options
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([])
  const [locations, setLocations] = useState<LocationOption[]>([])

  // Modals state
  const [selectedItemForPayment, setSelectedItemForPayment] =
    useState<AccountPayableItem | null>(null)
  const [selectedItemForHistory, setSelectedItemForHistory] =
    useState<AccountPayableItem | null>(null)

  // Load initial options
  useEffect(() => {
    async function loadOptions() {
      try {
        const [sups, locs] = await Promise.all([
          supplierService.list(),
          locationService.list(),
        ])
        setSuppliers(sups)
        setLocations(locs)
      } catch (err) {
        console.error('Error cargando opciones de filtro en CxP:', err)
      }
    }
    loadOptions()
  }, [])

  // Load items and stats
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [res, statsRes] = await Promise.all([
        accountsPayableService.list({
          query,
          supplierId,
          locationId,
          status,
          page,
          pageSize,
        }),
        accountsPayableService.getStats(),
      ])

      // Sort items
      let sortedItems = [...res.items]
      sortedItems.sort((a, b) => {
        let comp = 0
        if (sortField === 'purchaseNumber') {
          comp = a.purchaseNumber.localeCompare(b.purchaseNumber)
        } else if (sortField === 'supplierName') {
          comp = a.supplierName.localeCompare(b.supplierName)
        } else if (sortField === 'dueDate') {
          comp = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
        } else if (sortField === 'originalAmount') {
          comp = a.originalAmount - b.originalAmount
        } else if (sortField === 'pendingBalance') {
          comp = a.pendingBalance - b.pendingBalance
        }
        return sortDirection === 'desc' ? -comp : comp
      })

      setItems(sortedItems)
      setTotalPages(res.totalPages)
      setTotalCount(res.total)
      setIsCostRedacted(res.isCostRedacted)
      setStats(statsRes)
    } catch (err) {
      console.error('Error cargando datos de Cuentas por Pagar:', err)
    } finally {
      setLoading(false)
    }
  }, [query, supplierId, locationId, status, page, pageSize, sortField, sortDirection])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const formatCurrency = (val: number) => {
    if (isCostRedacted) return 'Confidencial'
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(val)
  }

  // Animated KPI numbers
  const animPendingBalance = useCountUp(stats?.totalPendingBalance || 0)
  const animOverdueBalance = useCountUp(stats?.totalOverdueBalance || 0)
  const animPaidThisMonth = useCountUp(stats?.paidThisMonth || 0)
  const currentPortion = Math.max(
    0,
    (stats?.totalPendingBalance || 0) - (stats?.totalOverdueBalance || 0)
  )
  const animCurrentBalance = useCountUp(currentPortion)

  // Filter check
  const activeFilterCount = [
    Boolean(query.trim()),
    supplierId !== 'ALL',
    locationId !== 'ALL',
    status !== 'ALL',
  ].filter(Boolean).length
  const hasActiveFilters = activeFilterCount > 0

  const handleResetFilters = () => {
    setQuery('')
    setSupplierId('ALL')
    setLocationId('ALL')
    setStatus('ALL')
    setPage(1)
  }

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
    setPage(1)
  }

  const handleExportCSV = () => {
    if (items.length === 0) return
    const headers = [
      'Documento',
      'Factura Proveedor',
      'Proveedor',
      'NIT',
      'Bodega',
      'Vencimiento',
      'Total Factura',
      'Abonado',
      'Saldo Pendiente',
      'Estado',
    ]

    const rows = items.map((it) => [
      `"${it.purchaseNumber}"`,
      `"${it.supplierInvoiceNumber || ''}"`,
      `"${it.supplierName.replace(/"/g, '""')}"`,
      `"${it.supplierNit}"`,
      `"${it.locationName}"`,
      `"${it.dueDate}"`,
      it.originalAmount,
      it.paidAmount,
      it.pendingBalance,
      `"${it.status}"`,
    ])

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `Cuentas_por_Pagar_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="products-module-wrapper accounts-payable-module-wrapper page-enter">
      {/* 1. Header */}
      <header className="products-header-wrap">
        <div className="header-title-group">
          <span className="product-category-eyebrow">
            Tesorería & Proveedores
          </span>
          <h1 className="header-main-title">
            Cuentas por Pagar (CxP)
          </h1>
          <p className="header-sub-caption">
            Control fiduciario de obligaciones comerciales, gestión de cartera de proveedores y abonos
          </p>
        </div>

        <div className="products-actions-bar">
          <button
            type="button"
            className="outline-button"
            onClick={() => fetchData()}
            disabled={loading}
            title="Refrescar datos de cartera"
          >
            <AppIcon name="refresh" size={15} className={loading ? 'spin-icon' : ''} />
            <span>Actualizar</span>
          </button>

          <button
            type="button"
            className="outline-button"
            onClick={handleExportCSV}
            title="Exportar reporte CSV"
          >
            <AppIcon name="download" size={15} />
            <span>Exportar CSV</span>
          </button>
        </div>
      </header>

      {/* 2. Key Metrics & Stats */}
      <section
        className="stats-grid products-stats-grid page-enter"
        aria-label="Métricas de cuentas por pagar"
      >
        <CxpStatCard
          title="Deuda Total Pendiente"
          value={formatCurrency(animPendingBalance)}
          iconName="wallet"
          tone="blue"
          badge="Cartera Total"
          note={`${stats?.pendingInvoicesCount || 0} obligaciones activas`}
          isPositive={true}
          subtext="Total por pagar a proveedores"
          index={1}
        />

        <CxpStatCard
          title="Cartera Vencida"
          value={formatCurrency(animOverdueBalance)}
          iconName="warning"
          tone="red"
          badge="En Mora"
          note={`${stats?.overdueInvoicesCount || 0} facturas vencidas`}
          isPositive={false}
          subtext="Obligaciones con plazo superado"
          index={2}
        />

        <CxpStatCard
          title="Pagado en el Mes"
          value={formatCurrency(animPaidThisMonth)}
          iconName="check"
          tone="teal"
          badge="Egresos"
          note="Abonos aplicados"
          isPositive={true}
          subtext="Liquidado en el periodo"
          index={3}
        />

        <CxpStatCard
          title="Cartera Corriente"
          value={formatCurrency(animCurrentBalance)}
          iconName="clock"
          tone="purple"
          badge="Al Día"
          note="Dentro del plazo"
          isPositive={true}
          subtext="Obligaciones no vencidas"
          index={4}
        />
      </section>

      {/* 3. Toolbar & Dynamic Filters */}
      <div className="products-toolbar toolbar">
        {/* Status Tabs */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexWrap: 'wrap',
          }}
        >
          {[
            { key: 'ALL', label: 'Todas' },
            { key: 'PENDIENTE', label: 'Pendientes' },
            { key: 'PARCIAL', label: 'Abonadas' },
            { key: 'VENCIDA', label: 'Vencidas' },
            { key: 'PAGADA', label: 'Liquidadas' },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`period-tab-btn ${status === tab.key ? 'selected' : ''}`}
              onClick={() => {
                setStatus(tab.key as any)
                setPage(1)
              }}
              style={{
                padding: '6px 12px',
                fontSize: 12,
                borderRadius: 8,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="products-search-box search-box" style={{ minWidth: 260 }}>
          <AppIcon name="search" size={16} className="search-icon" />
          <input
            type="text"
            className="filter-input-text"
            placeholder="Buscar por compra, factura o proveedor..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setPage(1)
            }}
          />
          {query && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => {
                setQuery('')
                setPage(1)
              }}
              title="Limpiar búsqueda"
            >
              <AppIcon name="close" size={13} />
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="filter-select-group">
          {/* Proveedor */}
          <div className="filter-select-item" style={{ minWidth: 200 }}>
            <CustomSelect
              size="sm"
              value={supplierId}
              onChange={(val) => {
                setSupplierId(val)
                setPage(1)
              }}
              options={[
                { value: 'ALL', label: 'Todos los proveedores' },
                ...suppliers.map((s) => ({ value: s.id, label: s.name })),
              ]}
              placeholder="Proveedor..."
            />
          </div>

          {/* Bodega */}
          <div className="filter-select-item" style={{ minWidth: 180 }}>
            <CustomSelect
              size="sm"
              value={locationId}
              onChange={(val) => {
                setLocationId(val)
                setPage(1)
              }}
              options={[
                { value: 'ALL', label: 'Todas las bodegas' },
                ...locations.map((l) => ({ value: l.id, label: `${l.name} (${l.code})` })),
              ]}
              placeholder="Bodega..."
            />
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              className="reset-filters-pill"
              onClick={handleResetFilters}
              title="Restablecer filtros de búsqueda"
            >
              <AppIcon name="close" size={12} />
              <span>Limpiar filtros</span>
              <span className="active-filter-badge">{activeFilterCount}</span>
            </button>
          )}
        </div>
      </div>

      {/* 4. Table */}
      <AccountsPayableTable
        items={items}
        isLoading={loading}
        isCostRedacted={isCostRedacted}
        page={page}
        pageSize={pageSize}
        totalPages={totalPages}
        totalCount={totalCount}
        sortField={sortField}
        sortDirection={sortDirection}
        onSort={handleSort}
        onPageChange={(p) => setPage(p)}
        onPageSizeChange={(s) => {
          setPageSize(s)
          setPage(1)
        }}
        onRegisterPayment={(it) => setSelectedItemForPayment(it)}
        onViewHistory={(it) => setSelectedItemForHistory(it)}
      />

      {/* 5. Modals */}
      <AccountsPayablePaymentModal
        item={selectedItemForPayment}
        isOpen={Boolean(selectedItemForPayment)}
        onClose={() => setSelectedItemForPayment(null)}
        onSuccess={() => {
          setSelectedItemForPayment(null)
          fetchData()
        }}
      />

      <AccountsPayableHistoryModal
        item={selectedItemForHistory}
        isOpen={Boolean(selectedItemForHistory)}
        onClose={() => setSelectedItemForHistory(null)}
      />
    </div>
  )
}
