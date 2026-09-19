'use client'

import React, { useMemo } from 'react'
import { useSettings } from '../hooks/useSettings'
import { SettingsHeader } from './SettingsHeader'
import { SettingsStatsCards } from './SettingsStats'
import { SettingsCategoryCard } from './SettingsCategoryCard'
import { SettingsDetailDrawer } from './drawers/SettingsDetailDrawer'
import { CriticalChangeModal } from './modals/CriticalChangeModal'
import { SettingsSkeleton } from './SettingsSkeleton'
import { SettingsToast } from './SettingsToast'
import { CategoryCardInfo } from '../types'

const CATEGORIES_DEFINITIONS: CategoryCardInfo[] = [
  {
    id: 'COMPANY',
    title: 'Empresa',
    description: 'Razón social, NIT, representante legal, dirección y datos corporativos.',
    iconName: 'warehouse',
    badgeText: 'Corporativo',
    badgeTone: 'blue',
    isCritical: false,
  },
  {
    id: 'WAREHOUSES',
    title: 'Bodegas',
    description: 'Bodega principal CEDI, nodo de despacho web y sede por defecto POS.',
    iconName: 'warehouse',
    badgeText: 'Logística',
    badgeTone: 'blue',
    isCritical: true,
  },
  {
    id: 'INVENTORY',
    title: 'Inventario',
    description: 'Umbral mínimo de stock, método de valoración (promedio ponderado) y ajustes.',
    iconName: 'inventory',
    badgeText: 'Existencias',
    badgeTone: 'teal',
    isCritical: true,
  },
  {
    id: 'PRODUCTS',
    title: 'Productos',
    description: 'Formato de SKU, numeración correlativa y estructura de códigos del catálogo.',
    iconName: 'products',
    badgeText: 'Catálogo',
    badgeTone: 'teal',
    isCritical: false,
  },
  {
    id: 'PRICING',
    title: 'Precios',
    description: 'Asignación de listas de precios a POS mostrador, tienda web y distribuidora.',
    iconName: 'sales',
    badgeText: 'Comercial',
    badgeTone: 'amber',
    isCritical: false,
  },
  {
    id: 'POS',
    title: 'Punto de Venta',
    description: 'Sede predeterminada, tirilla térmica, cliente genérico y venta rápida.',
    iconName: 'pos',
    badgeText: 'Mostrador',
    badgeTone: 'amber',
    isCritical: false,
  },
  {
    id: 'CASH',
    title: 'Cajas',
    description: 'Flotante inicial sugerido, obligatoriedad de cierre y tolerancia de arqueo.',
    iconName: 'cashRegisters',
    badgeText: 'Arqueo',
    badgeTone: 'amber',
    isCritical: false,
  },
  {
    id: 'ECOMMERCE',
    title: 'Ecommerce',
    description: 'Bodega de despacho web, switches de catálogos y enlace oficial WhatsApp.',
    iconName: 'webOrders',
    badgeText: 'Digital',
    badgeTone: 'purple',
    isCritical: true,
  },
  {
    id: 'CATALOGS',
    title: 'Catálogos Web',
    description: 'Políticas de disponibilidad pública, precios visibles y compra directa.',
    iconName: 'ecommerceSM',
    badgeText: 'Público',
    badgeTone: 'purple',
    isCritical: false,
  },
  {
    id: 'BILLING',
    title: 'Facturación',
    description: 'Prefijos autorizados DIAN, consecutivos y proveedor tecnológico fiscal.',
    iconName: 'invoices',
    badgeText: 'Fiscal',
    badgeTone: 'red',
    isCritical: true,
  },
  {
    id: 'TAX',
    title: 'Impuestos',
    description: 'Régimen tributario de la empresa, autorretenciones y perfil fiscal.',
    iconName: 'taxes',
    badgeText: 'Tributario',
    badgeTone: 'red',
    isCritical: false,
  },
  {
    id: 'ACCOUNTING',
    title: 'Contabilidad',
    description: 'Año fiscal en curso, cuentas contables PUC de enlace y parámetros de costos.',
    iconName: 'accounting',
    badgeText: 'Financiero',
    badgeTone: 'teal',
    isCritical: true,
  },
  {
    id: 'EXOGENA',
    title: 'Exógena',
    description: 'Año gravable predeterminado para la generación de formatos DIAN.',
    iconName: 'exogena',
    badgeText: 'Reportes',
    badgeTone: 'teal',
    isCritical: false,
  },
  {
    id: 'ALERTS',
    title: 'Alertas',
    description: 'Frecuencia de escaneo programado y sincronización con motor de reglas.',
    iconName: 'alerts',
    badgeText: 'Monitoreo',
    badgeTone: 'red',
    isCritical: false,
  },
  {
    id: 'SECURITY',
    title: 'Seguridad',
    description: 'Tiempo límite de sesión por inactividad y políticas de intentos fallidos.',
    iconName: 'lock',
    badgeText: 'Accesos',
    badgeTone: 'slate',
    isCritical: true,
  },
  {
    id: 'ROLES',
    title: 'Roles y Permisos',
    description: 'Consulta de la matriz de los 6 roles inmutables y sus permisos asociados.',
    iconName: 'users',
    badgeText: 'Solo Lectura',
    badgeTone: 'slate',
    isCritical: false,
    isReadOnly: true,
  },
]

