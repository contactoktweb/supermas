'use client'

import { useState, useEffect, useCallback } from 'react'
import { auditService } from '../services/audit.service'
import { AuditLogEntry, AuditFilters, AuditStats } from '../types'
import { UserRole } from './useAuditPermissions'

const DEFAULT_STATS: AuditStats = {
  todayEventsCount: 0,
  periodEventsCount: 0,
  activeUsersCount: 0,
  criticalActionsCount: 0,
  topActiveModule: 'N/A',
  pendingReviewsCount: 0,
}

export function useAudit(userRole: UserRole = 'SUPERADMIN', userLocationId?: string) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [stats, setStats] = useState<AuditStats>(DEFAULT_STATS)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  // Filtros
  const [filters, setFilters] = useState<AuditFilters>({
    level: 'ALL',
    module: 'ALL',
    locationId: 'ALL',
    result: 'ALL',
    onlyCritical: false,
    onlyWithChanges: false,
    searchQuery: '',
  })

  // Log seleccionado para el drawer
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState<boolean>(false)

  // Carga de datos
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const [logsRes, statsRes] = await Promise.all([
        auditService.list(filters, userRole, userLocationId),
        auditService.getAuditStats(filters, userRole, userLocationId),
      ])
      setLogs(logsRes)
      setStats(statsRes)
    } catch (err: any) {
      setError(err.message || 'Error al cargar los registros de auditoría.')
    } finally {
      setIsLoading(false)
    }
  }, [filters, userRole, userLocationId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleUpdateFilter = (key: keyof AuditFilters, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  const handleResetFilters = () => {
    setFilters({
      level: 'ALL',
      module: 'ALL',
      locationId: 'ALL',
      result: 'ALL',
      onlyCritical: false,
      onlyWithChanges: false,
      searchQuery: '',
      dateFrom: undefined,
      dateTo: undefined,
      userId: undefined,
    })
  }

  const handleSelectLog = (log: AuditLogEntry) => {
    setSelectedLog(log)
    setIsDetailOpen(true)
  }

  const handleCloseDetail = () => {
    setIsDetailOpen(false)
    setSelectedLog(null)
  }

  const handleExportCSV = async () => {
    const res = await auditService.exportAudit(
      filters,
      { id: 'usr-001', name: 'Mauricio Andrade', role: 'Superadministrador' },
      userRole
    )

    const blob = new Blob([res.content], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', res.fileName)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    await loadData() // Refrescar para ver el nuevo evento de exportación en la lista
  }

  return {
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
    reload: loadData,
  }
}
