'use client'

import React, { useState } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { AccountingVoucherType } from '../../types'
import { VoucherTypeUpdateData } from '../../schemas/accounting.schema'
import { VoucherTypeBadge } from '../VoucherTypeBadge'

interface VoucherTypesSectionProps {
  voucherTypes: AccountingVoucherType[]
  state: 'loading' | 'ready' | 'error' | 'stale'
  canManage: boolean
  onUpdate: (voucherType: AccountingVoucherType, changes: VoucherTypeUpdateData) => Promise<void>
  onRetry: () => void
}

/**
 * Catálogo de tipos de comprobante (FC, CC, RV...). Cada tipo numera sus asientos con su propio
 * consecutivo. Los tipos del sistema son fijos; los demás se pueden renombrar o desactivar.
 */
export function VoucherTypesSection({ voucherTypes, state, canManage, onUpdate, onRetry }: VoucherTypesSectionProps) {
  // Igual que la base (migración 064, is_admin()): solo ADMIN o SUPERADMIN editan el catálogo.
  const { hasRole } = useAuth()
  const isAdmin = hasRole(['ADMIN', 'SUPERADMIN'])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null)

  const activeCount = voucherTypes.filter((vt) => vt.isActive).length

  const startRename = (vt: AccountingVoucherType) => {
    setEditingId(vt.id)
    setDraftName(vt.name)
    setRowError(null)
  }

  const cancelRename = () => {
    setEditingId(null)
    setDraftName('')
  }

  const runUpdate = async (vt: AccountingVoucherType, changes: VoucherTypeUpdateData) => {
    setSavingId(vt.id)
    setRowError(null)
    try {
      await onUpdate(vt, changes)
      if (changes.name !== undefined) cancelRename()
    } catch (err: any) {
      setRowError({ id: vt.id, message: err?.message || 'No se pudo actualizar el tipo de comprobante.' })
    } finally {
      setSavingId(null)
    }
  }

  const saveRename = (vt: AccountingVoucherType) => {
    const name = draftName.trim()
    if (name.length < 3 || name.length > 80) {
      setRowError({ id: vt.id, message: 'El nombre debe tener entre 3 y 80 caracteres.' })
      return
    }
    if (name === vt.name) {
      cancelRename()
      return
    }
    void runUpdate(vt, { name })
  }

  return (
    <section
      className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm"
      aria-labelledby="voucher-types-title"
    >
      <div className="p-4 bg-gray-50 border-b flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="voucher-types-title" className="text-sm font-semibold text-gray-900">
            Tipos de comprobante
          </h2>
          <p className="text-xs text-gray-500">
            Cada asiento lleva un tipo con su propio consecutivo (por ejemplo{' '}
            <strong className="text-blue-900 font-mono">FC-000012</strong>). Los tipos del sistema son fijos; los demás
            los puede renombrar o desactivar un administrador.
          </p>
        </div>
        {voucherTypes.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="badge badge-blue">{voucherTypes.length} tipos</span>
            <span className="badge badge-teal">{activeCount} activos</span>
          </div>
        )}
      </div>

      {state === 'error' && voucherTypes.length === 0 ? (
        <div className="p-6 flex flex-col items-center gap-3 text-center text-xs text-rose-800" role="alert">
          <AppIcon name="warning" size={20} />
          <p>No se pudieron cargar los tipos de comprobante.</p>
          <button type="button" className="outline-button text-xs py-1" onClick={onRetry}>
            <AppIcon name="refresh" size={13} />
            <span>Reintentar</span>
          </button>
        </div>
      ) : state !== 'ready' && voucherTypes.length === 0 ? (
        <div className="p-4 space-y-2" aria-busy="true" aria-label="Cargando tipos de comprobante">
          {[0, 1, 2].map((row) => (
            <div key={row} className="h-10 rounded-lg bg-gray-100 animate-pulse motion-reduce:animate-none" />
          ))}
        </div>
      ) : voucherTypes.length === 0 ? (
        <div className="p-6 flex flex-col items-center gap-2 text-center text-xs text-gray-500">
          <AppIcon name="receipt" size={20} className="text-gray-400" />
          <p>La empresa no tiene tipos de comprobante configurados.</p>
        </div>
      ) : (
        <div className="table-scroll">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-gray-50/50 text-gray-600 text-left">
                <th scope="col" className="py-2.5 px-4 font-semibold w-20">Código</th>
                <th scope="col" className="py-2.5 px-4 font-semibold">Nombre</th>
                <th scope="col" className="py-2.5 px-4 font-semibold">Clase</th>
                <th scope="col" className="py-2.5 px-4 font-semibold">Estado</th>
                <th scope="col" className="py-2.5 px-4 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {voucherTypes.map((vt) => {
                const isEditing = editingId === vt.id
                const isSaving = savingId === vt.id
                const editable = canManage && isAdmin && !vt.isSystem
                return (
                  <tr key={vt.id} className="hover:bg-blue-50/30 transition-colors motion-reduce:transition-none align-top">
                    <td className="py-3 px-4">
                      <VoucherTypeBadge code={vt.code} voucherTypes={voucherTypes} />
                    </td>
                    <td className="py-3 px-4">
                      {isEditing ? (
                        <div className="flex flex-col gap-1.5 max-w-sm">
                          <label htmlFor={`voucher-name-${vt.id}`} className="sr-only">
                            Nuevo nombre del tipo {vt.code}
                          </label>
                          <input
                            id={`voucher-name-${vt.id}`}
                            className="w-full h-8 px-2.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all motion-reduce:transition-none"
                            value={draftName}
                            maxLength={80}
                            autoFocus
                            disabled={isSaving}
                            onChange={(e) => setDraftName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                saveRename(vt)
                              }
                              if (e.key === 'Escape') cancelRename()
                            }}
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              className="primary-button text-xs py-1"
                              onClick={() => saveRename(vt)}
                              disabled={isSaving}
                            >
                              {isSaving ? 'Guardando...' : 'Guardar'}
                            </button>
                            <button
                              type="button"
                              className="outline-button text-xs py-1"
                              onClick={cancelRename}
                              disabled={isSaving}
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <span className="font-semibold text-gray-900 block">{vt.name}</span>
                          {vt.description && <span className="text-[11px] text-gray-500 block">{vt.description}</span>}
                        </>
                      )}
                      {rowError?.id === vt.id && (
                        <p className="mt-1.5 text-[11px] text-rose-700" role="alert">
                          {rowError.message}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {vt.isSystem ? (
                        <span className="badge badge-purple inline-flex items-center gap-1">
                          <AppIcon name="lock" size={11} />
                          Sistema
                        </span>
                      ) : (
                        <span className="badge badge-gray">Configurable</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`badge ${vt.isActive ? 'badge-teal' : 'badge-gray'}`}>
                        {vt.isActive ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {editable && !isEditing && (
                        <div className="inline-flex flex-wrap justify-end gap-2">
                          <button
                            type="button"
                            className="outline-button text-xs py-1"
                            onClick={() => startRename(vt)}
                            disabled={isSaving}
                            aria-label={`Renombrar el tipo ${vt.code}`}
                          >
                            <AppIcon name="edit" size={13} />
                            <span>Renombrar</span>
                          </button>
                          <button
                            type="button"
                            className="outline-button text-xs py-1"
                            onClick={() => void runUpdate(vt, { isActive: !vt.isActive })}
                            disabled={isSaving}
                            aria-label={`${vt.isActive ? 'Desactivar' : 'Activar'} el tipo ${vt.code}`}
                          >
                            <AppIcon name={vt.isActive ? 'closeSimple' : 'checkSimple'} size={13} />
                            <span>{isSaving ? 'Guardando...' : vt.isActive ? 'Desactivar' : 'Activar'}</span>
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
