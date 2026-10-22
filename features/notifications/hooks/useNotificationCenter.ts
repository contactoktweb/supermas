'use client'

/**
 * SUPER MÁS ERP/POS — Estado del centro de notificaciones del Header.
 *
 * Sin Supabase Realtime en el proyecto: refresca al montar, al volver a la pestaña
 * (focus / visibilitychange) y cada 60 s solo mientras la pestaña está visible.
 * El usuario sale de AuthContext, cuyo perfil está memoizado por sesión
 * (lib/supabase/session-context.ts), así que no se repiten getUser ni lecturas de perfil.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@/features/auth'
import { productService } from '@/features/products/services/product.service'
import { canApprovePrices, canRequestPrices } from '@/features/products/utils/price-permissions'
import type { PriceChangeRequest } from '@/features/products/types'
import { notificationRepository } from '../repositories/notification.repository'
import { NOTIFICATION_TYPES, UserNotification } from '../types'

const POLL_INTERVAL_MS = 60_000
/** Evita consultas repetidas cuando focus y visibilitychange llegan juntos. */
const MIN_REFRESH_GAP_MS = 10_000
const RECENT_NOTIFICATIONS_LIMIT = 8
const PENDING_APPROVALS_PREVIEW_LIMIT = 5

export interface NotificationCenterState {
  notifications: UserNotification[]
  pendingApprovals: PriceChangeRequest[]
  pendingApprovalsCount: number
  unreadCount: number
  badgeCount: number
  canApprove: boolean
  canRequest: boolean
  isLoading: boolean
  error: string | null
  refresh: (force?: boolean) => Promise<void>
  markAsRead: (notificationIds?: string[]) => Promise<void>
}

export function useNotificationCenter(): NotificationCenterState {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const canApprove = canApprovePrices(user)
  const canRequest = canRequestPrices(user)

  const [notifications, setNotifications] = useState<UserNotification[]>([])
  const [pendingApprovals, setPendingApprovals] = useState<PriceChangeRequest[]>([])
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0)
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const inFlightRef = useRef(false)
  const lastRefreshRef = useRef(0)

  const refresh = useCallback(
    async (force = false) => {
      if (!userId || inFlightRef.current) return
      if (!force && Date.now() - lastRefreshRef.current < MIN_REFRESH_GAP_MS) return

      inFlightRef.current = true
      setIsLoading(true)
      try {
        // Para el aprobador, los avisos de solicitud ya están representados por el contador de pendientes.
        const excludedTypes = canApprove ? [NOTIFICATION_TYPES.PRICE_APPROVAL_REQUEST] : []
        const [recent, unread, pendingCount, pendingPreview] = await Promise.all([
          notificationRepository.listRecent(userId, RECENT_NOTIFICATIONS_LIMIT),
          notificationRepository.countUnread(userId, excludedTypes),
          canApprove ? productService.countPendingPriceChangeRequests() : Promise.resolve(0),
          canApprove
            ? productService.getPriceChangeRequests({ status: 'PENDING', limit: PENDING_APPROVALS_PREVIEW_LIMIT })
            : Promise.resolve([] as PriceChangeRequest[]),
        ])
        setNotifications(recent)
        setUnreadCount(unread)
        setPendingApprovalsCount(pendingCount)
        setPendingApprovals(pendingPreview)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudieron cargar las notificaciones.')
      } finally {
        lastRefreshRef.current = Date.now()
        inFlightRef.current = false
        setIsLoading(false)
      }
    },
    [userId, canApprove]
  )

  useEffect(() => {
    if (!userId) {
      setNotifications([])
      setPendingApprovals([])
      setPendingApprovalsCount(0)
      setUnreadCount(0)
      return
    }

    refresh(true)

    const isVisible = () => document.visibilityState === 'visible'
    const interval = window.setInterval(() => {
      if (isVisible()) refresh(true)
    }, POLL_INTERVAL_MS)

    const handleVisibility = () => {
      if (isVisible()) refresh()
    }
    window.addEventListener('focus', handleVisibility)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', handleVisibility)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [userId, refresh])

  const markAsRead = useCallback(
    async (notificationIds?: string[]) => {
      if (!userId) return
      const targetIds = notificationIds && notificationIds.length > 0 ? new Set(notificationIds) : null
      const nowIso = new Date().toISOString()

      setNotifications((prev) =>
        prev.map((n) => (!n.readAt && (!targetIds || targetIds.has(n.id)) ? { ...n, readAt: nowIso } : n))
      )
      try {
        await notificationRepository.markAsRead(notificationIds)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudieron marcar las notificaciones como leídas.')
      }
      await refresh(true)
    },
    [userId, refresh]
  )

  const badgeCount = unreadCount + (canApprove ? pendingApprovalsCount : 0)

  return {
    notifications,
    pendingApprovals,
    pendingApprovalsCount,
    unreadCount,
    badgeCount,
    canApprove,
    canRequest,
    isLoading,
    error,
    refresh,
    markAsRead,
  }
}
