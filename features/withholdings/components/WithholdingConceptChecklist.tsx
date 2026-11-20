'use client'

import React from 'react'
import type { WithholdingConcept, WithholdingLine } from '../types'
import { WITHHOLDING_TYPE_LABELS, formatWithholdingMoney, formatWithholdingRate } from '../utils/withholding-format'

interface WithholdingConceptChecklistProps {
  concepts: WithholdingConcept[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
  disabled?: boolean
  /** Resultado del cálculo por concepto, cuando se muestra dentro de un documento. */
  lines?: WithholdingLine[]
  legend: string
}

/** Lista de conceptos de retención seleccionables, con el valor calculado cuando hay cálculo. */
export function WithholdingConceptChecklist({ concepts, selectedIds, onChange, disabled, lines, legend }: WithholdingConceptChecklistProps) {
  const toggle = (id: string, checked: boolean) =>
    onChange(checked ? Array.from(new Set([...selectedIds, id])) : selectedIds.filter((item) => item !== id))

  return (
    <fieldset className="grid gap-2" disabled={disabled}>
      <legend className="sr-only">{legend}</legend>
      {concepts.map((concept) => {
        const checked = selectedIds.includes(concept.id)
        const line = lines?.find((item) => item.conceptId === concept.id)
        return (
          <label
            key={concept.id}
            className={`flex items-start gap-3 rounded-lg border p-3 text-sm transition-colors cursor-pointer ${
              checked ? 'border-[var(--navy)] bg-slate-50' : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0"
              checked={checked}
              onChange={(e) => toggle(concept.id, e.target.checked)}
            />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-[var(--navy)]">{concept.name}</span>
              <span className="block text-xs text-slate-500">
                {WITHHOLDING_TYPE_LABELS[concept.withholdingType]} · {formatWithholdingRate(concept.ratePercent)}
                {concept.minBaseUvt > 0 ? ` · base mínima ${concept.minBaseUvt} UVT` : ''}
              </span>
              {checked && line && !line.applied && line.reason && (
                <span className="block text-xs text-amber-700">No se aplica: {line.reason}</span>
              )}
              {checked && line?.applied && line.zeseFactor < 1 && (
                <span className="block text-xs text-slate-500">
                  ZESE: tarifa efectiva {formatWithholdingRate(line.effectiveRate)}
                </span>
              )}
            </span>
            {checked && line && (
              <span className="shrink-0 font-tabular font-semibold text-[var(--navy)]">
                {line.applied ? `−${formatWithholdingMoney(line.amount)}` : formatWithholdingMoney(0)}
              </span>
            )}
          </label>
        )
      })}
    </fieldset>
  )
}
