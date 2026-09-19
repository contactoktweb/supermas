'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon, LightIconName } from '@/components/ui/Icon'
import { AlertItem, AlertPriority, AlertStatus, AlertModule } from '../../types'
import { useRouter } from 'next/navigation'

interface AlertDetailDrawerProps {
  alert: AlertItem | null
  isOpen: boolean
  onClose: () => void
  onAttend: (alertId: string, comment: string) => Promise<void>
  onResolve: (alertId: string, solutionNotes: string) => Promise<void>
  onCloseAlert: (alertId: string, notes?: string) => Promise<void>
}

const PRIORITY_THEMES: Record<AlertPriority, { label: string; badge: string }> = {
  CRITICA: {
    label: 'Crítica',
    badge: 'bg-rose-50 text-rose-700 border-rose-200',
  },
  ALTA: {
    label: 'Alta',
    badge: 'bg-orange-50 text-orange-700 border-orange-200',
  },
  MEDIA: {
    label: 'Media',
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  BAJA: {
    label: 'Baja',
    badge: 'bg-slate-100 text-slate-700 border-slate-200',
  },
}

const STATUS_THEMES: Record<AlertStatus, { label: string; class: string }> = {
  NEW: { label: 'Nueva (Sin leer)', class: 'bg-rose-50 text-rose-700 border-rose-200' },
  READ: { label: 'Leída', class: 'bg-blue-50 text-blue-700 border-blue-200' },
  IN_PROGRESS: { label: 'En Atención', class: 'bg-amber-50 text-amber-700 border-amber-200' },
  RESOLVED: { label: 'Solucionada', class: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  CLOSED: { label: 'Cerrada', class: 'bg-slate-100 text-slate-600 border-slate-200' },
}

export function AlertDetailDrawer({
  alert,
  isOpen,
  onClose,
  onAttend,
  onResolve,
  onCloseAlert,
}: AlertDetailDrawerProps) {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [attendComment, setAttendComment] = useState('')
  const [solutionNotes, setSolutionNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [actionTab, setActionTab] = useState<'info' | 'attend' | 'resolve'>('info')

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || !alert || !mounted) return null

  const priorityTheme = PRIORITY_THEMES[alert.priority]
  const statusTheme = STATUS_THEMES[alert.status]

  const getEntityNavigation = () => {
    switch (alert.entityType) {
      case 'PRODUCT':
        return {
          label: 'Ver Producto en Inventario',
          path: `/inventario`,
          icon: 'inventory' as LightIconName,
        }
      case 'PURCHASE_INVOICE':
        return {
          label: 'Ver Compra en Proveedores',
          path: `/compras`,
          icon: 'purchases' as LightIconName,
        }
      case 'INVOICE':
        return {
          label: 'Ver Facturación Electrónica',
          path: `/facturacion`,
          icon: 'invoices' as LightIconName,
        }
      case 'CASH_REGISTER':
        return {
          label: 'Ver Cajas Registradoras',
          path: `/reportes/cajas`,
          icon: 'cashRegisters' as LightIconName,
        }
      case 'WEB_ORDER':
        return {
          label: 'Ver Pedido en Pedidos Web',
          path: `/pedidos-web`,
          icon: 'webOrders' as LightIconName,
        }
      case 'TRANSFER':
        return {
          label: 'Ver Traslado en Transferencias',
          path: `/transferencias`,
          icon: 'transfers' as LightIconName,
        }
      case 'ACCOUNTING_ENTRY':
        return {
          label: 'Ver en Contabilidad',
          path: `/contabilidad`,
          icon: 'accounting' as LightIconName,
        }
      default:
        return null
    }
  }

  const navTarget = getEntityNavigation()

  const handleAttend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!attendComment.trim()) return
    try {
      setIsSubmitting(true)
      await onAttend(alert.id, attendComment)
      setAttendComment('')
      setActionTab('info')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleResolve = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!solutionNotes.trim()) return
    try {
      setIsSubmitting(true)
      await onResolve(alert.id, solutionNotes)
      setSolutionNotes('')
      setActionTab('info')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = async () => {
    if (!confirm('¿Estás seguro de cerrar definitivamente esta alerta?')) return
    try {
      setIsSubmitting(true)
      await onCloseAlert(alert.id, 'Cierre administrativo completado')
      onClose()
    } finally {
      setIsSubmitting(false)
    }
  }

  return createPortal(
    <>
      <div
        className="drawer-backdrop"
        onClick={onClose}
      />

      <aside
        className="fixed inset-y-0 right-0 z-[100000] w-full max-w-xl bg-white border-l border-slate-200 shadow-2xl flex flex-col overflow-hidden"
        style={{ animation: 'slide .3s ease' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="alert-drawer-title"
      >
        {/* Drawer Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between bg-slate-50/70 shrink-0">
          <div className="space-y-1.5 pr-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-slate-500 font-bold bg-white px-2 py-0.5 rounded-md border border-slate-200 shadow-2xs">
                {alert.code}
              </span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${priorityTheme.badge}`}>
                {priorityTheme.label}
              </span>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${statusTheme.class}`}>
                {statusTheme.label}
              </span>
            </div>
            <h2 id="alert-drawer-title" className="text-lg font-bold text-slate-900 tracking-tight">
              {alert.title}
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Módulo: <span className="text-slate-800 font-semibold">{alert.module}</span> • Sede:{' '}
              <span className="text-slate-800 font-semibold">{alert.locationName || 'Consolidado General'}</span>
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors shrink-0"
            aria-label="Cerrar panel de alerta"
          >
            <AppIcon name="close" size={18} />
          </button>
        </div>

        {/* Action Tabs */}
        {alert.status !== 'CLOSED' && (
          <div className="flex border-b border-slate-100 bg-white px-6 py-2.5 gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setActionTab('info')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                actionTab === 'info'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              Información & Seguimiento
            </button>

            {alert.status !== 'RESOLVED' && (
              <button
                type="button"
                onClick={() => setActionTab('attend')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  actionTab === 'attend'
                    ? 'bg-amber-100 text-amber-800 border border-amber-300 shadow-xs'
                    : 'text-amber-700 hover:bg-amber-50'
                }`}
              >
                <AppIcon name="users" size={13} />
                <span>Atender Alerta</span>
              </button>
            )}

            {alert.status !== 'RESOLVED' && (
              <button
                type="button"
                onClick={() => setActionTab('resolve')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  actionTab === 'resolve'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-xs'
                    : 'text-emerald-700 hover:bg-emerald-50'
                }`}
              >
                <AppIcon name="check" size={13} />
                <span>Resolver Alerta</span>
              </button>
            )}
          </div>
        )}

        {/* Drawer Body Scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Section: Atender Form if tab active */}
          {actionTab === 'attend' && (
            <form onSubmit={handleAttend} className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 space-y-3">
              <div className="flex items-center gap-2 text-amber-800 font-bold text-xs uppercase tracking-wider">
                <AppIcon name="users" size={15} />
                <span>Asignar y Poner en Atención</span>
              </div>
              <p className="text-xs text-amber-900 leading-relaxed font-medium">
                Registra qué acción o revisión estás llevando a cabo. La alerta pasará a estado <strong>En atención</strong> y quedará asignada a tu usuario.
              </p>
              <textarea
                rows={3}
                required
                value={attendComment}
                onChange={(e) => setAttendComment(e.target.value)}
                placeholder="Ej: Verificando existencias físicas en pasillo 4 / Contactando al proveedor..."
                className="w-full bg-white border border-amber-200 rounded-xl p-3 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActionTab('info')}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !attendComment.trim()}
                  className="px-4 py-1.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-xs transition-all disabled:opacity-50"
                >
                  {isSubmitting ? 'Guardando...' : 'Confirmar Atención'}
                </button>
              </div>
            </form>
          )}

          {/* Section: Resolver Form if tab active */}
          {actionTab === 'resolve' && (
            <form onSubmit={handleResolve} className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 space-y-3">
              <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs uppercase tracking-wider">
                <AppIcon name="check" size={15} />
                <span>Registrar Solución y Resolver Alerta</span>
              </div>
              <p className="text-xs text-emerald-900 leading-relaxed font-medium">
                Documenta la solución definitiva aplicada para resolver esta situación.
              </p>
              <textarea
                rows={3}
                required
                value={solutionNotes}
                onChange={(e) => setSolutionNotes(e.target.value)}
                placeholder="Ej: Ingresaron 150 unidades según remisión RM-994. Stock normalizado en 150 unidades."
                className="w-full bg-white border border-emerald-200 rounded-xl p-3 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActionTab('info')}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !solutionNotes.trim()}
                  className="px-4 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all disabled:opacity-50"
                >
                  {isSubmitting ? 'Guardando...' : 'Marcar como Resuelta'}
                </button>
              </div>
            </form>
          )}

          {/* Alert Description Box */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-1.5">
            <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Descripción del Evento</h3>
            <p className="text-xs sm:text-sm text-slate-800 leading-relaxed font-medium">{alert.description}</p>
          </div>

          {/* Related Entity Card with Navigation */}
          {navTarget && (
            <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-4 flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <p className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">Registro Relacionado</p>
                <p className="text-xs sm:text-sm font-bold text-slate-900">
                  {alert.entityType}: <span className="font-mono text-blue-600">{alert.entityReference}</span>
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  onClose()
                  router.push(navTarget.path)
                }}
                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shrink-0 transition-all shadow-xs hover:scale-105 active:scale-95"
              >
                <AppIcon name={navTarget.icon} size={15} />
                <span>{navTarget.label}</span>
                <AppIcon name="arrowUpRight" size={13} />
              </button>
            </div>
          )}

          {/* Context Metadata Cards */}
          {alert.metadata && Object.keys(alert.metadata).length > 0 && (
            <div className="space-y-2">
              <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Detalles Específicos</h3>
              <div className="grid grid-cols-2 gap-2.5">
                {Object.entries(alert.metadata).map(([key, val]) => (
                  <div key={key} className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
                    <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider font-semibold">{key}</p>
                    <p className="text-xs font-bold text-slate-900 truncate mt-0.5">
                      {(typeof val === 'number' && (key.toLowerCase().includes('balance') || key.toLowerCase().includes('cash') || key.toLowerCase().includes('total') || key.toLowerCase().includes('difference')))
                        ? `$${val.toLocaleString('es-CO')}`
                        : String(val)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Solution Notes if Resolved */}
          {alert.solutionNotes && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-1.5">
              <div className="flex items-center gap-1.5 text-emerald-800 font-bold text-xs">
                <AppIcon name="check" size={14} />
                <span>Solución Registrada</span>
                {alert.resolvedByUserName && <span className="text-slate-500 font-normal">• por {alert.resolvedByUserName}</span>}
              </div>
              <p className="text-xs text-emerald-950 leading-relaxed font-medium">{alert.solutionNotes}</p>
            </div>
          )}

          {/* Attended comment if In Progress */}
          {alert.attendedComment && !alert.solutionNotes && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 space-y-1.5">
              <div className="flex items-center gap-1.5 text-amber-800 font-bold text-xs">
                <AppIcon name="users" size={14} />
                <span>En Proceso de Atención</span>
                {alert.attendedByUserName && <span className="text-slate-500 font-normal">• por {alert.attendedByUserName}</span>}
              </div>
              <p className="text-xs text-amber-950 leading-relaxed font-medium">{alert.attendedComment}</p>
            </div>
          )}

          {/* Timeline / Activity History */}
          <div className="space-y-3 pt-2">
            <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Historial de Seguimiento</h3>
            <div className="space-y-3 border-l-2 border-slate-200 ml-2 pl-4">
              {alert.history?.map((hist, idx) => (
                <div key={idx} className="relative space-y-0.5">
                  <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-slate-300 border-2 border-white ring-2 ring-slate-100" />
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">{hist.actor}</span>
                    <span className="text-[10px] font-mono text-slate-500 font-medium">
                      {new Date(hist.timestamp).toLocaleDateString('es-CO', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-700">
                    {hist.action}
                  </span>
                  {hist.notes && <p className="text-xs text-slate-600 mt-1 font-normal">{hist.notes}</p>}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Drawer Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 font-medium">
            Creada: {new Date(alert.createdAt).toLocaleDateString('es-CO')}
          </div>

          <div className="flex items-center gap-2">
            {alert.status === 'RESOLVED' && (
              <button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors"
              >
                Cerrar Administrativamente
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white transition-all shadow-xs"
            >
              Listo
            </button>
          </div>
        </div>
      </aside>
    </>,
    document.body
  )
}
