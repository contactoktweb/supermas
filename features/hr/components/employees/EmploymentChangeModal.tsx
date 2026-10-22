'use client'

import React, { useCallback, useMemo } from 'react'
import type { SelectOption } from '@/components/ui/CustomSelect'
import { HrModal } from '../shared/HrModal'
import { HrFormError, HrFormFooter, HrSelectField, HrTextAreaField, HrTextField } from '../shared/HrFormFields'
import { useHrForm } from '../../hooks/useHrForm'
import { useHrQuery } from '../../hooks/useHrQuery'
import { useHrCatalogs } from '../../hooks/useHrCatalogs'
import { hrOrgService } from '../../services/hr-org.service'
import { hrEmployeeService } from '../../services/hr-employee.service'
import { employmentChangeSchema, type EmploymentChangeInput } from '../../schemas/hr.schema'
import { CONTRACT_TYPE_LABELS, SALARY_TYPE_LABELS, WORK_SCHEDULE_LABELS, toSelectOptions } from '../../constants'
import { todayIso } from '../../utils/hr-format'
import type { Employee } from '../../types'

interface EmploymentChangeModalProps {
  employee: Employee
  onClose: () => void
  onSaved: (events: number) => void
}

/** Cambio de cargo, área, sede, salario o contrato: cada grupo modificado deja un evento en el historial. */
export function EmploymentChangeModal({ employee, onClose, onSaved }: EmploymentChangeModalProps) {
  const form = useHrForm<EmploymentChangeInput>({
    positionId: employee.positionId,
    areaId: employee.areaId ?? '',
    locationId: employee.locationId ?? '',
    managerEmployeeId: employee.managerEmployeeId ?? '',
    contractType: employee.contractType,
    contractEndDate: employee.contractEndDate ?? '',
    salary: String(employee.salary),
    salaryType: employee.salaryType,
    workSchedule: employee.workSchedule,
    weeklyHours: employee.weeklyHours ? String(employee.weeklyHours) : '',
    effectiveDate: todayIso(),
    reason: '',
  })
  const { values, setField, errors, isSubmitting } = form
  const { options } = useHrCatalogs()

  const loadManagers = useCallback(() => hrOrgService.listEmployeeOptions(), [])
  const managers = useHrQuery(loadManagers)
  const managerOptions: SelectOption[] = useMemo(
    () => [
      { value: '', label: 'Sin jefe inmediato' },
      ...(managers.data ?? []).filter((m) => m.id !== employee.id).map((m) => ({ value: m.id, label: m.name })),
    ],
    [managers.data, employee.id]
  )

  // El cargo actual puede estar inactivo: se mantiene disponible para no forzar su cambio
  const positionOptions: SelectOption[] = useMemo(() => {
    const active = options.activePositions
    return active.some((p) => p.value === employee.positionId)
      ? active
      : [{ value: employee.positionId, label: employee.positionName ?? 'Cargo actual' }, ...active]
  }, [options.activePositions, employee.positionId, employee.positionName])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    let events = 0
    const ok = await form.submit(employmentChangeSchema, async (data) => {
      events = await hrEmployeeService.changeEmployment(employee, data)
    })
    if (ok) onSaved(events)
  }

  return (
    <HrModal title="Movimiento laboral" subtitle={`${employee.fullName} • queda registrado en el historial`} icon="briefcase" size="lg" isBusy={isSubmitting} onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate className="modal-form flex flex-col gap-3 pt-4">
        <HrFormError message={errors.form} />
        <div className="form-grid-2 max-sm:grid-cols-1!">
          <HrSelectField label="Cargo" required value={values.positionId} onChange={(v) => setField('positionId', v)} options={positionOptions} error={errors.positionId} />
          <HrSelectField label="Área" value={values.areaId} onChange={(v) => setField('areaId', v)} options={[{ value: '', label: 'La del cargo' }, ...options.areas]} error={errors.areaId} />
        </div>
        <div className="form-grid-2 max-sm:grid-cols-1!">
          <HrSelectField label="Sede" value={values.locationId} onChange={(v) => setField('locationId', v)} options={[{ value: '', label: 'Sin sede asignada' }, ...options.locations]} error={errors.locationId} />
          <HrSelectField label="Jefe inmediato" value={values.managerEmployeeId} onChange={(v) => setField('managerEmployeeId', v)} options={managerOptions} error={errors.managerEmployeeId} />
        </div>
        <div className="form-grid-2 max-sm:grid-cols-1!">
          <HrTextField label="Salario mensual" required value={values.salary} onChange={(v) => setField('salary', v.replace(/[^\d]/g, ''))} error={errors.salary} inputMode="numeric" prefix="$" maxLength={13} />
          <HrSelectField label="Tipo de salario" value={values.salaryType} onChange={(v) => setField('salaryType', v as EmploymentChangeInput['salaryType'])} options={toSelectOptions(SALARY_TYPE_LABELS)} />
        </div>
        <div className="form-grid-2 max-sm:grid-cols-1!">
          <HrSelectField label="Tipo de contrato" value={values.contractType} onChange={(v) => setField('contractType', v as EmploymentChangeInput['contractType'])} options={toSelectOptions(CONTRACT_TYPE_LABELS)} />
          <HrTextField label="Fin del contrato" type="date" required={values.contractType === 'TERMINO_FIJO'} value={values.contractEndDate} onChange={(v) => setField('contractEndDate', v)} error={errors.contractEndDate} min={employee.hireDate} />
        </div>
        <div className="form-grid-2 max-sm:grid-cols-1!">
          <HrSelectField label="Jornada" value={values.workSchedule} onChange={(v) => setField('workSchedule', v as EmploymentChangeInput['workSchedule'])} options={toSelectOptions(WORK_SCHEDULE_LABELS)} />
          <HrTextField label="Horas semanales" value={values.weeklyHours} onChange={(v) => setField('weeklyHours', v)} error={errors.weeklyHours} inputMode="decimal" maxLength={5} />
        </div>
        <HrTextField label="Fecha efectiva" type="date" required value={values.effectiveDate} onChange={(v) => setField('effectiveDate', v)} error={errors.effectiveDate} min={employee.hireDate} />
        <HrTextAreaField label="Motivo del cambio" required value={values.reason} onChange={(v) => setField('reason', v)} error={errors.reason} maxLength={1000} placeholder="Ej: Ascenso aprobado por gerencia" />
        <HrFormFooter onCancel={onClose} isSubmitting={isSubmitting} submitLabel="Registrar movimiento" />
      </form>
    </HrModal>
  )
}
