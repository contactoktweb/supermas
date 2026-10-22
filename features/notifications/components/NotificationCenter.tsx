'use client'

import React, { useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AppIcon, LightIconName } from '@/components/ui/Icon'
import { productService } from '@/features/products/services/product.service'
import { formatPriceVariation } from '@/features/products/utils/price-change-plan'
import { useNotificationCenter } from '../hooks/useNotificationCenter'
import { UserNotification, UserNotificationSeverity } from '../types'

export const PRICE_APPROVALS_PATH = '/aprobaciones-precios'
const MAX_BADGE_COUNT = 99

const SEVERITY_ICON: Record<UserNotificationSeverity, LightIconName> = {
  INFO: 'info',
  SUCCESS: 'check',
  WARNING: 'alertTriangle',
  CRITICAL: 'warning',
}

function formatRelativeDate(iso: string): string {
  return new Date(iso).toLocaleString('es-CO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Bogota',
  })
}

export function NotificationCenter() {
  const router = useRouter()
  const panelId = useId()
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const {
    notifications,
    pendingApprovals,
    pendingApprovalsCount,
    badgeCount,
    canApprove,
    canRequest,
    isLoading,
    error,
    refresh,
    markAsRead,
  } = useNotificationCenter()

  useEffect(() => {
    if (!isOpen) return
    const handlePointer = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', handlePointer)
    document.addEventListener('touchstart', handlePointer)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handlePointer)
      document.removeEventListener('touchstart', handlePointer)
      document.removeEventListener('keydown', handleKey)
    }
  }, [isOpen])

  const toggle = () => {
    if (!isOpen) refresh(true)
    setIsOpen(!isOpen)
  }

  const openNotification = (notification: UserNotification) => {
    setIsOpen(false)
    if (!notification.readAt) markAsRead([notification.id])
    if (notification.linkPath) router.push(notification.linkPath)
  }

  const hasUnread = notifications.some((n) => !n.readAt)
  const badgeLabel = badgeCount > MAX_BADGE_COUNT ? `${MAX_BADGE_COUNT}+` : String(badgeCount)

  return (
    <div className="notif-center" ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        className={`notification icon-button notif-center-trigger ${badgeCount > 0 ? 'has-badge' : ''}`}
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={panelId}
        aria-label={
          badgeCount > 0
            ? `Notificaciones: ${badgeCount} pendientes`
            : 'Notificaciones: sin pendientes'
        }
        title="Notificaciones"
      >
        <AppIcon name="alerts" size={18} />
        {badgeCount > 0 && (
          <i key={badgeCount} className="notif-center-badge" aria-hidden="true">
            {badgeLabel}
          </i>
        )}
      </button>

      {isOpen && (
        <div id={panelId} className="notif-center-panel" role="dialog" aria-label="Centro de notificaciones">
          <header className="notif-center-header">
            <strong>Notificaciones</strong>
            <div className="notif-center-header-actions">
              <button
                type="button"
                className="notif-center-link-button"
                onClick={() => refresh(true)}
                disabled={isLoading}
                aria-label="Actualizar notificaciones"
              >
                <AppIcon name="refresh" size={14} className={isLoading ? 'notif-spin' : ''} />
              </button>
              {hasUnread && (
                <button type="button" className="notif-center-link-button" onClick={() => markAsRead()}>
                  Marcar todas como leídas
                </button>
              )}
            </div>
          </header>

          {error && (
            <p className="notif-center-error" role="alert">
              <AppIcon name="warning" size={14} />
              <span>{error}</span>
            </p>
          )}

          <div className="notif-center-body">
            {canApprove && (
              <section className="notif-center-section" aria-labelledby={`${panelId}-approvals`}>
                <h2 id={`${panelId}-approvals`} className="notif-center-section-title">
                  Aprobaciones de precio
                  {pendingApprovalsCount > 0 && <span className="notif-center-count">{pendingApprovalsCount}</span>}
                </h2>
                {pendingApprovals.length === 0 ? (
                  <p className="notif-center-empty-line">
                    <AppIcon name="check" size={14} />
                    <span>No hay cambios de precio por aprobar.</span>
                  </p>
                ) : (
                  <ul className="notif-center-list">
                    {pendingApprovals.map((request) => (
                      <li key={request.id}>
                        <Link
                          href={`${PRICE_APPROVALS_PATH}?solicitud=${request.id}`}
                          className="notif-center-item is-unread"
                          onClick={() => setIsOpen(false)}
                        >
                          <span className="notif-center-item-icon tone-warning" aria-hidden="true">
                            <AppIcon name="dollar" size={15} />
                          </span>
                          <span className="notif-center-item-text">
                            <strong>{request.productName}</strong>
                            <span>
                              {request.priceListName}: {productService.formatCurrency(request.previousPrice)} a{' '}
                              {productService.formatCurrency(request.proposedPrice)} ({formatPriceVariation(request.variationPercent)})
                            </span>
                            <small>
                              {request.requestedByName} · {formatRelativeDate(request.requestedAt)}
                            </small>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            <section className="notif-center-section" aria-labelledby={`${panelId}-recent`}>
              <h2 id={`${panelId}-recent`} className="notif-center-section-title">
                Recientes
              </h2>
              {isLoading && notifications.length === 0 ? (
                <div className="notif-center-skeleton" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </div>
              ) : notifications.length === 0 ? (
                <p className="notif-center-empty-line">
                  <AppIcon name="check" size={14} />
                  <span>No tienes notificaciones.</span>
                </p>
              ) : (
                <ul className="notif-center-list">
                  {notifications.map((notification) => (
                    <li key={notification.id}>
                      <button
                        type="button"
                        className={`notif-center-item ${notification.readAt ? '' : 'is-unread'}`}
                        onClick={() => openNotification(notification)}
                      >
                        <span
                          className={`notif-center-item-icon tone-${notification.severity.toLowerCase()}`}
                          aria-hidden="true"
                        >
                          <AppIcon name={SEVERITY_ICON[notification.severity] ?? 'info'} size={15} />
                        </span>
                        <span className="notif-center-item-text">
                          <strong>{notification.title}</strong>
                          <span>{notification.message}</span>
                          <small>
                            {formatRelativeDate(notification.createdAt)}
                            {!notification.readAt && <em className="visually-hidden"> (no leída)</em>}
                          </small>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {canRequest && (
            <footer className="notif-center-footer">
              <Link href={PRICE_APPROVALS_PATH} className="outline-button compact" onClick={() => setIsOpen(false)}>
                <AppIcon name="dollar" size={14} />
                <span>{canApprove ? 'Ir a la bandeja de aprobaciones' : 'Ver mis solicitudes de precio'}</span>
              </Link>
            </footer>
          )}
        </div>
      )}
    </div>
  )
}
