'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { AppIcon } from '@/components/ui/Icon'
import { useAuth } from '@/features/auth'
import { PriceChangeRequest, PriceChangeRequestFilters } from '../../types'
import { canApprovePrices, canRequestPrices } from '../../utils/price-permissions'
import { usePriceChangeRequests } from '../../hooks/usePriceChangeRequests'
import { ProductToastContainer, ToastMessage } from '../ProductToast'
import { PriceApprovalFilters, PriceStatusFilter } from './PriceApprovalFilters'
import { PriceRequestList } from './PriceRequestList'
import { PriceRequestReviewDrawer } from './PriceRequestReviewDrawer'

type ApprovalView = 'pendientes' | 'historial' | 'mias'

const VIEW_LABELS: Record<ApprovalView, string> = {
  pendientes: 'Por aprobar',
  historial: 'Historial',
  mias: 'Mis solicitudes',
}

const TOAST_DURATION_MS = 4500

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

export function PriceApprovalsPage() {
  const router = useRouter()
  const pathname = usePathname() || '/aprobaciones-precios'
  const searchParams = useSearchParams()
  const { user, isLoading: isAuthLoading } = useAuth()

  const canApprove = canApprovePrices(user)
  const canRequest = canRequestPrices(user)
  const availableViews: ApprovalView[] = canApprove ? ['pendientes', 'historial', 'mias'] : ['mias']

  const requestedView = searchParams.get('vista') as ApprovalView | null
  const view: ApprovalView =
    requestedView && availableViews.includes(requestedView) ? requestedView : availableViews[0]
  const selectedId = searchParams.get('solicitud')

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<PriceStatusFilter>('ALL')
  const [priceList, setPriceList] = useState('ALL')
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const filters = useMemo<PriceChangeRequestFilters | null>(() => {
    if (!user) return null
    if (view === 'pendientes') return { status: 'PENDING' }
    if (view === 'mias') return { requestedBy: user.id, status }
    return { status }
  }, [user, view, status])

  const { requests, isLoading, error, reload } = usePriceChangeRequests(filters)

  const updateQuery = useCallback(
    (changes: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString())
      Object.entries(changes).forEach(([key, value]) => {
        if (value === null) params.delete(key)
        else params.set(key, value)
      })
      const query = params.toString()
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    },
    [router, pathname, searchParams]
  )

  useEffect(() => {
    setStatus('ALL')
    setPriceList('ALL')
  }, [view])

  const priceListOptions = useMemo(() => {
    const map = new Map<string, string>()
    requests.forEach((r) => map.set(r.priceListCode, r.priceListName))
    return Array.from(map, ([code, name]) => ({ code, name }))
  }, [requests])

  const visibleRequests = useMemo(() => {
    const term = normalizeText(search.trim())
    return requests.filter((r) => {
      if (priceList !== 'ALL' && r.priceListCode !== priceList) return false
      if (!term) return true
      return normalizeText(`${r.productName} ${r.productSku} ${r.requestedByName}`).includes(term)
    })
  }, [requests, search, priceList])

  const counts = useMemo(
    () => ({
      PENDING: requests.filter((r) => r.status === 'PENDING').length,
      APPROVED: requests.filter((r) => r.status === 'APPROVED').length,
      REJECTED: requests.filter((r) => r.status === 'REJECTED').length,
    }),
    [requests]
  )

  const selectedRequest: PriceChangeRequest | null = useMemo(
    () => (selectedId ? requests.find((r) => r.id === selectedId) ?? null : null),
    [requests, selectedId]
  )

  const showToast = useCallback((title: string, message: string, type: ToastMessage['type']) => {
    const id = `toast-${Date.now()}`
    setToasts((prev) => [...prev, { id, title, message, type }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), TOAST_DURATION_MS)
  }, [])

  const handleReviewed = (message: string, approved: boolean) => {
    showToast(approved ? 'Precio aprobado' : 'Solicitud rechazada', message, approved ? 'success' : 'info')
    updateQuery({ solicitud: null })
    reload()
  }

  if (isAuthLoading) {
    return (
      <div className="price-approvals-page" aria-busy="true">
        <div className="price-approvals-skeleton" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>
    )
  }

  if (!canRequest) {
    return (
      <div className="price-approvals-page">
        <div className="drawer-empty page-enter">
          <AppIcon name="lock" size={32} />
          <h1 className="price-approvals-denied-title">Aprobación de precios</h1>
          <p>No tienes permisos para consultar solicitudes de cambio de precio.</p>
        </div>
      </div>
    )
  }

  const emptyMessage =
    view === 'pendientes'
      ? 'No hay cambios de precio esperando aprobación.'
      : view === 'mias'
      ? 'Aún no has enviado solicitudes de cambio de precio. Se crean al editar el precio de un producto.'
      : 'No hay solicitudes con los filtros seleccionados.'

  return (
    <div className="price-approvals-page">
      <ProductToastContainer toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />

      <header className="page-heading page-enter">
        <div>
          <p className="eyebrow">Inventario · Control de precios</p>
          <h1>Aprobación de precios</h1>
          <p className="welcome-subtitle">
            {canApprove
              ? 'Revisa los cambios de precio propuestos por el equipo operativo. Al aprobar, el precio se aplica de inmediato y queda en auditoría.'
              : 'Consulta el estado de los cambios de precio que enviaste a aprobación del administrador.'}
          </p>
        </div>
        <div className="heading-actions">
          <button type="button" className="outline-button" onClick={() => reload()} disabled={isLoading}>
            <AppIcon name="refresh" size={16} className={isLoading ? 'notif-spin' : ''} />
            <span>Actualizar</span>
          </button>
        </div>
      </header>

      {availableViews.length > 1 && (
        <div className="tabs" role="tablist" aria-label="Vistas de solicitudes">
          {availableViews.map((option) => (
            <button
              key={option}
              type="button"
              role="tab"
              aria-selected={view === option}
              className={view === option ? 'active' : ''}
              onClick={() => updateQuery({ vista: option, solicitud: null })}
            >
              {VIEW_LABELS[option]}
            </button>
          ))}
        </div>
      )}

      <section className="price-approvals-summary page-enter" aria-label="Resumen">
        <div className="price-approvals-chip is-pending">
          <AppIcon name="clock" size={15} aria-hidden="true" />
          <span>Pendientes</span>
          <strong>{counts.PENDING}</strong>
        </div>
        {view !== 'pendientes' && (
          <>
            <div className="price-approvals-chip is-approved">
              <AppIcon name="check" size={15} aria-hidden="true" />
              <span>Aprobadas</span>
              <strong>{counts.APPROVED}</strong>
            </div>
            <div className="price-approvals-chip is-rejected">
              <AppIcon name="close" size={15} aria-hidden="true" />
              <span>Rechazadas</span>
              <strong>{counts.REJECTED}</strong>
            </div>
          </>
        )}
      </section>

      <PriceApprovalFilters
        search={search}
        onSearchChange={setSearch}
        status={status}
        onStatusChange={setStatus}
        showStatus={view !== 'pendientes'}
        priceList={priceList}
        onPriceListChange={setPriceList}
        priceListOptions={priceListOptions}
      />

      {isLoading && requests.length === 0 ? (
        <div className="price-approvals-skeleton" aria-busy="true" aria-label="Cargando solicitudes">
          <span />
          <span />
          <span />
        </div>
      ) : error ? (
        <div className="drawer-empty page-enter" role="alert">
          <AppIcon name="warning" size={32} />
          <p>{error}</p>
          <button type="button" className="outline-button compact" onClick={() => reload()}>
            Reintentar
          </button>
        </div>
      ) : visibleRequests.length === 0 ? (
        <div className="drawer-empty page-enter">
          <AppIcon name="check" size={32} />
          <p>{emptyMessage}</p>
        </div>
      ) : (
        <PriceRequestList requests={visibleRequests} onSelect={(r) => updateQuery({ solicitud: r.id })} />
      )}

      <PriceRequestReviewDrawer
        request={selectedRequest}
        currentUserId={user?.id ?? null}
        canApprove={canApprove}
        onClose={() => updateQuery({ solicitud: null })}
        onReviewed={handleReviewed}
      />
    </div>
  )
}
