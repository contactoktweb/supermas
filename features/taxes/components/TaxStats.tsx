'use client'

import React from 'react'
import { AppIcon, LightIconName } from '@/components/ui/Icon'
import { TaxStats as TaxStatsData } from '../types'
import { useCountUp } from '@/features/warehouses/hooks/useCountUp'

interface TaxStatsProps {
  stats: TaxStatsData
}

export function TaxStats({ stats }: TaxStatsProps) {
  return (
    <section className="stats-grid products-stats" aria-label="Estadísticas tributarias generales">
      <StatCard
        title="Configuraciones activas"
        value={stats.activeConfigsCount}
        note="Tarifas vigentes"
        iconName="taxes"
        tone="blue"
        tooltip="Cantidad de perfiles y tarifas tributarias activas para facturación y compras."
      />

      <StatCard
        title="Productos gravados"
        value={stats.taxedProductsCount}
        note="Causan IVA/INC"
        iconName="products"
        tone="teal"
        tooltip="Productos del catálogo que causan IVA (tarifa 19%, 5% o similar)."
      />

      <StatCard
        title="Productos excluidos"
        value={stats.exemptProductsCount}
        note="Exentos o excluidos (0%)"
        iconName="inventory"
        tone="amber"
        tooltip="Bienes exentos (Art. 477 ET) o excluidos (Art. 424 ET) sin tarifa de IVA."
      />

      <StatCard
        title="Ventas con impuestos"
        value={stats.salesWithTaxesCount}
        note="Facturas emitidas"
        iconName="sales"
        tone="blue"
        tooltip="Total de ventas que liquidaron impuesto generado en el periodo."
      />

      <StatCard
        title="Compras con impuestos"
        value={stats.purchasesWithTaxesCount}
        note="Facturas de proveedor"
        iconName="purchases"
        tone="teal"
        tooltip="Total de órdenes de compra con IVA descontable soportado."
      />

      <StatCard
        title="Impuesto generado (Ventas)"
        value={stats.generatedTaxPeriod}
        isCurrency
        note="IVA Débito Fiscal"
        iconName="dollar"
        tone="red"
        tooltip="Total de IVA liquidado y recaudado a favor de la DIAN por concepto de ventas."
      />

      <StatCard
        title="Impuesto descontable (Compras)"
        value={stats.deductibleTaxPeriod}
        isCurrency
        note="IVA Crédito Fiscal"
        iconName="creditCard"
        tone="teal"
        tooltip="Total de IVA pagado a proveedores con derecho a deducción fiscal."
      />
    </section>
  )
}

interface StatCardProps {
  title: string
  value: number
  isCurrency?: boolean
  note: string
  iconName: LightIconName
  tone: 'blue' | 'teal' | 'amber' | 'red'
  tooltip: string
}

function StatCard({
  title,
  value,
  isCurrency = false,
  note,
  iconName,
  tone,
  tooltip,
}: StatCardProps) {
  const animatedValue = useCountUp(value, {
    isCurrency,
    duration: 850,
  })

  return (
    <article className="stat-card" title={tooltip}>
      <div className={`stat-icon ${tone}`}>
        <AppIcon name={iconName} size={18} />
      </div>
      <div className="stat-text">
        <span>{title}</span>
        <strong>{animatedValue}</strong>
        <small className={tone === 'red' ? 'warning-text' : 'positive'}>
          <AppIcon
            name={tone === 'red' ? 'warning' : 'arrowUpRight'}
            size={13}
          />
          {note}
        </small>
      </div>
      <svg className="sparkline" viewBox="0 0 90 30" aria-hidden="true">
        <polyline points="0,25 15,20 30,22 45,14 60,18 75,9 90,4" />
      </svg>
    </article>
  )
}
