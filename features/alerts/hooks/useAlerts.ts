'use client'

import { useState, useEffect, useCallback } from 'react'
import { alertService, DEFAULT_ALERT_USER } from '../services/alert.service'
import {
  AlertItem,
  AlertStats,
  AlertFilterCriteria,
  AlertRule,
  UserAlertContext,
  RuleEvaluationResult,
} from '../types'
import { AlertRuleConfigInput } from '../schemas/alert.schema'

export function useAlerts(userContext: UserAlertContext = DEFAULT_ALERT_USER) {
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState<AlertStats | null>(null)
  const [rules, setRules] = useState<AlertRule[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isScanning, setIsScanning] = useState(false)
  const [selectedAlert, setSelectedAlert] = useState<AlertItem | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)

  const [filters, setFilters] = useState<AlertFilterCriteria>({
    searchQuery: '',
    priority: 'ALL',
    module: 'ALL',
    status: 'ALL',
    locationId: 'ALL',
    onlyCritical: false,
    onlyUnread: false,
    page: 1,
    pageSize: 15,
  })

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type })
  }, [])

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true)
      const [alertsRes, statsRes, rulesRes] = await Promise.all([
        alertService.getAlerts(filters, userContext),
        alertService.getStats(filters.locationId !== 'ALL' ? filters.locationId : undefined, userContext),
        alertService.getRules(userContext),
      ])

      setAlerts(alertsRes.data)
      setTotal(alertsRes.total)
      setStats(statsRes)
      setRules(rulesRes)
    } catch (err: any) {
      showToast(err.message || 'Error al cargar alertas', 'error')
    } finally {
      setIsLoading(false)
    }
  }, [filters, userContext, showToast])

  useEffect(() => {
    loadData()
  }, [loadData])

  const setFilter = useCallback((key: keyof AlertFilterCriteria, value: any) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
      page: key === 'page' ? value : 1, // Reset page on filter change
    }))
  }, [])

  const resetFilters = useCallback(() => {
    setFilters({
      searchQuery: '',
      priority: 'ALL',
      module: 'ALL',
      status: 'ALL',
      locationId: 'ALL',
      onlyCritical: false,
      onlyUnread: false,
      page: 1,
      pageSize: 15,
    })
  }, [])

  const markAsRead = useCallback(
    async (alertId: string) => {
      try {
        const updated = await alertService.markAsRead(alertId, userContext)
        setAlerts((prev) => prev.map((a) => (a.id === alertId ? updated : a)))
        if (selectedAlert?.id === alertId) {
          setSelectedAlert(updated)
        }
        // Actualizar stats
        const newStats = await alertService.getStats(undefined, userContext)
        setStats(newStats)
        showToast('Alerta marcada como leída', 'info')
      } catch (err: any) {
        showToast(err.message || 'Error al marcar como leída', 'error')
      }
    },
    [userContext, selectedAlert, showToast]
  )

  const markAllAsRead = useCallback(async () => {
    try {
      const count = await alertService.markAllAsRead(userContext)
      await loadData()
      showToast(`${count} alertas marcadas como leídas`, 'success')
    } catch (err: any) {
      showToast(err.message || 'Error al marcar todas como leídas', 'error')
    }
  }, [userContext, loadData, showToast])

  const attendAlert = useCallback(
    async (alertId: string, comment: string) => {
      try {
        const updated = await alertService.attendAlert(alertId, { comment }, userContext)
        setAlerts((prev) => prev.map((a) => (a.id === alertId ? updated : a)))
        if (selectedAlert?.id === alertId) {
          setSelectedAlert(updated)
        }
        const newStats = await alertService.getStats(undefined, userContext)
        setStats(newStats)
        showToast('Alerta puesta en atención exitosamente', 'success')
      } catch (err: any) {
        showToast(err.message || 'Error al atender alerta', 'error')
      }
    },
    [userContext, selectedAlert, showToast]
  )

  const resolveAlert = useCallback(
    async (alertId: string, solutionNotes: string) => {
      try {
        const updated = await alertService.resolveAlert(alertId, { solutionNotes }, userContext)
        setAlerts((prev) => prev.map((a) => (a.id === alertId ? updated : a)))
        if (selectedAlert?.id === alertId) {
          setSelectedAlert(updated)
        }
        const newStats = await alertService.getStats(undefined, userContext)
        setStats(newStats)
        showToast('Alerta solucionada y registrada', 'success')
      } catch (err: any) {
        showToast(err.message || 'Error al resolver alerta', 'error')
      }
    },
    [userContext, selectedAlert, showToast]
  )

  const closeAlert = useCallback(
    async (alertId: string, closeNotes?: string) => {
      try {
        const updated = await alertService.closeAlert(alertId, { closeNotes }, userContext)
        setAlerts((prev) => prev.map((a) => (a.id === alertId ? updated : a)))
        if (selectedAlert?.id === alertId) {
          setSelectedAlert(updated)
        }
        const newStats = await alertService.getStats(undefined, userContext)
        setStats(newStats)
        showToast('Alerta cerrada administrativamente', 'info')
      } catch (err: any) {
        showToast(err.message || 'Error al cerrar alerta', 'error')
      }
    },
    [userContext, selectedAlert, showToast]
  )

  const scanSystem = useCallback(async (): Promise<RuleEvaluationResult | null> => {
    try {
      setIsScanning(true)
      const res = await alertService.scanAndEvaluate(userContext)
      await loadData()
      showToast(
        `Escaneo completado: ${res.newAlertsCreated} nuevas alertas detectadas de ${res.evaluatedRules} reglas activas.`,
        res.newAlertsCreated > 0 ? 'info' : 'success'
      )
      return res
    } catch (err: any) {
      showToast(err.message || 'Error al escanear reglas del sistema', 'error')
      return null
    } finally {
      setIsScanning(false)
    }
  }, [userContext, loadData, showToast])

  const updateRuleConfig = useCallback(
    async (input: AlertRuleConfigInput) => {
      try {
        const updated = await alertService.updateRuleConfig(input, userContext)
        setRules((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
        showToast(`Regla ${updated.code} actualizada correctamente`, 'success')
      } catch (err: any) {
        showToast(err.message || 'Error al actualizar configuración de regla', 'error')
      }
    },
    [userContext, showToast]
  )

  const openAlertDetail = useCallback(
    (alert: AlertItem) => {
      setSelectedAlert(alert)
      setIsDrawerOpen(true)
      // Si está nueva, marcar automáticamente como leída al abrir
      if (alert.status === 'NEW') {
        markAsRead(alert.id)
      }
    },
    [markAsRead]
  )

  return {
    alerts,
    total,
    stats,
    rules,
    filters,
    isLoading,
    isScanning,
    selectedAlert,
    isDrawerOpen,
    isRulesModalOpen,
    toast,
    setFilter,
    resetFilters,
    markAsRead,
    markAllAsRead,
    attendAlert,
    resolveAlert,
    closeAlert,
    scanSystem,
    updateRuleConfig,
    openAlertDetail,
    setIsDrawerOpen,
    setIsRulesModalOpen,
    setToast,
    refresh: loadData,
  }
}
