'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { AppIcon } from '@/components/ui/Icon'
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
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

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
          pageSize: 15,
        }),
        accountsPayableService.getStats(),
      ])

      setItems(res.items)
      setTotalPages(res.totalPages)
      setTotalCount(res.total)
      setIsCostRedacted(res.isCostRedacted)
      setStats(statsRes)
    } catch (err) {
      console.error('Error cargando datos de Cuentas por Pagar:', err)
    } finally {
      setLoading(false)
    }
  }, [query, supplierId, locationId, status, page])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const formatCurrency = (val: number) => {
    if (isCostRedacted) return '••••••'
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(val)
  }

  const supplierOptions = [
    { value: 'ALL', label: 'Todos los proveedores' },
    ...suppliers.map((s) => ({ value: s.id, label: s.name })),
  ]

  const locationOptions = [
    { value: 'ALL', label: 'Todas las bodegas' },
    ...locations.map((l) => ({ value: l.id, label: `${l.name} (${l.code})` })),
  ]

  return (
    <div className="page-container page-enter" style={{ padding: '24px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 12,
              color: 'var(--text-muted)',
              marginBottom: 4,
            }}
          >
            <span>Compras</span>
            <span>/</span>
            <span style={{ color: 'var(--navy)', fontWeight: 600 }}>Cuentas por Pagar</span>
          </div>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 800,
              color: 'var(--navy)',
              margin: 0,
              letterSpacing: '-0.02em',
            }}
          >
            Cuentas por Pagar (CxP)
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Control fiduciario de obligaciones con proveedores, gestión de cartera y abonos
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            className="outline-button-sm"
            onClick={() => fetchData()}
            title="Refrescar datos"
            style={{
              padding: '8px 14px',
              fontSize: 13,
              fontWeight: 600,
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: '#ffffff',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <AppIcon name="refresh" size={14} />
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 16,
          marginBottom: 24,
        }}
      >
        {/* Card 1: Total Deuda Pendiente */}
        <div
          className="metric-card"
          style={{
            background: 'var(--card-bg, #ffffff)',
            padding: '20px',
            borderRadius: 12,
            border: '1px solid var(--border)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Deuda Total Pendiente
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--navy)', marginTop: 8 }}>
                {stats ? formatCurrency(stats.totalPendingBalance) : '...'}
              </div>
            </div>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: 'rgba(30, 58, 138, 0.1)',
                color: 'var(--navy)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AppIcon name="wallet" size={20} />
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10 }}>
            {stats ? stats.pendingInvoicesCount : 0} facturas u órdenes pendientes
          </div>
        </div>

        {/* Card 2: Cartera Vencida */}
        <div
          className="metric-card"
          style={{
            background: 'var(--card-bg, #ffffff)',
            padding: '20px',
            borderRadius: 12,
            border: '1px solid #fecaca',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#dc2626', textTransform: 'uppercase' }}>
                Cartera Vencida
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#dc2626', marginTop: 8 }}>
                {stats ? formatCurrency(stats.totalOverdueBalance) : '...'}
              </div>
            </div>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: '#fef2f2',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AppIcon name="warning" size={20} />
            </div>
          </div>
          <div style={{ fontSize: 12, color: '#dc2626', marginTop: 10, fontWeight: 600 }}>
            {stats ? stats.overdueInvoicesCount : 0} facturas vencidas
          </div>
        </div>

        {/* Card 3: Abonos del Mes */}
        <div
          className="metric-card"
          style={{
            background: 'var(--card-bg, #ffffff)',
            padding: '20px',
            borderRadius: 12,
            border: '1px solid var(--border)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Pagado en el Mes
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#059669', marginTop: 8 }}>
                {stats ? formatCurrency(stats.paidThisMonth) : '...'}
              </div>
            </div>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: '#ecfdf5',
                color: '#059669',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AppIcon name="check" size={20} />
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10 }}>
            Egresos aplicados a proveedores este mes
          </div>
        </div>
      </div>

      {/* Filter and Tab Section */}
      <div
        style={{
          background: 'var(--card-bg, #ffffff)',
          borderRadius: 12,
          border: '1px solid var(--border)',
          padding: 16,
          marginBottom: 20,
        }}
      >
        {/* Status Tabs */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            borderBottom: '1px solid var(--border)',
            paddingBottom: 14,
            marginBottom: 16,
          }}
        >
          {[
            { key: 'ALL', label: 'Todas las Obligaciones' },
            { key: 'PENDIENTE', label: 'Pendientes' },
            { key: 'PARCIAL', label: 'Abonadas / Parciales' },
            { key: 'VENCIDA', label: 'Vencidas' },
            { key: 'PAGADA', label: 'Liquidadas / Pagadas' },
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
                padding: '6px 14px',
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 8,
                border: 'none',
                background: status === tab.key ? 'var(--navy, #1e3a8a)' : 'transparent',
                color: status === tab.key ? '#ffffff' : 'var(--text-main)',
                cursor: 'pointer',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Filter Inputs Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 12,
          }}
        >
          {/* Search Box */}
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Buscar por orden, factura o notas..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setPage(1)
              }}
              className="filter-date-input"
              style={{
                width: '100%',
                paddingLeft: 36,
                fontSize: 13,
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }}
            >
              <AppIcon name="search" size={14} />
            </div>
          </div>

          {/* Supplier Dropdown */}
          <div>
            <CustomSelect
              value={supplierId}
              onChange={(val) => {
                setSupplierId(val)
                setPage(1)
              }}
              options={supplierOptions}
            />
          </div>

          {/* Location Dropdown */}
          <div>
            <CustomSelect
              value={locationId}
              onChange={(val) => {
                setLocationId(val)
                setPage(1)
              }}
              options={locationOptions}
            />
          </div>
        </div>
      </div>

      {/* Main Table */}
      <AccountsPayableTable
        items={items}
        isLoading={loading}
        isCostRedacted={isCostRedacted}
        onRegisterPayment={(item) => setSelectedItemForPayment(item)}
        onViewHistory={(item) => setSelectedItemForHistory(item)}
      />

      {/* Pagination */}
      {!loading && totalCount > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 16,
            padding: '12px 16px',
            background: 'var(--card-bg, #ffffff)',
            borderRadius: 8,
            border: '1px solid var(--border)',
            fontSize: 12,
            color: 'var(--text-muted)',
          }}
        >
          <div>
            Mostrando <strong>{items.length}</strong> de <strong>{totalCount}</strong> cuentas por pagar
          </div>

          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="outline-button-sm"
              style={{
                padding: '4px 10px',
                borderRadius: 6,
                border: '1px solid var(--border)',
                background: '#ffffff',
                cursor: page <= 1 ? 'not-allowed' : 'pointer',
                opacity: page <= 1 ? 0.5 : 1,
              }}
            >
              <AppIcon name="chevronLeft" size={14} />
            </button>
            <span style={{ fontWeight: 600, padding: '0 8px' }}>
              Página {page} de {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="outline-button-sm"
              style={{
                padding: '4px 10px',
                borderRadius: 6,
                border: '1px solid var(--border)',
                background: '#ffffff',
                cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                opacity: page >= totalPages ? 0.5 : 1,
              }}
            >
              <AppIcon name="chevronRight" size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Modal Abono / Pago */}
      <AccountsPayablePaymentModal
        item={selectedItemForPayment}
        isOpen={!!selectedItemForPayment}
        onClose={() => setSelectedItemForPayment(null)}
        onSuccess={() => fetchData()}
      />

      {/* Modal Historial de Pagos */}
      <AccountsPayableHistoryModal
        item={selectedItemForHistory}
        isOpen={!!selectedItemForHistory}
        onClose={() => setSelectedItemForHistory(null)}
      />
    </div>
  )
}
