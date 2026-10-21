'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import type { SelectOption } from '@/components/ui/CustomSelect'
import { AppIcon } from '@/components/ui/Icon'
import { HrModal } from '../shared/HrModal'
import { HrFormError, HrFormFooter, HrSelectField, HrTextAreaField, HrTextField } from '../shared/HrFormFields'
import { useHrForm } from '../../hooks/useHrForm'
import { useHrQuery } from '../../hooks/useHrQuery'
import { hrOrgService } from '../../services/hr-org.service'
import { hrAbsenceService, type VacationRequestInput } from '../../services/hr-absence.service'
import { vacationRequestSchema } from '../../schemas/hr.schema'
import { addDaysIso, formatDays, todayIso } from '../../utils/hr-format'

const PREVIEW_DEBOUNCE_MS = 350

interface VacationRequestModalProps {
  employeeId?: string
  employeeName?: string
  availableDays?: number
  onClose: () => void
  onSaved: () => void
}

/** Programación de vacaciones: la base calcula los días hábiles y valida el saldo. */
export function VacationRequestModal({ employeeId, employeeName, availableDays, onClose, onSaved }: VacationRequestModalProps) {
  const defaultStart = addDaysIso(todayIso(), 7)
  const form = useHrForm<VacationRequestInput>({
    employeeId: employeeId ?? '',
    startDate: defaultStart,
    endDate: addDaysIso(defaultStart, 13),
    notes: '',
  })
  const { values, setField, errors, isSubmitting } = form
  const [businessDays, setBusinessDays] = useState<number | null>(null)

  const loadEmployees = useCallback(() => hrOrgService.listEmployeeOptions(), [])
  const employees = useHrQuery(loadEmployees, !employeeId)
  const employeeOptions: SelectOption[] = useMemo(
    () => (employees.data ?? []).map((e) => ({ value: e.id, label: e.name })),
    [employees.data]
  )

  useEffect(() => {
    if (!values.startDate || !values.endDate || values.endDate < values.startDate) {
      setBusinessDays(null)
      return
    }
    let cancelled = false
    const timer = setTimeout(() => {
      hrAbsenceService
        .countBusinessDays(values.startDate, values.endDate)
        .then((days) => !cancelled && setBusinessDays(days))
        .catch(() => !cancelled && setBusinessDays(null))
    }, PREVIEW_DEBOUNCE_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [values.startDate, values.endDate])

  const exceedsBalance = availableDays !== undefined && businessDays !== null && businessDays > availableDays

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const ok = await form.submit(vacationRequestSchema, (data) => hrAbsenceService.createVacationRequest(data))
    if (ok) onSaved()
  }

  return (
    <HrModal title="Programar vacaciones" subtitle={employeeName ?? 'Solicitud sujeta a aprobación'} icon="vacation" isBusy={isSubmitting} onClose={onClose}>
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
        <div className="form-grid-2 max-sm:grid-cols-1!">
          <HrTextField
            label="Primer día de vacaciones"
            type="date"
            required
            value={values.startDate}
            onChange={(v) => {
              setField('startDate', v)
              if (values.endDate < v) setField('endDate', v)
            }}
            error={errors.startDate}
          />
          <HrTextField label="Último día de vacaciones" type="date" required value={values.endDate} onChange={(v) => setField('endDate', v)} error={errors.endDate} min={values.startDate} />
        </div>

        <div
          className={`flex items-center gap-3 rounded-[10px] border p-3 text-xs ${exceedsBalance ? 'border-red-200 bg-red-50 text-red-700' : 'border-[var(--line)] bg-[#f6f8fc] text-[var(--foreground)]'}`}
          role="status"
          aria-live="polite"
        >
          <AppIcon name={exceedsBalance ? 'warning' : 'calendar'} size={18} />
          <div className="flex flex-col gap-1">
            <strong>{businessDays === null ? 'Calculando días hábiles...' : `${formatDays(businessDays)} hábiles`}</strong>
            <span className="text-[var(--muted)]">
              Excluye domingos y festivos de Colombia.
              {availableDays !== undefined && ` Saldo disponible: ${formatDays(availableDays)}.`}
            </span>
          </div>
        </div>

        <HrTextAreaField label="Observaciones" value={values.notes} onChange={(v) => setField('notes', v)} error={errors.notes} maxLength={500} />
        <HrFormFooter onCancel={onClose} isSubmitting={isSubmitting} submitLabel="Registrar solicitud" />
      </form>
    </HrModal>
  )
}
