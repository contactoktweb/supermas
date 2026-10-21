'use client'

import React from 'react'
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
import { positionFormSchema, type PositionFormInput } from '../../schemas/hr.schema'
import { hrOrgService } from '../../services/hr-org.service'
import { ARL_RISK_CLASSES } from '../../constants'
import type { HrPosition } from '../../types'

interface PositionFormModalProps {
  position: HrPosition | null
  areaOptions: SelectOption[]
  onClose: () => void
  onSaved: (name: string) => void
}

const RISK_OPTIONS: SelectOption[] = [
  { value: '', label: 'Sin definir' },
  ...ARL_RISK_CLASSES.map((risk) => ({ value: String(risk), label: `Clase ${risk}` })),
]

export function PositionFormModal({ position, areaOptions, onClose, onSaved }: PositionFormModalProps) {
  const form = useHrForm<PositionFormInput>({
    name: position?.name ?? '',
    code: position?.code ?? '',
    areaId: position?.areaId ?? '',
    description: position?.description ?? '',
    arlRiskClass: position?.arlRiskClass ? String(position.arlRiskClass) : '',
    isActive: position?.isActive ?? true,
  })
  const { values, setField, errors, isSubmitting } = form

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const ok = await form.submit(positionFormSchema, (data) => hrOrgService.savePosition(position?.id ?? null, data))
    if (ok) onSaved(values.name.trim())
  }

  return (
    <HrModal
      title={position ? 'Editar cargo' : 'Nuevo cargo'}
      subtitle="El cargo define el área por defecto del empleado."
      icon="briefcase"
      isBusy={isSubmitting}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} noValidate className="modal-form flex flex-col gap-3 pt-4">
        <HrFormError message={errors.form} />
        <div className="form-grid-2 max-sm:grid-cols-1!">
          <HrTextField label="Nombre del cargo" required value={values.name} onChange={(v) => setField('name', v)} error={errors.name} maxLength={120} placeholder="Ej: Auxiliar de bodega" />
          <HrTextField label="Código" value={values.code} onChange={(v) => setField('code', v.toUpperCase())} error={errors.code} maxLength={20} />
        </div>
        <div className="form-grid-2 max-sm:grid-cols-1!">
          <HrSelectField
            label="Área"
            value={values.areaId}
            onChange={(v) => setField('areaId', v)}
            options={[{ value: '', label: 'Sin área' }, ...areaOptions]}
            error={errors.areaId}
          />
          <HrSelectField
            label="Clase de riesgo ARL"
            value={values.arlRiskClass}
            onChange={(v) => setField('arlRiskClass', v)}
            options={RISK_OPTIONS}
            error={errors.arlRiskClass}
          />
        </div>
        <HrTextAreaField label="Funciones o descripción" value={values.description} onChange={(v) => setField('description', v)} error={errors.description} maxLength={500} />
        <HrCheckboxField
          label={values.isActive ? 'Cargo activo' : 'Cargo inactivo'}
          description="Un cargo inactivo no se puede asignar a nuevos empleados."
          checked={values.isActive}
          onChange={(v) => setField('isActive', v)}
        />
        <HrFormFooter onCancel={onClose} isSubmitting={isSubmitting} submitLabel={position ? 'Guardar cambios' : 'Crear cargo'} />
      </form>
    </HrModal>
  )
}
