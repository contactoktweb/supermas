'use client'

import React, { useCallback, useMemo, useState } from 'react'
import type { SelectOption } from '@/components/ui/CustomSelect'
import { FileUpload } from '@/components/ui/FileUpload'
import { HrDrawer } from '../shared/HrDrawer'
import {
  HrCheckboxField,
  HrFormError,
  HrFormFooter,
  HrFormSection,
  HrSelectField,
  HrTextAreaField,
  HrTextField,
} from '../shared/HrFormFields'
import { useHrForm } from '../../hooks/useHrForm'
import { useHrQuery } from '../../hooks/useHrQuery'
import { useHrCatalogs } from '../../hooks/useHrCatalogs'
import { hrOrgService } from '../../services/hr-org.service'
import { hrEmployeeService } from '../../services/hr-employee.service'
import { hrDocumentService } from '../../services/hr-document.service'
import {
  bankAccountSchema,
  employeeCreateSchema,
  employeePersonalSchema,
  type EmployeeCreateInput,
} from '../../schemas/hr.schema'
import {
  ARL_RISK_CLASSES,
  BANK_ACCOUNT_TYPE_LABELS,
  CONTRACT_TYPE_LABELS,
  DOCUMENT_ID_TYPE_LABELS,
  DOCUMENT_TYPE_LABELS,
  HR_DOCUMENT_MAX_BYTES,
  HR_DOCUMENT_MIME_TYPES,
  SALARY_TYPE_LABELS,
  WORK_SCHEDULE_LABELS,
  toSelectOptions,
} from '../../constants'
import { todayIso } from '../../utils/hr-format'
import type { Employee } from '../../types'

interface EmployeeFormDrawerProps {
  employee: Employee | null
  canSensitive: boolean
  onClose: () => void
  /** `warning` llega cuando el empleado se creó pero el soporte adjunto no se pudo guardar. */
  onSaved: (employeeId: string, fullName: string, warning?: string) => void
}

type EmployeeFormValues = EmployeeCreateInput & { accountNumber: string }

const RISK_OPTIONS: SelectOption[] = [
  { value: '', label: 'Sin definir' },
  ...ARL_RISK_CLASSES.map((risk) => ({ value: String(risk), label: `Clase ${risk}` })),
]

const initialValues = (employee: Employee | null): EmployeeFormValues => ({
  documentType: employee?.documentType ?? 'CC',
  documentNumber: employee?.documentNumber ?? '',
  firstName: employee?.firstName ?? '',
  lastName: employee?.lastName ?? '',
  birthDate: employee?.birthDate ?? '',
  email: employee?.email ?? '',
  phone: employee?.phone ?? '',
  address: employee?.address ?? '',
  city: employee?.city ?? '',
  department: employee?.department ?? '',
  emergencyContactName: employee?.emergencyContactName ?? '',
  emergencyContactPhone: employee?.emergencyContactPhone ?? '',
  emergencyContactRelationship: employee?.emergencyContactRelationship ?? '',
  eps: employee?.eps ?? '',
  afp: employee?.afp ?? '',
  arl: employee?.arl ?? '',
  arlRiskClass: employee?.arlRiskClass ? String(employee.arlRiskClass) : '',
  ccf: employee?.ccf ?? '',
  severanceFund: employee?.severanceFund ?? '',
  bankName: employee?.bankName ?? '',
  bankAccountType: employee?.bankAccountType ?? '',
  userId: employee?.userId ?? '',
  dataConsentAt: employee?.dataConsentAt ?? todayIso(),
  dataConsentVersion: employee?.dataConsentVersion ?? '',
  notes: employee?.notes ?? '',
  positionId: employee?.positionId ?? '',
  areaId: employee?.areaId ?? '',
  locationId: employee?.locationId ?? '',
  managerEmployeeId: employee?.managerEmployeeId ?? '',
  contractType: employee?.contractType ?? 'INDEFINIDO',
  contractEndDate: employee?.contractEndDate ?? '',
  salary: employee ? String(employee.salary) : '',
  salaryType: employee?.salaryType ?? 'ORDINARIO',
  workSchedule: employee?.workSchedule ?? 'TIEMPO_COMPLETO',
  weeklyHours: employee?.weeklyHours ? String(employee.weeklyHours) : '',
  hireDate: employee?.hireDate ?? todayIso(),
  dataConsentAccepted: Boolean(employee),
  accountNumber: '',
})

