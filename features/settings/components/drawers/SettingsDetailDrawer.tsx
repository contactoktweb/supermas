'use client'

import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon, LightIconName } from '@/components/ui/Icon'
import type {
  CashSettings,
  CompanySettings,
  EcommerceSettings,
  GeneralSettings,
  InventorySettings,
  POSSettings,
  SettingsCategory,
} from '../../types'
import type { SettingsData } from '../../hooks/useSettings'
import { RolesConsultationView } from '../views/RolesConsultationView'
import { CompanySettingsPanel } from '../panels/CompanySettingsPanel'
import {
  CashSettingsPanel,
  EcommerceSettingsPanel,
  ExogenaSettingsPanel,
  InventorySettingsPanel,
  POSSettingsPanel,
  SecuritySettingsPanel,
} from '../panels/OperationalSettingsPanels'
import { AccountingSettingsPanel, BillingSettingsPanel, TaxSettingsPanel } from '../panels/ReadOnlySettingsPanels'

const CATEGORY_HEADERS: Record<SettingsCategory, { title: string; subtitle: string; icon: LightIconName }> = {
  COMPANY: { title: 'Información de la empresa', subtitle: 'Datos legales, contacto y perfil fiscal DIAN', icon: 'warehouse' },
  INVENTORY: { title: 'Inventario', subtitle: 'Umbrales de stock y valoración', icon: 'inventory' },
  POS: { title: 'Punto de venta', subtitle: 'Sede predeterminada e impresión de tirillas', icon: 'pos' },
  CASH: { title: 'Cajas', subtitle: 'Base de apertura y tolerancia de arqueo', icon: 'cashRegisters' },
  ECOMMERCE: { title: 'Canales web', subtitle: 'Bodega de despacho, catálogos y WhatsApp', icon: 'webOrders' },
  BILLING: { title: 'Facturación electrónica', subtitle: 'Resolución vigente y estado ante la DIAN', icon: 'invoices' },
  TAX: { title: 'Impuestos', subtitle: 'Perfil tributario de la empresa', icon: 'taxes' },
  ACCOUNTING: { title: 'Contabilidad', subtitle: 'Periodos abiertos y cuentas de enlace PUC', icon: 'accounting' },
  EXOGENA: { title: 'Información exógena', subtitle: 'Año gravable predeterminado', icon: 'exogena' },
  SECURITY: { title: 'Seguridad', subtitle: 'Sesiones y acceso', icon: 'lock' },
  ROLES: { title: 'Roles y permisos', subtitle: 'Permisos vigentes de cada rol', icon: 'users' },
}

interface SettingsDetailDrawerProps {
  category: SettingsCategory | null
  data: SettingsData
  isSaving: boolean
  onClose: () => void
  onSaveCompany: (value: CompanySettings) => Promise<boolean>
  onSaveInventory: (value: InventorySettings) => Promise<boolean>
  onSavePOS: (value: POSSettings) => Promise<boolean>
  onSaveCash: (value: CashSettings) => Promise<boolean>
  onSaveEcommerce: (value: EcommerceSettings) => Promise<boolean>
  onSaveGeneral: (value: GeneralSettings) => Promise<boolean>
}

export function SettingsDetailDrawer({
  category,
  data,
  isSaving,
  onClose,
  onSaveCompany,
  onSaveInventory,
  onSavePOS,
  onSaveCash,
  onSaveEcommerce,
  onSaveGeneral,
}: SettingsDetailDrawerProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!category) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [category, onClose])

  if (!category || !mounted) return null
  const header = CATEGORY_HEADERS[category]

  const content: Record<SettingsCategory, React.ReactNode> = {
    COMPANY: <CompanySettingsPanel company={data.company} isSaving={isSaving} onSave={onSaveCompany} />,
    INVENTORY: <InventorySettingsPanel value={data.inventory} isSaving={isSaving} onSave={onSaveInventory} />,
    POS: <POSSettingsPanel value={data.pos} locations={data.locations} isSaving={isSaving} onSave={onSavePOS} />,
    CASH: <CashSettingsPanel value={data.cash} isSaving={isSaving} onSave={onSaveCash} />,
    ECOMMERCE: <EcommerceSettingsPanel value={data.ecommerce} locations={data.locations} isSaving={isSaving} onSave={onSaveEcommerce} />,
    BILLING: <BillingSettingsPanel fiscal={data.fiscal} />,
    TAX: <TaxSettingsPanel company={data.company} />,
    ACCOUNTING: <AccountingSettingsPanel accounting={data.accounting} />,
    EXOGENA: <ExogenaSettingsPanel value={data.general} isSaving={isSaving} onSave={onSaveGeneral} />,
    SECURITY: <SecuritySettingsPanel value={data.general} isSaving={isSaving} onSave={onSaveGeneral} />,
    ROLES: <RolesConsultationView roles={data.roles} />,
  }

  return createPortal(
    <div className="drawer-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="settings-drawer-title">
      <aside
        className="product-drawer page-enter"
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 680, display: 'flex', flexDirection: 'column', padding: 0 }}
      >
        <header className="px-6 py-5 border-b border-[#e2e8f0] flex items-center justify-between gap-3 bg-slate-50/80 shrink-0 sticky top-0 z-10 backdrop-blur-sm">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-200 text-red-600 flex items-center justify-center shrink-0">
              <AppIcon name={header.icon} size={20} />
            </div>
            <div className="min-w-0">
              <h2 id="settings-drawer-title" className="text-base font-bold text-[var(--navy)]">
                {header.title}
              </h2>
              <p className="text-xs text-slate-500">{header.subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="icon-button w-9 h-9 rounded-lg hover:bg-slate-200 transition-colors shrink-0"
            aria-label="Cerrar panel de configuración"
          >
            <AppIcon name="close" size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-6">{content[category]}</div>
      </aside>
    </div>,
    document.body
  )
}
