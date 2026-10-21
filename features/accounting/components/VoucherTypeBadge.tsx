import React from 'react'
import { AccountingVoucherType } from '../types'

interface VoucherTypeBadgeProps {
  code?: string
  /** Catálogo de la empresa: aporta el nombre del tipo para el título accesible. */
  voucherTypes?: AccountingVoucherType[]
  className?: string
}

/** Código del tipo de comprobante (FC, CC, RV...) con su nombre como descripción accesible. */
export function VoucherTypeBadge({ code, voucherTypes = [], className = '' }: VoucherTypeBadgeProps) {
  if (!code) return null
  const name = voucherTypes.find((vt) => vt.code === code)?.name
  const label = name ? `${code} — ${name}` : code

  return (
    <span
      className={`inline-flex items-center justify-center min-w-[2.25rem] px-1.5 py-0.5 rounded-md border border-blue-200 bg-white font-mono text-[10px] font-bold tracking-wide text-blue-900 transition-colors duration-150 motion-reduce:transition-none ${className}`}
      title={label}
      aria-label={`Tipo de comprobante ${label}`}
    >
      {code}
    </span>
  )
}
