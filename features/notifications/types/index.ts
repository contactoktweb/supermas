/**
 * SUPER MÁS ERP/POS — Notificaciones por usuario (public.user_notifications, migración 069)
 */

export type UserNotificationSeverity = 'INFO' | 'SUCCESS' | 'WARNING' | 'CRITICAL'

/** Tipos emitidos por la base. */
export const NOTIFICATION_TYPES = {
  PRICE_APPROVAL_REQUEST: 'PRICE_APPROVAL_REQUEST',
  PRICE_APPROVAL_RESULT: 'PRICE_APPROVAL_RESULT',
} as const

export interface UserNotification {
  id: string
  type: string
  severity: UserNotificationSeverity
  title: string
  message: string
  entityType: string | null
  entityId: string | null
  linkPath: string | null
  readAt: string | null
  createdAt: string
}
