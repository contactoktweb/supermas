'use client'

import React from 'react'
import { HrModal } from '../shared/HrModal'
import { HrFormError, HrFormFooter, HrTextAreaField, HrTextField } from '../shared/HrFormFields'
import { useHrForm } from '../../hooks/useHrForm'
import { hrEmployeeService } from '../../services/hr-employee.service'
import { rehireSchema, type RehireInput } from '../../schemas/hr.schema'
import { addDaysIso, todayIso } from '../../utils/hr-format'
import type { Employee } from '../../types'

interface RehireModalProps {
  employee: Employee
  onClose: () => void
  onSaved: () => void
}

/** Reingreso de un empleado retirado: nuevo vínculo laboral y nueva causación de vacaciones. */
export function RehireModal({ employee, onClose, onSaved }: RehireModalProps) {
  const form = useHrForm<RehireInput>({ hireDate: todayIso(), reason: '' })
  const { values, setField, errors, isSubmitting } = form

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const ok = await form.submit(rehireSchema, (data) => hrEmployeeService.rehire(employee.id, data))
    if (ok) onSaved()
  }

  return (
    <HrModal title="Registrar reingreso" subtitle={`${employee.fullName} • conserva su historial`} icon="userPlus" tone="emerald" isBusy={isSubmitting} onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate className="modal-form flex flex-col gap-3 pt-4">
        <HrFormError message={errors.form} />
        <HrTextField
          label="Fecha de reingreso"
          type="date"
          required
          value={values.hireDate}
          onChange={(v) => setField('hireDate', v)}
          error={errors.hireDate}
          min={employee.terminationDate ? addDaysIso(employee.terminationDate, 1) : undefined}
          hint="Mantiene el cargo, la sede y el salario anteriores; ajústelos después con un movimiento laboral."
        />
        <HrTextAreaField label="Motivo" required value={values.reason} onChange={(v) => setField('reason', v)} error={errors.reason} maxLength={1000} />
        <HrFormFooter onCancel={onClose} isSubmitting={isSubmitting} submitLabel="Registrar reingreso" />
      </form>
    </HrModal>
  )
}
