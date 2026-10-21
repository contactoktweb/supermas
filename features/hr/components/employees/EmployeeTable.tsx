'use client'

import React from 'react'
import Link from 'next/link'
import { AppIcon } from '@/components/ui/Icon'
import { HrBadge } from '../shared/HrBadge'
import { HrEmptyState, HrTableSkeleton } from '../shared/HrStates'
import {
  CONTRACT_TYPE_LABELS,
  EMPLOYEE_STATUS_LABELS,
  EMPLOYEE_STATUS_TONES,
  HR_LIST_PAGE_SIZE,
  employeeProfilePath,
} from '../../constants'
import { formatDate, initials } from '../../utils/hr-format'
import type { EmployeeListItem } from '../../types'

interface EmployeeTableProps {
  employees: EmployeeListItem[]
  total: number
  page: number
  isLoading: boolean
  onPageChange: (page: number) => void
  emptyAction?: React.ReactNode
}

const COLUMNS = 8

export function EmployeeTable({ employees, total, page, isLoading, onPageChange, emptyAction }: EmployeeTableProps) {
  const totalPages = Math.max(1, Math.ceil(total / HR_LIST_PAGE_SIZE))
  const from = total === 0 ? 0 : (page - 1) * HR_LIST_PAGE_SIZE + 1
  const to = Math.min(page * HR_LIST_PAGE_SIZE, total)

  return (
    <section className="table-panel animated-table page-enter" aria-labelledby="hr-employees-table-title">
      <h2 id="hr-employees-table-title" className="sr-only">
        Listado de empleados
      </h2>
      <div className="table-scroll">
        <table className="min-w-[980px]!">
          <thead>
            <tr>
              <th scope="col">Empleado</th>
              <th scope="col">Documento</th>
              <th scope="col">Cargo y área</th>
              <th scope="col">Sede</th>
              <th scope="col">Contrato</th>
              <th scope="col">Ingreso</th>
              <th scope="col">Estado</th>
              <th scope="col" className="text-right">
                Ficha
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <HrTableSkeleton columns={COLUMNS} />
            ) : employees.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS}>
                  <HrEmptyState
                    icon="users"
                    title="No se encontraron empleados"
                    description="No hay empleados registrados o que coincidan con los filtros aplicados."
                    action={emptyAction}
                  />
                </td>
              </tr>
            ) : (
              employees.map((employee) => (
                <tr key={employee.id} className={employee.status === 'RETIRADO' ? 'opacity-70' : ''}>
                  <td>
                    <div className="product-cell">
                      <span className="product-thumb text-[11px] font-bold" aria-hidden="true">
                        {initials(employee.fullName)}
                      </span>
                      <div>
                        <strong>{employee.fullName}</strong>
                        <span className="mono">{employee.employeeCode}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    {employee.documentType} {employee.documentNumber}
                  </td>
                  <td>
                    <span className="block font-semibold text-[var(--foreground)]">{employee.positionName ?? '—'}</span>
                    <small>{employee.areaName ?? 'Sin área'}</small>
                  </td>
                  <td>{employee.locationName ?? 'Sin sede'}</td>
                  <td>{CONTRACT_TYPE_LABELS[employee.contractType]}</td>
                  <td>
                    {formatDate(employee.hireDate)}
                    {employee.terminationDate && <small>Retiro: {formatDate(employee.terminationDate)}</small>}
                  </td>
                  <td>
                    <HrBadge tone={EMPLOYEE_STATUS_TONES[employee.status]}>{EMPLOYEE_STATUS_LABELS[employee.status]}</HrBadge>
                  </td>
                  <td className="text-right">
                    <Link
                      href={employeeProfilePath(employee.id)}
                      className="outline-button compact inline-flex items-center gap-1"
                      aria-label={`Ver ficha de ${employee.fullName}`}
                    >
                      <AppIcon name="eye" size={14} />
                      <span>Ver ficha</span>
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!isLoading && total > 0 && (
        <nav className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] px-4 py-3 text-xs text-[var(--muted)]" aria-label="Paginación de empleados">
          <span>
            {from} a {to} de {total} empleados
          </span>
          <div className="flex items-center gap-2">
            <button type="button" className="outline-button compact" onClick={() => onPageChange(page - 1)} disabled={page <= 1} aria-label="Página anterior">
              <AppIcon name="chevronLeft" size={14} />
            </button>
            <span aria-current="page">
              Página {page} de {totalPages}
            </span>
            <button type="button" className="outline-button compact" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages} aria-label="Página siguiente">
              <AppIcon name="chevronRight" size={14} />
            </button>
          </div>
        </nav>
      )}
    </section>
  )
}
