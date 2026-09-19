'use client'

import React from 'react'
import { AppIcon, LightIconName } from '@/components/ui/Icon'
import { AlertStats, AlertModule } from '../types'
import { useCountUp } from '@/features/warehouses/hooks/useCountUp'

interface AlertsStatsProps {
  stats: AlertStats | null
  activeModule: AlertModule | 'ALL'
  onSelectModule: (mod: AlertModule | 'ALL') => void
  onFilterCritical: () => void
  onFilterNew: () => void
}

function StatCard({
  title,
  value,
  subtitle,
  iconName,
  tone,
  onClick,
  active,
}: {
  title: string
  value: number
  subtitle: string
  iconName: LightIconName
  tone: 'red' | 'rose' | 'amber' | 'emerald' | 'blue'
  onClick?: () => void
  active?: boolean
}) {
  const animatedValue = useCountUp(value, { duration: 700 })

  const toneClasses = {
    red: {
      bg: 'bg-rose-50/50 hover:bg-rose-50 border-rose-200/80',
      iconBg: 'bg-rose-100 text-rose-600',
      numColor: 'text-rose-700',
      activeRing: 'ring-2 ring-rose-500/50 shadow-md',
    },
    rose: {
      bg: 'bg-red-50/50 hover:bg-red-50 border-red-200/80',
      iconBg: 'bg-red-100 text-red-600',
      numColor: 'text-red-700',
      activeRing: 'ring-2 ring-red-500/50 shadow-md',
    },
    amber: {
      bg: 'bg-amber-50/50 hover:bg-amber-50 border-amber-200/80',
      iconBg: 'bg-amber-100 text-amber-600',
      numColor: 'text-amber-700',
      activeRing: 'ring-2 ring-amber-500/50 shadow-md',
    },
    emerald: {
      bg: 'bg-emerald-50/50 hover:bg-emerald-50 border-emerald-200/80',
      iconBg: 'bg-emerald-100 text-emerald-600',
      numColor: 'text-emerald-700',
      activeRing: 'ring-2 ring-emerald-500/50 shadow-md',
    },
    blue: {
      bg: 'bg-blue-50/50 hover:bg-blue-50 border-blue-200/80',
      iconBg: 'bg-blue-100 text-blue-600',
      numColor: 'text-blue-700',
      activeRing: 'ring-2 ring-blue-500/50 shadow-md',
    },
  }[tone]

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={`rounded-2xl border p-4 bg-white transition-all duration-200 cursor-pointer select-none shadow-xs hover:shadow-md hover:-translate-y-0.5 ${
        toneClasses.bg
      } ${active ? toneClasses.activeRing : ''}`}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">{title}</p>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${toneClasses.numColor}`}>
              {animatedValue}
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium">{subtitle}</p>
        </div>

        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${toneClasses.iconBg}`}>
          <AppIcon name={iconName} size={20} />
        </div>
      </div>
    </div>
  )
}

const MODULE_LABELS: Record<AlertModule, { label: string; icon: LightIconName }> = {
  INVENTORY: { label: 'Inventario', icon: 'inventory' },
  PURCHASES: { label: 'Compras', icon: 'purchases' },
  SALES: { label: 'Ventas', icon: 'sales' },
  INVOICING: { label: 'Facturación', icon: 'invoices' },
  CASH: { label: 'Cajas', icon: 'cashRegisters' },
  WEB_ORDERS: { label: 'Pedidos Web', icon: 'webOrders' },
  TRANSFERS: { label: 'Traslados', icon: 'transfers' },
  ACCOUNTING: { label: 'Contabilidad', icon: 'accounting' },
}

export function AlertsStats({
  stats,
  activeModule,
  onSelectModule,
  onFilterCritical,
  onFilterNew,
}: AlertsStatsProps) {
  if (!stats) return null

  return (
    <section className="space-y-4" aria-label="Indicadores de alertas">
      {/* 4 Core KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <StatCard
          title="Nuevas Alertas"
          value={stats.totalNew}
          subtitle="Recién detectadas sin leer"
          iconName="alerts"
          tone="rose"
          onClick={onFilterNew}
        />
        <StatCard
          title="Alertas Críticas"
          value={stats.totalCritical}
          subtitle="Atención y solución prioritaria"
          iconName="warning"
          tone="red"
          onClick={onFilterCritical}
        />
        <StatCard
          title="Alertas Pendientes"
          value={stats.totalPending}
          subtitle="En proceso o leídas"
          iconName="chevronRight"
          tone="amber"
        />
        <StatCard
          title="Solucionadas"
          value={stats.totalResolved}
          subtitle="Resueltas y cerradas"
          iconName="check"
          tone="emerald"
        />
      </div>

      {/* Module Breakdown Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 scrollbar-thin">
        <button
          type="button"
          onClick={() => onSelectModule('ALL')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 flex items-center gap-1.5 transition-all duration-150 ${
            activeModule === 'ALL'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-200 shadow-2xs'
          }`}
        >
          <span>Todos los módulos</span>
          <span
            className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
              activeModule === 'ALL' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
            }`}
          >
            {stats.totalCount}
          </span>
        </button>

        {(Object.keys(MODULE_LABELS) as AlertModule[]).map((modKey) => {
          const mod = MODULE_LABELS[modKey]
          const count = stats.byModule[modKey] || 0
          const isActive = activeModule === modKey

          return (
            <button
              key={modKey}
              type="button"
              onClick={() => onSelectModule(modKey)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 flex items-center gap-1.5 transition-all duration-150 ${
                isActive
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-200 shadow-2xs'
              }`}
            >
              <AppIcon name={mod.icon} size={14} />
              <span>{mod.label}</span>
              {count > 0 && (
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    isActive ? 'bg-red-800/80 text-white' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </section>
  )
}
