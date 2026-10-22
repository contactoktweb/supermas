'use client'

import React, { useEffect, useState } from 'react'
import { SelectField } from '@/components/ui/SelectField'
import type {
  CashSettings,
  EcommerceSettings,
  GeneralSettings,
  InventorySettings,
  LocationOption,
  POSSettings,
} from '../../types'
import {
  SettingsField,
  SettingsModuleLink,
  SettingsNotice,
  SettingsNumberInput,
  SettingsReadOnlyList,
  SettingsSaveButton,
  SettingsSection,
  SettingsTextInput,
  SettingsToggleRow,
} from './SettingsFormParts'

/** Estado local de un formulario que se reinicia cuando llega un valor nuevo desde la base. */
function useFormState<T>(value: T) {
  const [form, setForm] = useState<T>(value)
  useEffect(() => setForm(value), [value])
  const set = <K extends keyof T>(key: K, next: T[K]) => setForm((prev) => ({ ...prev, [key]: next }))
  return { form, set }
}

interface PanelProps<T> {
  value: T
  isSaving?: boolean
  onSave: (value: T) => Promise<boolean>
}

export function InventorySettingsPanel({ value, isSaving, onSave }: PanelProps<InventorySettings>) {
  const { form, set } = useFormState(value)
  return (
    <div className="settings-panel">
      <SettingsSection title="Umbrales de stock predeterminados">
        <div className="settings-grid-2">
          <SettingsField label="Stock mínimo" required hint="Alerta de stock bajo para productos nuevos e importados.">
            {(id) => <SettingsNumberInput id={id} value={form.defaultMinStockThreshold} onChange={(v) => set('defaultMinStockThreshold', v)} min={1} suffix="und" />}
          </SettingsField>
          <SettingsField label="Umbral crítico" required hint="Nivel que se marca como crítico.">
            {(id) => <SettingsNumberInput id={id} value={form.criticalLowStockThreshold} onChange={(v) => set('criticalLowStockThreshold', v)} suffix="und" />}
          </SettingsField>
        </div>
        <SettingsNotice>Cada producto puede ajustar sus propios umbrales desde su ficha.</SettingsNotice>
      </SettingsSection>

      <SettingsSection title="Valoración del inventario">
        <SettingsReadOnlyList
          rows={[
            { label: 'Método de costeo', value: 'Promedio ponderado' },
            { label: 'Existencias negativas', value: 'No permitidas' },
            { label: 'Motivo en ajustes manuales', value: 'Obligatorio' },
          ]}
        />
      </SettingsSection>

      <SettingsSaveButton isSaving={isSaving} label="Guardar parámetros de inventario" onClick={() => void onSave(form)} />
    </div>
  )
}

interface POSPanelProps extends PanelProps<POSSettings> {
  locations: LocationOption[]
}

export function POSSettingsPanel({ value, locations, isSaving, onSave }: POSPanelProps) {
  const { form, set } = useFormState(value)
  return (
    <div className="settings-panel">
      <SettingsSection title="Punto de venta">
        <SettingsField label="Sede predeterminada" hint="Sede con la que abre el POS; el cajero puede cambiarla.">
          {(id) => (
            <SelectField id={id} value={form.defaultLocationId} onChange={(v) => set('defaultLocationId', v)} size="md">
              <option value="">Primera sede activa</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name} ({loc.code})
                </option>
              ))}
            </SelectField>
          )}
        </SettingsField>
        <SettingsToggleRow
          title="Imprimir la tirilla automáticamente"
          description="Abre la impresión apenas se registra el cobro."
          checked={form.autoPrintReceipt}
          onChange={(v) => set('autoPrintReceipt', v)}
        />
      </SettingsSection>
      <SettingsSaveButton isSaving={isSaving} label="Guardar parámetros del punto de venta" onClick={() => void onSave(form)} />
    </div>
  )
}

export function CashSettingsPanel({ value, isSaving, onSave }: PanelProps<CashSettings>) {
  const { form, set } = useFormState(value)
  return (
    <div className="settings-panel">
      <SettingsSection title="Apertura de caja">
        <div className="settings-grid-2">
          <SettingsField label="Base sugerida" hint="Valor inicial al abrir un turno.">
            {(id) => <SettingsNumberInput id={id} value={form.recommendedInitialFloat} onChange={(v) => set('recommendedInitialFloat', v)} prefix="$" />}
          </SettingsField>
          <SettingsField label="Base máxima permitida" hint="0 = sin límite.">
            {(id) => <SettingsNumberInput id={id} value={form.maxAllowedInitialFloat} onChange={(v) => set('maxAllowedInitialFloat', v)} prefix="$" />}
          </SettingsField>
        </div>
      </SettingsSection>
      <SettingsSection title="Cierre de caja">
        <SettingsField label="Tolerancia de descuadre" hint="Diferencias hasta este valor se muestran como caja cuadrada. 0 = exacta.">
          {(id) => <SettingsNumberInput id={id} value={form.maxDifferenceToleranceAmount} onChange={(v) => set('maxDifferenceToleranceAmount', v)} prefix="$" />}
        </SettingsField>
      </SettingsSection>
      <SettingsSaveButton isSaving={isSaving} label="Guardar reglas de caja" onClick={() => void onSave(form)} />
    </div>
  )
}

