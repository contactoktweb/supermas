'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon, LightIconName } from '@/components/ui/Icon'
import {
  SettingsCategory,
  CompanySettings,
  InventorySettings,
  POSSettings,
  EcommerceSettings,
  SystemSettingItem,
} from '../../types'
import { RolesConsultationView } from '../views/RolesConsultationView'

interface SettingsDetailDrawerProps {
  category: SettingsCategory | null
  onClose: () => void
  companySettings: CompanySettings | null
  inventorySettings: InventorySettings | null
  posSettings: POSSettings | null
  ecommerceSettings: EcommerceSettings | null
  systemSettings: SystemSettingItem[]
  roles: any[]
  onSaveCompany: (data: Partial<CompanySettings>) => Promise<boolean>
  onSaveInventory: (data: Partial<InventorySettings>) => Promise<boolean>
  onSavePOS: (data: Partial<POSSettings>) => Promise<boolean>
  onSaveEcommerce: (data: Partial<EcommerceSettings>) => Promise<boolean>
  onSaveDynamic: (key: string, value: any, notes?: string) => Promise<boolean>
  isSaving?: boolean
}

export function SettingsDetailDrawer({
  category,
  onClose,
  companySettings,
  inventorySettings,
  posSettings,
  ecommerceSettings,
  systemSettings,
  roles,
  onSaveCompany,
  onSaveInventory,
  onSavePOS,
  onSaveEcommerce,
  onSaveDynamic,
  isSaving,
}: SettingsDetailDrawerProps) {
  const [mounted, setMounted] = useState(false)

  // Local state for forms
  const [compForm, setCompForm] = useState<Partial<CompanySettings>>({})
  const [invForm, setInvForm] = useState<Partial<InventorySettings>>({})
  const [posForm, setPOSForm] = useState<Partial<POSSettings>>({})
  const [ecomForm, setEcomForm] = useState<Partial<EcommerceSettings>>({})
  const [dynamicValues, setDynamicValues] = useState<Record<string, any>>({})

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (companySettings) setCompForm({ ...companySettings })
    if (inventorySettings) setInvForm({ ...inventorySettings })
    if (posSettings) setPOSForm({ ...posSettings })
    if (ecommerceSettings) setEcomForm({ ...ecommerceSettings })

    const dynMap: Record<string, any> = {}
    systemSettings.forEach((s) => {
      dynMap[s.key] = s.value
    })
    setDynamicValues(dynMap)
  }, [companySettings, inventorySettings, posSettings, ecommerceSettings, systemSettings, category])

  if (!category || !mounted) return null

  const categoryTitles: Record<SettingsCategory, { title: string; subtitle: string; icon: LightIconName }> = {
    COMPANY: { title: 'Información de la Empresa', subtitle: 'Datos legales, comerciales e identidad corporativa', icon: 'warehouse' },
    WAREHOUSES: { title: 'Parámetros Globales de Bodegas', subtitle: 'Nodos logísticos predeterminados y centros de distribución', icon: 'warehouse' },
    INVENTORY: { title: 'Políticas de Inventario', subtitle: 'Umbrales mínimos, valoración y reglas de existencias', icon: 'inventory' },
    PRODUCTS: { title: 'Reglas de Productos', subtitle: 'Estructura de SKU, numeración y codificación', icon: 'products' },
    PRICING: { title: 'Listas de Precios del Sistema', subtitle: 'Asignación de listas a canales de venta y mostrador', icon: 'sales' },
    POS: { title: 'Puntos de Venta (POS)', subtitle: 'Comportamiento de cajas, impresión y cliente genérico', icon: 'pos' },
    CASH: { title: 'Control de Cajas Registradoras', subtitle: 'Flotante inicial, cierres diarios y tolerancias', icon: 'cashRegisters' },
    ECOMMERCE: { title: 'Canales Web y Ecommerce', subtitle: 'Bodega de despacho web y enlaces comerciales WhatsApp', icon: 'webOrders' },
    CATALOGS: { title: 'Catálogos Públicos', subtitle: 'Disponibilidad comercial y políticas de compra', icon: 'ecommerceSM' },
    BILLING: { title: 'Facturación y DIAN', subtitle: 'Prefijos autorizados y proveedor tecnológico', icon: 'invoices' },
    TAX: { title: 'Impuestos y Régimen Fiscal', subtitle: 'Régimen tributario y retenciones empresariales', icon: 'taxes' },
    ACCOUNTING: { title: 'Parámetros Contables', subtitle: 'Periodo fiscal activo y cuentas de enlace PUC', icon: 'accounting' },
    EXOGENA: { title: 'Información Exógena', subtitle: 'Año gravable predeterminado y reportes magnéticos', icon: 'exogena' },
    ALERTS: { title: 'Supervisión y Alertas', subtitle: 'Frecuencia de escaneo y reglas automáticas', icon: 'alerts' },
    SECURITY: { title: 'Seguridad y Accesos', subtitle: 'Políticas de sesión, bloqueos e integridad', icon: 'lock' },
    ROLES: { title: 'Roles y Permisos (Solo Lectura)', subtitle: 'Consulta de la matriz de roles inmutables del ERP', icon: 'users' },
  }

  const info = categoryTitles[category]

  return createPortal(
    <div
      className="drawer-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-drawer-title"
    >
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
          boxShadow: '-10px 0 30px rgba(0, 27, 92, 0.15)',
        }}
      >
        {/* Drawer Header */}
        <div className="px-6 py-5 border-b border-[#e2e8f0] flex items-center justify-between bg-slate-50/80 shrink-0 sticky top-0 z-10 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-200 text-red-600 flex items-center justify-center shrink-0 shadow-sm">
              <AppIcon name={info.icon} size={20} />
            </div>
            <div>
              <h2 id="settings-drawer-title" className="text-base font-bold text-[var(--navy)]">
                {info.title}
              </h2>
              <p className="text-xs text-slate-500">{info.subtitle}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
            aria-label="Cerrar panel de configuración"
          >
            <AppIcon name="close" size={18} />
          </button>
        </div>

        {/* Drawer Body Scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {/* CATEGORY: COMPANY */}
          {category === 'COMPANY' && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[var(--navy)] font-semibold block mb-1">Nombre Comercial</label>
                  <input
                    type="text"
                    value={compForm.companyName || ''}
                    onChange={(e) => setCompForm({ ...compForm, companyName: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-800 focus:border-[var(--navy)] focus:ring-1 focus:ring-[var(--navy)] focus:outline-none transition-all shadow-sm"
                  />
                </div>
                <div>
                  <label className="text-[var(--navy)] font-semibold block mb-1">Razón Social</label>
                  <input
                    type="text"
                    value={compForm.legalName || ''}
                    onChange={(e) => setCompForm({ ...compForm, legalName: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-800 focus:border-[var(--navy)] focus:ring-1 focus:ring-[var(--navy)] focus:outline-none transition-all shadow-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="text-[var(--navy)] font-semibold block mb-1">NIT</label>
                  <input
                    type="text"
                    value={compForm.nit || ''}
                    onChange={(e) => setCompForm({ ...compForm, nit: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-800 focus:border-[var(--navy)] focus:ring-1 focus:ring-[var(--navy)] focus:outline-none transition-all shadow-sm font-mono"
                  />
                </div>
                <div>
                  <label className="text-[var(--navy)] font-semibold block mb-1">DV</label>
                  <input
                    type="text"
                    maxLength={1}
                    value={compForm.dv || ''}
                    onChange={(e) => setCompForm({ ...compForm, dv: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-800 text-center focus:border-[var(--navy)] focus:ring-1 focus:ring-[var(--navy)] focus:outline-none transition-all shadow-sm font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[var(--navy)] font-semibold block mb-1">Representante Legal</label>
                  <input
                    type="text"
                    value={compForm.legalRepresentative || ''}
                    onChange={(e) => setCompForm({ ...compForm, legalRepresentative: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-800 focus:border-[var(--navy)] focus:ring-1 focus:ring-[var(--navy)] focus:outline-none transition-all shadow-sm"
                  />
                </div>
                <div>
                  <label className="text-[var(--navy)] font-semibold block mb-1">Documento Representante</label>
                  <input
                    type="text"
                    value={compForm.legalRepresentativeDoc || ''}
                    onChange={(e) => setCompForm({ ...compForm, legalRepresentativeDoc: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-800 focus:border-[var(--navy)] focus:ring-1 focus:ring-[var(--navy)] focus:outline-none transition-all shadow-sm font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[var(--navy)] font-semibold block mb-1">Dirección Principal</label>
                  <input
                    type="text"
                    value={compForm.address || ''}
                    onChange={(e) => setCompForm({ ...compForm, address: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-800 focus:border-[var(--navy)] focus:ring-1 focus:ring-[var(--navy)] focus:outline-none transition-all shadow-sm"
                  />
                </div>
                <div>
                  <label className="text-[var(--navy)] font-semibold block mb-1">Ciudad y Departamento</label>
                  <input
                    type="text"
                    value={`${compForm.city || ''}, ${compForm.department || ''}`}
                    onChange={(e) => {
                      const [city = '', department = ''] = e.target.value.split(',').map((s) => s.trim())
                      setCompForm({ ...compForm, city, department })
                    }}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-800 focus:border-[var(--navy)] focus:ring-1 focus:ring-[var(--navy)] focus:outline-none transition-all shadow-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[var(--navy)] font-semibold block mb-1">Teléfono PBX</label>
                  <input
                    type="text"
                    value={compForm.phone || ''}
                    onChange={(e) => setCompForm({ ...compForm, phone: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-800 focus:border-[var(--navy)] focus:ring-1 focus:ring-[var(--navy)] focus:outline-none transition-all shadow-sm"
                  />
                </div>
                <div>
                  <label className="text-[var(--navy)] font-semibold block mb-1">Correo Electrónico General</label>
                  <input
                    type="email"
                    value={compForm.email || ''}
                    onChange={(e) => setCompForm({ ...compForm, email: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-800 focus:border-[var(--navy)] focus:ring-1 focus:ring-[var(--navy)] focus:outline-none transition-all shadow-sm"
                  />
                </div>
              </div>

              <div>
                <label className="text-[var(--navy)] font-semibold block mb-1">Descripción Comercial</label>
                <textarea
                  rows={3}
                  value={compForm.commercialDescription || ''}
                  onChange={(e) => setCompForm({ ...compForm, commercialDescription: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-800 focus:border-[var(--navy)] focus:ring-1 focus:ring-[var(--navy)] focus:outline-none transition-all shadow-sm"
                />
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => onSaveCompany(compForm)}
                  className="primary-button w-full justify-center py-2.5 shadow-md"
                >
                  {isSaving ? 'Guardando...' : 'Guardar Información de Empresa'}
                </button>
              </div>
            </div>
          )}

          {/* CATEGORY: INVENTORY */}
          {category === 'INVENTORY' && (
            <div className="space-y-5 text-xs">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-4">
                <h3 className="font-bold text-[var(--navy)] text-xs uppercase tracking-wider">Políticas de Existencias</h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[var(--navy)] font-semibold block mb-1">Stock Mínimo General (Alerta)</label>
                    <input
                      type="number"
                      min={1}
                      value={invForm.defaultMinStockThreshold || 10}
                      onChange={(e) => setInvForm({ ...invForm, defaultMinStockThreshold: Number(e.target.value) })}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-800 focus:border-[var(--navy)] focus:ring-1 focus:ring-[var(--navy)] focus:outline-none transition-all shadow-sm"
                    />
                    <span className="text-[11px] text-slate-500 mt-1 block">
                      Dispara alerta de stock bajo cuando las existencias caen a este nivel.
                    </span>
                  </div>

                  <div>
                    <label className="text-[var(--navy)] font-semibold block mb-1">Umbral Crítico</label>
                    <input
                      type="number"
                      min={0}
                      value={invForm.criticalLowStockThreshold || 5}
                      onChange={(e) => setInvForm({ ...invForm, criticalLowStockThreshold: Number(e.target.value) })}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-800 focus:border-[var(--navy)] focus:ring-1 focus:ring-[var(--navy)] focus:outline-none transition-all shadow-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[var(--navy)] font-semibold block mb-1">
                    Método de Valoración de Inventario (Crítico)
                  </label>
                  <select
                    value={invForm.valuationMethod || 'WEIGHTED_AVERAGE'}
                    onChange={(e) => setInvForm({ ...invForm, valuationMethod: e.target.value as any })}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-800 focus:border-[var(--navy)] focus:ring-1 focus:ring-[var(--navy)] focus:outline-none transition-all shadow-sm"
                  >
                    <option value="WEIGHTED_AVERAGE">Promedio Ponderado (Estándar NIIF)</option>
                    <option value="PEPS_FIFO">PEPS / FIFO (Primeras en Entrar, Primeras en Salir)</option>
                  </select>
                  <span className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200 mt-2 block font-medium">
                    ⚠️ Cambiar este parámetro requiere confirmación y afecta el costeo contable.
                  </span>
                </div>
              </div>

              {/* Toggles */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
                <h3 className="font-bold text-[var(--navy)] text-xs uppercase tracking-wider">Reglas Operativas</h3>

                <label className="flex items-center justify-between p-3 rounded-lg bg-white border border-slate-200 cursor-pointer shadow-sm">
                  <div>
                    <strong className="text-[var(--navy)] block text-xs">Permitir Inventario Negativo</strong>
                    <span className="text-[11px] text-slate-500">Bloquea ventas si no hay unidades disponibles</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={invForm.allowNegativeStock || false}
                    onChange={(e) => setInvForm({ ...invForm, allowNegativeStock: e.target.checked })}
                    className="w-4 h-4 text-red-600 rounded border-slate-300 focus:ring-red-500"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-lg bg-white border border-slate-200 cursor-pointer shadow-sm">
                  <div>
                    <strong className="text-[var(--navy)] block text-xs">Motivo Obligatorio en Ajustes</strong>
                    <span className="text-[11px] text-slate-500">Exige justificación escrita para auditoría</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={invForm.requireReasonForManualAdjustments ?? true}
                    onChange={(e) => setInvForm({ ...invForm, requireReasonForManualAdjustments: e.target.checked })}
                    className="w-4 h-4 text-red-600 rounded border-slate-300 focus:ring-red-500"
                  />
                </label>
              </div>

              <button
                type="button"
                disabled={isSaving}
                onClick={() => onSaveInventory(invForm)}
                className="primary-button w-full justify-center py-2.5 shadow-md"
              >
                {isSaving ? 'Guardando...' : 'Guardar Políticas de Inventario'}
              </button>
            </div>
          )}

          {/* CATEGORY: POS */}
          {category === 'POS' && (
            <div className="space-y-5 text-xs">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-4">
                <h3 className="font-bold text-[var(--navy)] text-xs uppercase tracking-wider">Terminales y Mostrador</h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[var(--navy)] font-semibold block mb-1">Sede Predeterminada POS</label>
                    <select
                      value={posForm.defaultLocationId || 'loc-002'}
                      onChange={(e) => setPOSForm({ ...posForm, defaultLocationId: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-800 focus:border-[var(--navy)] focus:ring-1 focus:ring-[var(--navy)] focus:outline-none transition-all shadow-sm"
                    >
                      <option value="loc-002">Punto Centro (PTO-002)</option>
                      <option value="loc-001">Bodega Principal CEDI (BOD-001)</option>
                      <option value="loc-004">Punto Calle 80 (PTO-004)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[var(--navy)] font-semibold block mb-1">Cliente Genérico</label>
                    <input
                      type="text"
                      value={posForm.genericCustomerName || 'Consumidor Final'}
                      onChange={(e) => setPOSForm({ ...posForm, genericCustomerName: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-800 focus:border-[var(--navy)] focus:ring-1 focus:ring-[var(--navy)] focus:outline-none transition-all shadow-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[var(--navy)] font-semibold block mb-1">Formato de Tirilla</label>
                    <select
                      value={posForm.defaultReceiptTemplate || 'TICKET_58MM'}
                      onChange={(e) => setPOSForm({ ...posForm, defaultReceiptTemplate: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-800 focus:border-[var(--navy)] focus:ring-1 focus:ring-[var(--navy)] focus:outline-none transition-all shadow-sm"
                    >
                      <option value="TICKET_58MM">Tirilla Térmica 58mm</option>
                      <option value="TICKET_80MM">Tirilla Térmica 80mm</option>
                      <option value="INVOICE_HALF_PAGE">Media Página (Factura Comercial)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[var(--navy)] font-semibold block mb-1">Impresión Automática</label>
                    <select
                      value={posForm.autoPrintReceipt ? 'YES' : 'NO'}
                      onChange={(e) => setPOSForm({ ...posForm, autoPrintReceipt: e.target.value === 'YES' })}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-800 focus:border-[var(--navy)] focus:ring-1 focus:ring-[var(--navy)] focus:outline-none transition-all shadow-sm"
                    >
                      <option value="YES">Imprimir automáticamente al cobrar</option>
                      <option value="NO">Confirmar antes de imprimir</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Cash rules */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-4">
                <h3 className="font-bold text-[var(--navy)] text-xs uppercase tracking-wider">Reglas de Cajas</h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[var(--navy)] font-semibold block mb-1">Flotante Base Inicial Sugerido</label>
                    <input
                      type="number"
                      value={posForm.cashRegisterRules?.recommendedInitialFloat || 200000}
                      onChange={(e) =>
                        setPOSForm({
                          ...posForm,
                          cashRegisterRules: {
                            ...posForm.cashRegisterRules!,
                            recommendedInitialFloat: Number(e.target.value),
                          },
                        })
                      }
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-800 focus:border-[var(--navy)] focus:ring-1 focus:ring-[var(--navy)] focus:outline-none transition-all shadow-sm font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[var(--navy)] font-semibold block mb-1">Tolerancia Descuadre (COP)</label>
                    <input
                      type="number"
                      value={posForm.cashRegisterRules?.maxDifferenceToleranceAmount || 0}
                      onChange={(e) =>
                        setPOSForm({
                          ...posForm,
                          cashRegisterRules: {
                            ...posForm.cashRegisterRules!,
                            maxDifferenceToleranceAmount: Number(e.target.value),
                          },
                        })
                      }
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-800 focus:border-[var(--navy)] focus:ring-1 focus:ring-[var(--navy)] focus:outline-none transition-all shadow-sm font-mono"
                    />
                    <span className="text-[11px] text-slate-500 mt-1 block">
                      Cualquier diferencia disparará alerta si supera este margen.
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                disabled={isSaving}
                onClick={() => onSavePOS(posForm)}
                className="primary-button w-full justify-center py-2.5 shadow-md"
              >
                {isSaving ? 'Guardando...' : 'Guardar Configuración POS'}
              </button>
            </div>
          )}

          {/* CATEGORY: ECOMMERCE */}
          {category === 'ECOMMERCE' && (
            <div className="space-y-5 text-xs">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-4">
                <h3 className="font-bold text-[var(--navy)] text-xs uppercase tracking-wider">Centro de Despacho Web</h3>

                <div>
                  <label className="text-[var(--navy)] font-semibold block mb-1">
                    Bodega Designada para Despacho Ecommerce (Crítico)
                  </label>
                  <select
                    value={ecomForm.dispatchWarehouseId || 'loc-001'}
                    onChange={(e) => {
                      const locId = e.target.value
                      const locName =
                        locId === 'loc-001'
                          ? 'Bodega Principal (CEDI)'
                          : locId === 'loc-002'
                          ? 'Bodega Norte - Yumbo'
                          : 'Punto Centro'
                      setEcomForm({ ...ecomForm, dispatchWarehouseId: locId, dispatchWarehouseName: locName })
                    }}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-800 focus:border-[var(--navy)] focus:ring-1 focus:ring-[var(--navy)] focus:outline-none transition-all shadow-sm"
                  >
                    <option value="loc-001">Bodega Principal (CEDI Medellín) — Recomendado</option>
                    <option value="loc-002">Bodega Norte (Yumbo)</option>
                  </select>
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    Define de qué ubicación física se descuenta el stock cuando se alistan pedidos de la tienda online.
                  </span>
                </div>
              </div>

              {/* Switches */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
                <h3 className="font-bold text-[var(--navy)] text-xs uppercase tracking-wider">Canales Activos</h3>

                <label className="flex items-center justify-between p-3 rounded-lg bg-white border border-slate-200 cursor-pointer shadow-sm">
                  <div>
                    <strong className="text-[var(--navy)] block text-xs">Catálogo Super Más (Venta B2C)</strong>
                    <span className="text-[11px] text-slate-500">Habilita carrito y compra directa en web</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={ecomForm.superCatalogEnabled ?? true}
                    onChange={(e) => setEcomForm({ ...ecomForm, superCatalogEnabled: e.target.checked })}
                    className="w-4 h-4 text-red-600 rounded border-slate-300 focus:ring-red-500"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-lg bg-white border border-slate-200 cursor-pointer shadow-sm">
                  <div>
                    <strong className="text-[var(--navy)] block text-xs">Catálogo Distribuidora (Comercial B2B)</strong>
                    <span className="text-[11px] text-slate-500">Permite cotización mayorista vía WhatsApp</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={ecomForm.distributorCatalogEnabled ?? true}
                    onChange={(e) => setEcomForm({ ...ecomForm, distributorCatalogEnabled: e.target.checked })}
                    className="w-4 h-4 text-red-600 rounded border-slate-300 focus:ring-red-500"
                  />
                </label>
              </div>

              {/* WhatsApp Config */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
                <h3 className="font-bold text-[var(--navy)] text-xs uppercase tracking-wider">Integración WhatsApp</h3>

                <div>
                  <label className="text-[var(--navy)] font-semibold block mb-1">Número de WhatsApp Comercial</label>
                  <input
                    type="text"
                    value={ecomForm.whatsapp?.phoneNumber || ''}
                    onChange={(e) =>
                      setEcomForm({
                        ...ecomForm,
                        whatsapp: { ...ecomForm.whatsapp!, phoneNumber: e.target.value, displayPhoneNumber: e.target.value },
                      })
                    }
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-800 focus:border-[var(--navy)] focus:ring-1 focus:ring-[var(--navy)] focus:outline-none transition-all shadow-sm font-mono"
                  />
                  <span className="text-[11px] text-slate-500 mt-1 block">Formato internacional con código de país (ej. +573104458821).</span>
                </div>

                <div>
                  <label className="text-[var(--navy)] font-semibold block mb-1">Plantilla de Mensaje para Cotizaciones</label>
                  <textarea
                    rows={2}
                    value={ecomForm.whatsapp?.defaultQuoteTemplate || ''}
                    onChange={(e) =>
                      setEcomForm({
                        ...ecomForm,
                        whatsapp: { ...ecomForm.whatsapp!, defaultQuoteTemplate: e.target.value },
                      })
                    }
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-800 focus:border-[var(--navy)] focus:ring-1 focus:ring-[var(--navy)] focus:outline-none transition-all shadow-sm"
                  />
                </div>
              </div>

              <button
                type="button"
                disabled={isSaving}
                onClick={() => onSaveEcommerce(ecomForm)}
                className="primary-button w-full justify-center py-2.5 shadow-md"
              >
                {isSaving ? 'Guardando...' : 'Guardar Configuración Ecommerce'}
              </button>
            </div>
          )}

          {/* CATEGORY: ROLES (READ ONLY) */}
          {category === 'ROLES' && <RolesConsultationView roles={roles} />}

          {/* DYNAMIC SYSTEM VARIABLES CATEGORIES (WAREHOUSES, PRODUCTS, PRICING, CASH, CATALOGS, BILLING, TAX, ACCOUNTING, EXOGENA, ALERTS, SECURITY) */}
          {category !== 'COMPANY' &&
            category !== 'INVENTORY' &&
            category !== 'POS' &&
            category !== 'ECOMMERCE' &&
            category !== 'ROLES' && (
              <div className="space-y-4 text-xs">
                <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 mb-4">
                  <p className="text-slate-700 text-xs leading-relaxed">
                    Parámetros operativos centralizados para el módulo de <strong className="text-[var(--navy)]">{info.title}</strong>. Las modificaciones se registran en auditoría inmutable y aplican globalmente.
                  </p>
                </div>

                {systemSettings
                  .filter((s) => s.category === category)
                  .map((item) => (
                    <div
                      key={item.id}
                      className="p-4 rounded-xl bg-white border border-slate-200 space-y-2 hover:border-slate-300 transition-colors shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-[var(--navy)] text-xs">{item.description}</span>
                        {item.isCritical && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-200">
                            Crítico
                          </span>
                        )}
                      </div>

                      <span className="text-[11px] font-mono text-slate-400 block">{item.key}</span>

                      {/* Input based on type */}
                      <div className="pt-1">
                        {item.type === 'BOOLEAN' ? (
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={Boolean(dynamicValues[item.key] ?? item.value)}
                              onChange={(e) => {
                                setDynamicValues({ ...dynamicValues, [item.key]: e.target.checked })
                                onSaveDynamic(item.key, e.target.checked)
                              }}
                              className="w-4 h-4 text-red-600 rounded border-slate-300 focus:ring-red-500"
                            />
                            <span className="text-slate-700 text-xs font-medium">
                              {dynamicValues[item.key] ?? item.value ? 'Habilitado' : 'Deshabilitado'}
                            </span>
                          </label>
                        ) : item.type === 'NUMBER' ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              value={dynamicValues[item.key] ?? item.value}
                              onChange={(e) =>
                                setDynamicValues({ ...dynamicValues, [item.key]: Number(e.target.value) })
                              }
                              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-800 font-mono focus:border-[var(--navy)] focus:ring-1 focus:ring-[var(--navy)] focus:outline-none transition-all shadow-sm"
                            />
                            <button
                              type="button"
                              onClick={() => onSaveDynamic(item.key, dynamicValues[item.key])}
                              className="outline-button px-3 py-2 text-xs shrink-0"
                            >
                              Guardar
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={dynamicValues[item.key] ?? item.value}
                              onChange={(e) =>
                                setDynamicValues({ ...dynamicValues, [item.key]: e.target.value })
                              }
                              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-800 font-mono focus:border-[var(--navy)] focus:ring-1 focus:ring-[var(--navy)] focus:outline-none transition-all shadow-sm"
                            />
                            <button
                              type="button"
                              onClick={() => onSaveDynamic(item.key, dynamicValues[item.key])}
                              className="outline-button px-3 py-2 text-xs shrink-0"
                            >
                              Guardar
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                {systemSettings.filter((s) => s.category === category).length === 0 && (
                  <div className="p-8 text-center text-slate-400 space-y-2">
                    <AppIcon name="settings" size={24} className="mx-auto text-slate-300" />
                    <p className="text-xs">No hay variables dinámicas registradas para esta categoría.</p>
                  </div>
                )}
              </div>
            )}
        </div>
      </aside>
    </div>,
    document.body
  )
}
