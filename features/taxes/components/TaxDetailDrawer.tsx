'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '@/components/ui/Icon'
import { TaxConfig } from '../types'
import { taxService } from '../services/tax.service'
import { taxCalculationService } from '../services/tax-calculation.service'
import { TaxPermissions } from '../hooks/useTaxPermissions'

interface TaxDetailDrawerProps {
  taxId: string | null
  isOpen: boolean
  onClose: () => void
  onEdit: (tax: TaxConfig) => void
  onViewProducts: (tax: TaxConfig) => void
  onDeactivate: (tax: TaxConfig) => void
  onActivate: (tax: TaxConfig) => void
  permissions: TaxPermissions
}

export function TaxDetailDrawer({
  taxId,
  isOpen,
  onClose,
  onEdit,
  onViewProducts,
  onDeactivate,
  onActivate,
  permissions,
}: TaxDetailDrawerProps) {
  const [mounted, setMounted] = useState(false)
  const [tax, setTax] = useState<TaxConfig | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (taxId && isOpen) {
      setIsLoading(true)
      taxService
        .getById(taxId)
        .then((data) => setTax(data))
        .catch(() => setTax(null))
        .finally(() => setIsLoading(false))
    } else {
      setTax(null)
    }
  }, [taxId, isOpen])

  // Cerrar con Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!mounted || !isOpen) return null

  const drawerContent = (
    <div
      className="drawer-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tax-detail-title"
    >
      <div
        className="product-drawer"
        style={{ width: 'min(100%, 540px)', padding: '28px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="drawer-header">
          <div>
            <p className="eyebrow" style={{ margin: '0 0 4px', fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1.2 }}>
              Ficha Tributaria DIAN
            </p>
            <h2 id="tax-detail-title" style={{ margin: 0, fontSize: 20 }}>
              {tax?.name || 'Cargando detalle...'}
            </h2>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Cerrar panel"
          >
            <AppIcon name="close" size={18} />
          </button>
        </div>

        {isLoading ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--muted)' }}>
            <AppIcon name="refresh" size={24} className="animate-spin" />
            <p style={{ marginTop: 10, fontSize: 12 }}>Consultando datos tributarios...</p>
          </div>
        ) : !tax ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--red)' }}>
            No se encontró la configuración tributaria solicitada.
          </div>
        ) : (
          <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Header Card de Tarifa */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 18,
                borderRadius: 12,
                background: 'linear-gradient(135deg, #001b5c 0%, #152b6d 100%)',
                color: '#fff',
              }}
            >
              <div>
                <span style={{ fontSize: 11, opacity: 0.8, textTransform: 'uppercase', letterSpacing: 1 }}>
                  Tarifa Legal Vigente
                </span>
                <div style={{ fontSize: 32, fontWeight: 900, marginTop: 4 }}>
                  {tax.ratePercent}%
                </div>
                <div style={{ fontSize: 11, opacity: 0.9, marginTop: 4 }}>
                  Código Fiscal: <strong>{tax.code}</strong> · Versión {tax.version || 1}
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 10px',
                    borderRadius: 20,
                    fontSize: 11,
                    fontWeight: 700,
                    background: tax.status === 'ACTIVE' ? '#10b981' : '#64748b',
                    color: '#fff',
                  }}
                >
                  <i style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />
                  {tax.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
                </span>
                <div style={{ fontSize: 11, opacity: 0.8, marginTop: 8 }}>
                  Tipo: <strong>{tax.type}</strong>
                </div>
              </div>
            </div>

            {/* Tarjetas de Uso y Métricas */}
            <div>
              <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 700, color: 'var(--navy)' }}>
                Impacto y Uso en el ERP
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                <div style={{ padding: 12, borderRadius: 10, border: '1px solid var(--line)', background: '#fafbfc' }}>
                  <span style={{ fontSize: 10, color: 'var(--muted)' }}>Productos</span>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--navy)', margin: '4px 0' }}>
                    {tax.associatedProductsCount || 0}
                  </div>
                  <button
                    type="button"
                    className="text-button"
                    style={{ fontSize: 10, padding: 0 }}
                    onClick={() => onViewProducts(tax)}
                  >
                    Ver catálogo &rarr;
                  </button>
                </div>

                <div style={{ padding: 12, borderRadius: 10, border: '1px solid var(--line)', background: '#fafbfc' }}>
                  <span style={{ fontSize: 10, color: 'var(--muted)' }}>IVA en Ventas</span>
                  <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--red)', margin: '4px 0' }}>
                    {taxCalculationService.formatCOP(tax.totalSalesTaxAmount || 0)}
                  </div>
                  <small style={{ fontSize: 9, color: 'var(--muted)' }}>
                    {tax.salesCount || 0} facturas emitidas
                  </small>
                </div>

                <div style={{ padding: 12, borderRadius: 10, border: '1px solid var(--line)', background: '#fafbfc' }}>
                  <span style={{ fontSize: 10, color: 'var(--muted)' }}>IVA en Compras</span>
                  <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--green)', margin: '4px 0' }}>
                    {taxCalculationService.formatCOP(tax.totalPurchasesTaxAmount || 0)}
                  </div>
                  <small style={{ fontSize: 9, color: 'var(--muted)' }}>
                    {tax.purchasesCount || 0} compras recibidas
                  </small>
                </div>
              </div>
            </div>

            {/* Vigencia & Fundamento Legal */}
            <div style={{ padding: 14, borderRadius: 10, border: '1px solid var(--line)', background: '#fff' }}>
              <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: 'var(--navy)' }}>
                Vigencia Tributaria
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                <span style={{ color: 'var(--muted)' }}>Fecha de inicio:</span>
                <strong>{tax.validFrom}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: 'var(--muted)' }}>Fecha de finalización:</span>
                <strong>{tax.validUntil || 'Vigencia indefinida'}</strong>
              </div>
              {tax.description && (
                <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--line)', fontSize: 11, color: 'var(--muted)', lineHeight: 1.5 }}>
                  {tax.description}
                </div>
              )}
            </div>

            {/* Cuentas Contables */}
            <div style={{ padding: 14, borderRadius: 10, border: '1px solid var(--line)', background: '#fff' }}>
              <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: 'var(--navy)' }}>
                Mapeo Contable PUC
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ color: 'var(--muted)' }}>IVA Generado (Venta):</span>
                <strong>{tax.generatedTaxAccountName || tax.generatedTaxAccountId || '240805'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '6px 0' }}>
                <span style={{ color: 'var(--muted)' }}>IVA Descontable (Compra):</span>
                <strong>{tax.deductibleTaxAccountName || tax.deductibleTaxAccountId || '240810'}</strong>
              </div>
            </div>

            {/* Acciones del Drawer */}
            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
              <button
                type="button"
                className="outline-button"
                style={{ flex: 1 }}
                onClick={() => onViewProducts(tax)}
              >
                <AppIcon name="products" size={14} />
                <span>Ver productos</span>
              </button>

              {permissions.canUpdateTax && (
                <button
                  type="button"
                  className="outline-button"
                  style={{ flex: 1 }}
                  onClick={() => {
                    onClose()
                    onEdit(tax)
                  }}
                >
                  <AppIcon name="edit" size={14} />
                  <span>Editar</span>
                </button>
              )}

              {permissions.canDeactivateTax && (
                tax.status === 'ACTIVE' ? (
                  <button
                    type="button"
                    className="outline-button"
                    style={{ color: 'var(--red)', borderColor: '#fca5a5' }}
                    onClick={() => {
                      onClose()
                      onDeactivate(tax)
                    }}
                    title="Desactivar"
                  >
                    <AppIcon name="powerOff" size={14} />
                  </button>
                ) : (
                  <button
                    type="button"
                    className="outline-button"
                    style={{ color: 'var(--green)', borderColor: '#86efac' }}
                    onClick={() => {
                      onClose()
                      onActivate(tax)
                    }}
                    title="Reactivar"
                  >
                    <AppIcon name="check" size={14} />
                  </button>
                )
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )

  return createPortal(drawerContent, document.body)
}
