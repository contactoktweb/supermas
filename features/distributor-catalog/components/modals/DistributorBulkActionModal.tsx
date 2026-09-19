'use client'

import React, { useState } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { BulkActionType } from '../../types'

interface DistributorBulkActionModalProps {
  isOpen: boolean
  action: BulkActionType | null
  selectedCount: number
  onClose: () => void
  onConfirm: (action: BulkActionType) => Promise<any>
}

export function DistributorBulkActionModal({
  isOpen,
  action,
  selectedCount,
  onClose,
  onConfirm,
}: DistributorBulkActionModalProps) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen || !action) return null

  const getActionDetails = () => {
    switch (action) {
      case 'PUBLISH':
        return {
          title: 'Publicar Productos en Catálogo Distribuidora',
          desc: `Se marcarán como visibles los ${selectedCount} productos seleccionados en el catálogo comercial mayorista.`,
          tone: 'blue',
        }
      case 'HIDE':
        return {
          title: 'Ocultar Productos del Catálogo Distribuidora',
          desc: `Los ${selectedCount} productos seleccionados dejarán de ser visibles para los clientes distribuidores.`,
          tone: 'slate',
        }
      case 'ENABLE_WHATSAPP':
        return {
          title: 'Activar Contacto por WhatsApp',
          desc: `Se habilitará el botón de consulta por WhatsApp en los ${selectedCount} productos seleccionados.`,
          tone: 'emerald',
        }
      case 'DISABLE_WHATSAPP':
        return {
          title: 'Desactivar Contacto por WhatsApp',
          desc: `Se ocultará el botón de consulta por WhatsApp en los ${selectedCount} productos seleccionados.`,
          tone: 'rose',
        }
      case 'ENABLE_DIRECT_PURCHASE':
        return {
          title: 'Habilitar Compra Directa Online',
          desc: `Se activará la opción de compra web directa para los ${selectedCount} productos (aplicable a aquellos activos en Super Más).`,
          tone: 'purple',
        }
      case 'DISABLE_DIRECT_PURCHASE':
        return {
          title: 'Deshabilitar Compra Directa Online',
          desc: `Los ${selectedCount} productos quedarán únicamente para consulta y cotización mayorista.`,
          tone: 'amber',
        }
    }
  }

  const details = getActionDetails()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setSubmitting(true)
      setError(null)
      await onConfirm(action)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Error al ejecutar la acción masiva.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="drawer-backdrop modal-center" onClick={onClose}>
      <div
        className="modal-card animate-scale-up"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 480,
          background: '#ffffff',
          borderRadius: 14,
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
              <AppIcon name="ecommerceDist" size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 m-0">Acción Masiva en Catálogo</h2>
              <p className="text-xs text-slate-500 m-0">{selectedCount} productos seleccionados</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200/50"
          >
            <AppIcon name="close" size={16} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <h3 className="text-sm font-bold text-slate-900 m-0">{details.title}</h3>
            <p className="text-xs text-slate-600 leading-relaxed m-0">{details.desc}</p>
          </div>

          <div className="p-3.5 rounded-xl bg-purple-50/70 border border-purple-200 text-xs text-purple-900">
            <span className="font-bold block mb-1">Trazabilidad en Auditoría:</span>
            Esta operación masiva modificará simultáneamente los productos maestros en la base de datos de Super Más y registrará un evento inmutable en el historial de auditoría.
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button type="button" onClick={onClose} className="outline-button text-xs py-2 px-4">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-lg bg-purple-600 text-white font-semibold text-xs hover:bg-purple-700 disabled:opacity-50 transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <AppIcon name="check" size={15} />
              <span>{submitting ? 'Aplicando...' : 'Confirmar Acción Masiva'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
