import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '@/components/ui/Icon'
import { LocationWithMetrics, WarehouseInventoryItem } from '../types'
import { createTransferSchema, CreateTransferFormData } from '../schemas/warehouse.schema'
import { warehouseRepository } from '../repositories/warehouse.repository'
import { CustomSelect } from '@/components/ui/CustomSelect'

interface WarehouseTransferModalProps {
  originWarehouse: LocationWithMetrics | null
  allWarehouses: LocationWithMetrics[]
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: CreateTransferFormData) => Promise<void>
}

export function WarehouseTransferModal({
  originWarehouse,
  allWarehouses,
  isOpen,
  onClose,
  onSubmit,
}: WarehouseTransferModalProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])
  const [destinationId, setDestinationId] = useState('')
  const [originInventory, setOriginInventory] = useState<WarehouseInventoryItem[]>([])
  const [selectedProductId, setSelectedProductId] = useState('')
  const [units, setUnits] = useState<number | string>(10)
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const activeDestinations = allWarehouses.filter(
    (w) => w.id !== originWarehouse?.id && w.status === 'ACTIVE'
  )

  useEffect(() => {
    if (originWarehouse && isOpen) {
      warehouseRepository
        .findInventoryByLocationId(originWarehouse.id)
        .then((items) => {
          const availableItems = items.filter((i) => i.currentStock > 0)
          setOriginInventory(availableItems)
          if (availableItems.length > 0) {
            setSelectedProductId(availableItems[0].productId)
          }
        })
      if (activeDestinations.length > 0) {
        setDestinationId(activeDestinations[0].id)
      }
      setErrors({})
    }
  }, [originWarehouse, isOpen])

  if (!isOpen || !originWarehouse || !mounted) return null

  const selectedItem = originInventory.find((i) => i.productId === selectedProductId)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return

    try {
      const payload: CreateTransferFormData = {
        originLocationId: originWarehouse.id,
        destinationLocationId: destinationId,
        items: [
          {
            productId: selectedProductId,
            units: Number(units),
          },
        ],
        notes: notes || undefined,
      }

      const validated = createTransferSchema.parse(payload)

      if (selectedItem && validated.items[0].units > selectedItem.currentStock) {
        setErrors({
          units: `Supera el stock disponible (${selectedItem.currentStock} uds)`,
        })
        return
      }

      setIsSubmitting(true)
      setErrors({})
      await onSubmit(validated)
      onClose()
    } catch (err: any) {
      if (err.errors) {
        const fieldErrors: Record<string, string> = {}
        err.errors.forEach((zErr: any) => {
          fieldErrors[zErr.path.join('.')] = zErr.message
        })
        setErrors(fieldErrors)
      } else {
        setErrors({ general: err.message || 'Error al registrar transferencia' })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return createPortal(
    <div className="drawer-backdrop modal-center" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="deactivate-dialog-card modal-lg page-enter"
        onClick={(e) => e.stopPropagation()}
        aria-labelledby="transfer-modal-title"
      >
        <div className="dialog-header-standard">
          <div className="dialog-header-title">
            <div className="stat-icon blue">
              <AppIcon name="transfers" size={20} />
            </div>
            <div>
              <p className="eyebrow">Logística interna</p>
              <h3 id="transfer-modal-title">Nueva transferencia de inventario</h3>
            </div>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Cerrar modal"
          >
            <AppIcon name="close" size={18} />
          </button>
        </div>

        {/* Route indicator */}
        <div className="transfer-route-visual">
          <div className="route-node">
            <span>Origen</span>
            <strong>{originWarehouse.name}</strong>
            <small>{originWarehouse.code}</small>
          </div>
          <div className="route-arrow">
            <AppIcon name="transfers" size={18} />
            <AppIcon name="arrowRight" size={16} />
          </div>
          <div className="route-node">
            <span>Destino</span>
            <strong>
              {allWarehouses.find((w) => w.id === destinationId)?.name || 'Selecciona destino'}
            </strong>
            <small>
              {allWarehouses.find((w) => w.id === destinationId)?.code || '—'}
            </small>
          </div>
        </div>

        {errors.general && (
          <div className="form-error-banner" role="alert">
            <AppIcon name="warning" size={16} />
            <span>{errors.general}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="adjust-form">
          <div className="form-grid-2">
            <div className="input-field-block">
              <label htmlFor="tr-dest">
                Bodega o punto de destino <span className="req">*</span>
              </label>
              <CustomSelect
                id="tr-dest"
                value={destinationId}
                onChange={(val) => setDestinationId(val)}
                options={activeDestinations.map((dest) => ({
                  value: dest.id,
                  label: `${dest.name} (${dest.code})`,
                  description: `${dest.city} · ${dest.address}`,
                  badge: dest.type === 'STORE_POINT' ? 'POS' : 'Bodega',
                }))}
                placeholder="Selecciona bodega de destino..."
              />
              {errors.destinationLocationId && (
                <span className="field-error">{errors.destinationLocationId}</span>
              )}
            </div>

            <div className="input-field-block">
              <label htmlFor="tr-prod">
                Producto a transferir <span className="req">*</span>
              </label>
              <CustomSelect
                id="tr-prod"
                value={selectedProductId}
                onChange={(val) => setSelectedProductId(val)}
                options={originInventory.map((item) => ({
                  value: item.productId,
                  label: item.productName,
                  description: `SKU: ${item.sku} · ${item.category}`,
                  badge: `${item.currentStock} uds`,
                }))}
                placeholder="Selecciona producto..."
              />
            </div>
          </div>

          <div className="form-grid-2">
            <div className="input-field-block">
              <label htmlFor="tr-units">
                Cantidad de unidades <span className="req">*</span>
              </label>
              <div className="input-wrap">
                <input
                  id="tr-units"
                  type="number"
                  min={1}
                  max={selectedItem?.currentStock || 9999}
                  value={units}
                  onChange={(e) => setUnits(e.target.value)}
                  required
                />
              </div>
              <small className="field-helper">
                Disponible en origen: <b>{selectedItem?.currentStock || 0} unidades</b>
              </small>
              {errors.units && <span className="field-error">{errors.units}</span>}
            </div>

            <div className="input-field-block">
              <label htmlFor="tr-notes">Instrucciones o motivo</label>
              <div className="input-wrap">
                <input
                  id="tr-notes"
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ej. Reabastecimiento urgente de punto comercial"
                />
              </div>
            </div>
          </div>

          <div className="dialog-footer">
            <button
              type="button"
              className="outline-button"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </button>

            <button
              type="submit"
              className="primary-button"
              disabled={isSubmitting || !selectedItem || selectedItem.currentStock <= 0}
            >
              <AppIcon name="check" size={16} />
              <span>{isSubmitting ? 'Creando...' : 'Crear transferencia'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
