'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { useWithholdingConcepts } from '../hooks/useWithholdingConcepts'
import type { ThirdPartyWithholdingProfile } from '../types'
import { WithholdingConceptChecklist } from './WithholdingConceptChecklist'

interface ThirdPartyWithholdingFieldsProps {
  /** PURCHASES = proveedor (la empresa le retiene); SALES = cliente (le retiene a la empresa). */
  side: 'PURCHASES' | 'SALES'
  value: ThirdPartyWithholdingProfile
  onChange: (value: ThirdPartyWithholdingProfile) => void
}

function CheckRow({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm cursor-pointer transition-colors hover:border-slate-300">
      <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <span className="block font-semibold text-[var(--navy)]">{label}</span>
        <span className="block text-xs text-slate-500">{description}</span>
      </span>
    </label>
  )
}

/** Bloque "Perfil tributario" de los formularios de proveedor y cliente. */
export function ThirdPartyWithholdingFields({ side, value, onChange }: ThirdPartyWithholdingFieldsProps) {
  const { concepts, isLoading, error } = useWithholdingConcepts(side)
  const set = <K extends keyof ThirdPartyWithholdingProfile>(key: K, v: ThirdPartyWithholdingProfile[K]) => onChange({ ...value, [key]: v })
  const isSupplier = side === 'PURCHASES'
  const showConcepts = isSupplier || value.isWithholdingAgent

  return (
    <section className="grid gap-3" aria-labelledby={`withholding-profile-${side}`}>
      <h3 id={`withholding-profile-${side}`} className="text-sm font-bold text-[var(--navy)]">
        Perfil tributario y retenciones
      </h3>

      {isSupplier ? (
        <>
          <CheckRow
            label="Autorretenedor"
            description="No se le practica retención en la fuente."
            checked={value.isSelfWithholder}
            onChange={(v) => set('isSelfWithholder', v)}
          />
          <CheckRow
            label="Régimen simple de tributación"
            description="No se le practica retención en la fuente."
            checked={value.isSimpleRegime}
            onChange={(v) => set('isSimpleRegime', v)}
          />
          <CheckRow
            label="Beneficiario ZESE"
            description="La retención en la fuente se reduce según los años desde el inicio del beneficio."
            checked={value.isZeseBeneficiary}
            onChange={(v) => onChange({ ...value, isZeseBeneficiary: v, zeseStartDate: v ? value.zeseStartDate : null })}
          />
          {value.isZeseBeneficiary && (
            <div>
              <label htmlFor="supplier-zese-start" className="block text-xs font-bold mb-1.5">
                Inicio del beneficio ZESE <span className="text-red-600">*</span>
              </label>
              <input
                id="supplier-zese-start"
                type="date"
                className="filter-date-input w-full"
                value={value.zeseStartDate ?? ''}
                onChange={(e) => set('zeseStartDate', e.target.value || null)}
                required
              />
            </div>
          )}
        </>
      ) : (
        <CheckRow
          label="Agente retenedor"
          description="Este cliente le practica retenciones a la empresa en sus compras."
          checked={value.isWithholdingAgent}
          onChange={(v) => onChange({ ...value, isWithholdingAgent: v, defaultWithholdingConceptIds: v ? value.defaultWithholdingConceptIds : [] })}
        />
      )}

      {showConcepts && (
        <div className="grid gap-2">
          <p className="text-xs font-bold">Retenciones habituales</p>
          <p className="text-xs text-slate-500">Se preseleccionan en cada {isSupplier ? 'compra' : 'venta'} y se pueden cambiar en el documento.</p>
          {isLoading ? (
            <p className="text-xs text-slate-500">Cargando retenciones…</p>
          ) : error ? (
            <p className="flex items-center gap-2 text-xs text-amber-700" role="alert">
              <AppIcon name="warning" size={14} />
              <span>{error}</span>
            </p>
          ) : concepts.length === 0 ? (
            <p className="text-xs text-slate-500">No hay retenciones activas para {isSupplier ? 'compras' : 'ventas'}. Se crean en Configuración → Retenciones.</p>
          ) : (
            <WithholdingConceptChecklist
              concepts={concepts}
              selectedIds={value.defaultWithholdingConceptIds}
              onChange={(ids) => set('defaultWithholdingConceptIds', ids)}
              legend="Retenciones habituales"
            />
          )}
        </div>
      )}
    </section>
  )
}
