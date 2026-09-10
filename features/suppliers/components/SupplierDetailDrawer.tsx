'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '@/components/ui/Icon'
import {
  Supplier,
  SupplierProductSummary,
  SupplierInvoiceSummary,
  SupplierPaymentSummary,
  SupplierWarehouseRelation,
  SupplierDocumentItem,
  UserPermissionContext,
} from '../types'
import { supplierService } from '../services/supplier.service'
import { getSupplierStatusBadge } from './SupplierTable'

interface SupplierDetailDrawerProps {
  supplier: Supplier | null
  isOpen: boolean
  isCostRedacted: boolean
  userContext?: UserPermissionContext
  onClose: () => void
  onEdit?: (supplier: Supplier) => void
  onNewPurchase?: (supplier: Supplier) => void
  onRegisterPayment?: (supplier: Supplier) => void
  onViewPurchaseInModule?: (purchaseNumber: string) => void
}

type TabKey =
  | 'resumen'
  | 'compras'
  | 'productos'
  | 'facturas'
  | 'pagos'
  | 'documentos'
  | 'bodegas'
  | 'auditoria'

export function SupplierDetailDrawer({
  supplier,
  isOpen,
  isCostRedacted,
  userContext,
  onClose,
  onEdit,
  onNewPurchase,
  onRegisterPayment,
  onViewPurchaseInModule,
}: SupplierDetailDrawerProps) {
  const [mounted, setMounted] = useState(false)
  const [activeTab, setActiveTab] = useState<TabKey>('resumen')

  // Relational sub-data
  const [products, setProducts] = useState<SupplierProductSummary[]>([])
  const [invoices, setInvoices] = useState<SupplierInvoiceSummary[]>([])
  const [payments, setPayments] = useState<SupplierPaymentSummary[]>([])
  const [warehouses, setWarehouses] = useState<SupplierWarehouseRelation[]>([])
  const [documents, setDocuments] = useState<SupplierDocumentItem[]>([])
  const [auditLogs, setAuditLogs] = useState<any[]>([])
  const [loadingTabs, setLoadingTabs] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const loadSubData = useCallback(async () => {
    if (!supplier) return
    setLoadingTabs(true)
    try {
      const [prods, invs, pays, whs, docs, logs] = await Promise.all([
        supplierService.getSupplierProducts(supplier.id, userContext),
        supplierService.getSupplierInvoices(supplier.id, userContext),
        supplierService.getSupplierPayments(supplier.id, userContext),
        supplierService.getSupplierWarehouses(supplier.id, userContext),
        supplierService.getSupplierDocuments(supplier.id, userContext),
        supplierService.getSupplierAuditLogs(supplier.id, userContext),
      ])
      setProducts(prods)
      setInvoices(invs)
      setPayments(pays)
      setWarehouses(whs)
      setDocuments(docs)
      setAuditLogs(logs)
    } catch (err) {
      console.error('Error cargando datos relacionales del proveedor:', err)
    } finally {
      setLoadingTabs(false)
    }
  }, [supplier, userContext])

  useEffect(() => {
    if (isOpen && supplier) {
      loadSubData()
      setActiveTab('resumen')
    }
  }, [isOpen, supplier, loadSubData])

  if (!isOpen || !supplier || !mounted) return null

  const formatCurrency = (val: number) => {
    if (isCostRedacted) return '••••••'
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(val)
  }

  const formatDate = (isoString?: string) => {
    if (!isoString) return '—'
    const d = new Date(isoString)
    return d.toLocaleDateString('es-CO', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const hasPendingBalance = (supplier.currentBalance || 0) > 0

  return createPortal(
    <div
      className="drawer-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="supplier-detail-title"
    >
      <div
        className="product-drawer product-detail-drawer page-enter"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 880, width: '94vw' }}
      >
        {/* Header */}
        <div className="drawer-header product-detail-header-v2" style={{ padding: '18px 24px' }}>
          <div className="product-detail-hero-layout">
            <div
              className="stat-icon blue"
              style={{ width: 46, height: 46, borderRadius: 12 }}
            >
              <AppIcon name="suppliers" size={26} />
            </div>

            <div className="product-detail-header-info">
              <span className="product-category-eyebrow">
                Ficha del Proveedor • NIT {supplier.documentNumber || supplier.nit}
              </span>
              <h2
                id="supplier-detail-title"
                className="product-detail-title-v2"
                style={{ fontSize: 18 }}
              >
                {supplier.businessName || supplier.supplierName}
              </h2>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  marginTop: 4,
                  flexWrap: 'wrap',
                }}
              >
                {getSupplierStatusBadge(supplier.status)}
                {supplier.commercialName && (
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                    Comercial: <strong>{supplier.commercialName}</strong>
                  </span>
                )}
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                  • {supplier.city}, {supplier.department}
                </span>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                  • Tel: {supplier.phone}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            className="drawer-close-btn"
            onClick={onClose}
            aria-label="Cerrar ficha"
          >
            <AppIcon name="close" size={18} />
          </button>
        </div>

        {/* Action Toolbar */}
        <div
          style={{
            padding: '12px 24px',
            background: 'var(--bg-subtle, #f8fafc)',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', gap: 8 }}>
            {/* Nueva Compra */}
            {onNewPurchase && (
              <button
                type="button"
                className="primary-button"
                onClick={() => onNewPurchase(supplier)}
                title="Generar nueva orden de compra a este proveedor"
              >
                <AppIcon name="purchases" size={15} />
                <span>Nueva compra</span>
              </button>
            )}

            {/* Registrar Pago (si tiene saldo pendiente) */}
            {hasPendingBalance && onRegisterPayment && (
              <button
                type="button"
                className="outline-button"
                onClick={() => onRegisterPayment(supplier)}
                title="Registrar abono a facturas de este proveedor"
                style={{ color: '#7c3aed', borderColor: '#c4b5fd' }}
              >
                <AppIcon name="wallet" size={15} />
                <span>Registrar pago</span>
              </button>
            )}

            {/* Editar Ficha */}
            {onEdit && (
              <button
                type="button"
                className="outline-button"
                onClick={() => onEdit(supplier)}
                title="Editar información del proveedor"
              >
                <AppIcon name="edit" size={14} />
                <span>Editar ficha</span>
              </button>
            )}
          </div>

          <div style={{ fontSize: 11, color: 'var(--muted)' }}>
            Registrado: {formatDate(supplier.createdAt)}
          </div>
        </div>

        {/* Executive Metrics Bar */}
        <div
          style={{
            padding: '14px 24px',
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 12,
            borderBottom: '1px solid var(--border)',
            background: '#fff',
          }}
        >
          <div
            style={{
              padding: 10,
              background: '#f8fafc',
              borderRadius: 8,
              border: '1px solid var(--border)',
            }}
          >
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>
              Total comprado
            </div>
            <strong
              style={{ fontSize: 14, color: 'var(--navy)' }}
              className="font-tabular"
            >
              {formatCurrency(supplier.totalPurchased)}
            </strong>
            <div style={{ fontSize: 10, color: 'var(--muted)' }}>
              {supplier.deliveriesCount || 0} compras asentadas
            </div>
          </div>

          <div
            style={{
              padding: 10,
              background: '#f8fafc',
              borderRadius: 8,
              border: '1px solid var(--border)',
            }}
          >
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>
              Saldo pendiente
            </div>
            <strong
              style={{
                fontSize: 14,
                color: hasPendingBalance ? '#b45309' : '#16a34a',
              }}
              className="font-tabular"
            >
              {formatCurrency(supplier.currentBalance)}
            </strong>
            <div style={{ fontSize: 10, color: 'var(--muted)' }}>
              {hasPendingBalance ? 'Obligación viva' : 'Al día ($0)'}
            </div>
          </div>

          <div
            style={{
              padding: 10,
              background: '#f8fafc',
              borderRadius: 8,
              border: '1px solid var(--border)',
            }}
          >
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>
              Cupo de crédito
            </div>
            <strong
              style={{ fontSize: 13, color: 'var(--text-main)' }}
              className="font-tabular"
            >
              {formatCurrency(supplier.creditLimit)}
            </strong>
            <div style={{ fontSize: 10, color: 'var(--muted)' }}>
              Plazo: {supplier.creditDays} días
            </div>
          </div>

          <div
            style={{
              padding: 10,
              background: '#f8fafc',
              borderRadius: 8,
              border: '1px solid var(--border)',
            }}
          >
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>
              Contacto principal
            </div>
            <strong style={{ fontSize: 12, color: 'var(--text-main)' }}>
              {supplier.contactName}
            </strong>
            <div style={{ fontSize: 10, color: 'var(--muted)' }}>
              {supplier.email}
            </div>
          </div>
        </div>

        {/* 8 Animated Tabs Header */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--border)',
            padding: '0 16px',
            background: '#fff',
            overflowX: 'auto',
          }}
        >
          {[
            { key: 'resumen', label: 'Resumen', icon: 'dashboard' },
            { key: 'compras', label: `Compras (${invoices.length})`, icon: 'purchases' },
            { key: 'productos', label: `Productos (${products.length})`, icon: 'products' },
            { key: 'facturas', label: `Facturas (${invoices.length})`, icon: 'invoices' },
            { key: 'pagos', label: `Pagos (${payments.length})`, icon: 'wallet' },
            { key: 'documentos', label: `Documentos (${documents.length})`, icon: 'download' },
            { key: 'bodegas', label: `Bodegas (${warehouses.length})`, icon: 'warehouse' },
            { key: 'auditoria', label: 'Auditoría', icon: 'audit' },
          ].map((t) => (
            <button
              key={t.key}
              type="button"
              className={`period-tab-btn ${activeTab === t.key ? 'selected' : ''}`}
              onClick={() => setActiveTab(t.key as TabKey)}
              style={{
                padding: '12px 14px',
                borderBottom:
                  activeTab === t.key
                    ? '2px solid var(--navy)'
                    : '2px solid transparent',
                borderRadius: 0,
                whiteSpace: 'nowrap',
              }}
            >
              <AppIcon name={t.icon as any} size={14} />
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* Body Content */}
        <div
          className="drawer-body"
          style={{ padding: 24, overflowY: 'auto', flex: 1 }}
        >
          {loadingTabs ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)' }}>
              Cargando información del proveedor...
            </div>
          ) : (
            <>
              {/* =========================================================================
                  TAB 1: RESUMEN
                 ========================================================================= */}
              {activeTab === 'resumen' && (
                <div className="page-enter">
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1.2fr 1fr',
                      gap: 20,
                      marginBottom: 20,
                    }}
                  >
                    {/* Tarjeta Datos Comerciales */}
                    <div
                      style={{
                        padding: 16,
                        background: '#f8fafc',
                        borderRadius: 8,
                        border: '1px solid var(--border)',
                      }}
                    >
                      <h4
                        style={{
                          margin: '0 0 12px',
                          fontSize: 13,
                          color: 'var(--navy)',
                          fontWeight: 700,
                        }}
                      >
                        Condiciones Comerciales y Fiscales
                      </h4>
                      <div style={{ display: 'grid', gap: 8, fontSize: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--muted)' }}>Tipo de persona / Doc:</span>
                          <strong>{supplier.documentType} {supplier.documentNumber}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--muted)' }}>Días de crédito:</span>
                          <strong>{supplier.creditDays} días</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--muted)' }}>Cupo máximo asignado:</span>
                          <strong className="font-tabular">{formatCurrency(supplier.creditLimit)}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--muted)' }}>Dirección:</span>
                          <span>{supplier.address}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--muted)' }}>Ciudad / Dpto:</span>
                          <span>{supplier.city}, {supplier.department} ({supplier.country})</span>
                        </div>
                      </div>

                      {supplier.notes && (
                        <div
                          style={{
                            marginTop: 12,
                            paddingTop: 10,
                            borderTop: '1px dashed var(--border)',
                            fontSize: 11,
                            color: 'var(--muted)',
                          }}
                        >
                          <strong>Observaciones:</strong> {supplier.notes}
                        </div>
                      )}
                    </div>

                    {/* Tarjeta Cuentas por Pagar & Vencimientos */}
                    <div
                      style={{
                        padding: 16,
                        background: '#f8fafc',
                        borderRadius: 8,
                        border: '1px solid var(--border)',
                      }}
                    >
                      <h4
                        style={{
                          margin: '0 0 12px',
                          fontSize: 13,
                          color: 'var(--navy)',
                          fontWeight: 700,
                        }}
                      >
                        Estado de Cuentas por Pagar
                      </h4>
                      <div style={{ fontSize: 12, marginBottom: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ color: 'var(--muted)' }}>Saldo pendiente:</span>
                          <strong style={{ color: hasPendingBalance ? '#b45309' : '#16a34a' }}>
                            {formatCurrency(supplier.currentBalance)}
                          </strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--muted)' }}>Facturas vivas:</span>
                          <strong>{invoices.filter((i) => i.pendingBalance > 0).length}</strong>
                        </div>
                      </div>

                      {hasPendingBalance && onRegisterPayment && (
                        <button
                          type="button"
                          className="primary-button"
                          onClick={() => onRegisterPayment(supplier)}
                          style={{ width: '100%', justifyContent: 'center', background: '#7c3aed', borderColor: '#7c3aed' }}
                        >
                          <AppIcon name="wallet" size={14} />
                          <span>Abonar a facturas pendientes</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Últimas compras */}
                  <h4 style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--navy)', fontWeight: 700 }}>
                    Últimas Órdenes de Compra Realizadas
                  </h4>
                  {invoices.length === 0 ? (
                    <div style={{ padding: 24, textAlign: 'center', background: '#f8fafc', borderRadius: 8, border: '1px dashed var(--border)', fontSize: 12, color: 'var(--muted)' }}>
                      No hay compras registradas para este proveedor.
                    </div>
                  ) : (
                    <div className="table-responsive" style={{ border: '1px solid var(--border)', borderRadius: 8 }}>
                      <table className="products-table" style={{ fontSize: 12 }}>
                        <thead>
                          <tr>
                            <th>N° Compra</th>
                            <th>Factura</th>
                            <th>Fecha</th>
                            <th className="numeric">Total</th>
                            <th className="numeric">Saldo</th>
                            <th>Estado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {invoices.slice(0, 4).map((inv) => (
                            <tr key={inv.purchaseId}>
                              <td><strong>{inv.purchaseNumber}</strong></td>
                              <td>{inv.invoiceNumber}</td>
                              <td>{formatDate(inv.date)}</td>
                              <td className="numeric font-tabular">{formatCurrency(inv.total)}</td>
                              <td className="numeric font-tabular">
                                <span style={{ color: inv.pendingBalance > 0 ? '#b45309' : '#16a34a', fontWeight: 600 }}>
                                  {formatCurrency(inv.pendingBalance)}
                                </span>
                              </td>
                              <td>
                                <span className={`kardex-type-badge ${inv.status === 'PAGADA' ? 'type-badge-green' : inv.status === 'VENCIDA' ? 'type-badge-red' : 'type-badge-amber'}`}>
                                  {inv.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* =========================================================================
                  TAB 2: COMPRAS
                 ========================================================================= */}
              {activeTab === 'compras' && (
                <div className="page-enter">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                      Mostrando {invoices.length} órdenes comerciales asociadas
                    </span>
                    {onNewPurchase && (
                      <button
                        type="button"
                        className="outline-button-sm"
                        onClick={() => onNewPurchase(supplier)}
                      >
                        <AppIcon name="plus" size={13} />
                        <span>Nueva compra</span>
                      </button>
                    )}
                  </div>

                  {invoices.length === 0 ? (
                    <div style={{ padding: 32, textAlign: 'center', background: '#f8fafc', borderRadius: 8, border: '1px dashed var(--border)', color: 'var(--muted)', fontSize: 13 }}>
                      No se han emitido órdenes de compra a este proveedor.
                    </div>
                  ) : (
                    <div className="table-responsive" style={{ border: '1px solid var(--border)', borderRadius: 8 }}>
                      <table className="products-table" style={{ fontSize: 12 }}>
                        <thead>
                          <tr>
                            <th>N° Compra</th>
                            <th>Factura Proveedor</th>
                            <th>Fecha</th>
                            <th>Vencimiento</th>
                            <th className="numeric">Total</th>
                            <th className="numeric">Saldo</th>
                            <th>Estado</th>
                            <th style={{ textAlign: 'right', paddingRight: 14 }}>Acción</th>
                          </tr>
                        </thead>
                        <tbody>
                          {invoices.map((inv) => (
                            <tr key={inv.purchaseId}>
                              <td><strong>{inv.purchaseNumber}</strong></td>
                              <td>{inv.invoiceNumber}</td>
                              <td>{formatDate(inv.date)}</td>
                              <td>{formatDate(inv.dueDate)}</td>
                              <td className="numeric font-tabular">{formatCurrency(inv.total)}</td>
                              <td className="numeric font-tabular">
                                <strong style={{ color: inv.pendingBalance > 0 ? '#b45309' : '#16a34a' }}>
                                  {formatCurrency(inv.pendingBalance)}
                                </strong>
                              </td>
                              <td>
                                <span className={`kardex-type-badge ${inv.status === 'PAGADA' ? 'type-badge-green' : inv.status === 'VENCIDA' ? 'type-badge-red' : 'type-badge-amber'}`}>
                                  {inv.status}
                                </span>
                              </td>
                              <td style={{ textAlign: 'right', paddingRight: 14 }}>
                                {onViewPurchaseInModule ? (
                                  <button
                                    type="button"
                                    className="outline-button-sm"
                                    onClick={() => onViewPurchaseInModule(inv.purchaseNumber)}
                                    title="Abrir compra en el módulo Compras"
                                  >
                                    <span>Ver compra</span>
                                  </button>
                                ) : (
                                  <a href="/compras" className="outline-button-sm">
                                    <span>Ver compra</span>
                                  </a>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* =========================================================================
                  TAB 3: PRODUCTOS SUMINISTRADOS
                 ========================================================================= */}
              {activeTab === 'productos' && (
                <div className="page-enter">
                  <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--muted)' }}>
                    Productos adquiridos a través de líneas de compra con este proveedor (Supplier → PurchaseLine → Product).
                  </p>

                  {products.length === 0 ? (
                    <div style={{ padding: 32, textAlign: 'center', background: '#f8fafc', borderRadius: 8, border: '1px dashed var(--border)', color: 'var(--muted)', fontSize: 13 }}>
                      Aún no hay productos registrados en compras de este proveedor.
                    </div>
                  ) : (
                    <div className="table-responsive" style={{ border: '1px solid var(--border)', borderRadius: 8 }}>
                      <table className="products-table" style={{ fontSize: 12 }}>
                        <thead>
                          <tr>
                            <th>Producto</th>
                            <th>SKU</th>
                            <th>Categoría</th>
                            <th className="numeric">Último Costo</th>
                            <th>Última Compra</th>
                            <th>Fecha</th>
                            <th className="numeric">Unidades Acumuladas</th>
                          </tr>
                        </thead>
                        <tbody>
                          {products.map((p) => (
                            <tr key={p.productId}>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  {p.imageUrl ? (
                                    <img
                                      src={p.imageUrl}
                                      alt={p.productName}
                                      style={{ width: 28, height: 28, borderRadius: 4, objectFit: 'cover' }}
                                    />
                                  ) : (
                                    <div style={{ width: 28, height: 28, borderRadius: 4, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--navy)' }}>
                                      <AppIcon name="products" size={14} />
                                    </div>
                                  )}
                                  <strong>{p.productName}</strong>
                                </div>
                              </td>
                              <td><span className="sku-badge">{p.sku}</span></td>
                              <td>{p.category}</td>
                              <td className="numeric font-tabular">
                                <strong>{formatCurrency(p.lastUnitCost)}</strong>
                              </td>
                              <td><span className="secondary-meta">{p.lastPurchaseDoc}</span></td>
                              <td>{formatDate(p.lastPurchaseDate)}</td>
                              <td className="numeric font-tabular">
                                {p.totalUnitsSupplied} {p.unitOfMeasure}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* =========================================================================
                  TAB 4: FACTURAS
                 ========================================================================= */}
              {activeTab === 'facturas' && (
                <div className="page-enter">
                  <div style={{ display: 'grid', gap: 12 }}>
                    {invoices.length === 0 ? (
                      <div style={{ padding: 32, textAlign: 'center', background: '#f8fafc', borderRadius: 8, border: '1px dashed var(--border)', color: 'var(--muted)', fontSize: 13 }}>
                        No hay facturas registradas.
                      </div>
                    ) : (
                      invoices.map((inv) => (
                        <div
                          key={inv.purchaseId}
                          style={{
                            padding: 14,
                            background: '#f8fafc',
                            borderRadius: 8,
                            border: '1px solid var(--border)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: 10,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div
                              style={{
                                width: 38,
                                height: 38,
                                borderRadius: 8,
                                background: '#eff6ff',
                                color: 'var(--navy)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <AppIcon name="invoices" size={18} />
                            </div>
                            <div>
                              <strong style={{ fontSize: 13, color: 'var(--navy)' }}>
                                Factura {inv.invoiceNumber}
                              </strong>
                              <div style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', gap: 8 }}>
                                <span>Orden: {inv.purchaseNumber}</span>
                                <span>•</span>
                                <span>Emitida: {formatDate(inv.date)}</span>
                                <span>•</span>
                                <span>Vence: {formatDate(inv.dueDate)}</span>
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: 13, fontWeight: 700 }} className="font-tabular">
                                {formatCurrency(inv.total)}
                              </div>
                              <div style={{ fontSize: 11, color: inv.pendingBalance > 0 ? '#b45309' : '#16a34a' }}>
                                Saldo: {formatCurrency(inv.pendingBalance)}
                              </div>
                            </div>

                            <span className={`kardex-type-badge ${inv.status === 'PAGADA' ? 'type-badge-green' : inv.status === 'VENCIDA' ? 'type-badge-red' : 'type-badge-amber'}`}>
                              {inv.status}
                            </span>

                            {inv.hasAttachment && inv.attachmentUrl && (
                              <a
                                href={inv.attachmentUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="outline-button-sm"
                                title="Ver archivo soporte de factura"
                              >
                                <AppIcon name="eye" size={14} />
                              </a>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* =========================================================================
                  TAB 5: PAGOS
                 ========================================================================= */}
              {activeTab === 'pagos' && (
                <div className="page-enter">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                      Historial de abonos y transferencias realizadas
                    </span>
                    {hasPendingBalance && onRegisterPayment && (
                      <button
                        type="button"
                        className="primary-button-sm"
                        onClick={() => onRegisterPayment(supplier)}
                        style={{ background: '#7c3aed', borderColor: '#7c3aed' }}
                      >
                        <AppIcon name="wallet" size={13} />
                        <span>Registrar pago</span>
                      </button>
                    )}
                  </div>

                  {payments.length === 0 ? (
                    <div style={{ padding: 32, textAlign: 'center', background: '#f8fafc', borderRadius: 8, border: '1px dashed var(--border)', color: 'var(--muted)', fontSize: 13 }}>
                      No se han registrado pagos ni abonos a este proveedor.
                    </div>
                  ) : (
                    <div className="table-responsive" style={{ border: '1px solid var(--border)', borderRadius: 8 }}>
                      <table className="products-table" style={{ fontSize: 12 }}>
                        <thead>
                          <tr>
                            <th>Fecha</th>
                            <th>Factura / Orden</th>
                            <th>Método</th>
                            <th>Referencia</th>
                            <th>Registrado por</th>
                            <th className="numeric">Valor Pagado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {payments.map((p) => (
                            <tr key={p.paymentId}>
                              <td>{formatDate(p.date)}</td>
                              <td>{p.invoiceNumber} ({p.purchaseNumber})</td>
                              <td><span className="sku-badge">{p.paymentMethod}</span></td>
                              <td>{p.reference}</td>
                              <td>{p.registeredByUserName}</td>
                              <td className="numeric font-tabular">
                                <strong style={{ color: '#16a34a' }}>{formatCurrency(p.amount)}</strong>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* =========================================================================
                  TAB 6: DOCUMENTOS
                 ========================================================================= */}
              {activeTab === 'documentos' && (
                <div className="page-enter">
                  <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--muted)' }}>
                    Documentos comerciales, facturas electrónicas y certificados tributarios (PDF o imagen).
                  </p>

                  {documents.length === 0 ? (
                    <div style={{ padding: 32, textAlign: 'center', background: '#f8fafc', borderRadius: 8, border: '1px dashed var(--border)', color: 'var(--muted)', fontSize: 13 }}>
                      No hay documentos adjuntos para este proveedor.
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gap: 12 }}>
                      {documents.map((d) => (
                        <div
                          key={d.id}
                          style={{
                            padding: 14,
                            background: '#f8fafc',
                            borderRadius: 8,
                            border: '1px solid var(--border)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div
                              style={{
                                width: 40,
                                height: 40,
                                borderRadius: 8,
                                background: '#eff6ff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'var(--navy)',
                              }}
                            >
                              <AppIcon name="invoices" size={20} />
                            </div>
                            <div>
                              <strong style={{ fontSize: 13, color: 'var(--navy)', display: 'block' }}>
                                {d.fileName}
                              </strong>
                              <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                                {(d.fileSize / 1024).toFixed(1)} KB • Subido por {d.uploadedBy} el {formatDate(d.uploadedAt)}
                              </span>
                            </div>
                          </div>

                          <a
                            href={d.url}
                            target="_blank"
                            rel="noreferrer"
                            className="outline-button-sm"
                            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                          >
                            <AppIcon name="eye" size={14} />
                            <span>Visualizar soporte</span>
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* =========================================================================
                  TAB 7: RELACIÓN CON BODEGAS
                 ========================================================================= */}
              {activeTab === 'bodegas' && (
                <div className="page-enter">
                  <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--muted)' }}>
                    Bodegas de la empresa donde este proveedor ha efectuado entregas de mercancía (Supplier ↔ Location).
                  </p>

                  {warehouses.length === 0 ? (
                    <div style={{ padding: 32, textAlign: 'center', background: '#f8fafc', borderRadius: 8, border: '1px dashed var(--border)', color: 'var(--muted)', fontSize: 13 }}>
                      Sin registros de entregas por bodega.
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
                      {warehouses.map((w) => (
                        <div
                          key={w.locationId}
                          style={{
                            padding: 14,
                            background: '#f8fafc',
                            borderRadius: 8,
                            border: '1px solid var(--border)',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <AppIcon name="warehouse" size={18} />
                            <strong style={{ fontSize: 13, color: 'var(--navy)' }}>{w.locationName}</strong>
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>
                            Código: <strong>{w.locationCode}</strong>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                            <span style={{ color: 'var(--muted)' }}>Compras recibidas:</span>
                            <strong>{w.purchasesCount}</strong>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                            <span style={{ color: 'var(--muted)' }}>Volumen facturado:</span>
                            <strong className="font-tabular">{formatCurrency(w.totalAmount)}</strong>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)', marginTop: 8, borderTop: '1px dashed var(--border)', paddingTop: 6 }}>
                            <span>Última operación:</span>
                            <span>{formatDate(w.lastOperationDate)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* =========================================================================
                  TAB 8: AUDITORÍA
                 ========================================================================= */}
              {activeTab === 'auditoria' && (
                <div className="page-enter">
                  <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--muted)' }}>
                    Bitácora inmutable de modificaciones sobre el proveedor (audit_logs.json).
                  </p>

                  {auditLogs.length === 0 ? (
                    <div style={{ padding: 32, textAlign: 'center', background: '#f8fafc', borderRadius: 8, border: '1px dashed var(--border)', color: 'var(--muted)', fontSize: 13 }}>
                      No hay registros de auditoría recientes para este proveedor.
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gap: 10 }}>
                      {auditLogs.map((log) => (
                        <div
                          key={log.id}
                          style={{
                            padding: 12,
                            background: '#f8fafc',
                            borderRadius: 8,
                            border: '1px solid var(--border)',
                            fontSize: 12,
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <strong style={{ color: 'var(--navy)' }}>{log.action}</strong>
                            <span style={{ color: 'var(--muted)', fontSize: 11 }}>
                              {formatDate(log.timestamp)} por {log.userName}
                            </span>
                          </div>
                          {log.changes?.details && (
                            <p style={{ margin: '2px 0 0', color: 'var(--text-main)' }}>
                              {log.changes.details}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Drawer Footer */}
        <div
          className="drawer-footer"
          style={{
            padding: '14px 24px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'flex-end',
            background: '#fff',
          }}
        >
          <button type="button" className="outline-button" onClick={onClose}>
            Cerrar ficha
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
