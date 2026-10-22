'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { CustomSelect, type SelectOption } from '@/components/ui/CustomSelect'
import { HrPageHeader } from '../shared/HrPageHeader'
import { HrKpiCard } from '../shared/HrKpiCard'
import { HrAccessDenied, HrErrorBanner } from '../shared/HrStates'
import { HrToastContainer } from '../shared/HrToastContainer'
import { HR_PAGE_CLASS } from '../shared/hr-ui'
import { NoveltyListPanel } from './NoveltyListPanel'
import { NoveltyFormModal } from './NoveltyFormModal'
import { useHrPermissions } from '../../hooks/useHrPermissions'
import { useHrQuery } from '../../hooks/useHrQuery'
import { useHrToasts } from '../../hooks/useHrToasts'
import { hrAbsenceService } from '../../services/hr-absence.service'
import { NOVELTY_STATUS_LABELS, NOVELTY_TYPE_LABELS, UNPAID_NOVELTY_TYPES, toSelectOptions } from '../../constants'
import { addDaysIso, firstDayOfMonthIso, todayIso } from '../../utils/hr-format'
import type { NoveltyFilters } from '../../types'
import { DatePicker } from '@/components/ui/DatePicker'

const SEARCH_DEBOUNCE_MS = 300

const STATUS_OPTIONS: SelectOption[] = [{ value: 'ALL', label: 'Todos los estados' }, ...toSelectOptions(NOVELTY_STATUS_LABELS)]
const TYPE_OPTIONS: SelectOption[] = [{ value: 'ALL', label: 'Todos los tipos' }, ...toSelectOptions(NOVELTY_TYPE_LABELS)]

export function NoveltiesPage() {
  const permissions = useHrPermissions()
  const { toasts, notify, dismiss } = useHrToasts()
  const [isCreating, setIsCreating] = useState(false)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<NoveltyFilters>({
    query: '',
    status: 'ALL',
    noveltyType: 'ALL',
    from: addDaysIso(firstDayOfMonthIso(), -31),
    to: addDaysIso(todayIso(), 60),
  })

  useEffect(() => {
    const timer = setTimeout(() => setFilters((prev) => (prev.query === search ? prev : { ...prev, query: search })), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [search])

  const loader = useCallback(() => hrAbsenceService.listNovelties(filters), [filters])
  const { data, isLoading, error, reload } = useHrQuery(loader, permissions.canRead)
  const novelties = useMemo(() => data ?? [], [data])

  const stats = useMemo(() => {
    const today = todayIso()
    const approved = novelties.filter((n) => n.status === 'APROBADA')
    return {
      pending: novelties.filter((n) => n.status === 'PENDIENTE').length,
      activeToday: approved.filter((n) => n.startDate <= today && n.endDate >= today).length,
      incapacities: approved.filter((n) => n.noveltyType.startsWith('INCAPACIDAD')).length,
      unpaid: approved.filter((n) => UNPAID_NOVELTY_TYPES.includes(n.noveltyType)).length,
    }
  }, [novelties])

  if (!permissions.isLoading && !permissions.canRead) return <HrAccessDenied />

  const update = (patch: Partial<NoveltyFilters>) => setFilters((prev) => ({ ...prev, ...patch }))

  return (
    <div className={HR_PAGE_CLASS}>
      <HrPageHeader
        eyebrow="Recursos Humanos • Ausentismo"
        title="Novedades de personal"
        subtitle="Permisos, licencias, incapacidades, calamidades, suspensiones y ausencias con su aprobación."
        actions={
          <>
            <button type="button" className="outline-button" onClick={() => void reload()} disabled={isLoading}>
              <AppIcon name="refresh" size={16} className={isLoading ? 'spin' : ''} />
              <span>Actualizar</span>
            </button>
            {permissions.canManage && (
              <button type="button" className="primary-button" onClick={() => setIsCreating(true)}>
                <AppIcon name="plus" size={16} />
                <span>Registrar novedad</span>
              </button>
            )}
          </>
        }
      />

      <section className="stats-grid max-lg:grid-cols-2! max-sm:grid-cols-1!" aria-label="Resumen de novedades del filtro">
        <HrKpiCard title="Pendientes de aprobación" value={stats.pending} icon="clock" tone={stats.pending > 0 ? 'amber' : 'teal'} badge="Filtro" note={stats.pending > 0 ? 'Requieren revisión' : 'Sin pendientes'} isPositive={stats.pending === 0} index={1} />
        <HrKpiCard title="Vigentes hoy" value={stats.activeToday} icon="calendarMark" tone="blue" badge="Hoy" note="Personal ausente hoy" index={2} />
        <HrKpiCard title="Incapacidades aprobadas" value={stats.incapacities} icon="hospital" tone="purple" badge="Salud" note="En el rango consultado" index={3} />
        <HrKpiCard title="No remuneradas" value={stats.unpaid} icon="dollar" tone="red" badge="Nómina" note="Se reportan en la exportación" isPositive={stats.unpaid === 0} index={4} />
      </section>

      <div className="toolbar inventory-toolbar page-enter" role="search" aria-label="Filtros de novedades">
        <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(200px,2fr)_repeat(4,minmax(0,1fr))]">
          <div className="search-box inventory-search-box w-full!">
            <AppIcon name="search" size={15} color="#94a3b8" />
            <input type="search" placeholder="Empleado o descripción" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Buscar novedad" />
          </div>
          <CustomSelect size="sm" value={filters.status} onChange={(v) => update({ status: v as NoveltyFilters['status'] })} options={STATUS_OPTIONS} />
          <CustomSelect size="sm" value={filters.noveltyType} onChange={(v) => update({ noveltyType: v as NoveltyFilters['noveltyType'] })} options={TYPE_OPTIONS} />
          <label className="search-box w-full! text-[11px]">
            <span className="whitespace-nowrap">Desde</span>
            <DatePicker
              value={filters.from}
              aria-label="Desde"
              onChange={(value) => update({ from: value })}
            />
          </label>
          <label className="search-box w-full! text-[11px]">
            <span className="whitespace-nowrap">Hasta</span>
            <DatePicker
              value={filters.to}
              min={filters.from}
              aria-label="Hasta"
              onChange={(value) => update({ to: value })}
            />
          </label>
        </div>
      </div>

      {error && <HrErrorBanner message={error} onRetry={() => void reload()} />}

      <NoveltyListPanel
        title="Listado de novedades"
        novelties={novelties}
        isLoading={isLoading}
        showEmployee
        canManage={permissions.canManage}
        notify={notify}
        onChanged={() => void reload()}
      />

      {isCreating && (
        <NoveltyFormModal
          onClose={() => setIsCreating(false)}
          onSaved={() => {
            setIsCreating(false)
            notify('success', 'Novedad registrada', 'Queda pendiente de aprobación.')
            void reload()
          }}
        />
      )}

      <HrToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}
