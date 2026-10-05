'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { AppIcon, LightIconName } from '@/components/ui/Icon'
import { CustomSelect } from '@/components/ui/CustomSelect'
import { PurchaseReceipt, UserPermissionContext, SupplierOption } from '../types'
import { LocationOption, locationService } from '../services/location.service'
import { supplierService } from '../services/supplier.service'
import { purchaseService } from '../services/purchase.service'

interface ReceiptsPageProps {
  onNavigate?: (view: string) => void
  userContext?: UserPermissionContext
}

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

interface ReceiptStatCardProps {
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

function ReceiptStatCard({
  title,
  value,
  iconName,
  tone,
  badge,
  note,
  isPositive = true,
  subtext,
  index,
}: ReceiptStatCardProps) {
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

export function ReceiptsPage({ onNavigate, userContext }: ReceiptsPageProps) {
  // 1. Data States
  const [receipts, setReceipts] = useState<PurchaseReceipt[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([])
  const [locations, setLocations] = useState<LocationOption[]>([])

  // 2. Filters & Pagination
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedLocationId, setSelectedLocationId] = useState('ALL')
  const [selectedSupplierId, setSelectedSupplierId] = useState('ALL')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [sortField, setSortField] = useState<'date' | 'number' | 'items' | 'supplier'>('date')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

  // 3. Selection
  const [selectedReceipt, setSelectedReceipt] = useState<PurchaseReceipt | null>(null)

  // Initial load of filter options
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
        console.error('Error cargando proveedores y bodegas en recepciones:', err)
      }
    }
    loadOptions()
  }, [])

  // Fetch receipts
  const fetchReceipts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await purchaseService.getReceipts(undefined, userContext)
      setReceipts(data)
    } catch (err: any) {
      setError(err.message || 'Error al cargar el historial de recepciones.')
    } finally {
      setLoading(false)
    }
  }, [userContext])

  useEffect(() => {
    fetchReceipts()
  }, [fetchReceipts])

  // Formatting helpers
  const formatDate = (isoString?: string) => {
    if (!isoString) return '—'
    const d = new Date(isoString)
    return d.toLocaleDateString('es-CO', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(val)
  }

  // Filtered & Sorted list
  const filteredReceipts = useMemo(() => {
    let result = receipts.filter((r) => {
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchNumber = r.receptionNumber.toLowerCase().includes(q)
        const matchRemission = r.supplierRemissionNumber?.toLowerCase().includes(q)
        const matchSupplier = r.supplierName?.toLowerCase().includes(q)
        const matchLocation = r.locationName?.toLowerCase().includes(q)
        const matchUser = r.receivedByUserName?.toLowerCase().includes(q)
        const matchPurchase = r.purchaseNumber?.toLowerCase().includes(q) || r.purchaseId.toLowerCase().includes(q)
        const matchNotes = r.notes?.toLowerCase().includes(q)

        if (!matchNumber && !matchRemission && !matchSupplier && !matchLocation && !matchUser && !matchPurchase && !matchNotes) {
          return false
        }
      }

      // Location filter
      if (selectedLocationId !== 'ALL' && r.locationId !== selectedLocationId) {
        return false
      }

      // Supplier filter
      if (selectedSupplierId !== 'ALL' && r.supplierId !== selectedSupplierId) {
        return false
      }

      return true
    })

    // Sort
    result.sort((a, b) => {
      let comparison = 0
      if (sortField === 'date') {
        const tA = new Date(a.receptionDate || a.createdAt).getTime()
        const tB = new Date(b.receptionDate || b.createdAt).getTime()
        comparison = tA - tB
      } else if (sortField === 'number') {
        comparison = a.receptionNumber.localeCompare(b.receptionNumber)
      } else if (sortField === 'supplier') {
        comparison = (a.supplierName || '').localeCompare(b.supplierName || '')
      } else if (sortField === 'items') {
        const itemsA = a.items?.reduce((sum, it) => sum + (it.quantityReceived || 0), 0) || 0
        const itemsB = b.items?.reduce((sum, it) => sum + (it.quantityReceived || 0), 0) || 0
        comparison = itemsA - itemsB
      }

      return sortDirection === 'desc' ? -comparison : comparison
    })

    return result
  }, [receipts, searchQuery, selectedLocationId, selectedSupplierId, sortField, sortDirection])

  // Pagination calculation
  const totalRecords = filteredReceipts.length
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize))
  const paginatedReceipts = useMemo(() => {
    const startIndex = (page - 1) * pageSize
    return filteredReceipts.slice(startIndex, startIndex + pageSize)
  }, [filteredReceipts, page, pageSize])

  // KPI Calculations
  const stats = useMemo(() => {
    const totalCount = receipts.length
    const totalUnits = receipts.reduce((acc, r) => {
      const lineUnits = r.items?.reduce((la, item) => la + (item.quantityReceived || 0), 0) || 0
      return acc + lineUnits
    }, 0)

    const uniqueWarehouses = new Set(receipts.map((r) => r.locationId).filter(Boolean)).size
    const uniqueSuppliers = new Set(receipts.map((r) => r.supplierId).filter(Boolean)).size

    const now = new Date()
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()
    const thisMonthCount = receipts.filter((r) => {
      const d = new Date(r.receptionDate || r.createdAt)
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear
    }).length

    return {
      totalCount,
      totalUnits,
      uniqueWarehouses,
      uniqueSuppliers,
      thisMonthCount,
    }
  }, [receipts])

  const animTotalCount = useCountUp(stats.totalCount)
  const animTotalUnits = useCountUp(stats.totalUnits)
  const animWarehouses = useCountUp(stats.uniqueWarehouses)
  const animSuppliers = useCountUp(stats.uniqueSuppliers)

  const activeFilterCount = [
    Boolean(searchQuery.trim()),
    selectedLocationId !== 'ALL',
    selectedSupplierId !== 'ALL',
  ].filter(Boolean).length
  const hasActiveFilters = activeFilterCount > 0

  const handleResetFilters = () => {
    setSearchQuery('')
    setSelectedLocationId('ALL')
    setSelectedSupplierId('ALL')
    setPage(1)
  }

  const handleSort = (field: 'date' | 'number' | 'items' | 'supplier') => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
    setPage(1)
  }

  return (
    <div className="products-module-wrapper receptions-module-wrapper page-enter">
      {/* 1. Module Header */}
      <header className="products-header-wrap">
        <div className="header-title-group">
          <span className="product-category-eyebrow">
            Abastecimiento & Logística
          </span>
          <h1 className="header-main-title">
            Recepciones de Mercancía
          </h1>
          <p className="header-sub-caption">
            Historial de actas de recepción física, remisiones de proveedor e ingresos transaccionales a Kardex
          </p>
        </div>

        <div className="products-actions-bar">
          <button
            type="button"
            className="outline-button"
            onClick={fetchReceipts}
            disabled={loading}
            title="Refrescar lista de actas"
          >
            <AppIcon name="refresh" size={15} className={loading ? 'spin-icon' : ''} />
            <span>Actualizar</span>
          </button>

          {onNavigate && (
            <button
              type="button"
              className="outline-button"
              onClick={() => onNavigate('/compras')}
              title="Ir a órdenes de compra"
            >
              <AppIcon name="purchases" size={15} />
              <span>Ver Órdenes de Compra</span>
            </button>
          )}

          {onNavigate && (
            <button
              type="button"
              className="primary-button"
              onClick={() => onNavigate('/compras')}
              title="Registrar una nueva compra"
            >
              <AppIcon name="plus" size={15} />
              <span>Nueva Compra</span>
            </button>
          )}
        </div>
      </header>

      {/* 2. Key Metrics & Stats */}
      <section
        className="stats-grid products-stats-grid page-enter"
        aria-label="Métricas de recepciones y almacén"
      >
        <ReceiptStatCard
          title="Total Actas Generadas"
          value={animTotalCount.toLocaleString('es-CO')}
          iconName="warehouse"
          tone="blue"
          badge="Auditoría"
          note="Entradas confirmadas"
          isPositive={true}
          subtext="Histórico total de actas"
          index={1}
        />

        <ReceiptStatCard
          title="Unidades Ingresadas"
          value={animTotalUnits.toLocaleString('es-CO')}
          iconName="check"
          tone="teal"
          badge="Kardex Físico"
          note="Stock alimentado"
          isPositive={true}
          subtext="Unidades físicas a inventario"
          index={2}
        />

        <ReceiptStatCard
          title="Bodegas Receptoras"
          value={animWarehouses.toLocaleString('es-CO')}
          iconName="warehouse"
          tone="purple"
          badge="Distribución"
          note="Puntos de recepción"
          isPositive={true}
          subtext="Sedes y bodegas activas"
          index={3}
        />

        <ReceiptStatCard
          title="Proveedores Despachantes"
          value={animSuppliers.toLocaleString('es-CO')}
          iconName="suppliers"
          tone="amber"
          badge="Proveedores"
          note="Cadena de suministro"
          isPositive={true}
          subtext="Proveedores con entregas"
          index={4}
        />
      </section>

      {/* 3. Toolbar & Dynamic Filters */}
      <div className="products-toolbar toolbar">
        <div className="products-search-box search-box">
          <AppIcon name="search" size={16} className="search-icon" />
          <input
            type="text"
            className="filter-input-text"
            placeholder="Buscar por acta, remisión, proveedor, orden o almacenista..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setPage(1)
            }}
          />
          {searchQuery && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => {
                setSearchQuery('')
                setPage(1)
              }}
              title="Limpiar búsqueda"
            >
              <AppIcon name="close" size={13} />
            </button>
          )}
        </div>

        <div className="filter-select-group">
          {/* Bodega */}
          <div className="filter-select-item" style={{ minWidth: 180 }}>
            <CustomSelect
              size="sm"
              value={selectedLocationId}
              onChange={(val) => {
                setSelectedLocationId(val)
                setPage(1)
              }}
              options={[
                { value: 'ALL', label: 'Todas las bodegas' },
                ...locations.map((loc) => ({
                  value: loc.id,
                  label: `${loc.name} (${loc.code})`,
                })),
              ]}
              placeholder="Bodega..."
            />
          </div>

          {/* Proveedor */}
          <div className="filter-select-item" style={{ minWidth: 200 }}>
            <CustomSelect
              size="sm"
              value={selectedSupplierId}
              onChange={(val) => {
                setSelectedSupplierId(val)
                setPage(1)
              }}
              options={[
                { value: 'ALL', label: 'Todos los proveedores' },
                ...suppliers.map((sup) => ({
                  value: sup.id,
                  label: sup.name,
                })),
              ]}
              placeholder="Proveedor..."
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

      {/* 4. Main Table */}
      {loading ? (
        <div className="table-panel products-table-panel" style={{ padding: 60, textAlign: 'center' }}>
          <div className="skeleton-line" style={{ height: 28, width: '40%', margin: '0 auto 16px', borderRadius: 8 }} />
          <div className="skeleton-line" style={{ height: 18, width: '60%', margin: '0 auto 12px', borderRadius: 8 }} />
          <div className="skeleton-line" style={{ height: 18, width: '50%', margin: '0 auto', borderRadius: 8 }} />
        </div>
      ) : error ? (
        <div
          className="table-panel products-table-panel"
          style={{
            padding: 48,
            textAlign: 'center',
            borderColor: '#fecaca',
            background: '#fffbfb',
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 12,
              background: '#fee2e2',
              color: '#dc2626',
              display: 'grid',
              placeItems: 'center',
              margin: '0 auto 16px',
            }}
          >
            <AppIcon name="warning" size={26} />
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#dc2626', margin: '0 0 8px' }}>
            Error al consultar recepciones
          </h3>
          <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 16px' }}>{error}</p>
          <button type="button" className="outline-button" onClick={fetchReceipts}>
            <AppIcon name="refresh" size={14} />
            <span>Reintentar</span>
          </button>
        </div>
      ) : filteredReceipts.length === 0 ? (
        <div
          className="table-panel products-table-panel"
          style={{
            padding: 64,
            textAlign: 'center',
            background: '#ffffff',
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: 'var(--bg-subtle, #f8fafc)',
              display: 'grid',
              placeItems: 'center',
              margin: '0 auto 16px',
              color: 'var(--navy)',
              border: '1px solid var(--border)',
            }}
          >
            <AppIcon name="warehouse" size={28} />
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 8px', color: 'var(--navy)' }}>
            No se encontraron actas de recepción
          </h3>
          <p style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 460, margin: '0 auto 16px' }}>
            {hasActiveFilters
              ? 'No hay registros que coincidan con los filtros aplicados. Intenta restablecer los parámetros de búsqueda.'
              : 'Las actas se generan automáticamente cuando ingresas físicamente productos desde una orden de compra.'}
          </p>
          {hasActiveFilters ? (
            <button type="button" className="outline-button" onClick={handleResetFilters}>
              <AppIcon name="close" size={14} />
              <span>Limpiar filtros</span>
            </button>
          ) : (
            onNavigate && (
              <button
                type="button"
                className="primary-button"
                onClick={() => onNavigate('/compras')}
              >
                <AppIcon name="purchases" size={14} />
                <span>Ir al módulo de Compras</span>
              </button>
            )
          )}
        </div>
      ) : (
        <div className="table-panel products-table-panel page-enter">
          <div className="table-scroll" tabIndex={0} aria-label="Tabla de recepciones de mercancía">
            <table className="products-table">
              <thead>
                <tr>
                  <th
                    className="sortable-th"
                    onClick={() => handleSort('number')}
                    style={{ minWidth: 140 }}
                  >
                    <div className="th-content">
                      <span>N° Acta</span>
                      {sortField === 'number' && (
                        <AppIcon
                          name={sortDirection === 'asc' ? 'chevronUp' : 'chevronDown'}
                          size={12}
                        />
                      )}
                    </div>
                  </th>

                  <th
                    className="sortable-th"
                    onClick={() => handleSort('date')}
                    style={{ minWidth: 150 }}
                  >
                    <div className="th-content">
                      <span>Fecha Recepción</span>
                      {sortField === 'date' && (
                        <AppIcon
                          name={sortDirection === 'asc' ? 'chevronUp' : 'chevronDown'}
                          size={12}
                        />
                      )}
                    </div>
                  </th>

                  <th
                    className="sortable-th"
                    onClick={() => handleSort('supplier')}
                    style={{ minWidth: 200 }}
                  >
                    <div className="th-content">
                      <span>Compra / Proveedor</span>
                      {sortField === 'supplier' && (
                        <AppIcon
                          name={sortDirection === 'asc' ? 'chevronUp' : 'chevronDown'}
                          size={12}
                        />
                      )}
                    </div>
                  </th>

                  <th style={{ minWidth: 150 }}>Bodega Destino</th>

                  <th style={{ minWidth: 150 }}>Remisión Proveedor</th>

                  <th
                    className="sortable-th"
                    onClick={() => handleSort('items')}
                    style={{ minWidth: 130, textAlign: 'center' }}
                  >
                    <div className="th-content" style={{ justifyContent: 'center' }}>
                      <span>Ingreso Físico</span>
                      {sortField === 'items' && (
                        <AppIcon
                          name={sortDirection === 'asc' ? 'chevronUp' : 'chevronDown'}
                          size={12}
                        />
                      )}
                    </div>
                  </th>

                  <th style={{ minWidth: 150 }}>Responsable</th>

                  <th style={{ minWidth: 180 }}>Observaciones</th>

                  <th style={{ width: 90, textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {paginatedReceipts.map((rec) => {
                  const totalUnits =
                    rec.items?.reduce((acc, i) => acc + (i.quantityReceived || 0), 0) || 0

                  return (
                    <tr
                      key={rec.id}
                      className="table-row-clickable"
                      onClick={() => setSelectedReceipt(rec)}
                    >
                      {/* N° Acta */}
                      <td className="product-code-col">
                        <span className="sku-badge" style={{ fontWeight: 700 }}>
                          {rec.receptionNumber}
                        </span>
                      </td>

                      {/* Fecha Recepción */}
                      <td>
                        <span className="product-date-cell">
                          {formatDate(rec.receptionDate || rec.createdAt)}
                        </span>
                      </td>

                      {/* Compra / Proveedor */}
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <strong style={{ color: 'var(--navy)', fontSize: 13 }}>
                            {rec.purchaseNumber || 'Compra'}
                          </strong>
                          <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                            {rec.supplierName || 'Proveedor'}
                          </span>
                        </div>
                      </td>

                      {/* Bodega Destino */}
                      <td>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <span
                            className="kardex-type-badge type-badge-purple"
                            style={{ fontSize: 11 }}
                          >
                            <AppIcon name="warehouse" size={12} />
                            <span>{rec.locationName || 'Bodega'}</span>
                          </span>
                        </div>
                      </td>

                      {/* Remisión Proveedor */}
                      <td>
                        {rec.supplierRemissionNumber ? (
                          <span
                            style={{
                              fontFamily: 'monospace',
                              fontWeight: 600,
                              fontSize: 12,
                              color: 'var(--navy)',
                              background: '#f1f5f9',
                              padding: '2px 6px',
                              borderRadius: 4,
                            }}
                          >
                            {rec.supplierRemissionNumber}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--muted)', fontSize: 12 }}>—</span>
                        )}
                      </td>

                      {/* Ingreso Físico */}
                      <td style={{ textAlign: 'center' }}>
                        <span className="kardex-type-badge type-badge-green">
                          <AppIcon name="check" size={12} />
                          <span>
                            {rec.items?.length || 0} ítems ({totalUnits} u.)
                          </span>
                        </span>
                      </td>

                      {/* Responsable */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: '50%',
                              background: 'var(--bg-subtle, #f1f5f9)',
                              display: 'grid',
                              placeItems: 'center',
                              fontSize: 10,
                              fontWeight: 700,
                              color: 'var(--navy)',
                            }}
                          >
                            {(rec.receivedByUserName || 'A')[0].toUpperCase()}
                          </div>
                          <span style={{ fontSize: 12, color: 'var(--foreground)' }}>
                            {rec.receivedByUserName || 'Almacenista'}
                          </span>
                        </div>
                      </td>

                      {/* Observaciones */}
                      <td>
                        <span
                          style={{
                            fontSize: 12,
                            color: 'var(--muted)',
                            display: '-webkit-box',
                            WebkitLineClamp: 1,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                          title={rec.notes}
                        >
                          {rec.notes || '—'}
                        </span>
                      </td>

                      {/* Acciones */}
                      <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="icon-button inspect-row-btn"
                          onClick={() => setSelectedReceipt(rec)}
                          title="Inspeccionar acta de recepción"
                          aria-label="Ver detalle"
                        >
                          <AppIcon name="eye" size={15} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Table Pagination Footer */}
          <div className="table-pagination-footer">
            <div className="pagination-info">
              <span>
                Mostrando{' '}
                <strong>
                  {totalRecords === 0 ? 0 : (page - 1) * pageSize + 1}
                </strong>{' '}
                -{' '}
                <strong>
                  {Math.min(page * pageSize, totalRecords)}
                </strong>{' '}
                de <strong>{totalRecords}</strong> actas registradas
              </span>

              <div className="page-size-selector">
                <span>Filas por página:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value))
                    setPage(1)
                  }}
                  aria-label="Filas por página"
                >
                  <option value={10}>10</option>
                  <option value={15}>15</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>
            </div>

            <div className="pagination-controls">
              <button
                type="button"
                className="pagination-btn"
                onClick={() => setPage(1)}
                disabled={page <= 1}
                title="Primera página"
              >
                «
              </button>
              <button
                type="button"
                className="pagination-btn"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                title="Página anterior"
              >
                ‹ Anterior
              </button>

              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--navy)',
                  padding: '0 8px',
                }}
              >
                Página {page} de {totalPages}
              </span>

              <button
                type="button"
                className="pagination-btn"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                title="Página siguiente"
              >
                Siguiente ›
              </button>
              <button
                type="button"
                className="pagination-btn"
                onClick={() => setPage(totalPages)}
                disabled={page >= totalPages}
                title="Última página"
              >
                »
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Detail Slide-in Drawer */}
      {selectedReceipt && (
        <div
          className="drawer-backdrop"
          onClick={() => setSelectedReceipt(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="product-drawer product-detail-drawer page-enter"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 680, width: '92vw' }}
          >
            {/* Drawer Header */}
            <div className="drawer-header product-detail-header-v2">
              <div className="product-detail-hero-layout">
                <div
                  className="kpi-icon-wrap blue"
                  style={{ width: 48, height: 48, borderRadius: 12 }}
                >
                  <AppIcon name="warehouse" size={24} />
                </div>
                <div className="product-detail-header-info">
                  <span className="product-category-eyebrow">
                    Acta Oficial de Recepción Física
                  </span>
                  <h2 className="product-detail-title-v2" style={{ fontSize: 20 }}>
                    {selectedReceipt.receptionNumber}
                  </h2>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                    Registrada el: {formatDate(selectedReceipt.receptionDate || selectedReceipt.createdAt)}
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="drawer-close-btn"
                onClick={() => setSelectedReceipt(null)}
                aria-label="Cerrar detalle"
              >
                <AppIcon name="close" size={18} />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="drawer-body" style={{ padding: 24, overflowY: 'auto' }}>
              {/* Summary cards grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: 12,
                  marginBottom: 20,
                  background: '#f8fafc',
                  padding: 16,
                  borderRadius: 12,
                  border: '1px solid var(--border)',
                }}
              >
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)' }}>
                    Orden de Compra / Proveedor
                  </div>
                  <strong style={{ fontSize: 13, color: 'var(--navy)' }}>
                    {selectedReceipt.purchaseNumber || 'Compra'} — {selectedReceipt.supplierName || 'Proveedor'}
                  </strong>
                </div>

                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)' }}>
                    Bodega de Destino
                  </div>
                  <strong style={{ fontSize: 13, color: 'var(--navy)' }}>
                    {selectedReceipt.locationName || 'Bodega'} ({selectedReceipt.locationCode || 'BOD'})
                  </strong>
                </div>

                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)' }}>
                    Remisión de Proveedor
                  </div>
                  <strong style={{ fontSize: 13, color: 'var(--navy)' }}>
                    {selectedReceipt.supplierRemissionNumber || 'No especificada'}
                  </strong>
                </div>

                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)' }}>
                    Almacenista Receptor
                  </div>
                  <strong style={{ fontSize: 13, color: 'var(--navy)' }}>
                    {selectedReceipt.receivedByUserName || 'Responsable de bodega'}
                  </strong>
                </div>

                {selectedReceipt.notes && (
                  <div style={{ gridColumn: 'span 2', marginTop: 4 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)' }}>
                      Notas de Entrega
                    </div>
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--foreground)' }}>
                      {selectedReceipt.notes}
                    </p>
                  </div>
                )}
              </div>

              {/* Items Section */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: 'var(--navy)' }}>
                  Mercancía Ingresada al Kardex
                </h3>
                <span className="kardex-type-badge type-badge-blue">
                  {selectedReceipt.items?.length || 0} referencias
                </span>
              </div>

              <div
                className="table-scroll"
                style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}
              >
                <table className="products-table" style={{ fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th style={{ minWidth: 220 }}>Producto / Referencia</th>
                      <th style={{ minWidth: 100 }}>SKU</th>
                      <th style={{ textAlign: 'right', minWidth: 110 }}>Cantidad Recibida</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedReceipt.items?.map((item, idx) => (
                      <tr key={item.id || idx}>
                        <td>
                          <strong>{item.productName || `Ítem #${idx + 1}`}</strong>
                        </td>
                        <td>
                          <span className="sku-badge">
                            {item.sku || '—'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span
                            style={{
                              color: '#16a34a',
                              fontWeight: 700,
                              fontSize: 13,
                              background: '#f0fdf4',
                              padding: '3px 8px',
                              borderRadius: 6,
                              border: '1px solid #bbf7d0',
                            }}
                          >
                            +{item.quantityReceived} u.
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Drawer Footer */}
            <div
              className="drawer-footer"
              style={{
                padding: '16px 24px',
                borderTop: '1px solid var(--border)',
                display: 'flex',
                gap: 12,
                justifyContent: 'flex-end',
              }}
            >
              <button
                type="button"
                className="outline-button"
                onClick={() => window.print()}
                title="Imprimir comprobante de recepción"
              >
                <AppIcon name="print" size={15} />
                <span>Imprimir Acta</span>
              </button>

              <button
                type="button"
                className="primary-button"
                onClick={() => setSelectedReceipt(null)}
              >
                <span>Cerrar</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
