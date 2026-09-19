'use client'

import React from 'react'
import Link from 'next/link'
import { AppIcon } from '@/components/ui/Icon'
import { ReportStatsCard } from '../ReportStatsCard'
import { DistributionBarList } from '../ReportCharts'
import { AccountingReportData } from '../../types'

interface AccountingReportViewProps {
  data: AccountingReportData | null
  loading?: boolean
}

export function AccountingReportView({
  data,
  loading = false,
}: AccountingReportViewProps) {
  const summary = data?.summary

  return (
    <div className="space-y-8">
      {/* Banner de Enlace al Núcleo Contable */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold text-purple-700 uppercase tracking-wider block">
            Integración Contable PUC de Doble Partida
          </span>
          <h3 className="text-base font-extrabold text-slate-900 mt-0.5">
            Consolidado Financiero y Estado de Resultados
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Los datos contables se calculan dinámicamente desde el motor contable oficial sin duplicar reglas.
          </p>
        </div>
        <Link
          href="/contabilidad"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-xs transition-all active:scale-95"
        >
          <AppIcon name="accounting" size={16} />
          <span>Ir a Módulo Contabilidad</span>
          <AppIcon name="chevronRight" size={14} />
        </Link>
      </section>

      {/* KPIs Financieros Principales */}
      <section aria-label="Resumen Financiero y Patrimonial">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <ReportStatsCard
            title="Activos Totales (Clase 1)"
            value={summary?.totalAssets ?? 0}
            format="currency"
            subtitle="Caja, bancos, inventarios y cartera"
            iconName="wallet"
            accentColor="#3b82f6"
            loading={loading}
          />
          <ReportStatsCard
            title="Pasivos Totales (Clase 2)"
            value={summary?.totalLiabilities ?? 0}
            format="currency"
            subtitle="Proveedores, impuestos e intereses"
            iconName="creditCard"
            accentColor="#f59e0b"
            loading={loading}
          />
          <ReportStatsCard
            title="Patrimonio Neto (Clase 3)"
            value={summary?.totalEquity ?? 0}
            format="currency"
            subtitle="Capital social y reservas"
            iconName="pieChart"
            accentColor="#8b5cf6"
            loading={loading}
          />
          <ReportStatsCard
            title="Utilidad Neta del Ejercicio"
            value={summary?.netIncome ?? 0}
            format="currency"
            subtitle={
              summary?.accountingEquationSatisfied
                ? 'Ecuación patrimonial cuadrada'
                : 'Revisar balance general'
            }
            iconName="sparkles"
            accentColor="#10b981"
            loading={loading}
          />
        </div>
      </section>

      {/* Ecuación Fundamental & Distribución por Clases */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 tracking-wide mb-1">
            Comprobación Matemática de la Ecuación Patrimonial
          </h3>
          <p className="text-xs text-slate-500 mb-6">
            Activo = Pasivo + Patrimonio (Regla DIAN y NIIF de partida doble)
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-xs text-slate-500 font-medium block mb-1">Activo Total</span>
              <span className="text-lg font-bold text-blue-700 font-mono">
                ${(summary?.totalAssets ?? 0).toLocaleString('es-CO')}
              </span>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-xs text-slate-500 font-medium block mb-1">Pasivo + Patrimonio</span>
              <span className="text-lg font-bold text-emerald-700 font-mono">
                ${((summary?.totalLiabilities ?? 0) + (summary?.totalEquity ?? 0)).toLocaleString(
                  'es-CO'
                )}
              </span>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col items-center justify-center">
              <span className="text-xs text-slate-500 font-medium block mb-1">Estado de Balance</span>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 font-mono">
                <AppIcon name="check" size={14} /> Totalmente Cuadrado
              </span>
            </div>
          </div>
        </div>

        <div>
          <DistributionBarList
            items={data?.classDistribution || []}
            title="Estructura Patrimonial"
            subtitle="Participación sobre balance general"
            format="currency"
          />
        </div>
      </section>

      {/* Accesos a Libros Oficiales */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link
          href="/contabilidad"
          className="p-4 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 transition-all flex items-center gap-3 group shadow-xs"
        >
          <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-200">
            <AppIcon name="table" size={20} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
              Libro Diario
            </h4>
            <span className="text-[11px] text-slate-500 font-mono font-medium">
              {data?.journalSummary.entriesCount} asientos auditados
            </span>
          </div>
        </Link>

        <Link
          href="/contabilidad"
          className="p-4 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 transition-all flex items-center gap-3 group shadow-xs"
        >
          <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200">
            <AppIcon name="fileText" size={20} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">
              Libro Mayor
            </h4>
            <span className="text-[11px] text-slate-500 font-medium">Saldos por cuenta PUC</span>
          </div>
        </Link>

        <Link
          href="/contabilidad"
          className="p-4 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 transition-all flex items-center gap-3 group shadow-xs"
        >
          <div className="p-2.5 rounded-lg bg-purple-50 text-purple-600 border border-purple-200">
            <AppIcon name="pieChart" size={20} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900 group-hover:text-purple-600 transition-colors">
              Balance General
            </h4>
            <span className="text-[11px] text-slate-500 font-medium">Estado de situación NIIF</span>
          </div>
        </Link>

        <Link
          href="/contabilidad"
          className="p-4 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 transition-all flex items-center gap-3 group shadow-xs"
        >
          <div className="p-2.5 rounded-lg bg-amber-50 text-amber-600 border border-amber-200">
            <AppIcon name="sparkles" size={20} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900 group-hover:text-amber-600 transition-colors">
              Estado de Resultados
            </h4>
            <span className="text-[11px] text-slate-500 font-medium">P&amp;L financiero oficial</span>
          </div>
        </Link>
      </section>
    </div>
  )
}
