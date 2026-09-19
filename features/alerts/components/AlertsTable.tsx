'use client'

import React from 'react'
import { AppIcon, LightIconName } from '@/components/ui/Icon'
import { AlertItem, AlertPriority, AlertStatus, AlertModule } from '../types'

interface AlertsTableProps {
  alerts: AlertItem[]
  total: number
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  onSelectAlert: (alert: AlertItem) => void
  onMarkRead: (alertId: string) => void
}

const PRIORITY_BADGES: Record<AlertPriority, { label: string; class: string }> = {
  CRITICA: {
    label: 'Crítica',
    class: 'bg-rose-50 text-rose-700 border-rose-200',
  },
  ALTA: {
    label: 'Alta',
    class: 'bg-orange-50 text-orange-700 border-orange-200',
  },
  MEDIA: {
    label: 'Media',
    class: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  BAJA: {
    label: 'Baja',
    class: 'bg-slate-100 text-slate-700 border-slate-200',
  },
}

const STATUS_BADGES: Record<AlertStatus, { label: string; class: string }> = {
  NEW: {
    label: 'Nueva',
    class: 'bg-rose-50 text-rose-700 border-rose-200',
  },
  READ: {
    label: 'Leída',
    class: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  IN_PROGRESS: {
    label: 'En atención',
    class: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  RESOLVED: {
    label: 'Resuelta',
    class: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  CLOSED: {
    label: 'Cerrada',
    class: 'bg-slate-100 text-slate-600 border-slate-200',
  },
}

const MODULE_ICONS: Record<AlertModule, LightIconName> = {
  INVENTORY: 'inventory',
  PURCHASES: 'purchases',
  SALES: 'sales',
  INVOICING: 'invoices',
  CASH: 'cashRegisters',
  WEB_ORDERS: 'webOrders',
  TRANSFERS: 'transfers',
  ACCOUNTING: 'accounting',
}

export function AlertsTable({
  alerts,
  total,
  page,
  pageSize,
  onPageChange,
  onSelectAlert,
  onMarkRead,
}: AlertsTableProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  if (alerts.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center space-y-3 shadow-xs">
        <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100 shadow-2xs">
          <AppIcon name="check" size={28} />
        </div>
        <h3 className="text-base font-bold text-slate-900">Todo en orden</h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto font-medium leading-relaxed">
          No hay alertas activas que coincidan con los filtros seleccionados. El sistema se encuentra bajo parámetros normales.
        </p>
      </div>
    )
  }

  return (
    <div className="table-panel animated-table page-enter">
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th style={{ width: 140 }}>Prioridad / Código</th>
              <th>Módulo & Situación</th>
              <th>Sede / Bodega</th>
              <th>Fecha</th>
              <th>Estado</th>
              <th>Responsable</th>
              <th style={{ textAlign: 'right', width: 120 }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {alerts.map((alert) => {
              const priorityBadge = PRIORITY_BADGES[alert.priority]
              const statusBadge = STATUS_BADGES[alert.status]
              const isNew = alert.status === 'NEW'

              return (
                <tr
                  key={alert.id}
                  className={`hover:bg-slate-50/80 transition-colors group cursor-pointer ${
                    isNew ? 'bg-rose-50/20' : ''
                  }`}
                  onClick={() => onSelectAlert(alert)}
                >
                  {/* Prioridad y Código */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {isNew && <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0 animate-ping" />}
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border ${priorityBadge.class}`}
                      >
                        {priorityBadge.label}
                      </span>
                      <span className="font-mono text-xs font-semibold text-slate-500">{alert.code}</span>
                    </div>
                  </td>

                  {/* Módulo y Título */}
                  <td className="py-3.5 px-4 min-w-[260px]">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 text-slate-600 mt-0.5 border border-slate-200 shadow-2xs group-hover:bg-blue-50 group-hover:text-blue-600 group-hover:border-blue-200 transition-colors">
                        <AppIcon name={MODULE_ICONS[alert.module] || 'alerts'} size={16} />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1 text-xs sm:text-sm">
                          {alert.title}
                        </p>
                        <p className="text-xs text-slate-500 line-clamp-1 mt-0.5 font-normal">
                          {alert.description}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Bodega */}
                  <td className="py-3.5 px-4 whitespace-nowrap text-slate-700 text-xs font-medium">
                    {alert.locationName || 'Consolidado General'}
                  </td>

                  {/* Fecha */}
                  <td className="py-3.5 px-4 whitespace-nowrap text-slate-500 text-xs font-mono font-medium">
                    {new Date(alert.createdAt).toLocaleDateString('es-CO', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>

                  {/* Estado */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${statusBadge.class}`}
                    >
                      {statusBadge.label}
                    </span>
                  </td>

                  {/* Responsable */}
                  <td className="py-3.5 px-4 whitespace-nowrap text-xs">
                    {alert.assignedUserName ? (
                      <span className="font-semibold text-slate-800">{alert.assignedUserName}</span>
                    ) : (
                      <span className="text-slate-400 italic">Sin asignar</span>
                    )}
                  </td>

                  {/* Acciones */}
                  <td
                    className="py-3.5 px-4 text-right whitespace-nowrap"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      {isNew && (
                        <button
                          type="button"
                          onClick={() => onMarkRead(alert.id)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-200 transition-all duration-200 hover:scale-105 active:scale-95 shadow-2xs"
                          title="Marcar como leída"
                          aria-label="Marcar leída"
                        >
                          <AppIcon name="check" size={15} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onSelectAlert(alert)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 border border-slate-200 transition-all duration-200 hover:scale-105 active:scale-95 shadow-2xs"
                      >
                        Ver detalle
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-200 bg-slate-50 text-xs text-slate-600">
        <div>
          Mostrando{' '}
          <strong className="text-slate-900 font-semibold">
            {Math.min(total, (page - 1) * pageSize + 1)} - {Math.min(total, page * pageSize)}
          </strong>{' '}
          de <strong className="text-slate-900 font-semibold">{total}</strong> alertas
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="p-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-2xs"
            aria-label="Página anterior"
          >
            <AppIcon name="chevronLeft" size={14} />
          </button>

          <span className="px-3 py-1 rounded-md bg-white border border-slate-200 font-bold text-xs text-slate-800 shadow-2xs">
            Página {page} de {totalPages}
          </span>

          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="p-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-2xs"
            aria-label="Página siguiente"
          >
            <AppIcon name="chevronRight" size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
