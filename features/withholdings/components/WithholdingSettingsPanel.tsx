'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { useAuth } from '@/features/auth'
import {
  SettingsField,
  SettingsNotice,
  SettingsNumberInput,
  SettingsSaveButton,
  SettingsSection,
  SettingsTextInput,
  SettingsToggleRow,
} from '@/features/settings/components/panels/SettingsFormParts'
import { withholdingRepository } from '../repositories/withholding.repository'
import { companyWithholdingProfileSchema, uvtValueSchema } from '../schemas/withholding.schema'
import type { CompanyWithholdingProfile, PostingAccountChoice, UvtValue, WithholdingConcept, WithholdingConceptInput } from '../types'
import {
  WITHHOLDING_APPLIES_TO_LABELS,
  WITHHOLDING_TYPE_LABELS,
  formatWithholdingMoney,
  formatWithholdingRate,
} from '../utils/withholding-format'
import { WithholdingConceptForm } from './WithholdingConceptForm'

type Feedback = { tone: 'info' | 'warning'; message: string } | null
type ConceptEditor = { concept: WithholdingConcept | null } | null

const EMPTY_PROFILE: CompanyWithholdingProfile = {
  isSelfWithholder: false,
  isSimpleRegime: false,
  isZeseBeneficiary: false,
  zeseStartDate: null,
}

const errorMessage = (error: unknown, fallback: string) => (error instanceof Error && error.message ? error.message : fallback)

