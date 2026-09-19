'use client'

import React from 'react'
import { AppIcon, LightIconName } from '@/components/ui/Icon'
import { AccountingDashboard, WarehouseFinancialSummary } from '../../types'
import { useCountUp } from '@/features/warehouses/hooks/useCountUp'

interface AccountingDashboardTabProps {
  dashboard: AccountingDashboard | null
  onNavigateToTab: (tab: any) => void
}

export function AccountingDashboardTab({ dashboard, onNavigateToTab }: AccountingDashboardTabProps) {
  if (!dashboard) return null

  return (
    <div className="accounting-dashboard-view space-y-6 page-enter">
      {/* Grid principal de 9 indicadores financieros */}
      <section className="stats-grid products-stats" aria-label="Indicadores financieros principales">
        <StatCard
          title="Activos Totales"
          value={dashboard.totalAssets}
          isCurrency
          note="Clase 1 PUC"
          iconName="wallet"
          tone="blue"
          tooltip="Total de recursos económicos controlados: disponible, cartera, inventarios y equipos."
          onClick={() => onNavigateToTab('balance')}
        />

        <StatCard
          title="Pasivos Totales"
          value={dashboard.totalLiabilities}
          isCurrency
          note="Clase 2 PUC"
          iconName="creditCard"
          tone="amber"
          tooltip="Obligaciones presentes: proveedores, tributos por pagar, costos causados y nómina."
          onClick={() => onNavigateToTab('balance')}
        />

        <StatCard
          title="Patrimonio Neto"
          value={dashboard.totalEquity}
          isCurrency
          note="Clase 3 PUC"
          iconName="layers"
          tone="teal"
          tooltip="Capital social suscrito, reservas y resultados acumulados de Super Más S.A.S."
          onClick={() => onNavigateToTab('balance')}
        />

        <StatCard
          title="Ingresos Operacionales"
          value={dashboard.totalRevenues}
          isCurrency
          note="Clase 4 PUC"
          iconName="dollar"
          tone="teal"
          tooltip="Ventas netas facturadas de mercancías al por mayor y detal en el periodo."
          onClick={() => onNavigateToTab('results')}
        />

        <StatCard
          title="Costos de Ventas"
          value={dashboard.totalCosts}
          isCurrency
          note="Clase 6 PUC"
          iconName="purchases"
          tone="red"
          tooltip="Costo promedio de adquisición de las mercancías entregadas a clientes."
          onClick={() => onNavigateToTab('costs')}
        />

        <StatCard
          title="Gastos Operacionales"
          value={dashboard.totalExpenses}
          isCurrency
          note="Clase 5 PUC"
          iconName="taxes"
          tone="amber"
          tooltip="Gastos de administración, personal, arrendamientos, servicios públicos y logística."
          onClick={() => onNavigateToTab('results')}
        />

        <StatCard
          title="Utilidad Neta Periodo"
          value={dashboard.netProfit}
          isCurrency
          note={`Margen ${dashboard.profitMarginPercent}%`}
          iconName="pieChart"
          tone={dashboard.netProfit >= 0 ? 'teal' : 'red'}
          tooltip="Resultado neto después de costos y gastos operacionales."
          onClick={() => onNavigateToTab('results')}
        />

        <StatCard
          title="Inventario Valorizado"
          value={dashboard.totalValuedInventory}
          isCurrency
          note="Cuenta 1435"
          iconName="inventory"
          tone="blue"
          tooltip="Valor contable total de existencias en bodegas evaluadas a costo promedio."
          onClick={() => onNavigateToTab('costs')}
        />

        <StatCard
          title="Cuentas por Cobrar (CxC)"
          value={dashboard.accountsReceivableTotal}
          isCurrency
          note="Cuenta 1305"
          iconName="customers"
          tone="blue"
          tooltip="Cartera comercial pendiente de recaudo de clientes mayoristas."
          onClick={() => onNavigateToTab('receivables_payables')}
        />

        <StatCard
          title="Cuentas por Pagar (CxP)"
          value={dashboard.accountsPayableTotal}
          isCurrency
          note="Cuenta 2205"
          iconName="suppliers"
          tone="red"
          tooltip="Obligaciones pendientes con proveedores de mercancías."
          onClick={() => onNavigateToTab('receivables_payables')}
        />
      </section>

      {/* Gráfico y Métricas de Rendimiento Financiero */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gráfico de Barras Ingresos vs Costos */}
        <section className="col-span-2 dashboard-card" aria-label="Evolución financiera mensual">
          <div className="flex items-center justify-between border-b pb-4 mb-4">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Evolución de Ingresos vs. Costos y Gastos</h2>
              <p className="text-xs text-gray-500">Comportamiento financiero mensual consolidado (COP)</p>
            </div>
            <div className="flex items-center gap-4 text-xs font-medium">
              <span className="flex items-center gap-1.5 text-emerald-600">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Ingresos
              </span>
              <span className="flex items-center gap-1.5 text-rose-500">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" /> Costos
              </span>
              <span className="flex items-center gap-1.5 text-amber-500">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" /> Gastos
              </span>
            </div>
          </div>

          {/* Contenedor del Gráfico con Escala Dinámica y Líneas Guía */}
          {(() => {
            const highestValue = Math.max(
              ...dashboard.monthlyFinancials.map((pt) => Math.max(pt.revenue, pt.cost, pt.expenses, 0)),
              1
            )
            const maxVal = highestValue * 1.15

            return (
              <div className="relative h-64 pt-6 px-2">
                {/* Líneas guía horizontales de referencia */}
                <div className="absolute inset-x-2 top-6 bottom-9 flex flex-col justify-between pointer-events-none opacity-40">
                  <div className="border-b border-dashed border-slate-300 w-full" />
                  <div className="border-b border-dashed border-slate-300 w-full" />
                  <div className="border-b border-dashed border-slate-300 w-full" />
                  <div className="border-b border-slate-300 w-full" />
                </div>

                <div className="relative z-10 h-full flex items-end justify-between gap-3 pb-1">
                  {dashboard.monthlyFinancials.map((pt) => {
                    const revHeight = Math.min(100, Math.max(4, (pt.revenue / maxVal) * 100))
                    const costHeight = Math.min(100, Math.max(4, (pt.cost / maxVal) * 100))
                    const expHeight = Math.min(100, Math.max(4, (pt.expenses / maxVal) * 100))

                    return (
                      <div key={pt.month} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
                        <div className="w-full flex items-end justify-center gap-1.5 h-44">
                          {/* Barra Ingresos */}
                          <div
                            style={{ height: `${revHeight}%`, maxHeight: '100%' }}
                            className="w-full max-w-[18px] bg-emerald-500 hover:bg-emerald-600 rounded-t transition-all duration-300 relative group/bar shadow-2xs cursor-pointer"
                            title={`Ingresos (${pt.label}): $${pt.revenue.toLocaleString('es-CO')} COP`}
                          />
                          {/* Barra Costos */}
                          <div
                            style={{ height: `${costHeight}%`, maxHeight: '100%' }}
                            className="w-full max-w-[18px] bg-rose-500 hover:bg-rose-600 rounded-t transition-all duration-300 shadow-2xs cursor-pointer"
                            title={`Costos (${pt.label}): $${pt.cost.toLocaleString('es-CO')} COP`}
                          />
                          {/* Barra Gastos */}
                          <div
                            style={{ height: `${expHeight}%`, maxHeight: '100%' }}
                            className="w-full max-w-[18px] bg-amber-500 hover:bg-amber-600 rounded-t transition-all duration-300 shadow-2xs cursor-pointer"
                            title={`Gastos (${pt.label}): $${pt.expenses.toLocaleString('es-CO')} COP`}
                          />
                        </div>
                        <span className="text-xs font-bold text-slate-500 group-hover:text-slate-900 transition-colors">
                          {pt.label}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}

          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <span>Cálculo automático desde asientos contables POSTED</span>
            <span className="font-medium text-gray-700">Margen promedio actual: {dashboard.profitMarginPercent}%</span>
          </div>
        </section>

        {/* Resumen de Comprobantes y Estado Contable */}
        <section className="dashboard-card flex flex-col justify-between" aria-label="Resumen operativo contable">
          <div>
            <h2 className="text-base font-semibold text-gray-900 mb-1">Estado de Operaciones</h2>
            <p className="text-xs text-gray-500 mb-4">Garantía de integridad y partida doble</p>

            <div className="space-y-3">
              <div className="p-3 bg-gray-50 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                    <AppIcon name="check" size={16} />
                  </div>
                  <div>
                    <strong className="block text-xs text-gray-900">Asientos Confirmados</strong>
                    <span className="text-[11px] text-gray-500">Comprobantes oficiales</span>
                  </div>
                </div>
                <b className="text-sm text-gray-900">{dashboard.postedEntriesCount}</b>
              </div>

              <div className="p-3 bg-gray-50 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <AppIcon name="wallet" size={16} />
                  </div>
                  <div>
                    <strong className="block text-xs text-gray-900">Disponible (Caja y Bancos)</strong>
                    <span className="text-[11px] text-gray-500">Cuentas 1105 / 1110</span>
                  </div>
                </div>
                <b className="text-sm text-emerald-700">${dashboard.cashAndBanksTotal.toLocaleString('es-CO')}</b>
              </div>

              <div className="p-3 bg-gray-50 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center">
                    <AppIcon name="taxes" size={16} />
                  </div>
                  <div>
                    <strong className="block text-xs text-gray-900">IVA por Pagar Neto</strong>
                    <span className="text-[11px] text-gray-500">Generado - Descontable</span>
                  </div>
                </div>
                <b className="text-sm text-rose-700">${dashboard.taxPayableTotal.toLocaleString('es-CO')}</b>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t mt-4 flex gap-2">
            <button
              type="button"
              className="flex-1 py-2 text-xs font-medium rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors flex items-center justify-center gap-1.5"
              onClick={() => onNavigateToTab('journal')}
            >
              <AppIcon name="fileText" size={14} />
              <span>Ver Libro Diario</span>
            </button>
            <button
              type="button"
              className="flex-1 py-2 text-xs font-medium rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors flex items-center justify-center gap-1.5"
              onClick={() => onNavigateToTab('accounts')}
            >
              <AppIcon name="layers" size={14} />
              <span>Explorar PUC</span>
            </button>
          </div>
        </section>
      </div>

      {/* Resumen Financiero por Bodega */}
      <section className="dashboard-card" aria-label="Contabilidad por bodega">
        <div className="flex items-center justify-between border-b pb-3 mb-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Contabilidad Desglosada por Bodega / Centro de Costos</h2>
            <p className="text-xs text-gray-500">Análisis multidimensional de ventas, costos, inventario y utilidad por ubicación</p>
          </div>
          <button
            type="button"
            className="text-xs text-blue-600 hover:underline flex items-center gap-1 font-medium"
            onClick={() => onNavigateToTab('costs')}
          >
            <span>Ver análisis detallado de costos</span>
            <AppIcon name="chevronRight" size={12} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {dashboard.warehouseBreakdown.map((wh) => (
            <WarehouseCard key={wh.locationId} summary={wh} onInspect={() => onNavigateToTab('costs')} />
          ))}
        </div>
      </section>
    </div>
  )
}

function StatCard({
  title,
  value,
  isCurrency = false,
  note,
  iconName,
  tone,
  tooltip,
  onClick,
}: {
  title: string
  value: number
  isCurrency?: boolean
  note: string
  iconName: LightIconName
  tone: 'blue' | 'teal' | 'amber' | 'red'
  tooltip: string
  onClick?: () => void
}) {
  const animatedValue = useCountUp(value, { isCurrency, duration: 750 })

  return (
    <article
      className="stat-card cursor-pointer transition-transform hover:-translate-y-0.5"
      title={tooltip}
      onClick={onClick}
    >
      <div className={`stat-icon ${tone}`}>
        <AppIcon name={iconName} size={18} />
      </div>
      <div className="stat-text">
        <span>{title}</span>
        <strong>{animatedValue}</strong>
        <small className={tone === 'red' ? 'warning-text' : 'positive'}>
          <AppIcon name={tone === 'red' ? 'warning' : 'arrowUpRight'} size={13} />
          {note}
        </small>
      </div>
      <svg className="sparkline" viewBox="0 0 90 30" aria-hidden="true">
        <polyline points="0,25 15,20 30,22 45,14 60,18 75,9 90,4" />
      </svg>
    </article>
  )
}

function WarehouseCard({
  summary,
  onInspect,
}: {
  summary: WarehouseFinancialSummary
  onInspect: () => void
}) {
  return (
    <div className="p-4 rounded-xl border border-gray-100 bg-white hover:border-blue-200 transition-all hover:shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-xs">
            {summary.locationCode.substring(0, 3)}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 leading-tight">{summary.locationName}</h3>
            <span className="text-[11px] text-gray-400">{summary.type === 'WAREHOUSE' ? 'Centro Logístico (CEDI)' : 'Punto de Venta'}</span>
          </div>
        </div>
        <span className="px-2 py-0.5 text-[11px] font-semibold rounded bg-emerald-50 text-emerald-700">
          Margen {summary.marginPercent}%
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs py-2 border-y border-gray-50 my-2">
        <div>
          <span className="text-gray-400 block text-[11px]">Ventas del Mes</span>
          <b className="text-gray-800 font-medium">${summary.salesTotal.toLocaleString('es-CO')}</b>
        </div>
        <div>
          <span className="text-gray-400 block text-[11px]">Costo de Ventas</span>
          <b className="text-gray-800 font-medium">${summary.costsTotal.toLocaleString('es-CO')}</b>
        </div>
        <div>
          <span className="text-gray-400 block text-[11px]">Utilidad Bruta</span>
          <b className="text-emerald-700 font-medium">${summary.grossProfit.toLocaleString('es-CO')}</b>
        </div>
        <div>
          <span className="text-gray-400 block text-[11px]">Inventario Costo</span>
          <b className="text-blue-700 font-medium">${summary.inventoryValued.toLocaleString('es-CO')}</b>
        </div>
      </div>

      <button
        type="button"
        className="w-full text-center text-xs text-blue-600 font-medium pt-1 hover:underline"
        onClick={onInspect}
      >
        Analizar inventario y costos
      </button>
    </div>
  )
}
