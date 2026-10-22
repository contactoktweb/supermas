'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppIcon } from '@/components/ui/Icon'
import { HrPageHeader } from '../shared/HrPageHeader'
import { HrAccessDenied, HrErrorBanner } from '../shared/HrStates'
import { HrToastContainer } from '../shared/HrToastContainer'
import { HR_PAGE_CLASS } from '../shared/hr-ui'
import { EmployeeFilters } from './EmployeeFilters'
import { EmployeeTable } from './EmployeeTable'
import { EmployeeFormDrawer } from './EmployeeFormDrawer'
import { useHrPermissions } from '../../hooks/useHrPermissions'
import { useEmployees } from '../../hooks/useEmployees'
import { useHrCatalogs } from '../../hooks/useHrCatalogs'
import { useHrToasts } from '../../hooks/useHrToasts'
import { employeeProfilePath } from '../../constants'

export function EmployeesPage() {
  const router = useRouter()
  const permissions = useHrPermissions()
  const list = useEmployees(permissions.canRead)
  const { options } = useHrCatalogs(permissions.canRead)
  const { toasts, notify, dismiss } = useHrToasts()
  const [isCreating, setIsCreating] = useState(false)

  if (!permissions.isLoading && !permissions.canRead) return <HrAccessDenied />

  const createButton = permissions.canManage ? (
    <button type="button" className="primary-button" onClick={() => setIsCreating(true)}>
      <AppIcon name="userPlus" size={16} />
      <span>Registrar empleado</span>
    </button>
  ) : null

  return (
    <div className={HR_PAGE_CLASS}>
      <HrPageHeader
        eyebrow={`Recursos Humanos • ${list.total} ${list.total === 1 ? 'empleado' : 'empleados'} en el filtro`}
        title="Empleados"
        subtitle="Consulta y actualiza la información personal y laboral del personal de la empresa."
        actions={
          <>
            <button type="button" className="outline-button" onClick={() => void list.reload()} disabled={list.isLoading}>
              <AppIcon name="refresh" size={16} className={list.isLoading ? 'spin' : ''} />
              <span>Actualizar</span>
            </button>
            {createButton}
          </>
        }
      />

      <EmployeeFilters
        filters={list.filters}
        areaOptions={options.areas}
        positionOptions={options.positions}
        locationOptions={options.locations}
        onChange={list.updateFilters}
        onReset={list.resetFilters}
      />

      {list.error && <HrErrorBanner message={list.error} onRetry={() => void list.reload()} />}

      <EmployeeTable
        employees={list.employees}
        total={list.total}
        page={list.page}
        isLoading={list.isLoading}
        onPageChange={list.setPage}
        emptyAction={createButton}
      />

      {isCreating && (
        <EmployeeFormDrawer
          employee={null}
          canSensitive={permissions.canSensitive}
          onClose={() => setIsCreating(false)}
          onSaved={(id, name, warning) => {
            setIsCreating(false)
            notify('success', 'Empleado registrado', `${name} quedó activo con su evento de ingreso.`)
            if (warning) notify('error', 'Autorización pendiente', warning)
            router.push(employeeProfilePath(id))
          }}
        />
      )}

      <HrToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}
