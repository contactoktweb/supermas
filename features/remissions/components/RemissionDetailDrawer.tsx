'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '@/components/ui/Icon'
import { RemissionStatusBadge } from './RemissionStatusBadge'
import { Remission } from '../types'

interface RemissionDetailDrawerProps {
  isOpen: boolean
  remission: Remission | null
  onClose: () => void
  onOpenDispatch: (rem: Remission) => void
  onOpenDeliver: (rem: Remission) => void
  onOpenCancel: (rem: Remission) => void
}

export function RemissionDetailDrawer({
  isOpen,
  remission,
  onClose,
  onOpenDispatch,
  onOpenDeliver,
  onOpenCancel,
}: RemissionDetailDrawerProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  if (!mounted || !isOpen || !remission) return null

  const handlePrint = () => {
    window.print()
  }

  // Determine Stepper States
  const isCreated = Boolean(remission.createdAt)
  const isDispatched = remission.status === 'DISPATCHED' || remission.status === 'DELIVERED'
  const isDelivered = remission.status === 'DELIVERED'
  const isCancelled = remission.status === 'CANCELLED'

  return createPortal(
    <div className="drawer-backdrop" onClick={onClose}>
      <aside
        className="product-drawer page-enter"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 680,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflowY: 'auto',
          background: '#ffffff',
        }}
      >
        {/* Drawer Header */}
        <div className="drawer-header" style={{ borderBottom: '1px solid #e2e8f0', padding: '18px 24px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span className="eyebrow" style={{ margin: 0 }}>Comprobante de Despacho & Entrega</span>
              <RemissionStatusBadge status={remission.status} size="sm" />
            </div>
            <h2 style={{ fontSize: 20, color: 'var(--navy)', margin: 0, fontWeight: 800 }}>
              {remission.remissionNumber}
            </h2>
          </div>

          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Cerrar detalle"
            style={{ width: 34, height: 34 }}
          >
            <AppIcon name="close" size={18} />
          </button>
        </div>

        {/* Drawer Body */}
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Animated Delivery Stepper */}
          {!isCancelled ? (
            <div
              style={{
                padding: '16px 20px',
                borderRadius: 10,
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Progreso del Despacho y Entrega
              </span>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: 14,
                  position: 'relative',
                }}
              >
                {/* Step 1: Creada */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: isCreated ? 'var(--navy)' : '#cbd5e1',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 13,
                      fontWeight: 700,
                      boxShadow: isCreated ? '0 0 0 3px rgba(0, 27, 92, 0.15)' : 'none',
                    }}
                  >
                    ✓
                  </div>
                  <strong style={{ fontSize: 11, color: 'var(--navy)', marginTop: 4 }}>1. Creada</strong>
                  <span style={{ fontSize: 10, color: 'var(--muted)' }}>
                    {new Date(remission.createdAt).toLocaleDateString('es-CO')}
                  </span>
                </div>

                {/* Connector Line 1 */}
                <div
                  style={{
                    flex: 1,
                    height: 3,
                    background: isDispatched ? 'var(--navy)' : '#e2e8f0',
                    margin: '0 8px',
                    marginBottom: 26,
                  }}
                />

                {/* Step 2: Despachada */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: isDispatched ? '#2563eb' : '#cbd5e1',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 13,
                      fontWeight: 700,
                      boxShadow: isDispatched ? '0 0 0 3px rgba(37, 99, 235, 0.15)' : 'none',
                    }}
                  >
                    {isDispatched ? '✓' : '2'}
                  </div>
                  <strong style={{ fontSize: 11, color: isDispatched ? '#2563eb' : '#64748b', marginTop: 4 }}>
                    2. En tránsito
                  </strong>
                  <span style={{ fontSize: 10, color: 'var(--muted)' }}>
                    {remission.dispatchedAt ? new Date(remission.dispatchedAt).toLocaleDateString('es-CO') : 'Pendiente'}
                  </span>
                </div>

                {/* Connector Line 2 */}
                <div
                  style={{
                    flex: 1,
                    height: 3,
                    background: isDelivered ? '#10b981' : '#e2e8f0',
                    margin: '0 8px',
                    marginBottom: 26,
                  }}
                />

                {/* Step 3: Entregada */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: isDelivered ? '#10b981' : '#cbd5e1',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 13,
                      fontWeight: 700,
                      boxShadow: isDelivered ? '0 0 0 3px rgba(16, 185, 129, 0.15)' : 'none',
                    }}
                  >
                    {isDelivered ? '✓' : '3'}
                  </div>
                  <strong style={{ fontSize: 11, color: isDelivered ? '#10b981' : '#64748b', marginTop: 4 }}>
                    3. Entregada
                  </strong>
                  <span style={{ fontSize: 10, color: 'var(--muted)' }}>
                    {remission.deliveredAt ? new Date(remission.deliveredAt).toLocaleDateString('es-CO') : 'Pendiente'}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* Cancelled Banner */
            <div
              style={{
                padding: '14px 18px',
                borderRadius: 8,
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#991b1b',
                fontSize: 12,
              }}
            >
              <strong style={{ display: 'block', fontSize: 13, marginBottom: 2 }}>Remisión Anulada</strong>
              <p style={{ margin: 0 }}>Motivo: {remission.cancelReason || 'Anulación administrativa'}</p>
              {remission.cancelledBy && (
                <small style={{ display: 'block', marginTop: 4, color: '#b91c1c' }}>
                  Anulada por: {remission.cancelledBy} el{' '}
                  {remission.cancelledAt ? new Date(remission.cancelledAt).toLocaleString('es-CO') : ''}
                </small>
              )}
            </div>
          )}

          {/* Section 1: Customer & Delivery Destination */}
          <div className="drawer-section" style={{ padding: 0 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)', marginBottom: 10 }}>
              Destinatario & Lugar de Entrega
            </h3>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 10,
                background: '#f8fafc',
                padding: '12px 16px',
                borderRadius: 8,
                border: '1px solid #e2e8f0',
              }}
            >
              <div>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>Cliente / Razón Social:</span>
                <p style={{ margin: '2px 0 0', fontWeight: 700, fontSize: 13, color: 'var(--navy)' }}>
                  {remission.customerName}
                </p>
              </div>

              <div>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>Identificación / NIT:</span>
                <p style={{ margin: '2px 0 0', fontWeight: 600, fontSize: 13, color: '#334155' }}>
                  {remission.customerDoc}
                </p>
              </div>

              <div>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>Dirección de Entrega:</span>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#334155' }}>
                  {remission.deliveryAddress || remission.customerAddress || 'No especificada'}
                </p>
              </div>

              <div>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>Ciudad de Destino:</span>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#334155' }}>
                  {remission.deliveryCity || remission.customerCity || 'Bogotá, D.C.'}
                </p>
              </div>

              <div>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>Persona de Contacto:</span>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#334155' }}>
                  {remission.contactPerson || 'Representante autorizado'}
                </p>
              </div>

              <div>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>Teléfono Contacto:</span>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#334155' }}>
                  {remission.contactPhone || remission.customerPhone || 'Sin teléfono'}
                </p>
              </div>

              <div>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>Bodega Origen de Despacho:</span>
                <p style={{ margin: '2px 0 0', fontWeight: 600, fontSize: 12, color: 'var(--navy)' }}>
                  {remission.locationName}
                </p>
              </div>

              <div>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>Usuario Creador:</span>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#334155' }}>
                  {remission.createdBy}
                </p>
              </div>
            </div>
          </div>

          {/* Section 2: Dispatch & Transport Details */}
          <div className="drawer-section" style={{ padding: 0 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)', marginBottom: 10 }}>
              Información de Despacho & Logística
            </h3>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 10,
                background: '#f8fafc',
                padding: '12px 16px',
                borderRadius: 8,
                border: '1px solid #e2e8f0',
              }}
            >
              <div>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>Empresa Transportadora:</span>
                <p style={{ margin: '2px 0 0', fontWeight: 600, fontSize: 12, color: '#334155' }}>
                  {remission.carrierName || 'Pendiente de asignación'}
                </p>
              </div>

              <div>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>Placa Vehículo:</span>
                <p style={{ margin: '2px 0 0', fontWeight: 700, fontSize: 12, color: 'var(--navy)' }}>
                  {remission.vehiclePlate || 'N/A'}
                </p>
              </div>

              <div>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>Conductor / Responsable:</span>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#334155' }}>
                  {remission.driverName || 'Sin asignar'}
                </p>
              </div>

              <div>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>Cédula Conductor:</span>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#334155' }}>
                  {remission.driverDoc || 'N/A'}
                </p>
              </div>

              <div>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>Fecha & Hora Despacho:</span>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#334155' }}>
                  {remission.dispatchedAt
                    ? new Date(remission.dispatchedAt).toLocaleString('es-CO')
                    : 'Aún no despachada'}
                </p>
              </div>

              <div>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>Despachado Por:</span>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#334155' }}>
                  {remission.dispatchedBy || '—'}
                </p>
              </div>
            </div>
          </div>

          {/* Section 3: Delivery Confirmation & Reception */}
          {remission.status === 'DELIVERED' && (
            <div className="drawer-section" style={{ padding: 0 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)', marginBottom: 10 }}>
                Constancia de Entrega & Recepción
              </h3>

              <div
                style={{
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  padding: '12px 16px',
                  borderRadius: 8,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: 10,
                }}
              >
                <div>
                  <span style={{ fontSize: 11, color: '#166534', fontWeight: 600 }}>Recibido Por:</span>
                  <p style={{ margin: '2px 0 0', fontWeight: 700, fontSize: 13, color: '#14532d' }}>
                    {remission.receivedBy}
                  </p>
                </div>

                <div>
                  <span style={{ fontSize: 11, color: '#166534', fontWeight: 600 }}>Documento / Cédula Receptor:</span>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: '#14532d' }}>
                    {remission.receivedDoc || 'Sin registro'}
                  </p>
                </div>

                <div>
                  <span style={{ fontSize: 11, color: '#166534', fontWeight: 600 }}>Fecha & Hora de Entrega:</span>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: '#14532d' }}>
                    {remission.deliveredAt ? new Date(remission.deliveredAt).toLocaleString('es-CO') : ''}
                  </p>
                </div>

                <div>
                  <span style={{ fontSize: 11, color: '#166534', fontWeight: 600 }}>Observaciones / Evidencia:</span>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: '#14532d' }}>
                    {remission.deliveryEvidenceNotes || 'Entrega física completada a satisfacción.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Section 4: Documentos Relacionados */}
          <div className="drawer-section" style={{ padding: 0 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)', marginBottom: 10 }}>
              Documentos Comerciales & Tributarios
            </h3>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {remission.saleNumber && (
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: 8,
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    fontSize: 12,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <AppIcon name="sales" size={16} color="var(--navy)" />
                  <div>
                    <span style={{ fontSize: 10, color: 'var(--muted)', display: 'block' }}>Venta Comercial:</span>
                    <strong style={{ color: 'var(--navy)' }}>{remission.saleNumber}</strong>
                  </div>
                </div>
              )}

              {remission.invoiceNumber ? (
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: 8,
                    background: '#ecfdf5',
                    border: '1px solid #a7f3d0',
                    fontSize: 12,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <AppIcon name="invoices" size={16} color="#16a34a" />
                  <div>
                    <span style={{ fontSize: 10, color: '#15803d', display: 'block' }}>Factura Emitida:</span>
                    <strong style={{ color: '#166534' }}>{remission.invoiceNumber}</strong>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: 8,
                    background: '#f8fafc',
                    border: '1px dashed #cbd5e1',
                    fontSize: 12,
                    color: 'var(--muted)',
                  }}
                >
                  Sin factura emitida aún
                </div>
              )}
            </div>
          </div>

          {/* Section 5: Line Items Table */}
          <div className="drawer-section" style={{ padding: 0 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)', marginBottom: 10 }}>
              Productos en Remisión ({remission.itemsCount} ítems · {remission.totalUnits} unidades)
            </h3>

            <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                    <th style={{ padding: '8px 10px', color: 'var(--muted)', fontWeight: 600 }}>Producto</th>
                    <th style={{ padding: '8px 10px', color: 'var(--muted)', fontWeight: 600 }}>SKU</th>
                    <th style={{ padding: '8px 10px', color: 'var(--muted)', fontWeight: 600, textAlign: 'center' }}>Unidad</th>
                    <th style={{ padding: '8px 10px', color: 'var(--muted)', fontWeight: 600, textAlign: 'center' }}>Cant. Solicitada</th>
                    <th style={{ padding: '8px 10px', color: 'var(--muted)', fontWeight: 600, textAlign: 'center' }}>Cant. Entregada</th>
                  </tr>
                </thead>
                <tbody>
                  {remission.items.map((item, idx) => (
                    <tr
                      key={item.id || idx}
                      style={{
                        borderBottom: idx === remission.items.length - 1 ? 'none' : '1px solid #f1f5f9',
                      }}
                    >
                      <td style={{ padding: '8px 10px' }}>
                        <strong style={{ color: 'var(--navy)', display: 'block' }}>{item.productName}</strong>
                        {item.notes && <small style={{ color: 'var(--muted)' }}>{item.notes}</small>}
                      </td>
                      <td style={{ padding: '8px 10px', color: 'var(--muted)' }}>
                        {item.sku}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'center', color: '#64748b' }}>
                        {item.unitOfMeasure}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700, color: 'var(--navy)' }}>
                        {item.quantityRequested}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700, color: item.quantityDelivered > 0 ? '#16a34a' : 'var(--muted)' }}>
                        {item.quantityDelivered}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Drawer Action Footer */}
        <div
          style={{
            marginTop: 'auto',
            padding: '16px 24px',
            borderTop: '1px solid #e2e8f0',
            background: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {(remission.status === 'CREATED' || remission.status === 'DRAFT') && (
              <button
                type="button"
                className="primary-button compact"
                onClick={() => onOpenDispatch(remission)}
                style={{ fontSize: 12 }}
              >
                <AppIcon name="transfers" size={14} /> Despachar Mercancía
              </button>
            )}

            {remission.status === 'DISPATCHED' && (
              <button
                type="button"
                className="primary-button compact"
                onClick={() => onOpenDeliver(remission)}
                style={{ fontSize: 12, background: '#16a34a', borderColor: '#16a34a' }}
              >
                <AppIcon name="check" size={14} /> Confirmar Entrega
              </button>
            )}

            {remission.status !== 'CANCELLED' && (
              <button
                type="button"
                className="outline-button"
                onClick={() => onOpenCancel(remission)}
                style={{ fontSize: 12, color: 'var(--red)', borderColor: 'rgba(254, 17, 12, 0.25)' }}
              >
                <AppIcon name="trash" size={14} color="var(--red)" /> Anular Remisión
              </button>
            )}
          </div>

          <button
            type="button"
            className="outline-button"
            onClick={handlePrint}
            style={{ fontSize: 12 }}
          >
            <AppIcon name="print" size={14} /> Imprimir Remisión PDF
          </button>
        </div>
      </aside>
    </div>,
    document.body
  )
}