export function WithholdingSettingsPanel() {
  const { user } = useAuth()
  const userId = user?.id || ''

  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [feedback, setFeedback] = useState<Feedback>(null)

  const [concepts, setConcepts] = useState<WithholdingConcept[]>([])
  const [uvtValues, setUvtValues] = useState<UvtValue[]>([])
  const [profile, setProfile] = useState<CompanyWithholdingProfile>(EMPTY_PROFILE)
  const [accounts, setAccounts] = useState<{ payable: PostingAccountChoice[]; receivable: PostingAccountChoice[] }>({
    payable: [],
    receivable: [],
  })
  const [uvtDraft, setUvtDraft] = useState<UvtValue>({ year: new Date().getFullYear(), value: 0 })
  const [editor, setEditor] = useState<ConceptEditor>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)
    try {
      const [conceptRows, uvtRows, companyProfile, postingAccounts] = await Promise.all([
        withholdingRepository.listConcepts(),
        withholdingRepository.listUvtValues(),
        withholdingRepository.getCompanyProfile(),
        withholdingRepository.listPostingAccounts(),
      ])
      setConcepts(conceptRows)
      setUvtValues(uvtRows)
      setProfile(companyProfile)
      setAccounts(postingAccounts)
      const currentYear = new Date().getFullYear()
      setUvtDraft({ year: currentYear, value: uvtRows.find((row) => row.year === currentYear)?.value ?? 0 })
    } catch (error) {
      setLoadError(errorMessage(error, 'No se pudo cargar la configuración de retenciones.'))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const runSave = async (action: () => Promise<void>, success: string): Promise<boolean> => {
    setIsSaving(true)
    setFeedback(null)
    try {
      await action()
      setFeedback({ tone: 'info', message: success })
      return true
    } catch (error) {
      setFeedback({ tone: 'warning', message: errorMessage(error, 'No se pudo guardar el cambio.') })
      return false
    } finally {
      setIsSaving(false)
    }
  }

  const saveProfile = () => {
    const parsed = companyWithholdingProfileSchema.safeParse(profile)
    if (!parsed.success) {
      setFeedback({ tone: 'warning', message: parsed.error.issues[0]?.message || 'Revise el perfil tributario.' })
      return
    }
    void runSave(() => withholdingRepository.saveCompanyProfile(parsed.data), 'Perfil tributario guardado.')
  }

  const saveUvt = () => {
    const parsed = uvtValueSchema.safeParse(uvtDraft)
    if (!parsed.success) {
      setFeedback({ tone: 'warning', message: parsed.error.issues[0]?.message || 'Revise el valor de la UVT.' })
      return
    }
    void runSave(async () => {
      await withholdingRepository.saveUvtValue(parsed.data, userId)
      setUvtValues(await withholdingRepository.listUvtValues())
    }, `UVT ${parsed.data.year} guardada.`)
  }

  const saveConcept = async (input: WithholdingConceptInput): Promise<boolean> => {
    const current = editor?.concept ?? null
    const ok = await runSave(async () => {
      const saved = current
        ? await withholdingRepository.updateConcept(current.id, input, userId)
        : await withholdingRepository.createConcept(input, userId)
      setConcepts((prev) => {
        const rest = prev.filter((item) => item.id !== saved.id)
        return [...rest, saved].sort((a, b) => a.withholdingType.localeCompare(b.withholdingType) || a.code.localeCompare(b.code))
      })
    }, current ? 'Retención actualizada.' : 'Retención creada.')
    if (ok) setEditor(null)
    return ok
  }

  if (isLoading) {
    return (
      <div className="settings-panel" aria-busy="true">
        <SettingsNotice>Cargando retenciones…</SettingsNotice>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="settings-panel">
        <SettingsNotice tone="warning">{loadError}</SettingsNotice>
        <button type="button" className="outline-button w-full justify-center" onClick={() => void load()}>
          <AppIcon name="refresh" size={15} />
          <span>Reintentar</span>
        </button>
      </div>
    )
  }

  if (editor) {
    return (
      <div className="settings-panel">
        {feedback && <SettingsNotice tone={feedback.tone}>{feedback.message}</SettingsNotice>}
        <WithholdingConceptForm
          concept={editor.concept}
          accounts={accounts}
          isSaving={isSaving}
          onCancel={() => setEditor(null)}
          onSave={saveConcept}
        />
      </div>
    )
  }

  const accountLabel = (id: string | null, options: PostingAccountChoice[]) => {
    if (!id) return null
    const account = options.find((option) => option.id === id)
    return account ? `${account.code} · ${account.name}` : 'Cuenta inactiva'
  }

  return (
    <div className="settings-panel">
      {feedback && <SettingsNotice tone={feedback.tone}>{feedback.message}</SettingsNotice>}

      <SettingsSection title="Retenciones configuradas">
        {concepts.length === 0 ? (
          <SettingsNotice>
            Aún no hay retenciones. Créelas con la tarifa, la base mínima y la cuenta contable que indique su contador.
          </SettingsNotice>
        ) : (
          <ul className="grid gap-2" aria-label="Retenciones configuradas">
            {concepts.map((concept) => (
              <li
                key={concept.id}
                className="rounded-xl border border-slate-200 bg-white p-3 transition-shadow hover:shadow-sm flex items-start justify-between gap-3"
              >
                <div className="min-w-0 text-sm">
                  <p className="font-semibold text-[var(--navy)] truncate">
                    <span className="font-mono">{concept.code}</span> · {concept.name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {WITHHOLDING_TYPE_LABELS[concept.withholdingType]} · {WITHHOLDING_APPLIES_TO_LABELS[concept.appliesTo]} ·{' '}
                    {formatWithholdingRate(concept.ratePercent)}
                    {concept.minBaseUvt > 0 ? ` · base mínima ${concept.minBaseUvt} UVT` : ''}
                  </p>
                  {[accountLabel(concept.payableAccountId, accounts.payable), accountLabel(concept.receivableAccountId, accounts.receivable)]
                    .filter(Boolean)
                    .map((label) => (
                      <p key={label} className="text-xs text-slate-500 truncate">
                        {label}
                      </p>
                    ))}
                  {!concept.isActive && <p className="text-xs font-semibold text-amber-700">Inactiva</p>}
                </div>
                <button
                  type="button"
                  className="icon-button w-9 h-9 rounded-lg hover:bg-slate-100 shrink-0"
                  aria-label={`Editar la retención ${concept.code}`}
                  onClick={() => {
                    setFeedback(null)
                    setEditor({ concept })
                  }}
                >
                  <AppIcon name="edit" size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          className="outline-button w-full justify-center"
          onClick={() => {
            setFeedback(null)
            setEditor({ concept: null })
          }}
        >
          <AppIcon name="plus" size={15} />
          <span>Nueva retención</span>
        </button>
      </SettingsSection>

      <SettingsSection title="Valor de la UVT">
        <p className="text-xs text-slate-500">Se usa para calcular la base mínima de cada retención según el año del documento.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <SettingsField label="Año" required>
            {(id) => <SettingsNumberInput id={id} value={uvtDraft.year} min={2000} max={2100} onChange={(v) => setUvtDraft((p) => ({ ...p, year: v }))} />}
          </SettingsField>
          <SettingsField label="Valor" required hint="Valor fijado por la DIAN para ese año">
            {(id) => <SettingsNumberInput id={id} value={uvtDraft.value} prefix="$" onChange={(v) => setUvtDraft((p) => ({ ...p, value: v }))} />}
          </SettingsField>
        </div>
        <SettingsSaveButton isSaving={isSaving} label="Guardar UVT" onClick={saveUvt} />
        {uvtValues.length > 0 && (
          <ul className="text-xs text-slate-600 grid gap-1" aria-label="Valores de UVT guardados">
            {uvtValues.map((row) => (
              <li key={row.year} className="flex justify-between">
                <span>{row.year}</span>
                <span className="font-semibold">{formatWithholdingMoney(row.value)}</span>
              </li>
            ))}
          </ul>
        )}
      </SettingsSection>

      <SettingsSection title="Perfil tributario de Super Más">
        <p className="text-xs text-slate-500">Define si los clientes le practican retención en la fuente a la empresa en las ventas.</p>
        <SettingsToggleRow
          title="Autorretenedor"
          description="Los clientes no le practican retención en la fuente."
          checked={profile.isSelfWithholder}
          onChange={(v) => setProfile((p) => ({ ...p, isSelfWithholder: v }))}
        />
        <SettingsToggleRow
          title="Régimen simple de tributación"
          description="Los clientes no le practican retención en la fuente."
          checked={profile.isSimpleRegime}
          onChange={(v) => setProfile((p) => ({ ...p, isSimpleRegime: v }))}
        />
        <SettingsToggleRow
          title="Beneficiaria ZESE"
          description="Reduce la retención en la fuente según los años transcurridos desde el inicio del beneficio."
          checked={profile.isZeseBeneficiary}
          onChange={(v) => setProfile((p) => ({ ...p, isZeseBeneficiary: v, zeseStartDate: v ? p.zeseStartDate : null }))}
        />
        {profile.isZeseBeneficiary && (
          <SettingsField label="Inicio del beneficio ZESE" required>
            {(id) => (
              <SettingsTextInput
                id={id}
                type="date"
                value={profile.zeseStartDate ?? ''}
                onChange={(v) => setProfile((p) => ({ ...p, zeseStartDate: v || null }))}
              />
            )}
          </SettingsField>
        )}
        <SettingsSaveButton isSaving={isSaving} label="Guardar perfil tributario" onClick={saveProfile} />
      </SettingsSection>
    </div>
  )
}