export function SettingsPage() {
  const {
    stats,
    companySettings,
    inventorySettings,
    posSettings,
    ecommerceSettings,
    systemSettings,
    roles,
    isLoading,
    isSaving,
    selectedCategory,
    setSelectedCategory,
    searchQuery,
    setSearchQuery,
    toast,
    criticalModal,
    closeCriticalModal,
    saveCompany,
    saveInventory,
    savePOS,
    saveEcommerce,
    saveDynamic,
    refresh,
  } = useSettings()

  // Filter categories based on search
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return CATEGORIES_DEFINITIONS
    const q = searchQuery.toLowerCase().trim()
    return CATEGORIES_DEFINITIONS.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.badgeText.toLowerCase().includes(q)
    )
  }, [searchQuery])

  if (isLoading && !companySettings) {
    return <SettingsSkeleton />
  }

  return (
    <div className="space-y-8 animate-fade-in text-left">
      {/* Toast feedback */}
      <SettingsToast toast={toast} />

      {/* Page Header */}
      <SettingsHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onRefresh={refresh}
        isRefreshing={isLoading}
      />

      {/* KPI Stats */}
      <SettingsStatsCards stats={stats} />

      {/* Categories Grid Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-[var(--navy)] uppercase tracking-wider">
            Áreas de Parámetros Globales ({filteredCategories.length})
          </h2>
          {searchQuery && (
            <span className="text-xs text-[var(--muted)]">
              Filtrado por: <strong className="text-[var(--navy)]">"{searchQuery}"</strong>
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredCategories.map((cat) => (
            <SettingsCategoryCard
              key={cat.id}
              card={cat}
              onSelect={(category) => setSelectedCategory(category)}
            />
          ))}
        </div>

        {filteredCategories.length === 0 && (
          <div className="p-12 text-center rounded-xl bg-white border border-[#e2e8f0] space-y-2 shadow-xs">
            <p className="text-sm text-[var(--navy)] font-bold">No se encontraron categorías</p>
            <p className="text-xs text-[var(--muted)]">
              No hay parámetros que coincidan con la búsqueda "{searchQuery}".
            </p>
          </div>
        )}
      </section>

      {/* Detail Edit Drawer */}
      <SettingsDetailDrawer
        category={selectedCategory}
        onClose={() => setSelectedCategory(null)}
        companySettings={companySettings}
        inventorySettings={inventorySettings}
        posSettings={posSettings}
        ecommerceSettings={ecommerceSettings}
        systemSettings={systemSettings}
        roles={roles}
        onSaveCompany={saveCompany}
        onSaveInventory={saveInventory}
        onSavePOS={savePOS}
        onSaveEcommerce={saveEcommerce}
        onSaveDynamic={saveDynamic}
        isSaving={isSaving}
      />

      {/* Critical Change Confirmation Modal */}
      <CriticalChangeModal
        modal={criticalModal}
        onClose={closeCriticalModal}
        isSubmitting={isSaving}
      />
    </div>
  )
}
