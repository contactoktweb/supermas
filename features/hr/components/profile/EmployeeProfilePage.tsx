'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { AppIcon, type LightIconName } from '@/components/ui/Icon'
import { ScrollableTabs } from '@/components/ui/ScrollableTabs'
import { extractErrorMessage } from '@/lib/utils'
import { HrPageHeader } from '../shared/HrPageHeader'
import { HrBadge } from '../shared/HrBadge'
import { HrAccessDenied, HrCardSkeleton, HrEmptyState, HrErrorBanner } from '../shared/HrStates'
import { HrToastContainer } from '../shared/HrToastContainer'
import { HR_PAGE_CLASS } from '../shared/hr-ui'
import { EmployeeFormDrawer } from '../employees/EmployeeFormDrawer'
import { EmploymentChangeModal } from '../employees/EmploymentChangeModal'
import { TerminationModal } from '../employees/TerminationModal'
import { RehireModal } from '../employees/RehireModal'
import { EmployeePersonalTab } from './EmployeePersonalTab'
import { EmployeeLaborTab } from './EmployeeLaborTab'
import { EmployeeDocumentsTab } from './EmployeeDocumentsTab'
import { EmployeeNoveltiesTab } from './EmployeeNoveltiesTab'
import { EmployeeVacationsTab } from './EmployeeVacationsTab'
import { EmployeeHistoryTab } from './EmployeeHistoryTab'
import { useHrPermissions } from '../../hooks/useHrPermissions'
import { useHrQuery } from '../../hooks/useHrQuery'
import { useHrToasts } from '../../hooks/useHrToasts'
import { hrEmployeeService } from '../../services/hr-employee.service'
import { hrAbsenceService } from '../../services/hr-absence.service'
import { EMPLOYEE_STATUS_LABELS, EMPLOYEE_STATUS_TONES, HR_ROUTES } from '../../constants'
import { formatDate, formatDays, formatSeniority, initials } from '../../utils/hr-format'

type ProfileTab = 'datos' | 'laboral' | 'documentos' | 'novedades' | 'vacaciones' | 'historial'
type ProfileModal = 'edit' | 'change' | 'terminate' | 'rehire' | null

const TABS: { id: ProfileTab; label: string; icon: LightIconName }[] = [
  { id: 'datos', label: 'Datos personales', icon: 'users' },
  { id: 'laboral', label: 'Información laboral', icon: 'briefcase' },
  { id: 'documentos', label: 'Documentos', icon: 'folder' },
  { id: 'novedades', label: 'Novedades', icon: 'calendarMark' },
  { id: 'vacaciones', label: 'Vacaciones', icon: 'vacation' },
  { id: 'historial', label: 'Historial', icon: 'history' },
]

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const isProfileTab =(value: string | null): value is ProfileTab => TABS.some((tab) => tab.id === value)

