'use client'

import React, { useMemo, useState } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { SelectField } from '@/components/ui/SelectField'
import {
  SettingsField,
  SettingsNumberInput,
  SettingsTextInput,
  SettingsToggleRow,
} from '@/features/settings/components/panels/SettingsFormParts'
import { withholdingConceptSchema } from '../schemas/withholding.schema'
import type { PostingAccountChoice, WithholdingConcept, WithholdingConceptInput } from '../types'
import { WITHHOLDING_APPLIES_TO_LABELS, WITHHOLDING_BASE_LABELS, WITHHOLDING_TYPE_LABELS } from '../utils/withholding-format'

interface WithholdingConceptFormProps {
  concept: WithholdingConcept | null
  accounts: { payable: PostingAccountChoice[]; receivable: PostingAccountChoice[] }
  isSaving: boolean
  onCancel: () => void
  onSave: (input: WithholdingConceptInput) => Promise<boolean>
}

const EMPTY: WithholdingConceptInput = {
  code: '',
  name: '',
  withholdingType: 'RETEFUENTE',
  appliesTo: 'PURCHASES',
  baseType: 'SUBTOTAL',
  ratePercent: 0,
  minBaseUvt: 0,
  payableAccountId: null,
  receivableAccountId: null,
  isActive: true,
  notes: '',
}

function AccountSelect({
  id,
  value,
  options,
  disabled,
  onChange,
}: {
  id: string
  value: string | null
  options: PostingAccountChoice[]
  disabled: boolean
  onChange: (value: string | null) => void
}) {
  const groups = useMemo(() => {
    const map = new Map<string, PostingAccountChoice[]>()
    options.forEach((option) => {
      const label = `${option.groupCode} ${option.groupName}`.trim()
      map.set(label, [...(map.get(label) || []), option])
    })
    return Array.from(map.entries())
  }, [options])

  return (
    <SelectField id={id} value={value ?? ''} disabled={disabled} className="w-full" size="sm" searchable onChange={(v) => onChange(v || null)}>
      <option value="">Seleccione una subcuenta auxiliar</option>
      {groups.map(([label, accounts]) => (
        <optgroup key={label} label={label}>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.code} · {account.name}
            </option>
          ))}
        </optgroup>
      ))}
    </SelectField>
  )
}

export function WithholdingConceptForm({ concept, accounts, isSaving, onCancel, onSave }: WithholdingConceptFormProps) {
  const [form, setForm] = useState<WithholdingConceptInput>(() => (concept ? { ...concept } : EMPTY))
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof WithholdingConceptInput>(key: K, value: WithholdingConceptInput[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const submit = async () => {
    const parsed = withholdingConceptSchema.safeParse(form)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || 'Revise los datos de la retención.')
      return
    }
    setError(null)
    const ok = await onSave(parsed.data)
    if (!ok) return
  }

  const usesPurchases = form.appliesTo !== 'SALES'
  const usesSales = form.appliesTo !== 'PURCHASES'

  return (
    <div className="settings-section page-enter" aria-labelledby="withholding-form-title">
      <h3 id="withholding-form-title">{concept ? `Editar ${concept.code}` : 'Nueva retención'}</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <SettingsField label="Código" required hint="Ejemplo: RF-COMPRAS-25">
          {(id) => <SettingsTextInput id={id} value={form.code} onChange={(v) => set('code', v.toUpperCase())} maxLength={30} mono />}
        </SettingsField>
        <SettingsField label="Nombre" required>
          {(id) => <SettingsTextInput id={id} value={form.name} onChange={(v) => set('name', v)} maxLength={150} />}
        </SettingsField>

        <SettingsField label="Tipo" required>
          {(id) => (
            <SelectField
              id={id}
              value={form.withholdingType}
              size="sm"
              className="w-full"
              onChange={(v) => {
                const type = v as WithholdingConceptInput['withholdingType']
                setForm((prev) => ({ ...prev, withholdingType: type, baseType: type === 'RETEIVA' ? 'TAX_AMOUNT' : 'SUBTOTAL' }))
              }}
            >
              {Object.entries(WITHHOLDING_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </SelectField>
          )}
        </SettingsField>
        <SettingsField label="Aplica a" required>
          {(id) => (
            <SelectField id={id} value={form.appliesTo} size="sm" className="w-full" onChange={(v) => set('appliesTo', v as WithholdingConceptInput['appliesTo'])}>
              {Object.entries(WITHHOLDING_APPLIES_TO_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </SelectField>
          )}
        </SettingsField>

        <SettingsField label="Tarifa" required hint="Porcentaje sobre la base. ReteICA 9,66 por mil = 0,966 %">
          {(id) => <SettingsNumberInput id={id} value={form.ratePercent} onChange={(v) => set('ratePercent', v)} max={100} suffix="%" />}
        </SettingsField>
        <SettingsField label="Base mínima" hint="En UVT. 0 = se aplica siempre">
          {(id) => <SettingsNumberInput id={id} value={form.minBaseUvt} onChange={(v) => set('minBaseUvt', v)} suffix="UVT" />}
        </SettingsField>

        <SettingsField label="Se calcula sobre" required>
          {(id) => (
            <SelectField
              id={id}
              value={form.baseType}
              size="sm"
              className="w-full"
              disabled={form.withholdingType !== 'RETEIVA'}
              onChange={(v) => set('baseType', v as WithholdingConceptInput['baseType'])}
            >
              {Object.entries(WITHHOLDING_BASE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </SelectField>
          )}
        </SettingsField>
      </div>

      {usesPurchases && (
        <SettingsField label="Cuenta en compras (retención por pagar)" required hint="Subcuentas de 2365, 2367 o 2368">
          {(id) => (
            <AccountSelect id={id} value={form.payableAccountId} options={accounts.payable} disabled={isSaving} onChange={(v) => set('payableAccountId', v)} />
          )}
        </SettingsField>
      )}
      {usesSales && (
        <SettingsField label="Cuenta en ventas (retención a favor)" required hint="Subcuentas de 1355">
          {(id) => (
            <AccountSelect id={id} value={form.receivableAccountId} options={accounts.receivable} disabled={isSaving} onChange={(v) => set('receivableAccountId', v)} />
          )}
        </SettingsField>
      )}

      <SettingsField label="Notas">
        {(id) => <SettingsTextInput id={id} value={form.notes} onChange={(v) => set('notes', v)} maxLength={500} />}
      </SettingsField>

      <SettingsToggleRow
        title="Activa"
        description="Solo las retenciones activas se pueden seleccionar en compras y ventas."
        checked={form.isActive}
        onChange={(v) => set('isActive', v)}
      />

      {error && (
        <p className="settings-notice is-warning" role="alert">
          <AppIcon name="warning" size={15} />
          <span>{error}</span>
        </p>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        <button type="button" className="outline-button flex-1 justify-center" onClick={onCancel} disabled={isSaving}>
          <AppIcon name="close" size={15} />
          <span>Cancelar</span>
        </button>
        <button type="button" className="primary-button flex-1 justify-center" onClick={submit} disabled={isSaving}>
          <AppIcon name={isSaving ? 'refresh' : 'save'} size={15} className={isSaving ? 'spin' : ''} />
          <span>{isSaving ? 'Guardando…' : 'Guardar retención'}</span>
        </button>
      </div>
    </div>
  )
}
