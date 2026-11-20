'use client'

import React, { useEffect, useState } from 'react'
import { withholdingRepository } from '../repositories/withholding.repository'
import type { DocumentWithholding } from '../types'
import { formatWithholdingMoney, formatWithholdingRate } from '../utils/withholding-format'

interface DocumentWithholdingSummaryProps {
  documentType: 'PURCHASE' | 'SALE'
  documentId: string
  total: number
  withholdingTotal: number
  /** "Neto a pagar" en compras, "Neto a cobrar" en ventas. */
  netLabel: string
}

/** Desglose de las retenciones guardadas en un documento y su neto. No se muestra si no hay retenciones. */
export function DocumentWithholdingSummary({ documentType, documentId, total, withholdingTotal, netLabel }: DocumentWithholdingSummaryProps) {
  const [lines, setLines] = useState<DocumentWithholding[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (withholdingTotal <= 0) return
    let active = true
    withholdingRepository
      .listDocumentWithholdings(documentType, documentId)
      .then((rows) => active && setLines(rows))
      .catch((e: unknown) => active && setError(e instanceof Error ? e.message : 'No se pudieron cargar las retenciones.'))
    return () => {
      active = false
    }
  }, [documentType, documentId, withholdingTotal])

  if (withholdingTotal <= 0) return null

  return (
    <div className="mt-2 grid gap-1 text-xs" aria-label="Retenciones del documento">
      {lines.length > 0
        ? lines.map((line) => (
            <div key={line.conceptId} className="flex justify-between gap-3 text-slate-600">
              <span className="min-w-0 truncate">
                {line.conceptName} ({formatWithholdingRate(line.effectiveRate)}
                {line.zeseFactor < 1 ? ', ZESE' : ''})
              </span>
              <span className="font-tabular shrink-0">−{formatWithholdingMoney(line.amount)}</span>
            </div>
          ))
        : (
            <div className="flex justify-between gap-3 text-slate-600">
              <span>Retenciones</span>
              <span className="font-tabular">−{formatWithholdingMoney(withholdingTotal)}</span>
            </div>
          )}
      {error && <p className="text-amber-700">{error}</p>}
      <div className="flex justify-between gap-3 border-t border-slate-200 pt-1 text-sm font-bold text-[var(--navy)]">
        <span>{netLabel}</span>
        <span className="font-tabular">{formatWithholdingMoney(Math.max(0, total - withholdingTotal))}</span>
      </div>
    </div>
  )
}
