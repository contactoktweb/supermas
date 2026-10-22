/**
 * SUPER MÁS ERP/POS — Repositorio de notificaciones por usuario.
 *
 * Lee public.user_notifications bajo RLS (cada usuario solo ve las suyas) y marca
 * como leídas mediante la RPC fn_mark_notifications_read (069). No escribe directamente.
 */

import { supabaseClient } from '@/lib/supabase/client'
import { UserNotification, UserNotificationSeverity } from '../types'

const NOTIFICATION_COLUMNS =
  'id, type, severity, title, message, entity_type, entity_id, link_path, read_at, created_at'

interface NotificationRow {
  id: string
  type: string
  severity: string
  title: string
  message: string
  entity_type: string | null
  entity_id: string | null
  link_path: string | null
  read_at: string | null
  created_at: string
}

function mapRow(row: NotificationRow): UserNotification {
  return {
    id: row.id,
    type: row.type,
    severity: (row.severity as UserNotificationSeverity) || 'INFO',
    title: row.title,
    message: row.message,
    entityType: row.entity_type,
    entityId: row.entity_id,
    linkPath: row.link_path,
    readAt: row.read_at,
    createdAt: row.created_at,
  }
}

export class NotificationRepository {
  async listRecent(userId: string, limit: number): Promise<UserNotification[]> {
    const { data, error } = await supabaseClient
      .from('user_notifications')
      .select(NOTIFICATION_COLUMNS)
      .eq('recipient_user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      throw new Error('No se pudieron cargar las notificaciones.')
    }
    return ((data || []) as NotificationRow[]).map(mapRow)
  }

  /** Cuenta las no leídas; `excludeTypes` omite tipos ya representados por otro contador. */
  async countUnread(userId: string, excludeTypes: string[] = []): Promise<number> {
    let query = supabaseClient
      .from('user_notifications')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_user_id', userId)
      .is('read_at', null)

    if (excludeTypes.length > 0) {
      query = query.not('type', 'in', `(${excludeTypes.join(',')})`)
    }

    const { count, error } = await query
    if (error) {
      throw new Error('No se pudo consultar el número de notificaciones.')
    }
    return count ?? 0
  }

  /** Marca como leídas las indicadas (o todas si no se indican). Devuelve cuántas cambiaron. */
  async markAsRead(notificationIds?: string[]): Promise<number> {
    const { data, error } = await supabaseClient.rpc('fn_mark_notifications_read', {
      p_notification_ids: notificationIds && notificationIds.length > 0 ? notificationIds : null,
    })

    if (error) {
      throw new Error(error.message || 'No se pudieron marcar las notificaciones como leídas.')
    }
    return Number(data ?? 0)
  }
}

export const notificationRepository = new NotificationRepository()
