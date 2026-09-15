'use client'

import React, { useState, useCallback } from 'react'
import { useTaxes } from '../hooks/useTaxes'
import { useTaxPermissions } from '../hooks/useTaxPermissions'
import { TaxHeader } from './TaxHeader'
import { TaxStats } from './TaxStats'
import { TaxFilters } from './TaxFilters'
import { TaxTable } from './TaxTable'
import { TaxFormDrawer } from './TaxFormDrawer'
import { TaxDetailDrawer } from './TaxDetailDrawer'
import { TaxProductsModal } from './TaxProductsModal'
import { TaxDeactivateDialog } from './TaxDeactivateDialog'
import { TaxReportsDrawer } from './TaxReportsDrawer'
import { TaxStatsSkeleton, TaxTableSkeleton } from './TaxSkeleton'
import { TaxErrorState } from './TaxErrorState'
import { TaxToastContainer, TaxToastMessage } from './TaxToast'
import { TaxConfig } from '../types'
import { TaxConfigFormData } from '../schemas/tax.schema'

export function TaxPage() {
  const permissions = useTaxPermissions('SUPERADMIN')
  const {
    taxes,
    total,
    stats,
    filters,
    isLoading,
    error,
    loadData,
    updateFilters,
    resetFilters,
    createTax,
    updateTax,
    deactivateTax,
    activateTax,
    exportCSV,
  } = useTaxes('SUPERADMIN')

  // Toast notifications
  const [toasts, setToasts] = useState<TaxToastMessage[]>([])

  const addToast = useCallback(
    (type: 'success' | 'error' | 'info', title: string, description?: string) => {
      setToasts((prev) => [
        ...prev,
        { id: `toast-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`, type, title, description },
      ])
    },
    []
  )

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  // Modales y Drawers
  const [isFormDrawerOpen, setIsFormDrawerOpen] = useState(false)
  const [formDrawerMode, setFormDrawerMode] = useState<'create' | 'edit'>('create')
  const [selectedTax, setSelectedTax] = useState<TaxConfig | null>(null)

  const [detailTaxId, setDetailTaxId] = useState<string | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)

  const [productsTax, setProductsTax] = useState<TaxConfig | null>(null)
  const [isProductsOpen, setIsProductsOpen] = useState(false)

  const [deactivatingTax, setDeactivatingTax] = useState<TaxConfig | null>(null)
  const [isDeactivateOpen, setIsDeactivateOpen] = useState(false)

  const [isReportsOpen, setIsReportsOpen] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Manejadores
  const handleOpenCreate = () => {
    setFormDrawerMode('create')
    setSelectedTax(null)
    setIsFormDrawerOpen(true)
  }

  const handleOpenEdit = (tax: TaxConfig) => {
    setFormDrawerMode('edit')
    setSelectedTax(tax)
    setIsFormDrawerOpen(true)
  }

  const handleOpenDetail = (id: string) => {
    setDetailTaxId(id)
    setIsDetailOpen(true)
  }

  const handleOpenProducts = (tax: TaxConfig) => {
    setProductsTax(tax)
    setIsProductsOpen(true)
  }

  const handleOpenDeactivate = (tax: TaxConfig) => {
    setDeactivatingTax(tax)
    setIsDeactivateOpen(true)
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await loadData()
    setIsRefreshing(false)
    addToast('info', 'Datos actualizados', 'Las configuraciones y estadísticas tributarias están al día.')
  }

  const handleFormSubmit = async (data: TaxConfigFormData) => {
    try {
      if (formDrawerMode === 'create') {
        const created = await createTax(data)
        addToast(
          'success',
          'Configuración creada',
          `Se parametrizó exitosamente "${created.name}" (${created.code} - ${created.ratePercent}%).`
        )
      } else if (selectedTax) {
        const updated = await updateTax(selectedTax.id, data)
        addToast(
          'success',
          'Cambios guardados',
          `Se actualizó la configuración "${updated.name}" (Versión v${updated.version}).`
        )
      }
    } catch (err: any) {
      addToast('error', 'No se pudo guardar', err.message)
      throw err
    }
  }

  const handleDeactivateConfirm = async (id: string, reason: string) => {
    try {
      const deactivated = await deactivateTax(id, reason)
      addToast(
        'info',
        'Configuración desactivada',
        `"${deactivated.name}" ya no podrá asignarse a nuevos productos ni ventas. Los históricos se conservan intactos.`
      )
    } catch (err: any) {
      addToast('error', 'Error al desactivar', err.message)
    }
  }

  const handleActivateConfirm = async (tax: TaxConfig) => {
    try {
      const activated = await activateTax(tax.id)
      addToast(
        'success',
        'Configuración reactivada',
        `"${activated.name}" está nuevamente disponible para su uso en operaciones del ERP.`
      )
    } catch (err: any) {
      addToast('error', 'Error al reactivar', err.message)
    }
  }

  const handleExportCSV = async () => {
    try {
      await exportCSV()
      addToast('success', 'Catálogo exportado', 'El archivo CSV de configuraciones tributarias ha sido descargado.')
    } catch (err: any) {
      addToast('error', 'Error en exportación', err.message)
    }
  }

  return (
    <div className="taxes-module page-enter">
      <TaxHeader
        onOpenCreate={handleOpenCreate}
        onOpenReports={() => setIsReportsOpen(true)}
        onExport={handleExportCSV}
        onRefresh={handleRefresh}
        canCreate={permissions.canCreateTax}
        canReport={permissions.canReportTax}
        canExport={permissions.canExportTax}
        isRefreshing={isRefreshing}
      />

      {/* Estadísticas */}
      {isLoading ? (
        <TaxStatsSkeleton />
      ) : (
        <TaxStats stats={stats} />
      )}

      {/* Filtros */}
      <TaxFilters
        filters={filters}
        onFilterChange={updateFilters}
        onClearFilters={resetFilters}
      />

      {/* Alerta de Error si ocurre */}
      {error && (
        <TaxErrorState message={error} onRetry={loadData} />
      )}

      {/* Tabla Principal */}
      {isLoading ? (
        <TaxTableSkeleton />
      ) : (
        <TaxTable
          taxes={taxes}
          permissions={permissions}
          total={total}
          filters={filters}
          onPageChange={(page) => updateFilters({ page })}
          onSortChange={(sortBy) => updateFilters({ sortBy, page: 1 })}
          onSelect={handleOpenDetail}
          onEdit={handleOpenEdit}
          onViewProducts={handleOpenProducts}
          onDeactivate={handleOpenDeactivate}
          onActivate={handleActivateConfirm}
          onClearFilters={resetFilters}
          onOpenCreate={handleOpenCreate}
        />
      )}

      {/* Drawers y Modales */}
      <TaxFormDrawer
        mode={formDrawerMode}
        tax={selectedTax}
        isOpen={isFormDrawerOpen}
        onClose={() => setIsFormDrawerOpen(false)}
        onSubmit={handleFormSubmit}
      />

      <TaxDetailDrawer
        taxId={detailTaxId}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        onEdit={handleOpenEdit}
        onViewProducts={handleOpenProducts}
        onDeactivate={handleOpenDeactivate}
        onActivate={handleActivateConfirm}
        permissions={permissions}
      />

      <TaxProductsModal
        tax={productsTax}
        isOpen={isProductsOpen}
        onClose={() => setIsProductsOpen(false)}
      />

      <TaxDeactivateDialog
        tax={deactivatingTax}
        isOpen={isDeactivateOpen}
        onClose={() => setIsDeactivateOpen(false)}
        onConfirm={handleDeactivateConfirm}
      />

      <TaxReportsDrawer
        isOpen={isReportsOpen}
        onClose={() => setIsReportsOpen(false)}
      />

      {/* Contenedor de notificaciones Toast */}
      <TaxToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  )
}
