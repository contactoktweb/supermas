'use client'

import React, { useMemo } from 'react'
import { useSettings } from '../hooks/useSettings'
import { SettingsHeader } from './SettingsHeader'
import { SettingsStatsCards } from './SettingsStats'
import { SettingsCategoryCard } from './SettingsCategoryCard'
import { SettingsDetailDrawer } from './drawers/SettingsDetailDrawer'
import { SettingsSkeleton } from './SettingsSkeleton'
import { SettingsToast } from './SettingsToast'
import { CategoryCardInfo } from '../types'
import { AppIcon } from '@/components/ui/Icon'

const CATEGORIES_DEFINITIONS: CategoryCardInfo[] = [
  {
    id: 'COMPANY',
    title: 'Empresa',
    description: 'Razón social, NIT, contacto y datos fiscales que usa la facturación electrónica.',
    iconName: 'warehouse',
    badgeText: 'Corporativo',
    badgeTone: 'blue',
  },
  {
    id: 'INVENTORY',
    title: 'Inventario',
    description: 'Stock mínimo y umbral crítico predeterminados para productos nuevos e importados.',
    iconName: 'inventory',
    badgeText: 'Existencias',
    badgeTone: 'teal',
  },
  {
    id: 'POS',
    title: 'Punto de venta',
    description: 'Sede con la que abre el POS e impresión automática de la tirilla.',
    iconName: 'pos',
    badgeText: 'Mostrador',
    badgeTone: 'amber',
  },
  {
    id: 'CASH',
    title: 'Cajas',
    description: 'Base sugerida y máxima de apertura y tolerancia de descuadre en el cierre.',
    iconName: 'cashRegisters',
    badgeText: 'Arqueo',
    badgeTone: 'amber',
  },
  {
    id: 'ECOMMERCE',
    title: 'Canales web',
    description: 'Bodega de despacho web, catálogos públicos y WhatsApp comercial.',
    iconName: 'webOrders',
    badgeText: 'Digital',
    badgeTone: 'purple',
  },
  {
    id: 'BILLING',
    title: 'Facturación',
    description: 'Resolución de numeración vigente y estado de la facturación electrónica.',
    iconName: 'invoices',
    badgeText: 'Fiscal',
    badgeTone: 'red',
    isReadOnly: true,
  },
  {
    id: 'TAX',
    title: 'Impuestos',
    description: 'Régimen y responsabilidades del RUT de la empresa.',
    iconName: 'taxes',
    badgeText: 'Tributario',
    badgeTone: 'red',
    isReadOnly: true,
  },
  {
    id: 'ACCOUNTING',
    title: 'Contabilidad',
    description: 'Periodos abiertos y cuentas PUC de enlace de la causación automática.',
    iconName: 'accounting',
    badgeText: 'Financiero',
    badgeTone: 'teal',
    isReadOnly: true,
  },
  {
    id: 'EXOGENA',
    title: 'Exógena',
    description: 'Año gravable con el que abre la generación de formatos DIAN.',
    iconName: 'exogena',
    badgeText: 'Reportes',
    badgeTone: 'teal',
  },
  {
    id: 'SECURITY',
    title: 'Seguridad',
    description: 'Cierre automático de la sesión por inactividad.',
    iconName: 'lock',
    badgeText: 'Accesos',
    badgeTone: 'slate',
  },
  {
    id: 'ROLES',
    title: 'Roles y permisos',
    description: 'Permisos vigentes de cada rol del sistema.',
    iconName: 'users',
    badgeText: 'Consulta',
    badgeTone: 'slate',
    isReadOnly: true,
  },
]

export function SettingsPage() {
  const {
    data,
    isLoading,
    isSaving,
    selectedCategory,
    setSelectedCategory,
    searchQuery,
    setSearchQuery,
    toast,
    refresh,
    saveCompany,
    saveInventory,
    savePOS,
    saveCash,
    saveEcommerce,
    saveGeneral,
  } = useSettings()

  const filteredCategories = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return CATEGORIES_DEFINITIONS
    return CATEGORIES_DEFINITIONS.filter(
      (c) => c.title.toLowerCase().includes(q) || c.description.toLowerCase().includes(q) || c.badgeText.toLowerCase().includes(q)
    )
  }, [searchQuery])

  if (isLoading && !data) {
    return <SettingsSkeleton />
  }

  const company = data?.company ?? null

  return (
    <div className="space-y-8 animate-fade-in text-left">
      <SettingsToast toast={toast} />

      <SettingsHeader searchQuery={searchQuery} onSearchChange={setSearchQuery} onRefresh={refresh} isRefreshing={isLoading} />

      <SettingsStatsCards stats={data?.stats ?? null} />

      {!company?.id ? (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <AppIcon name="alertTriangle" size={20} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-amber-950">Empresa sin registrar</h2>
              <p className="text-xs text-amber-800 mt-0.5">
                Registra los datos legales y tributarios de la empresa para facturar y emitir reportes.
              </p>
            </div>
          </div>
          <button type="button" onClick={() => setSelectedCategory('COMPANY')} className="primary-button text-xs py-2 px-4 shadow-sm shrink-0">
            Registrar empresa
          </button>
        </div>
      ) : (
        <div className="p-4 rounded-2xl bg-white border border-[#e2e8f0] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-[var(--navy)] flex items-center justify-center shrink-0">
              <AppIcon name="warehouse" size={20} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold text-[var(--navy)]">{company.legalName}</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    company.status === 'ACTIVE'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-red-50 text-red-700 border-red-200'
                  }`}
                >
                  {company.status === 'ACTIVE' ? 'Activa' : 'Inactiva'}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-mono mt-0.5 truncate">
                NIT {company.nit}-{company.dv} · {company.city}, {company.department}
              </p>
            </div>
          </div>
          <button type="button" onClick={() => setSelectedCategory('COMPANY')} className="outline-button text-xs py-1.5 px-3.5">
            Editar empresa
          </button>
        </div>
      )}

      <section className="space-y-4" aria-labelledby="settings-categories-title">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 id="settings-categories-title" className="text-sm font-bold text-[var(--navy)] uppercase tracking-wider">
            Áreas de configuración ({filteredCategories.length})
          </h2>
          {searchQuery && (
            <span className="text-xs text-[var(--muted)]">
              Filtrado por: <strong className="text-[var(--navy)]">&quot;{searchQuery}&quot;</strong>
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredCategories.map((cat) => (
            <SettingsCategoryCard key={cat.id} card={cat} onSelect={setSelectedCategory} />
          ))}
        </div>

        {filteredCategories.length === 0 && (
          <div className="p-12 text-center rounded-xl bg-white border border-[#e2e8f0] space-y-2 shadow-xs">
            <p className="text-sm text-[var(--navy)] font-bold">No se encontraron áreas</p>
            <p className="text-xs text-[var(--muted)]">Ninguna área coincide con &quot;{searchQuery}&quot;.</p>
          </div>
        )}
      </section>

      {data && (
        <SettingsDetailDrawer
          category={selectedCategory}
          data={data}
          isSaving={isSaving}
          onClose={() => setSelectedCategory(null)}
          onSaveCompany={saveCompany}
          onSaveInventory={saveInventory}
          onSavePOS={savePOS}
          onSaveCash={saveCash}
          onSaveEcommerce={saveEcommerce}
          onSaveGeneral={saveGeneral}
        />
      )}
    </div>
  )
}
