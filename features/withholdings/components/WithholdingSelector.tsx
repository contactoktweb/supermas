'use client'

import React, { useEffect, useState } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { useWithholdingConcepts } from '../hooks/useWithholdingConcepts'
import { withholdingRepository } from '../repositories/withholding.repository'
import type { WithholdingLine, WithholdingSide } from '../types'
import { formatWithholdingMoney } from '../utils/withholding-format'
import { WithholdingConceptChecklist } from './WithholdingConceptChecklist'

const PREVIEW_DEBOUNCE_MS = 350

interface WithholdingSelectorProps {
  side: WithholdingSide
  /** Proveedor (compras) o cliente (ventas). Sin tercero no se calcula. */
  thirdPartyId: string | null
  /** Base gravable antes de IVA y valor del IVA del documento. */
  base: number
  tax: number
  /** Fecha del documento (YYYY-MM-DD); define la UVT y los años ZESE. */
  date?: string
  selectedIds: string[]
  onSelectedChange: (ids: string[]) => void
  /** Total retenido según el servidor; 0 mientras calcula o si hay error. */
  onTotalChange: (total: number) => void
  disabled?: boolean
}

/** Selección de retenciones de un documento con el cálculo hecho en el servidor. */
export function WithholdingSelector({
  side,
  thirdPartyId,
  base,
  tax,
  date,
  selectedIds,
  onSelectedChange,
  onTotalChange,
  disabled,
}: WithholdingSelectorProps) {
  const { concepts, isLoading, error: loadError } = useWithholdingConcepts(side)
  const [lines, setLines] = useState<WithholdingLine[]>([])
  const [isCalculating, setIsCalculating] = useState(false)
  const [calcError, setCalcError] = useState<string | null>(null)
  const idsKey = selectedIds.join(',')

  useEffect(() => {
    if (!thirdPartyId || selectedIds.length === 0) {
      setLines([])
      setCalcError(null)
      onTotalChange(0)
      return
    }
    let active = true
    setIsCalculating(true)
    const timer = setTimeout(() => {
      withholdingRepository
        .preview({ side, thirdPartyId, base, tax, conceptIds: selectedIds, date })
        .then((result) => {
          if (!active) return
          setLines(result)
          setCalcError(null)
          onTotalChange(result.reduce((acc, line) => acc + (line.applied ? line.amount : 0), 0))
        })
        .catch((e: unknown) => {
          if (!active) return
          setLines([])
          setCalcError(e instanceof Error ? e.message : 'No se pudieron calcular las retenciones.')
          onTotalChange(0)
        })
        .finally(() => active && setIsCalculating(false))
    }, PREVIEW_DEBOUNCE_MS)
    return () => {
      active = false
      clearTimeout(timer)
    }
    // onTotalChange se omite a propósito: el padre puede pasar una función nueva en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [side, thirdPartyId, base, tax, date, idsKey])

  const total = lines.reduce((acc, line) => acc + (line.applied ? line.amount : 0), 0)

  if (isLoading) return <p className="text-xs text-slate-500">Cargando retenciones…</p>
  if (loadError) {
    return (
      <p className="flex items-center gap-2 text-xs text-amber-700" role="alert">
        <AppIcon name="warning" size={14} />
        <span>{loadError}</span>
      </p>
    )
  }
  if (concepts.length === 0) return null

  return (
    <section className="grid gap-2" aria-labelledby={`withholding-selector-${side}`}>
      <div className="flex items-center justify-between gap-3">
        <h4 id={`withholding-selector-${side}`} className="text-xs font-bold text-[var(--navy)]">
          Retenciones
        </h4>
        {isCalculating && (
          <span className="flex items-center gap-1 text-xs text-slate-500" aria-live="polite">
            <AppIcon name="refresh" size={12} className="spin" />
            Calculando…
          </span>
        )}
      </div>
      <WithholdingConceptChecklist
        concepts={concepts}
        selectedIds={selectedIds}
        onChange={onSelectedChange}
        lines={lines}
        disabled={disabled}
        legend="Retenciones del documento"
      />
      {calcError && (
        <p className="flex items-center gap-2 text-xs text-amber-700" role="alert">
          <AppIcon name="warning" size={14} />
          <span>{calcError}</span>
        </p>
      )}
      {selectedIds.length > 0 && !calcError && (
        <p className="flex justify-between text-xs font-semibold text-[var(--navy)]">
          <span>Total retenido</span>
          <span className="font-tabular">−{formatWithholdingMoney(total)}</span>
        </p>
      )}
    </section>
  )
}
