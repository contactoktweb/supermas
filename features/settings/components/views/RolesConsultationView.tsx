'use client'

import React, { useState } from 'react'
import { AppIcon } from '@/components/ui/Icon'

interface RolesConsultationViewProps {
  roles: any[]
}

export function RolesConsultationView({ roles }: RolesConsultationViewProps) {
  const [selectedRoleCode, setSelectedRoleCode] = useState<string>(roles[0]?.code || 'SUPERADMIN')

  const activeRole = roles.find((r) => r.code === selectedRoleCode) || roles[0]

  return (
    <div className="space-y-6">
      {/* Notice Banner */}
      <div className="rounded-2xl border border-blue-200 bg-blue-50/80 p-4 flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-blue-100 text-[var(--navy)] flex items-center justify-center shrink-0">
          <AppIcon name="shield" size={18} />
        </div>
        <div className="space-y-1 text-xs">
          <strong className="text-[var(--navy)] block font-semibold">
            Matriz de Roles Predefinidos del Sistema (Solo Lectura)
          </strong>
          <p className="text-slate-600 leading-relaxed">
            Los roles del ERP son inmutables y están definidos a nivel de seguridad en el núcleo de la aplicación. La asignación de roles a miembros del equipo se realiza exclusivamente desde el módulo <strong>Usuarios</strong>.
          </p>
        </div>
      </div>

      {/* Role selector tabs */}
      <div className="flex flex-wrap gap-2 pb-2 border-b border-[#e2e8f0]">
        {roles.map((r) => (
          <button
            key={r.code}
            onClick={() => setSelectedRoleCode(r.code)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
              selectedRoleCode === r.code
                ? 'bg-[var(--navy)] text-white shadow-md'
                : 'bg-slate-100 text-slate-600 hover:text-[var(--navy)] hover:bg-slate-200'
            }`}
          >
            <AppIcon name="users" size={14} />
            <span>{r.name}</span>
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                selectedRoleCode === r.code
                  ? 'bg-white/20 text-white'
                  : 'bg-white text-slate-500 border border-slate-200'
              }`}
            >
              {r.permissions?.length || 0}
            </span>
          </button>
        ))}
      </div>

      {/* Role Details */}
      {activeRole && (
        <div className="rounded-2xl bg-white border border-[#e2e8f0] p-6 space-y-6 shadow-sm">
          {/* Top info */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#e2e8f0]">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-base font-bold text-[var(--navy)]">{activeRole.name}</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                  {activeRole.code}
                </span>
              </div>
              <p className="text-xs text-slate-500">{activeRole.description}</p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500">Alcance de Sede:</span>
              <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                {activeRole.scope === 'ALL_LOCATIONS' ? 'Todas las Bodegas (Global)' : 'Sede Asignada'}
              </span>
            </div>
          </div>

          {/* Permissions Matrix */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--navy)]">
                Permisos Asignados ({activeRole.permissions?.length || 0})
              </span>
              <span className="text-[11px] text-slate-400">Inmutables por seguridad</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {activeRole.permissions?.map((perm: string) => {
                const [mod] = perm.split('.')
                return (
                  <div
                    key={perm}
                    className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                      <span className="font-mono text-xs text-slate-700 truncate">{perm}</span>
                    </div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 shrink-0">
                      {mod}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
