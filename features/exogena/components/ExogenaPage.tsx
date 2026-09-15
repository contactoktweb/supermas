'use client'

import React, { useState } from 'react'
import { useExogena } from '../hooks/useExogena'
import { useExogenaPermissions } from '../hooks/useExogenaPermissions'
import { ExogenaHeader } from './ExogenaHeader'
import { ExogenaYearSelector } from './ExogenaYearSelector'
import { ExogenaStats } from './ExogenaStats'
import { ExogenaFormatsTable } from './ExogenaFormatsTable'
import { ExogenaConfigSection } from './ExogenaConfigSection'
import { ExogenaConciliationSection } from './ExogenaConciliationSection'
import { ExogenaValidationDrawer } from './ExogenaValidationDrawer'
import { ExogenaConsolidationWizard } from './ExogenaConsolidationWizard'
import { ExogenaHistoryDrawer } from './ExogenaHistoryDrawer'
import { ExogenaToastContainer, ExogenaToastMessage } from './ExogenaToast'
import { ExogenaSkeleton } from './ExogenaSkeleton'
import { ExogenaErrorState } from './ExogenaErrorState'
import { AppIcon } from '@/components/ui/Icon'

export function ExogenaPage() {
  const {
    selectedYear,
    setSelectedYear,
    availableYears,
    normativa,
    stats,
    formatsSummary,
    conciliation,
    history,
    validationErrors,
    isValidating,
    isLoading,
    error,
    loadYearData,
    runValidation,
    updateNormativa,
    downloadSingleFormat,
  } = useExogena()

  const permissions = useExogenaPermissions()

  // Tabs de navegación
  const [activeTab, setActiveTab] = useState<'FORMATS' | 'CONCILIATION' | 'CONFIG'>('FORMATS')

  // Modales y Drawers
  const [isValidationDrawerOpen, setIsValidationDrawerOpen] = useState(false)
  const [isWizardOpen, setIsWizardOpen] = useState(false)
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false)

  // Toast feedback local
  const [toasts, setToasts] = useState<ExogenaToastMessage[]>([])

  const showToast = (
    title: string,
    message: string,
    type: 'success' | 'error' | 'info' | 'warning' = 'info'
  ) => {
    const toastType: 'success' | 'error' | 'info' = type === 'warning' ? 'error' : type
    setToasts((prev) => [...prev, { id: Math.random().toString(), title, description: message, type: toastType }])
  }

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  if (!permissions.canRead) {
    return (
      <ExogenaErrorState
        message="No dispones de los permisos necesarios (exogena.read) para visualizar el módulo de Medios Magnéticos."
      />
    )
  }

  if (isLoading && !normativa) {
    return <ExogenaSkeleton />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Encabezado Principal */}
      <ExogenaHeader
        onOpenWizard={() => setIsWizardOpen(true)}
        onValidate={async () => {
          try {
            await runValidation()
            setIsValidationDrawerOpen(true)
            showToast('Validación Finalizada', 'Se ejecutó el análisis de consistencia tributaria.', 'info')
          } catch (err: any) {
            showToast('Error de Validación', err.message, 'error')
          }
        }}
        onOpenConciliation={() => setActiveTab('CONCILIATION')}
        onOpenHistory={() => setIsHistoryDrawerOpen(true)}
        onOpenConfig={() => setActiveTab('CONFIG')}
        onRefresh={loadYearData}
        isValidating={isValidating}
        canGenerate={permissions.canGenerate}
        canValidate={permissions.canValidate}
        canConfigure={permissions.canConfigure}
      />

      {error && <ExogenaErrorState message={error} onRetry={loadYearData} />}

      {/* Selector de Año y Contexto Normativo */}
      <ExogenaYearSelector
        selectedYear={selectedYear}
        availableYears={availableYears}
        normativa={normativa}
        onSelectYear={setSelectedYear}
      />

      {/* KPI Cards Estadísticos con Count-Up */}
      <ExogenaStats
        stats={stats}
        onOpenValidationErrors={() => setIsValidationDrawerOpen(true)}
      />

      {/* Navegación por pestañas */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '2px solid var(--line, #e2e8f0)', paddingBottom: 0 }}>
        <button
          type="button"
          onClick={() => setActiveTab('FORMATS')}
          style={{
            padding: '10px 18px',
            fontSize: 13,
            fontWeight: 600,
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            color: activeTab === 'FORMATS' ? 'var(--primary, #00205B)' : 'var(--muted)',
            borderBottom: activeTab === 'FORMATS' ? '2px solid var(--primary, #00205B)' : '2px solid transparent',
            marginBottom: -2,
            transition: 'all 0.15s ease',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <AppIcon name="invoices" size={16} />
          <span>Formatos DIAN ({normativa?.formats?.length || 0})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('CONCILIATION')}
          style={{
            padding: '10px 18px',
            fontSize: 13,
            fontWeight: 600,
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            color: activeTab === 'CONCILIATION' ? 'var(--primary, #00205B)' : 'var(--muted)',
            borderBottom: activeTab === 'CONCILIATION' ? '2px solid var(--primary, #00205B)' : '2px solid transparent',
            marginBottom: -2,
            transition: 'all 0.15s ease',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <AppIcon name="accounting" size={16} />
          <span>Conciliación Contable</span>
          {stats?.recordsWithErrorsCount > 0 && (
            <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 10, background: '#fee2e2', color: '#991b1b', fontWeight: 700 }}>
              Descuadre
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('CONFIG')}
          style={{
            padding: '10px 18px',
            fontSize: 13,
            fontWeight: 600,
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            color: activeTab === 'CONFIG' ? 'var(--primary, #00205B)' : 'var(--muted)',
            borderBottom: activeTab === 'CONFIG' ? '2px solid var(--primary, #00205B)' : '2px solid transparent',
            marginBottom: -2,
            transition: 'all 0.15s ease',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <AppIcon name="settings" size={16} />
          <span>Configuración Normativa</span>
        </button>
      </div>

      {/* Contenido según la pestaña activa */}
      {activeTab === 'FORMATS' && (
        <ExogenaFormatsTable
          formats={formatsSummary.length > 0 ? formatsSummary : (normativa?.formats || [])}
          onDownloadFormat={async (formatNumber) => {
            try {
              await downloadSingleFormat(formatNumber)
              showToast('Descarga Exitosa', `Plantilla Formato ${formatNumber} exportada.`, 'success')
            } catch (err: any) {
              showToast('Error al exportar', err.message, 'error')
            }
          }}
          onViewErrors={() => {
            setIsValidationDrawerOpen(true)
          }}
        />
      )}

      {activeTab === 'CONCILIATION' && (
        <ExogenaConciliationSection
          items={conciliation}
          isLoading={isLoading}
          onRefresh={loadYearData}
        />
      )}

      {activeTab === 'CONFIG' && (
        <ExogenaConfigSection
          normativa={normativa}
          isLoading={isLoading}
          canConfigure={permissions.canConfigure}
          onSave={async (data) => {
            await updateNormativa(data)
          }}
          showToast={showToast}
        />
      )}

      {/* Drawer de Validación e Inconsistencias */}
      <ExogenaValidationDrawer
        isOpen={isValidationDrawerOpen}
        onClose={() => setIsValidationDrawerOpen(false)}
        errors={validationErrors}
        year={selectedYear}
      />

      {/* Modal Asistente de Consolidación y Generación */}
      <ExogenaConsolidationWizard
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        year={selectedYear}
        formats={normativa?.formats || []}
        onComplete={() => {
          loadYearData()
        }}
        onOpenErrors={() => setIsValidationDrawerOpen(true)}
        showToast={showToast}
      />

      {/* Drawer de Historial */}
      <ExogenaHistoryDrawer
        isOpen={isHistoryDrawerOpen}
        onClose={() => setIsHistoryDrawerOpen(false)}
        history={history}
        showToast={showToast}
      />

      {/* Floating Toast Notification */}
      <ExogenaToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}