export function EmployeeProfilePage({ employeeId }: { employeeId: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const requestedTab = searchParams.get('tab')
  const activeTab: ProfileTab = isProfileTab(requestedTab) ? requestedTab : 'datos'

  const permissions = useHrPermissions()
  const { toasts, notify, dismiss } = useHrToasts()
  const [modal, setModal] = useState<ProfileModal>(null)
  const [pendingVacationDays, setPendingVacationDays] = useState(0)
  const [isPreparingTermination, setIsPreparingTermination] = useState(false)

  // Actualiza causación y estado del empleado antes de mostrar su ficha
  const loader = useCallback(async () => {
    if (!UUID_PATTERN.test(employeeId)) return null
    await hrEmployeeService.refresh(employeeId).catch(() => undefined)
    return hrEmployeeService.getById(employeeId)
  }, [employeeId])
  const { data: employee, isLoading, error, reload } = useHrQuery(loader, permissions.canRead)

  const selectTab = (tab: ProfileTab) => {
    router.replace(`${pathname}?tab=${tab}`, { scroll: false })
  }

  const openTermination = async () => {
    if (!employee) return
    setIsPreparingTermination(true)
    try {
      const periods = await hrAbsenceService.listPeriods(employee.id, employee.hireDate)
      const available = periods.filter((p) => p.isCurrentEmployment).reduce((sum, p) => sum + p.balance, 0)
      setPendingVacationDays(Math.max(Math.round(available * 100) / 100, 0))
      setModal('terminate')
    } catch (err) {
      notify('error', 'No se pudo consultar el saldo de vacaciones', extractErrorMessage(err))
    } finally {
      setIsPreparingTermination(false)
    }
  }

  if (!permissions.isLoading && !permissions.canRead) return <HrAccessDenied />

  if (isLoading && !employee) {
    return (
      <div className={HR_PAGE_CLASS} aria-busy="true">
        <HrCardSkeleton height={110} />
        <HrCardSkeleton height={320} />
      </div>
    )
  }

  if (error && !employee) {
    return (
      <div className={HR_PAGE_CLASS}>
        <h1 className="sr-only">Ficha del empleado</h1>
        <HrErrorBanner message={error} onRetry={() => void reload()} />
      </div>
    )
  }

  if (!employee) {
    return (
      <section className="panel page-enter">
        <h1 className="sr-only">Empleado no encontrado</h1>
        <HrEmptyState
          icon="users"
          title="Empleado no encontrado"
          description="El empleado no existe o no pertenece a su empresa."
          action={
            <Link href={HR_ROUTES.employees} className="outline-button compact inline-flex items-center gap-2">
              <AppIcon name="chevronLeft" size={14} />
              <span>Volver a empleados</span>
            </Link>
          }
        />
      </section>
    )
  }

  const isRetired = employee.status === 'RETIRADO'
  const handleEmployeeChanged = () => void reload()

  return (
    <div className={HR_PAGE_CLASS}>
      <Link href={HR_ROUTES.employees} className="back-button w-fit" aria-label="Volver al listado de empleados">
        <AppIcon name="chevronLeft" size={14} />
        <span>Empleados</span>
      </Link>

      <HrPageHeader
        eyebrow={`${employee.employeeCode} • ${employee.documentType} ${employee.documentNumber}`}
        title={employee.fullName}
        subtitle={`${employee.positionName ?? 'Sin cargo'}${employee.areaName ? ` • ${employee.areaName}` : ''}${employee.locationName ? ` • ${employee.locationName}` : ''}`}
        actions={
          permissions.canManage ? (
            <>
              <button type="button" className="outline-button" onClick={() => setModal('edit')}>
                <AppIcon name="edit" size={16} />
                <span>Editar datos</span>
              </button>
              {isRetired ? (
                <button type="button" className="primary-button" onClick={() => setModal('rehire')}>
                  <AppIcon name="userPlus" size={16} />
                  <span>Registrar reingreso</span>
                </button>
              ) : (
                <>
                  <button type="button" className="outline-button" onClick={() => setModal('change')}>
                    <AppIcon name="briefcase" size={16} />
                    <span>Movimiento laboral</span>
                  </button>
                  <button type="button" className="danger-button" onClick={() => void openTermination()} disabled={isPreparingTermination}>
                    <AppIcon name={isPreparingTermination ? 'refresh' : 'userMinus'} size={16} className={isPreparingTermination ? 'spin' : ''} />
                    <span>Registrar retiro</span>
                  </button>
                </>
              )}
            </>
          ) : undefined
        }
      />

      <section className="panel page-enter flex flex-wrap items-center gap-4" aria-label="Resumen del empleado">
        <span className="product-thumb large text-lg font-bold" aria-hidden="true">
          {initials(employee.fullName)}
        </span>
        <dl className="m-0 grid flex-1 grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <dt className="text-[10px] font-semibold uppercase text-[var(--muted)]">Estado</dt>
            <dd className="m-0 mt-1">
              <HrBadge tone={EMPLOYEE_STATUS_TONES[employee.status]}>{EMPLOYEE_STATUS_LABELS[employee.status]}</HrBadge>
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase text-[var(--muted)]">Ingreso</dt>
            <dd className="m-0 mt-1 text-[13px] font-semibold">{formatDate(employee.hireDate)}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase text-[var(--muted)]">{isRetired ? 'Retiro' : 'Antigüedad'}</dt>
            <dd className="m-0 mt-1 text-[13px] font-semibold">
              {isRetired ? formatDate(employee.terminationDate) : formatSeniority(employee.hireDate)}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase text-[var(--muted)]">Jefe inmediato</dt>
            <dd className="m-0 mt-1 text-[13px] font-semibold">{employee.managerName ?? 'Sin asignar'}</dd>
          </div>
        </dl>
      </section>

      <ScrollableTabs>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`hr-tab-${tab.id}`}
            aria-selected={activeTab === tab.id}
            aria-controls="hr-profile-panel"
            className={`drawer-tab flex items-center gap-2 ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => selectTab(tab.id)}
          >
            <AppIcon name={tab.icon} size={15} />
            <span>{tab.label}</span>
          </button>
        ))}
      </ScrollableTabs>

      <section id="hr-profile-panel" role="tabpanel" aria-labelledby={`hr-tab-${activeTab}`} className="page-enter" key={activeTab}>
        <h2 className="sr-only">{TABS.find((tab) => tab.id === activeTab)?.label}</h2>
        {activeTab === 'datos' && <EmployeePersonalTab employee={employee} canSensitive={permissions.canSensitive} />}
        {activeTab === 'laboral' && <EmployeeLaborTab employee={employee} />}
        {activeTab === 'documentos' && <EmployeeDocumentsTab employee={employee} canDocuments={permissions.canDocuments} notify={notify} />}
        {activeTab === 'novedades' && (
          <EmployeeNoveltiesTab employee={employee} canManage={permissions.canManage} notify={notify} onEmployeeChanged={handleEmployeeChanged} />
        )}
        {activeTab === 'vacaciones' && (
          <EmployeeVacationsTab employee={employee} canManage={permissions.canManage} notify={notify} onEmployeeChanged={handleEmployeeChanged} />
        )}
        {activeTab === 'historial' && <EmployeeHistoryTab employee={employee} />}
      </section>

      {modal === 'edit' && (
        <EmployeeFormDrawer
          employee={employee}
          canSensitive={permissions.canSensitive}
          onClose={() => setModal(null)}
          onSaved={(_, name) => {
            setModal(null)
            notify('success', 'Datos actualizados', name)
            void reload()
          }}
        />
      )}
      {modal === 'change' && (
        <EmploymentChangeModal
          employee={employee}
          onClose={() => setModal(null)}
          onSaved={(events) => {
            setModal(null)
            notify('success', 'Movimiento laboral registrado', `${events} ${events === 1 ? 'cambio quedó' : 'cambios quedaron'} en el historial.`)
            void reload()
          }}
        />
      )}
      {modal === 'terminate' && (
        <TerminationModal
          employee={employee}
          pendingVacationDays={pendingVacationDays}
          onClose={() => setModal(null)}
          onSaved={(result) => {
            setModal(null)
            const compensation =
              result.vacationDaysCompensated > 0 ? ` Se registró la compensación de ${formatDays(result.vacationDaysCompensated)} de vacaciones.` : ''
            const erpUser = result.hasErpUser ? ' Tiene un usuario del ERP vinculado: desactívelo desde Usuarios si ya no debe ingresar.' : ''
            notify('info', 'Retiro registrado', `${employee.fullName} quedó retirado.${compensation}${erpUser}`)
            void reload()
          }}
        />
      )}
      {modal === 'rehire' && (
        <RehireModal
          employee={employee}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null)
            notify('success', 'Reingreso registrado', `${employee.fullName} quedó activo nuevamente.`)
            void reload()
          }}
        />
      )}

      <HrToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}