interface EcommercePanelProps extends PanelProps<EcommerceSettings> {
  locations: LocationOption[]
}

export function EcommerceSettingsPanel({ value, locations, isSaving, onSave }: EcommercePanelProps) {
  const { form, set } = useFormState(value)
  return (
    <div className="settings-panel">
      <SettingsSection title="Despacho de pedidos web">
        <SettingsField label="Bodega de despacho" hint="De esta bodega se toma la disponibilidad y se alistan los pedidos web.">
          {(id) => (
            <SelectField id={id} value={form.dispatchLocationId} onChange={(v) => set('dispatchLocationId', v)} size="md">
              <option value="">Sin bodega asignada</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name} ({loc.code})
                </option>
              ))}
            </SelectField>
          )}
        </SettingsField>
      </SettingsSection>

      <SettingsSection title="Catálogos públicos">
        <SettingsToggleRow
          title="Catálogo Super Más"
          description="Venta al consumidor final en la tienda web."
          checked={form.superCatalogEnabled}
          onChange={(v) => set('superCatalogEnabled', v)}
        />
        <SettingsToggleRow
          title="Catálogo Distribuidora"
          description="Cotización mayorista por WhatsApp."
          checked={form.distributorCatalogEnabled}
          onChange={(v) => set('distributorCatalogEnabled', v)}
        />
      </SettingsSection>

      <SettingsSection title="WhatsApp comercial">
        <SettingsField label="Número con indicativo" hint="Solo dígitos, ej. 573001234567. Vacío oculta el botón de WhatsApp.">
          {(id) => <SettingsTextInput id={id} type="tel" value={form.whatsappPhone} onChange={(v) => set('whatsappPhone', v.replace(/[^\d]/g, ''))} inputMode="numeric" maxLength={15} mono />}
        </SettingsField>
        <SettingsField label="Mensaje de cotización" hint="Usa {{product}} y {{sku}} para el nombre y el código del producto.">
          {(id) => (
            <textarea
              id={id}
              className="custom-form-textarea"
              rows={3}
              maxLength={500}
              value={form.whatsappQuoteTemplate}
              onChange={(e) => set('whatsappQuoteTemplate', e.target.value)}
            />
          )}
        </SettingsField>
      </SettingsSection>

      <SettingsSaveButton isSaving={isSaving} label="Guardar canales web" onClick={() => void onSave(form)} />
    </div>
  )
}

export function ExogenaSettingsPanel({ value, isSaving, onSave }: PanelProps<GeneralSettings>) {
  const { form, set } = useFormState(value)
  return (
    <div className="settings-panel">
      <SettingsSection title="Información exógena">
        <SettingsField label="Año gravable predeterminado" hint="Año que abre el módulo Exógena.">
          {(id) => <SettingsNumberInput id={id} value={form.exogenaDefaultYear} onChange={(v) => set('exogenaDefaultYear', v)} min={2019} max={new Date().getFullYear()} />}
        </SettingsField>
      </SettingsSection>
      <SettingsSaveButton isSaving={isSaving} label="Guardar año gravable" onClick={() => void onSave(form)} />
      <SettingsModuleLink href="/exogena" icon="exogena" label="Ir a Exógena" />
    </div>
  )
}

export function SecuritySettingsPanel({ value, isSaving, onSave }: PanelProps<GeneralSettings>) {
  const { form, set } = useFormState(value)
  return (
    <div className="settings-panel">
      <SettingsSection title="Sesiones">
        <SettingsField label="Cierre por inactividad" hint="Minutos sin actividad antes de cerrar la sesión en todas las pestañas (5 a 720).">
          {(id) => <SettingsNumberInput id={id} value={form.sessionTimeoutMinutes} onChange={(v) => set('sessionTimeoutMinutes', v)} min={5} max={720} suffix="min" />}
        </SettingsField>
      </SettingsSection>
      <SettingsSection title="Acceso">
        <SettingsReadOnlyList
          rows={[
            { label: 'Contraseña temporal', value: 'Cambio obligatorio al primer ingreso' },
            { label: 'Usuarios inactivos', value: 'Sin acceso' },
            { label: 'Intentos de ingreso', value: 'Limitados por el proveedor de autenticación' },
          ]}
        />
      </SettingsSection>
      <SettingsSaveButton isSaving={isSaving} label="Guardar parámetros de seguridad" onClick={() => void onSave(form)} />
    </div>
  )
}
