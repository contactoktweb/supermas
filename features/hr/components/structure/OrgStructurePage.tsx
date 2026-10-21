'use client'

import { useState } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { ScrollableTabs } from '@/components/ui/ScrollableTabs'
import { HrPageHeader } from '../shared/HrPageHeader'
import { HrKpiCard } from '../shared/HrKpiCard'
import { HrBadge } from '../shared/HrBadge'
import { HrAccessDenied, HrEmptyState, HrErrorBanner, HrTableSkeleton } from '../shared/HrStates'
import { HrToastContainer } from '../shared/HrToastContainer'
import { HR_PAGE_CLASS } from '../shared/hr-ui'
import { AreaFormModal } from './AreaFormModal'
import { PositionFormModal } from './PositionFormModal'
import { useHrPermissions } from '../../hooks/useHrPermissions'
import { useHrCatalogs } from '../../hooks/useHrCatalogs'
import { useHrToasts } from '../../hooks/useHrToasts'
import type { HrArea, HrPosition } from '../../types'

type StructureTab = 'areas' | 'positions'

export function OrgStructurePage() {
  const permissions = useHrPermissions()
  const { catalogs, options, isLoading, error, reload } = useHrCatalogs(permissions.canRead)
  const { toasts, notify, dismiss } = useHrToasts()
  const [tab, setTab] = useState<StructureTab>('areas')
  const [editingArea, setEditingArea] = useState<HrArea | null | undefined>(undefined)
  const [editingPosition, setEditingPosition] = useState<HrPosition | null | undefined>(undefined)

  if (!permissions.isLoading && !permissions.canRead) return <HrAccessDenied />

  const activeAreas = catalogs.areas.filter((a) => a.isActive).length
  const activePositions = catalogs.positions.filter((p) => p.isActive).length
  const assigned = catalogs.positions.reduce((sum, p) => sum + p.employeesCount, 0)
  const emptyPositions = catalogs.positions.filter((p) => p.isActive && p.employeesCount === 0).length

  return (
    <div className={HR_PAGE_CLASS}>
      <HrPageHeader
        eyebrow="Recursos Humanos • Estructura organizacional"
        title="Áreas y cargos"
        subtitle="Define las áreas de la empresa y los cargos a los que se asignan los empleados."
        actions={
          <>
            <button type="button" className="outline-button" onClick={() => void reload()} disabled={isLoading}>
              <AppIcon name="refresh" size={16} className={isLoading ? 'spin' : ''} />
              <span>Actualizar</span>
            </button>
            {permissions.canManage && (
              <>
                <button type="button" className="outline-button" onClick={() => setEditingArea(null)}>
                  <AppIcon name="structure" size={16} />
                  <span>Nueva área</span>
                </button>
                <button type="button" className="primary-button" onClick={() => setEditingPosition(null)}>
                  <AppIcon name="plus" size={16} />
                  <span>Nuevo cargo</span>
                </button>
              </>
            )}
          </>
        }
      />

      <section className="stats-grid max-lg:grid-cols-2! max-sm:grid-cols-1!" aria-label="Resumen de la estructura">
        <HrKpiCard title="Áreas activas" value={activeAreas} icon="structure" tone="blue" badge="Áreas" note={`${catalogs.areas.length} registradas`} index={1} />
        <HrKpiCard title="Cargos activos" value={activePositions} icon="briefcase" tone="teal" badge="Cargos" note={`${catalogs.positions.length} registrados`} index={2} />
        <HrKpiCard title="Empleados asignados" value={assigned} icon="users" tone="purple" badge="Planta" note="Empleados vigentes" index={3} />
        <HrKpiCard
          title="Cargos sin personal"
          value={emptyPositions}
          icon="info"
          tone={emptyPositions > 0 ? 'amber' : 'teal'}
          badge="Vacantes"
          note={emptyPositions > 0 ? 'Cargos activos sin asignar' : 'Todos los cargos asignados'}
          isPositive={emptyPositions === 0}
          index={4}
        />
      </section>

      {error && <HrErrorBanner message={error} onRetry={() => void reload()} />}

      <ScrollableTabs>
        <button type="button" role="tab" aria-selected={tab === 'areas'} className={`drawer-tab flex items-center gap-2 ${tab === 'areas' ? 'active' : ''}`} onClick={() => setTab('areas')}>
          <AppIcon name="structure" size={15} />
          <span>Áreas ({catalogs.areas.length})</span>
        </button>
        <button type="button" role="tab" aria-selected={tab === 'positions'} className={`drawer-tab flex items-center gap-2 ${tab === 'positions' ? 'active' : ''}`} onClick={() => setTab('positions')}>
          <AppIcon name="briefcase" size={15} />
          <span>Cargos ({catalogs.positions.length})</span>
        </button>
      </ScrollableTabs>

      <section className="table-panel animated-table page-enter" aria-labelledby="hr-structure-table-title">
        <h2 id="hr-structure-table-title" className="sr-only">
          {tab === 'areas' ? 'Listado de áreas' : 'Listado de cargos'}
        </h2>
        <div className="table-scroll">
          {tab === 'areas' ? (
            <table className="min-w-[720px]!">
              <thead>
                <tr>
                  <th scope="col">Área</th>
                  <th scope="col">Código</th>
                  <th scope="col">Cargos</th>
                  <th scope="col">Empleados</th>
                  <th scope="col">Estado</th>
                  <th scope="col" className="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <HrTableSkeleton columns={6} />
                ) : catalogs.areas.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <HrEmptyState icon="structure" title="Aún no hay áreas" description="Cree la primera área para organizar los cargos de la empresa." />
                    </td>
                  </tr>
                ) : (
                  catalogs.areas.map((area) => (
                    <tr key={area.id} className={area.isActive ? '' : 'opacity-60'}>
                      <td>
                        <strong className="block text-[13px] text-[var(--foreground)]">{area.name}</strong>
                        {area.description && <small className="max-w-[320px] truncate">{area.description}</small>}
                      </td>
                      <td className="mono">{area.code ?? '—'}</td>
                      <td>{area.positionsCount}</td>
                      <td>{area.employeesCount}</td>
                      <td>
                        <HrBadge tone={area.isActive ? 'success' : 'neutral'}>{area.isActive ? 'Activa' : 'Inactiva'}</HrBadge>
                      </td>
                      <td className="text-right">
                        {permissions.canManage && (
                          <button type="button" className="outline-button compact" onClick={() => setEditingArea(area)} aria-label={`Editar área ${area.name}`}>
                            <AppIcon name="edit" size={14} />
                            <span>Editar</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            <table className="min-w-[820px]!">
              <thead>
                <tr>
                  <th scope="col">Cargo</th>
                  <th scope="col">Código</th>
                  <th scope="col">Área</th>
                  <th scope="col">Riesgo ARL</th>
                  <th scope="col">Empleados</th>
                  <th scope="col">Estado</th>
                  <th scope="col" className="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <HrTableSkeleton columns={7} />
                ) : catalogs.positions.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <HrEmptyState icon="briefcase" title="Aún no hay cargos" description="Los empleados se registran sobre un cargo. Cree el primero para comenzar." />
                    </td>
                  </tr>
                ) : (
                  catalogs.positions.map((position) => (
                    <tr key={position.id} className={position.isActive ? '' : 'opacity-60'}>
                      <td>
                        <strong className="block text-[13px] text-[var(--foreground)]">{position.name}</strong>
                        {position.description && <small className="max-w-[320px] truncate">{position.description}</small>}
                      </td>
                      <td className="mono">{position.code ?? '—'}</td>
                      <td>{position.areaName ?? 'Sin área'}</td>
                      <td>{position.arlRiskClass ? `Clase ${position.arlRiskClass}` : '—'}</td>
                      <td>{position.employeesCount}</td>
                      <td>
                        <HrBadge tone={position.isActive ? 'success' : 'neutral'}>{position.isActive ? 'Activo' : 'Inactivo'}</HrBadge>
                      </td>
                      <td className="text-right">
                        {permissions.canManage && (
                          <button type="button" className="outline-button compact" onClick={() => setEditingPosition(position)} aria-label={`Editar cargo ${position.name}`}>
                            <AppIcon name="edit" size={14} />
                            <span>Editar</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {editingArea !== undefined && (
        <AreaFormModal
          area={editingArea}
          onClose={() => setEditingArea(undefined)}
          onSaved={(name) => {
            setEditingArea(undefined)
            notify('success', editingArea ? 'Área actualizada' : 'Área creada', name)
            void reload()
          }}
        />
      )}

      {editingPosition !== undefined && (
        <PositionFormModal
          position={editingPosition}
          areaOptions={options.activeAreas}
          onClose={() => setEditingPosition(undefined)}
          onSaved={(name) => {
            setEditingPosition(undefined)
            notify('success', editingPosition ? 'Cargo actualizado' : 'Cargo creado', name)
            void reload()
          }}
        />
      )}

      <HrToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}
