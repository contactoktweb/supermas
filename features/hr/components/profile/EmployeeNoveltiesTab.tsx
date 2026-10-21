'use client'

import { useCallback, useState } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { HrErrorBanner } from '../shared/HrStates'
import { NoveltyListPanel } from '../novelties/NoveltyListPanel'
import { NoveltyFormModal } from '../novelties/NoveltyFormModal'
import { useHrQuery } from '../../hooks/useHrQuery'
import { hrAbsenceService } from '../../services/hr-absence.service'
import type { HrNotify } from '../../hooks/useHrToasts'
import type { Employee } from '../../types'

interface EmployeeNoveltiesTabProps {
  employee: Employee
  canManage: boolean
  notify: HrNotify
  onEmployeeChanged: () => void
}

export function EmployeeNoveltiesTab({ employee, canManage, notify, onEmployeeChanged }: EmployeeNoveltiesTabProps) {
  const [isCreating, setIsCreating] = useState(false)
  const loader = useCallback(
    () => hrAbsenceService.listNovelties({ query: '', status: 'ALL', noveltyType: 'ALL', from: '', to: '', employeeId: employee.id }),
    [employee.id]
  )
  const { data, isLoading, error, reload } = useHrQuery(loader)
  const canCreate = canManage && employee.status !== 'RETIRADO'

  const handleChanged = () => {
    void reload()
    onEmployeeChanged()
  }

  return (
    <section className="flex flex-col gap-3" aria-labelledby="hr-novelties-tab-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 id="hr-novelties-tab-title" className="m-0 text-[14px] font-bold">
          Permisos, licencias, incapacidades y ausencias
        </h3>
        {canCreate && (
          <button type="button" className="primary-button compact" onClick={() => setIsCreating(true)}>
            <AppIcon name="plus" size={14} />
            <span>Registrar novedad</span>
          </button>
        )}
      </div>
      {error && <HrErrorBanner message={error} onRetry={() => void reload()} />}
      <NoveltyListPanel
        title={`Novedades de ${employee.fullName}`}
        novelties={data ?? []}
        isLoading={isLoading}
        showEmployee={false}
        canManage={canManage}
        notify={notify}
        onChanged={handleChanged}
      />
      {isCreating && (
        <NoveltyFormModal
          employeeId={employee.id}
          employeeName={employee.fullName}
          onClose={() => setIsCreating(false)}
          onSaved={() => {
            setIsCreating(false)
            notify('success', 'Novedad registrada', 'Queda pendiente de aprobación.')
            void reload()
          }}
        />
      )}
    </section>
  )
}
