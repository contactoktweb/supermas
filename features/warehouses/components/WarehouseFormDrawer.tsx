import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Save, Building2, Store, Warehouse, ShieldAlert, Info, Check } from 'lucide-react'
import { LocationWithMetrics, LocationType, LocationStatus } from '../types'
import { warehouseFormSchema, WarehouseFormData } from '../schemas/warehouse.schema'
import { CustomSelect } from '@/components/ui/CustomSelect'

interface WarehouseFormDrawerProps {
  mode: 'create' | 'edit'
  warehouse?: LocationWithMetrics | null
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: WarehouseFormData) => Promise<void>
}

export function WarehouseFormDrawer({
  mode,
  warehouse,
  isOpen,
  onClose,
  onSubmit,
}: WarehouseFormDrawerProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])
  const [formData, setFormData] = useState<WarehouseFormData>({
    name: '',
    code: '',
    type: 'WAREHOUSE',
    status: 'ACTIVE',
    address: '',
    city: 'Medellín',
    department: 'Antioquia',
    phone: '',
    email: '',
    managerName: '',
    managerEmail: '',
    managerPhone: '',
    description: '',
    settings: {
      allowInventoryOperations: true,
      allowSales: true,
      allowPurchases: true,
      allowTransfers: true,
      isStorePoint: false,
      isEcommerceProcessingSource: false,
      lowStockAlertThresholdPercent: 15,
      autoBlockOnZeroStock: false,
      notes: '',
    },
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState<'GENERAL' | 'CONFIG'>('GENERAL')

  useEffect(() => {
    if (warehouse && mode === 'edit') {
      setFormData({
        name: warehouse.name,
        code: warehouse.code,
        type: warehouse.type,
        status: warehouse.status,
        address: warehouse.address,
        city: warehouse.city,
        department: warehouse.department || 'Antioquia',
        phone: warehouse.phone || '',
        email: warehouse.email || '',
        managerName: warehouse.managerName || '',
        managerEmail: warehouse.managerEmail || '',
        managerPhone: warehouse.managerPhone || '',
        description: warehouse.description || '',
        settings: {
          allowInventoryOperations: warehouse.settings.allowInventoryOperations ?? true,
          allowSales: warehouse.settings.allowSales ?? true,
          allowPurchases: warehouse.settings.allowPurchases ?? true,
          allowTransfers: warehouse.settings.allowTransfers ?? true,
          isStorePoint: warehouse.settings.isStorePoint ?? (warehouse.type === 'STORE_POINT'),
          isEcommerceProcessingSource: warehouse.settings.isEcommerceProcessingSource ?? false,
          lowStockAlertThresholdPercent: warehouse.settings.lowStockAlertThresholdPercent ?? 15,
          autoBlockOnZeroStock: warehouse.settings.autoBlockOnZeroStock ?? false,
          notes: warehouse.settings.notes || '',
        },
      })
    } else {
      setFormData({
        name: '',
        code: '',
        type: 'WAREHOUSE',
        status: 'ACTIVE',
        address: '',
        city: 'Medellín',
        department: 'Antioquia',
        phone: '',
        email: '',
        managerName: '',
        managerEmail: '',
        managerPhone: '',
        description: '',
        settings: {
          allowInventoryOperations: true,
          allowSales: true,
          allowPurchases: true,
          allowTransfers: true,
          isStorePoint: false,
          isEcommerceProcessingSource: false,
          lowStockAlertThresholdPercent: 15,
          autoBlockOnZeroStock: false,
          notes: '',
        },
      })
    }
    setErrors({})
    setActiveTab('GENERAL')
  }, [warehouse, mode, isOpen])

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleInputChange = (
    field: keyof WarehouseFormData,
    value: any
  ) => {
    if (field === 'code') {
      // Normalize code to uppercase without inner spaces
      value = String(value).toUpperCase().replace(/\s+/g, '-')
    }
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    }
  }

  const handleSettingChange = (settingKey: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        [settingKey]: value,
      },
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return

    try {
      const validated = warehouseFormSchema.parse(formData)
      setIsSubmitting(true)
      setErrors({})
      await onSubmit(validated)
      onClose()
    } catch (err: any) {
      if (err.errors) {
        const fieldErrors: Record<string, string> = {}
        err.errors.forEach((zError: any) => {
          const path = zError.path.join('.')
          fieldErrors[path] = zError.message
        })
        setErrors(fieldErrors)
      } else {
        setErrors({ general: err.message || 'Ocurrió un error al guardar' })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen || !mounted) return null

  return createPortal(
    <div className="drawer-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <aside
        className="product-drawer warehouse-form-drawer"
        onClick={(e) => e.stopPropagation()}
        aria-labelledby="drawer-title"
      >
        <div className="drawer-header">
          <div>
            <p className="eyebrow">
              {mode === 'create' ? 'Nueva ubicación' : 'Edición de bodega'}
            </p>
            <h2 id="drawer-title">
              {mode === 'create'
                ? 'Registrar Bodega o Punto'
                : `Editar ${warehouse?.name || 'Bodega'}`}
            </h2>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Cerrar formulario"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="drawer-tabs">
          <button
            type="button"
            className={activeTab === 'GENERAL' ? 'active' : ''}
            onClick={() => setActiveTab('GENERAL')}
          >
            Información general
          </button>
          <button
            type="button"
            className={activeTab === 'CONFIG' ? 'active' : ''}
            onClick={() => setActiveTab('CONFIG')}
          >
            Configuración y permisos
          </button>
        </div>

        {errors.general && (
          <div className="form-error-banner" role="alert">
            <ShieldAlert size={16} />
            <span>{errors.general}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="warehouse-form-body">
          {activeTab === 'GENERAL' ? (
            <div className="form-section-group">
              <div className="input-field-block">
                <label htmlFor="wh-name">
                  Nombre de la bodega / punto <span className="req">*</span>
                </label>
                <div className="input-wrap">
                  <input
                    id="wh-name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="Ej. Bodega Principal, Punto Centro"
                    required
                  />
                </div>
                {errors.name && <span className="field-error">{errors.name}</span>}
              </div>

              <div className="form-grid-2">
                <div className="input-field-block">
                  <label htmlFor="wh-code">
                    Código único <span className="req">*</span>
                  </label>
                  <div className="input-wrap">
                    <input
                      id="wh-code"
                      type="text"
                      value={formData.code}
                      onChange={(e) => handleInputChange('code', e.target.value)}
                      placeholder="Ej. BOD-001"
                      required
                    />
                  </div>
                  <small className="field-helper">
                    El formato definitivo de códigos será definido durante la parametrización.
                  </small>
                  {errors.code && <span className="field-error">{errors.code}</span>}
                </div>

                <div className="input-field-block">
                  <label htmlFor="wh-type">
                    Tipo de ubicación <span className="req">*</span>
                  </label>
                  <CustomSelect
                    id="wh-type"
                    value={formData.type}
                    onChange={(val) => handleInputChange('type', val as LocationType)}
                    options={[
                      {
                        value: 'WAREHOUSE',
                        label: 'Bodega de almacenamiento',
                        description: 'Control principal de inventario y logística',
                      },
                      {
                        value: 'STORE_POINT',
                        label: 'Punto de venta (POS)',
                        description: 'Atención a clientes y facturación de mostrador',
                      },
                      {
                        value: 'DISTRIBUTION_CENTER',
                        label: 'Centro de distribución (CEDI)',
                        description: 'Consolidación mayorista y despachos masivos',
                      },
                    ]}
                  />
                </div>
              </div>

              <div className="input-field-block">
                <label htmlFor="wh-address">
                  Dirección física <span className="req">*</span>
                </label>
                <div className="input-wrap">
                  <input
                    id="wh-address"
                    type="text"
                    value={formData.address}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                    placeholder="Ej. Calle 50 # 45-28, Zona Industrial"
                    required
                  />
                </div>
                {errors.address && <span className="field-error">{errors.address}</span>}
              </div>

              <div className="form-grid-2">
                <div className="input-field-block">
                  <label htmlFor="wh-city">
                    Ciudad <span className="req">*</span>
                  </label>
                  <div className="input-wrap">
                    <input
                      id="wh-city"
                      type="text"
                      value={formData.city}
                      onChange={(e) => handleInputChange('city', e.target.value)}
                      placeholder="Ej. Medellín"
                      required
                    />
                  </div>
                  {errors.city && <span className="field-error">{errors.city}</span>}
                </div>

                <div className="input-field-block">
                  <label htmlFor="wh-status">Estado inicial</label>
                  <CustomSelect
                    id="wh-status"
                    value={formData.status}
                    onChange={(val) => handleInputChange('status', val as LocationStatus)}
                    options={[
                      {
                        value: 'ACTIVE',
                        label: 'Activa (operativa)',
                        description: 'Habilitada para ventas, compras y movimientos',
                      },
                      {
                        value: 'INACTIVE',
                        label: 'Inactiva (bloqueada)',
                        description: 'Deshabilitada para nuevas operaciones',
                      },
                    ]}
                  />
                </div>
              </div>

              <div className="form-grid-2">
                <div className="input-field-block">
                  <label htmlFor="wh-phone">Teléfono de contacto</label>
                  <div className="input-wrap">
                    <input
                      id="wh-phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      placeholder="+57 604 444 8920"
                    />
                  </div>
                </div>

                <div className="input-field-block">
                  <label htmlFor="wh-email">Correo de la ubicación</label>
                  <div className="input-wrap">
                    <input
                      id="wh-email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      placeholder="bodega@supermas.com.co"
                    />
                  </div>
                  {errors.email && <span className="field-error">{errors.email}</span>}
                </div>
              </div>

              <div className="drawer-divider" />

              <div className="input-field-block">
                <label htmlFor="wh-manager">Administrador / Responsable</label>
                <div className="input-wrap">
                  <input
                    id="wh-manager"
                    type="text"
                    value={formData.managerName}
                    onChange={(e) => handleInputChange('managerName', e.target.value)}
                    placeholder="Nombre del encargado de la bodega"
                  />
                </div>
              </div>

              <div className="input-field-block">
                <label htmlFor="wh-description">Notas u observaciones</label>
                <textarea
                  id="wh-description"
                  rows={2}
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Instrucciones logísticas, horarios de cargue y descargue..."
                  className="styled-textarea"
                />
              </div>
            </div>
          ) : (
            <div className="form-section-group">
              <div className="config-toggles-card">
                <h3>Permisos de Operación Directa</h3>
                <p className="field-helper">
                  Controla qué tipo de movimientos comerciales puede ejecutar esta ubicación.
                </p>

                <label className="toggle-row">
                  <div>
                    <strong>Permitir operaciones de inventario</strong>
                    <span>Entradas, salidas y ajustes de stock en Kardex</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.settings.allowInventoryOperations}
                    onChange={(e) =>
                      handleSettingChange('allowInventoryOperations', e.target.checked)
                    }
                  />
                </label>

                <label className="toggle-row">
                  <div>
                    <strong>Permitir ventas</strong>
                    <span>Habilita facturación y ventas directas en esta ubicación</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.settings.allowSales}
                    onChange={(e) =>
                      handleSettingChange('allowSales', e.target.checked)
                    }
                  />
                </label>

                <label className="toggle-row">
                  <div>
                    <strong>Permitir compras y recepción de proveedores</strong>
                    <span>Habilita registrar facturas de compra directamente aquí</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.settings.allowPurchases}
                    onChange={(e) =>
                      handleSettingChange('allowPurchases', e.target.checked)
                    }
                  />
                </label>

                <label className="toggle-row">
                  <div>
                    <strong>Permitir transferencias internas</strong>
                    <span>Puede ser origen y destino de transferencias entre sedes</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.settings.allowTransfers}
                    onChange={(e) =>
                      handleSettingChange('allowTransfers', e.target.checked)
                    }
                  />
                </label>
              </div>

              <div className="config-toggles-card">
                <h3>Canal Ecommerce</h3>
                <p className="field-helper">
                  Configura si esta sede es la encargada del alistamiento de pedidos web.
                </p>

                <label className="toggle-row ecommerce-toggle">
                  <div>
                    <strong>Bodega de procesamiento ecommerce</strong>
                    <span>
                      Máximo 1 bodega activa procesa ventas web. La disponibilidad pública
                      seguirá consultando el agregado total.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.settings.isEcommerceProcessingSource}
                    onChange={(e) =>
                      handleSettingChange('isEcommerceProcessingSource', e.target.checked)
                    }
                  />
                </label>
              </div>

              <div className="config-toggles-card">
                <h3>Alertas y Seguridad</h3>

                <div className="input-field-block" style={{ marginTop: 10 }}>
                  <label htmlFor="wh-thresh">
                    Umbral de alerta de stock bajo ({formData.settings.lowStockAlertThresholdPercent}%)
                  </label>
                  <input
                    id="wh-thresh"
                    type="range"
                    min={5}
                    max={50}
                    step={5}
                    value={formData.settings.lowStockAlertThresholdPercent}
                    onChange={(e) =>
                      handleSettingChange(
                        'lowStockAlertThresholdPercent',
                        Number(e.target.value)
                      )
                    }
                    className="styled-range"
                  />
                </div>

                <label className="toggle-row" style={{ marginTop: 14 }}>
                  <div>
                    <strong>Auto-bloqueo al agotar existencia</strong>
                    <span>Impide registrar ventas en negativo para esta bodega</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.settings.autoBlockOnZeroStock}
                    onChange={(e) =>
                      handleSettingChange('autoBlockOnZeroStock', e.target.checked)
                    }
                  />
                </label>
              </div>
            </div>
          )}

          <div className="drawer-footer-actions">
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
              disabled={isSubmitting}
            >
              <Save size={16} />
              <span>
                {isSubmitting
                  ? 'Guardando...'
                  : mode === 'create'
                  ? 'Crear bodega'
                  : 'Guardar cambios'}
              </span>
            </button>
          </div>
        </form>
      </aside>
    </div>,
    document.body
  )
}
