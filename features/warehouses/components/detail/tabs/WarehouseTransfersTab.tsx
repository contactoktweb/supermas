import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  Search,
  Truck,
  Plus,
  ArrowLeftRight,
  ArrowRight,
  CheckCircle2,
  Clock,
  XCircle,
} from 'lucide-react'
import { WarehouseTransfer, LocationWithMetrics } from '../../../types'
import { WarehouseEmptyState } from '../../WarehouseEmptyState'

interface WarehouseTransfersTabProps {
  transfers: WarehouseTransfer[]
  currentWarehouse: LocationWithMetrics
  canCreateTransfer: boolean
  onOpenNewTransfer: () => void
}

export function WarehouseTransfersTab({
  transfers,
  currentWarehouse,
  canCreateTransfer,
  onOpenNewTransfer,
}: WarehouseTransfersTabProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])
  const [directionFilter, setDirectionFilter] = useState<'ALL' | 'IN' | 'OUT'>('ALL')
  const [query, setQuery] = useState('')
  const [selectedTransfer, setSelectedTransfer] = useState<WarehouseTransfer | null>(null)

  const filtered = transfers.filter((t) => {
    if (directionFilter === 'IN' && t.destinationLocationId !== currentWarehouse.id) {
      return false
    }
    if (directionFilter === 'OUT' && t.originLocationId !== currentWarehouse.id) {
      return false
    }
    if (query) {
      const q = query.toLowerCase()
      return (
        t.code.toLowerCase().includes(q) ||
        t.originLocationName.toLowerCase().includes(q) ||
        t.destinationLocationName.toLowerCase().includes(q) ||
        t.requestedBy.toLowerCase().includes(q)
      )
    }
    return true
  })

  return (
    <div className="warehouse-transfers-tab page-enter">
      <div className="toolbar">
        <div className="search-box wide">
          <Search size={16} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por código de transferencia o sede..."
            aria-label="Buscar transferencias"
          />
        </div>

        <div className="segmented">
          <button
            type="button"
            className={directionFilter === 'ALL' ? 'selected' : ''}
            onClick={() => setDirectionFilter('ALL')}
          >
            Todas ({transfers.length})
          </button>
          <button
            type="button"
            className={directionFilter === 'IN' ? 'selected' : ''}
            onClick={() => setDirectionFilter('IN')}
          >
            Entrantes (
            {
              transfers.filter((t) => t.destinationLocationId === currentWarehouse.id)
                .length
            }
            )
          </button>
          <button
            type="button"
            className={directionFilter === 'OUT' ? 'selected' : ''}
            onClick={() => setDirectionFilter('OUT')}
          >
            Salientes (
            {
              transfers.filter((t) => t.originLocationId === currentWarehouse.id)
                .length
            }
            )
          </button>
        </div>

        {canCreateTransfer && currentWarehouse.status === 'ACTIVE' && (
          <button
            type="button"
            className="primary-button compact export"
            onClick={onOpenNewTransfer}
          >
            <Plus size={15} />
            <span>Nueva transferencia</span>
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <WarehouseEmptyState
          type="NO_ITEMS"
          customTitle="No hay transferencias registradas"
          customDescription="No se encontraron transferencias con los filtros aplicados para esta ubicación."
          onAction={() => {
            setQuery('')
            setDirectionFilter('ALL')
          }}
          actionLabel="Limpiar filtros"
        />
      ) : (
        <div className="flow-grid">
          {filtered.map((t) => {
            const isOrigin = t.originLocationId === currentWarehouse.id
            const isDest = t.destinationLocationId === currentWarehouse.id

            return (
              <article
                className="flow-card interactive-flow-card"
                key={t.id}
                onClick={() => setSelectedTransfer(t)}
                tabIndex={0}
                role="button"
                aria-label={`Transferencia ${t.code}`}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="mono"><b>{t.code}</b></span>
                  <span className={`state ${t.status.toLowerCase().replace('_', '-')}`}>
                    {t.status === 'EN_TRANSITO'
                      ? 'En tránsito'
                      : t.status === 'RECIBIDA'
                      ? 'Recibida'
                      : t.status === 'PENDIENTE'
                      ? 'Pendiente'
                      : 'Rechazada'}
                  </span>
                </div>

                <div className="flow-location">
                  <strong className={isOrigin ? 'current-loc' : ''}>
                    {t.originLocationName}
                  </strong>
                  <Truck size={16} />
                  <strong className={isDest ? 'current-loc' : ''}>
                    {t.destinationLocationName}
                  </strong>
                </div>

                <div className="flow-units">
                  <b>{t.totalUnits}</b>
                  <span>unidades en movimiento ({t.itemsCount} productos)</span>
                </div>

                {/* Visual Stepper */}
                <div className="stepper" style={{ margin: '14px 0 10px' }}>
                  <span className="done" title="Creada">✓</span>
                  <i className={t.status !== 'PENDIENTE' ? 'done' : ''} />
                  <span
                    className={
                      t.status === 'EN_TRANSITO' || t.status === 'RECIBIDA'
                        ? 'done'
                        : ''
                    }
                    title="Despachada"
                  >
                    {t.status === 'EN_TRANSITO' || t.status === 'RECIBIDA' ? '✓' : '2'}
                  </span>
                  <i className={t.status === 'RECIBIDA' ? 'done' : ''} />
                  <span
                    className={t.status === 'RECIBIDA' ? 'done' : ''}
                    title="Recibida"
                  >
                    {t.status === 'RECIBIDA' ? '✓' : '3'}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <small className="time-muted">Solicitó: {t.requestedBy}</small>
                  <small className="time-muted">{t.createdAt}</small>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {/* Transfer Detail Drawer */}
      {selectedTransfer && mounted && createPortal(
        <div
          className="drawer-backdrop"
          onClick={() => setSelectedTransfer(null)}
          role="dialog"
          aria-modal="true"
        >
          <aside
            className="transfer-drawer"
            onClick={(e) => e.stopPropagation()}
            aria-labelledby="tr-detail-title"
          >
            <div className="drawer-header">
              <div>
                <p className="eyebrow">Detalle de transferencia</p>
                <h2 id="tr-detail-title">{selectedTransfer.code}</h2>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setSelectedTransfer(null)}
                aria-label="Cerrar detalle"
              >
                <XCircle size={20} />
              </button>
            </div>

            <div className="transfer-route">
              <strong>{selectedTransfer.originLocationName}</strong>
              <ArrowLeftRight size={16} />
              <strong>{selectedTransfer.destinationLocationName}</strong>
            </div>

            <div className="detail-stepper">
              <div className="step done">
                <CheckCircle2 size={16} />
                <span>Creada</span>
              </div>
              <i className="done" />
              <div
                className={`step ${
                  selectedTransfer.status === 'EN_TRANSITO' ||
                  selectedTransfer.status === 'RECIBIDA'
                    ? 'done'
                    : ''
                }`}
              >
                <span>2</span>
                <span>Despachada</span>
              </div>
              <i className={selectedTransfer.status === 'RECIBIDA' ? 'done' : ''} />
              <div
                className={`step ${
                  selectedTransfer.status === 'RECIBIDA' ? 'done' : ''
                }`}
              >
                <span>3</span>
                <span>Recibida</span>
              </div>
            </div>

            <div className="drawer-section">
              <h3>Productos a transferir</h3>
              <div className="transfer-products-list">
                {selectedTransfer.items.map((it) => (
                  <div className="transfer-product-row" key={it.productId}>
                    <div>
                      <strong>{it.productName}</strong>
                      <span className="code-badge">{it.sku}</span>
                    </div>
                    <b>{it.units} uds</b>
                  </div>
                ))}
              </div>
            </div>

            <div className="drawer-section info-list">
              <p>
                <span>Solicitado por</span>
                <b>{selectedTransfer.requestedBy}</b>
              </p>
              <p>
                <span>Fecha de creación</span>
                <b>{selectedTransfer.createdAt}</b>
              </p>
              <p>
                <span>Observaciones</span>
                <b>{selectedTransfer.notes || 'Sin observaciones'}</b>
              </p>
            </div>
          </aside>
        </div>,
        document.body
      )}
    </div>
  )
}
