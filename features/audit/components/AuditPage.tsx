'use client'

import React, { useState } from 'react'
import { useAudit } from '../hooks/useAudit'
import { useAuditPermissions } from '../hooks/useAuditPermissions'
import { AuditHeader } from './AuditHeader'
import { AuditStats } from './AuditStats'
import { AuditFilters } from './AuditFilters'
import { AuditTable } from './AuditTable'
import { AuditDetailDrawer } from './AuditDetailDrawer'
import { AuditSkeleton } from './AuditSkeleton'
import { AuditErrorState } from './AuditErrorState'
import { AppIcon } from '@/components/ui/Icon'

export function AuditPage() {
  const permissions = useAuditPermissions()
  const {
    logs,
    stats,
    filters,
    isLoading,
    error,
    selectedLog,
    isDetailOpen,
    handleUpdateFilter,
    handleResetFilters,
    handleSelectLog,
    handleCloseDetail,
    handleExportCSV,
    reload,
  } = useAudit(permissions.role)

  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3500)
  }

  const handleExport = async () => {
    try {
      await handleExportCSV()
      showToast('Exportación completada y registrada en auditoría.')
    } catch (err: any) {
      showToast(err.message || 'Error al exportar.')
    }
  }

  if (!permissions.canRead) {
    return (
      <AuditErrorState
        message="No dispones de los permisos necesarios (audit.read) para consultar los registros de auditoría del sistema."
      />
    )
  }

  if (isLoading && logs.length === 0) {
    return <AuditSkeleton />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Encabezado Principal */}
      <AuditHeader
        onRefresh={reload}
        onExport={handleExport}
        canExport={permissions.canExport}
        isLoading={isLoading}
      />

      {error && <AuditErrorState message={error} onRetry={reload} />}

      {/* KPI Cards de Estadísticas */}
      <AuditStats
        stats={stats}
        isLoading={isLoading}
        onFilterCritical={() => handleUpdateFilter('onlyCritical', !filters.onlyCritical)}
      />

      {/* Filtros y Buscador con Debounce */}
      <AuditFilters
        filters={filters}
        onUpdateFilter={handleUpdateFilter}
        onResetFilters={handleResetFilters}
        isLoading={isLoading}
      />

      {/* Tabla Principal de Eventos de Auditoría */}
      <AuditTable
        logs={logs}
        onSelectLog={handleSelectLog}
        isLoading={isLoading}
      />

      {/* Drawer de Detalle y Diffs */}
      <AuditDetailDrawer
        isOpen={isDetailOpen}
        onClose={handleCloseDetail}
        log={selectedLog}
      />

      {/* Toast de notificación rápida */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            background: 'var(--primary, #00205B)',
            color: '#ffffff',
            padding: '12px 18px',
            borderRadius: 8,
            boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
            fontSize: 13,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            zIndex: 9999,
          }}
        >
          <AppIcon name="check" size={16} />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  )
}
