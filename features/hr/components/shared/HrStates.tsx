'use client'

import React from 'react'
import Link from 'next/link'
import { AppIcon, type LightIconName } from '@/components/ui/Icon'

interface HrEmptyStateProps {
  icon: LightIconName
  title: string
  description: string
  action?: React.ReactNode
}

export function HrEmptyState({ icon, title, description, action }: HrEmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center" role="status">
      <span className="grid h-12 w-12 place-items-center rounded-xl bg-[#e9eef8] text-[var(--navy)]" aria-hidden="true">
        <AppIcon name={icon} size={24} />
      </span>
      <h3 className="m-0 text-[15px] font-bold text-[var(--foreground)]">{title}</h3>
      <p className="m-0 max-w-md text-xs text-[var(--muted)]">{description}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

interface HrErrorBannerProps {
  message: string
  onRetry?: () => void
}

export function HrErrorBanner({ message, onRetry }: HrErrorBannerProps) {
  return (
    <div className="form-error-banner page-enter flex-wrap" role="alert">
      <AppIcon name="warning" size={16} />
      <span className="flex-1">{message}</span>
      {onRetry && (
        <button type="button" className="outline-button compact" onClick={onRetry}>
          <AppIcon name="refresh" size={14} />
          <span>Reintentar</span>
        </button>
      )}
    </div>
  )
}

/** Filas de carga para tablas (respeta prefers-reduced-motion). */
export function HrTableSkeleton({ rows = 6, columns }: { rows?: number; columns: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, index) => (
        <tr key={index} aria-hidden="true">
          <td colSpan={columns}>
            <div className="my-2 h-6 rounded-md bg-slate-100 motion-safe:animate-pulse" />
          </td>
        </tr>
      ))}
    </>
  )
}

export function HrCardSkeleton({ height = 136 }: { height?: number }) {
  return <div className="rounded-[14px] border border-[var(--line)] bg-slate-50 motion-safe:animate-pulse" style={{ height }} aria-hidden="true" />
}

/** Vista para usuarios sin permiso hr.read (la RLS igualmente devolvería datos vacíos). */
export function HrAccessDenied() {
  return (
    <section className="panel page-enter" aria-labelledby="hr-access-denied-title">
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-xl bg-red-50 text-[var(--red)]" aria-hidden="true">
          <AppIcon name="lock" size={24} />
        </span>
        <h1 id="hr-access-denied-title" className="m-0 text-xl font-bold">
          Acceso restringido
        </h1>
        <p className="m-0 max-w-md text-sm text-[var(--muted)]">
          El módulo de Recursos Humanos está disponible solo para los roles Recursos Humanos y Administrador.
        </p>
        <Link href="/" className="outline-button compact inline-flex items-center gap-2">
          <AppIcon name="dashboard" size={14} />
          <span>Volver al inicio</span>
        </Link>
      </div>
    </section>
  )
}
