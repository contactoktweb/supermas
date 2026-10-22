'use client'

import React from 'react'
import { HrModal } from '../shared/HrModal'
import { HrCheckboxField, HrFormError, HrFormFooter, HrTextAreaField, HrTextField } from '../shared/HrFormFields'
import { useHrForm } from '../../hooks/useHrForm'
import { areaFormSchema, type AreaFormInput } from '../../schemas/hr.schema'
import { hrOrgService } from '../../services/hr-org.service'
import type { HrArea } from '../../types'

interface AreaFormModalProps {
  area: HrArea | null
  onClose: () => void
  onSaved: (name: string) => void
}

export function AreaFormModal({ area, onClose, onSaved }: AreaFormModalProps) {
  const form = useHrForm<AreaFormInput>({
    name: area?.name ?? '',
    code: area?.code ?? '',
    description: area?.description ?? '',
    isActive: area?.isActive ?? true,
  })
  const { values, setField, errors, isSubmitting } = form

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const ok = await form.submit(areaFormSchema, (data) => hrOrgService.saveArea(area?.id ?? null, data))
    if (ok) onSaved(values.name.trim())
  }

  return (
    <HrModal
      title={area ? 'Editar área' : 'Nueva área'}
      subtitle="Las áreas agrupan cargos y empleados."
      icon="structure"
      isBusy={isSubmitting}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} noValidate className="modal-form flex flex-col gap-3 pt-4">
        <HrFormError message={errors.form} />
        <div className="form-grid-2 max-sm:grid-cols-1!">
          <HrTextField label="Nombre" required value={values.name} onChange={(v) => setField('name', v)} error={errors.name} maxLength={120} placeholder="Ej: Logística" />
          <HrTextField label="Código" value={values.code} onChange={(v) => setField('code', v.toUpperCase())} error={errors.code} maxLength={20} placeholder="Ej: LOG" />
        </div>
        <HrTextAreaField label="Descripción" value={values.description} onChange={(v) => setField('description', v)} error={errors.description} maxLength={500} />
        <HrCheckboxField
          label={values.isActive ? 'Área activa' : 'Área inactiva'}
          description="Un área inactiva no se ofrece para nuevas asignaciones."
          checked={values.isActive}
          onChange={(v) => setField('isActive', v)}
        />
        <HrFormFooter onCancel={onClose} isSubmitting={isSubmitting} submitLabel={area ? 'Guardar cambios' : 'Crear área'} />
      </form>
    </HrModal>
  )
}