/**
 * Alta de empleado (datos personales + condiciones de ingreso) o edición de datos personales.
 * Las condiciones laborales de un empleado existente se cambian con un movimiento laboral.
 */
export function EmployeeFormDrawer({ employee, canSensitive, onClose, onSaved }: EmployeeFormDrawerProps) {
  const isEdit = Boolean(employee)
  const form = useHrForm<EmployeeFormValues>(initialValues(employee))
  const { values, setField, errors, isSubmitting } = form
  const { options, isLoading: catalogsLoading } = useHrCatalogs()
  const [consentFile, setConsentFile] = useState<File | null>(null)
  const [consentPreview, setConsentPreview] = useState('')
  const [consentFileError, setConsentFileError] = useState('')

  const loadPeople = useCallback(
    () => Promise.all([hrOrgService.listEmployeeOptions(), hrOrgService.listErpUsers()]),
    []
  )
  const people = useHrQuery(loadPeople)

  const managerOptions: SelectOption[] = useMemo(
    () => [
      { value: '', label: 'Sin jefe inmediato' },
      ...(people.data?.[0] ?? []).filter((o) => o.id !== employee?.id).map((o) => ({ value: o.id, label: o.name })),
    ],
    [people.data, employee?.id]
  )
  const userOptions: SelectOption[] = useMemo(
    () => [
      { value: '', label: 'Sin usuario del ERP' },
      ...(people.data?.[1] ?? []).map((u) => ({ value: u.id, label: u.name, description: u.email })),
    ],
    [people.data]
  )

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (consentFile && !(HR_DOCUMENT_MIME_TYPES as readonly string[]).includes(consentFile.type)) {
      setConsentFileError('La autorización debe ser PDF, JPG o PNG.')
      return
    }
    if (consentFile && consentFile.size > HR_DOCUMENT_MAX_BYTES) {
      setConsentFileError('La autorización debe pesar como máximo 5 MB.')
      return
    }
    let savedId = employee?.id ?? ''
    const ok = await form.submit(isEdit ? employeePersonalSchema : employeeCreateSchema, async (data) => {
      const accountNumber = data.accountNumber.trim()
      if (canSensitive && accountNumber && !bankAccountSchema.safeParse({ accountNumber }).success) {
        throw new Error('Número de cuenta: entre 4 y 30 dígitos.')
      }
      if (employee) {
        await hrEmployeeService.updatePersonal(employee.id, data)
      } else {
        savedId = await hrEmployeeService.create(data)
      }
      if (canSensitive && accountNumber) {
        await hrEmployeeService.saveBankAccountNumber(savedId, accountNumber)
      }
    })
    if (!ok) return
    const fullName = `${values.firstName.trim()} ${values.lastName.trim()}`
    let warning: string | undefined
    if (!isEdit && consentFile) {
      // El empleado ya existe: un fallo aquí no debe repetir el alta, solo avisar.
      try {
        await hrDocumentService.upload(savedId, {
          documentType: 'AUTORIZACION_DATOS',
          name: DOCUMENT_TYPE_LABELS.AUTORIZACION_DATOS,
          description: values.dataConsentVersion.trim(),
          issueDate: values.dataConsentAt,
          expiresAt: '',
          file: consentFile,
        })
      } catch {
        warning = 'No se pudo guardar la autorización adjunta. Cárguela desde la ficha del empleado, pestaña Documentos.'
      }
    }
    onSaved(savedId, fullName, warning)
  }

  const positionHint = useMemo(
    () => options.activePositions.find((p) => p.value === values.positionId)?.description,
    [options.activePositions, values.positionId]
  )

  return (
    <HrDrawer
      eyebrow={isEdit ? 'Actualizar información' : 'Ingreso de personal'}
      title={isEdit ? `${employee?.firstName} ${employee?.lastName}` : 'Registrar empleado'}
      icon={isEdit ? 'edit' : 'userPlus'}
      isBusy={isSubmitting}
      onClose={onClose}
    >
      <HrFormError message={errors.form} />
      <form onSubmit={handleSubmit} noValidate className="product-form-body">
        <div className="form-tab-content flex flex-col gap-4">
          <HrFormSection title="Identificación">
            <div className="form-grid-2 max-sm:grid-cols-1!">
              <HrSelectField label="Tipo de documento" required value={values.documentType} onChange={(v) => setField('documentType', v as EmployeeFormValues['documentType'])} options={toSelectOptions(DOCUMENT_ID_TYPE_LABELS)} error={errors.documentType} />
              <HrTextField label="Número de documento" required value={values.documentNumber} onChange={(v) => setField('documentNumber', v)} error={errors.documentNumber} maxLength={20} inputMode="text" />
            </div>
            <div className="form-grid-2 max-sm:grid-cols-1!">
              <HrTextField label="Nombres" required value={values.firstName} onChange={(v) => setField('firstName', v)} error={errors.firstName} maxLength={80} autoComplete="off" />
              <HrTextField label="Apellidos" required value={values.lastName} onChange={(v) => setField('lastName', v)} error={errors.lastName} maxLength={80} />
            </div>
            <HrTextField label="Fecha de nacimiento" type="date" value={values.birthDate} onChange={(v) => setField('birthDate', v)} error={errors.birthDate} max={todayIso()} />
          </HrFormSection>

          <HrFormSection title="Contacto">
            <div className="form-grid-2 max-sm:grid-cols-1!">
              <HrTextField label="Correo electrónico" type="email" value={values.email} onChange={(v) => setField('email', v)} error={errors.email} maxLength={150} />
              <HrTextField label="Teléfono" type="tel" value={values.phone} onChange={(v) => setField('phone', v)} error={errors.phone} maxLength={30} inputMode="tel" />
            </div>
            <HrTextField label="Dirección" value={values.address} onChange={(v) => setField('address', v)} error={errors.address} maxLength={200} />
            <div className="form-grid-2 max-sm:grid-cols-1!">
              <HrTextField label="Ciudad" value={values.city} onChange={(v) => setField('city', v)} error={errors.city} maxLength={80} />
              <HrTextField label="Departamento" value={values.department} onChange={(v) => setField('department', v)} error={errors.department} maxLength={80} />
            </div>
            <div className="form-grid-2 max-sm:grid-cols-1!">
              <HrTextField label="Contacto de emergencia" value={values.emergencyContactName} onChange={(v) => setField('emergencyContactName', v)} error={errors.emergencyContactName} maxLength={120} />
              <HrTextField label="Teléfono de emergencia" type="tel" value={values.emergencyContactPhone} onChange={(v) => setField('emergencyContactPhone', v)} error={errors.emergencyContactPhone} maxLength={30} />
            </div>
            <HrTextField label="Parentesco" value={values.emergencyContactRelationship} onChange={(v) => setField('emergencyContactRelationship', v)} error={errors.emergencyContactRelationship} maxLength={50} />
          </HrFormSection>

          <HrFormSection title="Seguridad social">
            <div className="form-grid-2 max-sm:grid-cols-1!">
              <HrTextField label="EPS" value={values.eps} onChange={(v) => setField('eps', v)} error={errors.eps} maxLength={100} />
              <HrTextField label="Fondo de pensiones (AFP)" value={values.afp} onChange={(v) => setField('afp', v)} error={errors.afp} maxLength={100} />
            </div>
            <div className="form-grid-2 max-sm:grid-cols-1!">
              <HrTextField label="ARL" value={values.arl} onChange={(v) => setField('arl', v)} error={errors.arl} maxLength={100} />
              <HrSelectField label="Clase de riesgo ARL" value={values.arlRiskClass} onChange={(v) => setField('arlRiskClass', v)} options={RISK_OPTIONS} error={errors.arlRiskClass} />
            </div>
            <div className="form-grid-2 max-sm:grid-cols-1!">
              <HrTextField label="Caja de compensación" value={values.ccf} onChange={(v) => setField('ccf', v)} error={errors.ccf} maxLength={100} />
              <HrTextField label="Fondo de cesantías" value={values.severanceFund} onChange={(v) => setField('severanceFund', v)} error={errors.severanceFund} maxLength={100} />
            </div>
          </HrFormSection>

          <HrFormSection title="Datos bancarios">
            <div className="form-grid-2 max-sm:grid-cols-1!">
              <HrTextField label="Banco" value={values.bankName} onChange={(v) => setField('bankName', v)} error={errors.bankName} maxLength={80} />
              <HrSelectField
                label="Tipo de cuenta"
                value={values.bankAccountType}
                onChange={(v) => setField('bankAccountType', v as EmployeeFormValues['bankAccountType'])}
                options={[{ value: '', label: 'Sin definir' }, ...toSelectOptions(BANK_ACCOUNT_TYPE_LABELS)]}
                error={errors.bankAccountType}
              />
            </div>
            {canSensitive ? (
              <HrTextField
                label="Número de cuenta"
                value={values.accountNumber}
                onChange={(v) => setField('accountNumber', v.replace(/[^\d]/g, ''))}
                error={errors.accountNumber}
                maxLength={30}
                inputMode="numeric"
                hint={isEdit ? `Actual: ${employee?.bankAccountMasked ?? 'sin registrar'}. Déjelo vacío para conservarlo.` : 'Solo visible para usuarios con acceso a datos sensibles.'}
              />
            ) : (
              <p className="m-0 text-xs text-[var(--muted)]">
                Cuenta registrada: {employee?.bankAccountMasked ?? 'sin registrar'}. El número completo solo lo gestiona un usuario con acceso a datos sensibles.
              </p>
            )}
          </HrFormSection>

          {!isEdit && (
            <HrFormSection title="Condiciones de ingreso">
              <div className="form-grid-2 max-sm:grid-cols-1!">
                <HrTextField label="Fecha de ingreso" type="date" required value={values.hireDate} onChange={(v) => setField('hireDate', v)} error={errors.hireDate} />
                <HrSelectField
                  label="Cargo"
                  required
                  value={values.positionId}
                  onChange={(v) => setField('positionId', v)}
                  options={options.activePositions}
                  placeholder={catalogsLoading ? 'Cargando cargos...' : 'Seleccione el cargo'}
                  error={errors.positionId}
                  hint={positionHint ? `Área del cargo: ${positionHint}` : undefined}
                />
              </div>
              <div className="form-grid-2 max-sm:grid-cols-1!">
                <HrSelectField label="Área" value={values.areaId} onChange={(v) => setField('areaId', v)} options={[{ value: '', label: 'La del cargo' }, ...options.activeAreas]} error={errors.areaId} />
                <HrSelectField label="Sede (bodega o punto de venta)" value={values.locationId} onChange={(v) => setField('locationId', v)} options={[{ value: '', label: 'Sin sede asignada' }, ...options.locations]} error={errors.locationId} />
              </div>
              <div className="form-grid-2 max-sm:grid-cols-1!">
                <HrSelectField label="Tipo de contrato" required value={values.contractType} onChange={(v) => setField('contractType', v as EmployeeFormValues['contractType'])} options={toSelectOptions(CONTRACT_TYPE_LABELS)} error={errors.contractType} />
                <HrTextField
                  label="Fin del contrato"
                  type="date"
                  required={values.contractType === 'TERMINO_FIJO'}
                  value={values.contractEndDate}
                  onChange={(v) => setField('contractEndDate', v)}
                  error={errors.contractEndDate}
                  min={values.hireDate}
                />
              </div>
              <div className="form-grid-2 max-sm:grid-cols-1!">
                <HrTextField label="Salario mensual" required value={values.salary} onChange={(v) => setField('salary', v.replace(/[^\d]/g, ''))} error={errors.salary} inputMode="numeric" prefix="$" maxLength={13} />
                <HrSelectField label="Tipo de salario" value={values.salaryType} onChange={(v) => setField('salaryType', v as EmployeeFormValues['salaryType'])} options={toSelectOptions(SALARY_TYPE_LABELS)} error={errors.salaryType} />
              </div>
              <div className="form-grid-2 max-sm:grid-cols-1!">
                <HrSelectField label="Jornada" value={values.workSchedule} onChange={(v) => setField('workSchedule', v as EmployeeFormValues['workSchedule'])} options={toSelectOptions(WORK_SCHEDULE_LABELS)} error={errors.workSchedule} />
                <HrTextField label="Horas semanales" value={values.weeklyHours} onChange={(v) => setField('weeklyHours', v)} error={errors.weeklyHours} inputMode="decimal" maxLength={5} />
              </div>
              <HrSelectField label="Jefe inmediato" value={values.managerEmployeeId} onChange={(v) => setField('managerEmployeeId', v)} options={managerOptions} error={errors.managerEmployeeId} />
            </HrFormSection>
          )}

          <HrFormSection title="Vínculo con el ERP">
            <HrSelectField
              label="Usuario del ERP"
              value={values.userId}
              onChange={(v) => setField('userId', v)}
              options={userOptions}
              error={errors.userId}
              hint="Opcional. Relaciona al empleado con su cuenta de acceso sin modificarla."
            />
          </HrFormSection>

          <HrFormSection title="Tratamiento de datos personales (Ley 1581 de 2012)">
            <div className="form-grid-2 max-sm:grid-cols-1!">
              <HrTextField label="Fecha de la autorización" type="date" required value={values.dataConsentAt} onChange={(v) => setField('dataConsentAt', v)} error={errors.dataConsentAt} max={todayIso()} />
              <HrTextField label="Versión de la política autorizada" required value={values.dataConsentVersion} onChange={(v) => setField('dataConsentVersion', v)} error={errors.dataConsentVersion} maxLength={40} placeholder="Ej: Política de datos v1" />
            </div>
            {!isEdit && (
              <>
                <FileUpload
                  label="Autorización firmada (opcional)"
                  accept={HR_DOCUMENT_MIME_TYPES.join(',')}
                  fileType="any"
                  compact
                  value={consentPreview}
                  helperText="PDF, JPG o PNG de máximo 5 MB. Se guarda en los Documentos del empleado."
                  error={consentFileError || undefined}
                  onChange={(dataUrl, file) => {
                    setConsentFile(file)
                    setConsentPreview(dataUrl)
                    setConsentFileError('')
                    setField('dataConsentAccepted', true)
                  }}
                  onRemove={() => {
                    setConsentFile(null)
                    setConsentPreview('')
                    setConsentFileError('')
                  }}
                />
                <HrCheckboxField
                  label="El empleado firmó la autorización de tratamiento de sus datos personales"
                  description={
                    consentFile
                      ? 'El documento adjunto se guardará en la pestaña Documentos al registrar el ingreso.'
                      : 'Si no lo tiene a mano, puede cargarlo después desde la ficha del empleado, pestaña Documentos.'
                  }
                  checked={values.dataConsentAccepted === true}
                  onChange={(v) => setField('dataConsentAccepted', v)}
                  error={errors.dataConsentAccepted}
                />
              </>
            )}
            <HrTextAreaField label="Observaciones" value={values.notes} onChange={(v) => setField('notes', v)} error={errors.notes} maxLength={1000} />
          </HrFormSection>
        </div>

        <HrFormFooter
          className="dialog-footer form-drawer-footer"
          onCancel={onClose}
          isSubmitting={isSubmitting}
          submitLabel={isEdit ? 'Guardar cambios' : 'Registrar ingreso'}
        />
      </form>
    </HrDrawer>
  )
}
