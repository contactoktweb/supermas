'use client'

import React, { useCallback, useMemo } from 'react'
import type { SelectOption } from '@/components/ui/CustomSelect'
import { HrModal } from '../shared/HrModal'
import {
  HrCheckboxField,
  HrFormError,
  HrFormFooter,
  HrSelectField,
  HrTextAreaField,
  HrTextField,
} from '../shared/HrFormFields'
import { useHrForm } from '../../hooks/useHrForm'
import { useHrQuery } from '../../hooks/useHrQuery'
import { hrOrgService } from '../../services/hr-org.service'
import { hrDocumentService } from '../../services/hr-document.service'
import { hrAbsenceService, type NoveltyInput } from '../../services/hr-absence.service'
import { noveltyFormSchema } from '../../schemas/hr.schema'
import { DOCUMENT_TYPE_LABELS, HOURLY_NOVELTY_TYPES, NOVELTY_TYPE_LABELS, UNPAID_NOVELTY_TYPES, toSelectOptions } from '../../constants'
import { todayIso } from '../../utils/hr-format'

interface NoveltyFormModalProps {
  employeeId?: string
  employeeName?: string
  onClose: () => void
  onSaved: () => void
}

/** Registro de una novedad; queda PENDIENTE hasta su aprobación. */
export function NoveltyFormModal({ employeeId, employeeName, onClose, onSaved }: NoveltyFormModalProps) {
  const form = useHrForm<NoveltyInput>({
    employeeId: employeeId ?? '',
    noveltyType: 'PERMISO_REMUNERADO',
    startDate: todayIso(),
    endDate: todayIso(),
    byHours: false,
    hours: '',
    description: '',
    supportDocumentId: '',
  })
  const { values, setField, errors, isSubmitting } = form

  const loadEmployees = useCallback(() => hrOrgService.listEmployeeOptions(), [])
  const employees = useHrQuery(loadEmployees, !employeeId)

  const loadDocuments = useCallback(
    () => (values.employeeId ? hrDocumentService.list(values.employeeId, false) : Promise.resolve([])),
    [values.employeeId]
  )
  const documents = useHrQuery(loadDocuments)

  const employeeOptions: SelectOption[] = useMemo(
    () => (employees.data ?? []).map((e) => ({ value: e.id, label: e.name })),
    [employees.data]
  )
  const documentOptions: SelectOption[] = useMemo(
    () => [
      { value: '', label: 'Sin soporte' },
      ...(documents.data ?? []).map((d) => ({ value: d.id, label: d.name, description: DOCUMENT_TYPE_LABELS[d.documentType] })),
    ],
    [documents.data]
  )

  const allowsHours = HOURLY_NOVELTY_TYPES.includes(values.noveltyType)
  const isUnpaid = UNPAID_NOVELTY_TYPES.includes(values.noveltyType)
  const isIncapacity = values.noveltyType === 'INCAPACIDAD_GENERAL' || values.noveltyType === 'INCAPACIDAD_LABORAL'

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const ok = await form.submit(noveltyFormSchema, (data) =>
      hrAbsenceService.createNovelty({ ...data, byHours: allowsHours && data.byHours })
    )
    if (ok) onSaved()
  }

  return (
    <HrModal title="Registrar novedad" subtitle={employeeName ?? 'Permiso, licencia, incapacidad o ausencia'} icon="calendarMark" size="lg" isBusy={isSubmitting} onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate className="modal-form flex flex-col gap-3 pt-4">
        <HrFormError message={errors.form} />
        {!employeeId && (
          <HrSelectField
            label="Empleado"
            required
            value={values.employeeId}
            onChange={(v) => setField('employeeId', v)}
            options={employeeOptions}
            placeholder={employees.isLoading ? 'Cargando empleados...' : 'Seleccione el empleado'}
            error={errors.employeeId ?? employees.error ?? undefined}
          />
        )}
        <HrSelectField
          label="Tipo de novedad"
          required
          value={values.noveltyType}
          onChange={(v) => {
            setField('noveltyType', v as NoveltyInput['noveltyType'])
            if (!HOURLY_NOVELTY_TYPES.includes(v as NoveltyInput['noveltyType'])) setField('byHours', false)
          }}
          options={toSelectOptions(NOVELTY_TYPE_LABELS)}
          error={errors.noveltyType}
          hint={isUnpaid ? 'No remunerada: se reporta en los datos para nómina.' : 'Remunerada.'}
        />
        {allowsHours && (
          <HrCheckboxField
            label="Permiso por horas (un solo día)"
            checked={values.byHours}
            onChange={(v) => {
              setField('byHours', v)
              if (v) setField('endDate', values.startDate)
            }}
          />
        )}
        <div className="form-grid-2 max-sm:grid-cols-1!">
          <HrTextField
            label="Fecha inicial"
            type="date"
            required
            value={values.startDate}
            onChange={(v) => {
              setField('startDate', v)
              if (values.byHours || values.endDate < v) setField('endDate', v)
            }}
            error={errors.startDate}
          />
          {values.byHours ? (
            <HrTextField label="Horas" required value={values.hours} onChange={(v) => setField('hours', v)} error={errors.hours} inputMode="decimal" maxLength={5} />
          ) : (
            <HrTextField label="Fecha final" type="date" required value={values.endDate} onChange={(v) => setField('endDate', v)} error={errors.endDate} min={values.startDate} />
          )}
        </div>
        <HrSelectField
          label="Documento soporte"
          value={values.supportDocumentId}
          onChange={(v) => setField('supportDocumentId', v)}
          options={documentOptions}
          disabled={!values.employeeId || documents.isLoading}
          hint="Cargue primero el soporte en la pestaña Documentos del empleado."
        />
        <HrTextAreaField
          label="Descripción"
          value={values.description}
          onChange={(v) => setField('description', v)}
          error={errors.description}
          maxLength={500}
          hint={isIncapacity ? 'No registre diagnósticos médicos: son datos sensibles (Ley 1581 de 2012).' : undefined}
        />
        <HrFormFooter onCancel={onClose} isSubmitting={isSubmitting} submitLabel="Registrar novedad" />
      </form>
    </HrModal>
  )
}
