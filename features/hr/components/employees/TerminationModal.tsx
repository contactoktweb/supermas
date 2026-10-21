'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'
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
import { hrEmployeeService } from '../../services/hr-employee.service'
import { terminationSchema, type TerminationInput } from '../../schemas/hr.schema'
import { TERMINATION_CAUSE_LABELS, toSelectOptions } from '../../constants'
import { formatDays, todayIso } from '../../utils/hr-format'
import type { Employee, TerminationResult } from '../../types'

interface TerminationModalProps {
  employee: Employee
  pendingVacationDays: number
  onClose: () => void
  onSaved: (result: TerminationResult) => void
}

/**
 * Retiro del empleado. Con vacaciones pendientes la base bloquea el retiro salvo que se
 * registre su compensación en dinero con el motivo (Art. 189 CST). No liquida valores.
 */
export function TerminationModal({ employee, pendingVacationDays, onClose, onSaved }: TerminationModalProps) {
  const form = useHrForm<TerminationInput>({
    terminationDate: todayIso(),
    cause: 'RENUNCIA_VOLUNTARIA',
    reason: '',
    compensateVacations: false,
    compensationReason: '',
  })
  const { values, setField, errors, isSubmitting } = form
  const hasPending = pendingVacationDays > 0

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    let result: TerminationResult = { vacationDaysCompensated: 0, hasErpUser: false }
    const ok = await form.submit(terminationSchema, async (data) => {
      result = await hrEmployeeService.terminate(employee.id, data)
    })
    if (ok) onSaved(result)
  }

  return (
    <HrModal title="Registrar retiro" subtitle={employee.fullName} icon="userMinus" tone="red" size="lg" isBusy={isSubmitting} onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate className="modal-form flex flex-col gap-3 pt-4">
        <HrFormError message={errors.form} />

        {hasPending && (
          <div className="flex items-start gap-3 rounded-[10px] border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800" role="status">
            <AppIcon name="vacation" size={18} />
            <p className="m-0">
              El empleado tiene <strong>{formatDays(pendingVacationDays)}</strong> de vacaciones causadas a hoy. La política de la
              empresa exige disfrutarlas; para retirarlo antes debe registrar su compensación en dinero y el motivo. El saldo
              definitivo se calcula a la fecha de retiro.
            </p>
          </div>
        )}

        <div className="form-grid-2 max-sm:grid-cols-1!">
          <HrTextField label="Fecha de retiro" type="date" required value={values.terminationDate} onChange={(v) => setField('terminationDate', v)} error={errors.terminationDate} min={employee.hireDate} max={todayIso()} />
          <HrSelectField label="Causa" required value={values.cause} onChange={(v) => setField('cause', v as TerminationInput['cause'])} options={toSelectOptions(TERMINATION_CAUSE_LABELS)} error={errors.cause} />
        </div>
        <HrTextAreaField label="Motivo y soporte del retiro" required value={values.reason} onChange={(v) => setField('reason', v)} error={errors.reason} maxLength={1000} />

        <HrCheckboxField
          label="Registrar compensación en dinero de las vacaciones pendientes"
          description="Úsela solo cuando no sea posible el disfrute antes del retiro."
          checked={values.compensateVacations}
          onChange={(v) => setField('compensateVacations', v)}
        />
        {values.compensateVacations && (
          <HrTextAreaField label="Motivo de la compensación" required value={values.compensationReason} onChange={(v) => setField('compensationReason', v)} error={errors.compensationReason} maxLength={500} />
        )}

        <HrFormFooter onCancel={onClose} isSubmitting={isSubmitting} submitLabel="Confirmar retiro" submittingLabel="Registrando..." tone="danger" />
      </form>
    </HrModal>
  )
}
