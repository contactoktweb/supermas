'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { DEFINITIVE_ROLES } from '@/features/users/services/role-permissions'
import type { RoleSummary } from '../../types'

interface RolesConsultationViewProps {
  roles: RoleSummary[]
}

/** Nombre del área para cada grupo de permisos (prefijo antes del punto: "sales.create" → "sales"). */
const AREA_LABELS: Record<string, string> = {
  sales: 'Ventas',
  pos: 'Punto de venta',
  invoices: 'Facturación electrónica',
  remissions: 'Remisiones',
  customers: 'Clientes',
  products: 'Productos',
  prices: 'Precios',
  inventory: 'Inventario',
  kardex: 'Kardex',
  warehouses: 'Bodegas',
  purchases: 'Compras',
  suppliers: 'Proveedores',
  treasury: 'Tesorería y caja menor',
  accounting: 'Contabilidad',
  financial: 'Reportes financieros',
  taxes: 'Impuestos',
  exogena: 'Información exógena',
  cost: 'Costos',
  costs: 'Costos',
  hr: 'Recursos humanos',
  users: 'Usuarios',
  settings: 'Configuración',
  audit: 'Auditoría',
}

/** Acciones que solo permiten mirar: si un área solo tiene estas, el rol la consulta pero no la modifica. */
const READ_ONLY_ACTIONS = new Set(['read'])

interface RoleArea {
  label: string
  readOnly: boolean
}

function roleAreas(permissions: string[]): RoleArea[] {
  const actionsByArea = new Map<string, Set<string>>()
  for (const permission of permissions) {
    const [area, action = ''] = permission.split('.')
    const label = AREA_LABELS[area]
    if (!label) continue
    const actions = actionsByArea.get(label) ?? new Set<string>()
    actions.add(action)
    actionsByArea.set(label, actions)
  }
  return [...actionsByArea.entries()]
    .map(([label, actions]) => ({ label, readOnly: [...actions].every((a) => READ_ONLY_ACTIONS.has(a)) }))
    .sort((a, b) => Number(a.readOnly) - Number(b.readOnly) || a.label.localeCompare(b.label))
}

export function RolesConsultationView({ roles }: RolesConsultationViewProps) {
  const roleOrder: readonly string[] = DEFINITIVE_ROLES
  const sortedRoles = [...roles].sort((a, b) => {
    const aIndex = roleOrder.indexOf(a.code)
    const bIndex = roleOrder.indexOf(b.code)
    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex
    if (aIndex !== -1) return -1
    if (bIndex !== -1) return 1
    return a.name.localeCompare(b.name)
  })

  if (sortedRoles.length === 0) {
    return <p className="text-sm text-slate-500">No hay roles configurados.</p>
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Esto es lo que puede hacer cada rol en el sistema. Los roles se asignan a cada persona desde el módulo{' '}
        <strong>Usuarios</strong>.
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {sortedRoles.map((role, index) => {
          const areas = roleAreas(role.permissions || [])
          const allLocations = role.scope === 'ALL_LOCATIONS'
          return (
            <article
              key={role.code}
              className="page-enter rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md motion-reduce:transition-none"
              style={{ animationDelay: `${Math.min(index, 8) * 0.04}s` }}
            >
              <header className="mb-2 flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[var(--navy)]">
                    <AppIcon name="users" size={16} />
                  </span>
                  <h3 className="text-sm font-bold text-[var(--navy)]">{role.name}</h3>
                </div>
                <span
                  className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                    allLocations
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 bg-slate-50 text-slate-600'
                  }`}
                >
                  {allLocations ? 'Todas las sedes' : 'Solo su sede'}
                </span>
              </header>

              {role.description && <p className="mb-3 text-xs leading-relaxed text-slate-600">{role.description}</p>}

              {areas.length > 0 && (
                <ul className="flex flex-wrap gap-1.5" aria-label={`Áreas de ${role.name}`}>
                  {areas.map((area) => (
                    <li
                      key={area.label}
                      className={`rounded-lg px-2 py-1 text-[11px] font-medium ${
                        area.readOnly ? 'bg-slate-50 text-slate-500' : 'bg-blue-50 text-[var(--navy)]'
                      }`}
                    >
                      {area.label}
                      {area.readOnly && <span className="text-slate-400"> · solo consulta</span>}
                    </li>
                  ))}
                </ul>
              )}
            </article>
          )
        })}
      </div>
    </div>
  )
}
