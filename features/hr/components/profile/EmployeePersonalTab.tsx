'use client'

import { useState } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { extractErrorMessage } from '@/lib/utils'
import { HrInfoGrid } from '../shared/HrInfoGrid'
import { hrEmployeeService } from '../../services/hr-employee.service'
import { BANK_ACCOUNT_TYPE_LABELS, DOCUMENT_ID_TYPE_LABELS } from '../../constants'
import { formatDate } from '../../utils/hr-format'
import type { Employee } from '../../types'

interface EmployeePersonalTabProps {
  employee: Employee
  canSensitive: boolean
}

/** Datos personales, seguridad social, datos bancarios (enmascarados) y autorización de datos. */
export function EmployeePersonalTab({ employee, canSensitive }: EmployeePersonalTabProps) {
  const [accountNumber, setAccountNumber] = useState<string | null>(null)
  const [isRevealing, setIsRevealing] = useState(false)
  const [revealError, setRevealError] = useState<string | null>(null)

  const toggleAccount = async () => {
    if (accountNumber) {
      setAccountNumber(null)
      return
    }
    setIsRevealing(true)
    setRevealError(null)
    try {
      const number = await hrEmployeeService.getBankAccountNumber(employee.id)
      setAccountNumber(number ?? 'Sin registrar')
    } catch (err) {
      setRevealError(extractErrorMessage(err, 'No se pudo consultar la cuenta.'))
    } finally {
      setIsRevealing(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <HrInfoGrid
        title="Identificación y contacto"
        items={[
          { label: 'Documento', value: `${DOCUMENT_ID_TYPE_LABELS[employee.documentType]} ${employee.documentNumber}` },
          { label: 'Fecha de nacimiento', value: formatDate(employee.birthDate) },
          { label: 'Correo electrónico', value: employee.email },
          { label: 'Teléfono', value: employee.phone },
          { label: 'Dirección', value: employee.address },
          { label: 'Ciudad', value: [employee.city, employee.department].filter(Boolean).join(', ') },
          { label: 'Contacto de emergencia', value: employee.emergencyContactName },
          { label: 'Teléfono de emergencia', value: employee.emergencyContactPhone },
          { label: 'Parentesco', value: employee.emergencyContactRelationship },
        ]}
      />
      <HrInfoGrid
        title="Seguridad social"
        items={[
          { label: 'EPS', value: employee.eps },
          { label: 'Fondo de pensiones', value: employee.afp },
          { label: 'ARL', value: employee.arl },
          { label: 'Clase de riesgo ARL', value: employee.arlRiskClass ? `Clase ${employee.arlRiskClass}` : null },
          { label: 'Caja de compensación', value: employee.ccf },
          { label: 'Fondo de cesantías', value: employee.severanceFund },
        ]}
      />
      <HrInfoGrid
        title="Datos bancarios"
        action={
          canSensitive && employee.bankAccountMasked ? (
            <button type="button" className="outline-button compact" onClick={() => void toggleAccount()} disabled={isRevealing} aria-pressed={Boolean(accountNumber)}>
              <AppIcon name={accountNumber ? 'eyeOff' : 'eye'} size={14} />
              <span>{accountNumber ? 'Ocultar número' : 'Ver número completo'}</span>
            </button>
          ) : undefined
        }
        items={[
          { label: 'Banco', value: employee.bankName },
          { label: 'Tipo de cuenta', value: employee.bankAccountType ? BANK_ACCOUNT_TYPE_LABELS[employee.bankAccountType] : null },
          {
            label: 'Número de cuenta',
            value: revealError ? <span className="text-[var(--red)]">{revealError}</span> : (accountNumber ?? employee.bankAccountMasked),
          },
        ]}
      />
      <HrInfoGrid
        title="Tratamiento de datos y vínculo con el ERP"
        items={[
          { label: 'Autorización de datos', value: formatDate(employee.dataConsentAt) },
          { label: 'Versión de la política', value: employee.dataConsentVersion },
          { label: 'Usuario del ERP', value: employee.userName ?? 'Sin vincular' },
          { label: 'Observaciones', value: employee.notes },
        ]}
      />
    </div>
  )
}
