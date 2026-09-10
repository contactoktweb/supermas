'use client'

import React, { useEffect, useState } from 'react'
import { AppIcon, LightIconName } from '@/components/ui/Icon'
import { PurchaseStats as PurchaseStatsType } from '../types'

interface PurchaseStatsProps {
  stats: PurchaseStatsType
}

interface PurchaseStatCardProps {
  title: string
  value: string | number
  iconName: LightIconName
  tone: 'blue' | 'red' | 'teal' | 'amber' | 'purple'
  badge: string
  note?: string
  isPositive?: boolean
  subtext?: string
  index: number
}

function useCountUp(target: number, duration: number = 600) {
  const [count, setCount] = useState(target)

  useEffect(() => {
    let startTimestamp: number | null = null
    const startVal = 0
    const endVal = target
    if (endVal === 0) {
      setCount(0)
      return
    }

    let animationFrameId: number

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp
      const progress = Math.min((timestamp - startTimestamp) / duration, 1)
      setCount(Math.floor(progress * (endVal - startVal) + startVal))
      if (progress < 1) {
        animationFrameId = requestAnimationFrame(step)
      } else {
        setCount(endVal)
      }
    }

    animationFrameId = requestAnimationFrame(step)
    return () => cancelAnimationFrame(animationFrameId)
  }, [target, duration])

  return count
}

function PurchaseStatCard({
  title,
  value,
  iconName,
  tone,
  badge,
  note,
  isPositive = true,
  subtext,
  index,
}: PurchaseStatCardProps) {
  return (
    <article
      className={`dashboard-kpi-card tone-${tone}`}
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      <div className="kpi-card-header">
        <div className={`kpi-icon-wrap ${tone}`}>
          <AppIcon name={iconName} size={18} />
        </div>
        <span className="kpi-scope-badge">{badge}</span>
      </div>

      <div className="kpi-card-body">
        <span className="kpi-card-title">{title}</span>
        <div className="kpi-value-row">
          <strong className="kpi-card-value">{value}</strong>
        </div>
      </div>

      <div className="kpi-card-footer">
        {note && (
          <span
            className={`kpi-trend-pill ${
              isPositive ? 'trend-positive' : 'trend-warning'
            }`}
          >
            <AppIcon
              name={isPositive ? 'arrowUpRight' : 'warning'}
              size={12}
            />
            <span>{note}</span>
          </span>
        )}
        {subtext && <span className="kpi-subtext">{subtext}</span>}
      </div>
    </article>
  )
}

export function PurchaseStats({ stats }: PurchaseStatsProps) {
  const animatedPurchasedAmount = useCountUp(stats.totalPurchasedPeriod)
  const animatedPendingReception = useCountUp(stats.pendingReceptionCount)
  const animatedCreditPurchases = useCountUp(stats.creditPurchasesCount)
  const animatedCashPurchases = useCountUp(stats.cashPurchasesCount)
  const animatedPendingInvoices = useCountUp(stats.pendingPaymentInvoicesCount)
  const animatedOverdueInvoices = useCountUp(stats.overdueInvoicesCount)
  const animatedReceivedUnits = useCountUp(stats.receivedProductsUnits)

  const formatCurrency = (val: number) => {
    if (stats.isCostRedacted) return 'Confidencial'
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(val)
  }

  return (
    <section
      className="stats-grid products-stats-grid page-enter"
      aria-label="Métricas de compras y proveedores"
    >
      {/* 1. Total comprado del periodo */}
      <PurchaseStatCard
        title="Total comprado del periodo"
        value={formatCurrency(animatedPurchasedAmount)}
        iconName="purchases"
        tone="blue"
        badge="Inversión"
        note="Compras aprobadas"
        isPositive={true}
        subtext="Total facturado a proveedores"
        index={1}
      />

      {/* 2. Compras pendientes de recepción */}
      <PurchaseStatCard
        title="Pendientes de recepción"
        value={animatedPendingReception.toLocaleString('es-CO')}
        iconName="warehouse"
        tone="amber"
        badge="Por ingresar"
        note="Física pendiente"
        isPositive={false}
        subtext="Mercancía emitida sin recibir"
        index={2}
      />

      {/* 3. Compras crédito */}
      <PurchaseStatCard
        title="Compras crédito"
        value={animatedCreditPurchases.toLocaleString('es-CO')}
        iconName="wallet"
        tone="purple"
        badge="Obligaciones"
        note="Cuentas por pagar"
        isPositive={true}
        subtext="Facturas con plazo otorgado"
        index={3}
      />

      {/* 4. Compras contado */}
      <PurchaseStatCard
        title="Compras contado"
        value={animatedCashPurchases.toLocaleString('es-CO')}
        iconName="receipt"
        tone="teal"
        badge="Inmediato"
        note="Pagadas al emitir"
        isPositive={true}
        subtext="Liquidación de caja"
        index={4}
      />

      {/* 5. Facturas pendientes de pago */}
      <PurchaseStatCard
        title="Facturas pendientes de pago"
        value={animatedPendingInvoices.toLocaleString('es-CO')}
        iconName="invoices"
        tone="amber"
        badge="Por liquidar"
        note="Con saldo pendiente"
        isPositive={false}
        subtext="Obligaciones comerciales vivas"
        index={5}
      />

      {/* 6. Facturas vencidas */}
      <PurchaseStatCard
        title="Facturas vencidas"
        value={animatedOverdueInvoices.toLocaleString('es-CO')}
        iconName="warning"
        tone="red"
        badge="Alerta mora"
        note={animatedOverdueInvoices > 0 ? 'Prioridad pago' : 'Al día'}
        isPositive={animatedOverdueInvoices === 0}
        subtext="Plazo de crédito superado"
        index={6}
      />

      {/* 7. Productos ingresados */}
      <PurchaseStatCard
        title="Productos ingresados"
        value={`${animatedReceivedUnits.toLocaleString('es-CO')} uds`}
        iconName="inventory"
        tone="teal"
        badge="Físico"
        note="Kardex actualizado"
        isPositive={true}
        subtext="Unidades recibidas en bodega"
        index={7}
      />
    </section>
  )
}
