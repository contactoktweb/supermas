'use client'

import React, { useState } from 'react'
import { Settings, Save, Globe, Shield, AlertTriangle, CheckCircle2, Info } from 'lucide-react'
import { LocationWithMetrics, LocationSettings } from '../../../types'

interface WarehouseSettingsTabProps {
  warehouse: LocationWithMetrics
  onUpdateSettings: (settings: LocationSettings) => Promise<void>
}

export function WarehouseSettingsTab({
  warehouse,
  onUpdateSettings,
}: WarehouseSettingsTabProps) {
  const [settings, setSettings] = useState<LocationSettings>({
    allowInventoryOperations: warehouse.settings.allowInventoryOperations ?? true,
    allowSales: warehouse.settings.allowSales ?? true,
    allowPurchases: warehouse.settings.allowPurchases ?? true,
    allowTransfers: warehouse.settings.allowTransfers ?? true,
    isStorePoint: warehouse.settings.isStorePoint ?? false,
    isEcommerceProcessingSource: warehouse.settings.isEcommerceProcessingSource ?? false,
    lowStockAlertThresholdPercent: warehouse.settings.lowStockAlertThresholdPercent ?? 15,
    autoBlockOnZeroStock: warehouse.settings.autoBlockOnZeroStock ?? false,
    notes: warehouse.settings.notes || '',
  })

  const [isSaving, setIsSaving] = useState(false)
  const [savedSuccess, setSavedSuccess] = useState(false)

  const handleToggle = (key: keyof LocationSettings, val: boolean) => {
    setSettings((p) => ({ ...p, [key]: val }))
    setSavedSuccess(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setIsSaving(true)
      await onUpdateSettings(settings)
      setSavedSuccess(true)
      setTimeout(() => setSavedSuccess(false), 4000)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="warehouse-settings-tab page-enter">
      <form onSubmit={handleSubmit} className="settings-form-grid">
        {/* Card 1: Operating Policies */}
        <section className="panel config-toggles-card">
          <div className="panel-heading" style={{ padding: 0, border: 0, marginBottom: 14 }}>
            <div>
              <p className="eyebrow">Políticas de negocio</p>
              <h2>Operaciones Comerciales Permitidas</h2>
            </div>
          </div>

          <label className="toggle-row">
            <div>
              <strong>Permitir operaciones de inventario</strong>
              <span>Entradas, salidas y ajustes de stock en Kardex</span>
            </div>
            <input
              type="checkbox"
              checked={settings.allowInventoryOperations}
              onChange={(e) =>
                handleToggle('allowInventoryOperations', e.target.checked)
              }
            />
          </label>

          <label className="toggle-row">
            <div>
              <strong>Permitir ventas y facturación</strong>
              <span>Habilita facturación electrónica y ventas POS desde esta sede</span>
            </div>
            <input
              type="checkbox"
              checked={settings.allowSales}
              onChange={(e) => handleToggle('allowSales', e.target.checked)}
            />
          </label>

          <label className="toggle-row">
            <div>
              <strong>Permitir compras directas</strong>
              <span>Habilita registrar facturas y recepciones de proveedor aquí</span>
            </div>
            <input
              type="checkbox"
              checked={settings.allowPurchases}
              onChange={(e) => handleToggle('allowPurchases', e.target.checked)}
            />
          </label>

          <label className="toggle-row">
            <div>
              <strong>Permitir transferencias internas</strong>
              <span>Habilita enviar o recibir transferencias hacia otras sedes</span>
            </div>
            <input
              type="checkbox"
              checked={settings.allowTransfers}
              onChange={(e) => handleToggle('allowTransfers', e.target.checked)}
            />
          </label>
        </section>

        {/* Card 2: Ecommerce Processing Source */}
        <section className="panel config-toggles-card">
          <div className="panel-heading" style={{ padding: 0, border: 0, marginBottom: 14 }}>
            <div>
              <p className="eyebrow">Integración canal digital</p>
              <h2>Despacho de Pedidos Ecommerce</h2>
            </div>
          </div>

          <label className="toggle-row ecommerce-toggle">
            <div>
              <strong>Bodega principal de procesamiento ecommerce</strong>
              <span>
                Los pedidos generados en la tienda web serán alistados y despachados
                desde esta ubicación física.
              </span>
            </div>
            <input
              type="checkbox"
              checked={settings.isEcommerceProcessingSource}
              onChange={(e) =>
                handleToggle('isEcommerceProcessingSource', e.target.checked)
              }
            />
          </label>

          <div className="ecommerce-info-alert">
            <Info size={16} />
            <div>
              <strong>Disponibilidad web agregada:</strong>
              <p>
                La tienda web pública consulta la sumatoria de existencias de todas las
                bodegas activas (disponible / stock bajo / agotado) sin mostrar números
                exactos. La bodega de ecommerce aquí seleccionada define la{' '}
                <b>ejecución logística del despacho</b>.
              </p>
            </div>
          </div>
        </section>

        {/* Card 3: Inventory Alerts & Auto-blocking */}
        <section className="panel config-toggles-card">
          <div className="panel-heading" style={{ padding: 0, border: 0, marginBottom: 14 }}>
            <div>
              <p className="eyebrow">Parámetros de stock</p>
              <h2>Alertas y Controles de Seguridad</h2>
            </div>
          </div>

          <div className="input-field-block">
            <label htmlFor="setting-thresh">
              Umbral de alerta para stock bajo: <b>{settings.lowStockAlertThresholdPercent}%</b>
            </label>
            <input
              id="setting-thresh"
              type="range"
              min={5}
              max={50}
              step={5}
              value={settings.lowStockAlertThresholdPercent}
              onChange={(e) =>
                setSettings((p) => ({
                  ...p,
                  lowStockAlertThresholdPercent: Number(e.target.value),
                }))
              }
              className="styled-range"
            />
            <small className="field-helper">
              Los productos activarán alerta cuando su existencia esté por debajo de este
              porcentaje respecto a su stock máximo.
            </small>
          </div>

          <label className="toggle-row" style={{ marginTop: 14 }}>
            <div>
              <strong>Bloqueo automático en agotado</strong>
              <span>Impide facturar si el saldo en esta sede llega a cero</span>
            </div>
            <input
              type="checkbox"
              checked={settings.autoBlockOnZeroStock}
              onChange={(e) =>
                handleToggle('autoBlockOnZeroStock', e.target.checked)
              }
            />
          </label>
        </section>

        {/* Save Bar */}
        <div className="settings-submit-row">
          {savedSuccess && (
            <div className="save-success-pill">
              <CheckCircle2 size={16} />
              <span>Configuración guardada correctamente</span>
            </div>
          )}

          <button
            type="submit"
            className="primary-button compact"
            disabled={isSaving}
            style={{ marginLeft: 'auto' }}
          >
            <Save size={16} />
            <span>{isSaving ? 'Guardando...' : 'Guardar parámetros'}</span>
          </button>
        </div>
      </form>
    </div>
  )
}
