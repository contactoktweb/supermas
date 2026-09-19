'use client'

import React, { useState, useEffect } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { DistributorCatalogProduct, ProductCatalogConfigUpdate } from '../../types'

interface DistributorDirectPurchaseConfigModalProps {
  isOpen: boolean
  product: DistributorCatalogProduct | null
  onClose: () => void
  onSave: (productId: string, config: ProductCatalogConfigUpdate) => Promise<any>
}

export function DistributorDirectPurchaseConfigModal({
  isOpen,
  product,
  onClose,
  onSave,
}: DistributorDirectPurchaseConfigModalProps) {
  const [webSuperMas, setWebSuperMas] = useState(false)
  const [webDirectPurchaseEnabled, setWebDirectPurchaseEnabled] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (product) {
      setWebSuperMas(product.webSuperMas)
      setWebDirectPurchaseEnabled(product.webDirectPurchaseEnabled)
      setError(null)
    }
  }, [product])

  if (!isOpen || !product) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setSubmitting(true)
      setError(null)
      await onSave(product.id, {
        webSuperMas,
        webDirectPurchaseEnabled,
      })
      onClose()
    } catch (err: any) {
      setError(err.message || 'Error al actualizar configuración de compra.')
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
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
              <AppIcon name="purchases" size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 m-0">Modalidad de Compra Web</h2>
              <p className="text-xs text-slate-500 m-0">{product.sku}</p>
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

          <div>
            <span className="text-xs font-bold text-slate-900 block">{product.name}</span>
            <span className="text-[11px] text-slate-500">
              Categoría: {product.category} • Marca: {product.brand}
            </span>
          </div>

          <div className="space-y-3 pt-2">
            {/* Switch: Catálogo Super Más */}
            <label className="flex items-center justify-between p-3 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
              <div className="space-y-0.5 max-w-[320px]">
                <span className="text-xs font-bold text-slate-900 block">
                  Activo en Catálogo Super Más
                </span>
                <span className="text-[11px] text-slate-500 block">
                  El producto debe estar habilitado en la tienda online principal para permitir compras directas.
                </span>
              </div>
              <input
                type="checkbox"
                checked={webSuperMas}
                onChange={(e) => setWebSuperMas(e.target.checked)}
                className="rounded text-blue-600 cursor-pointer"
              />
            </label>

            {/* Switch: Compra Directa */}
            <label className="flex items-center justify-between p-3 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
              <div className="space-y-0.5 max-w-[320px]">
                <span className="text-xs font-bold text-slate-900 block">
                  Habilitar Botón &quot;Comprar Online&quot; en Distribuidora
                </span>
                <span className="text-[11px] text-slate-500 block">
                  Permite a los distribuidores agregar este ítem al carrito y generar el pedido web de inmediato.
                </span>
              </div>
              <input
                type="checkbox"
                checked={webDirectPurchaseEnabled}
                onChange={(e) => setWebDirectPurchaseEnabled(e.target.checked)}
                className="rounded text-blue-600 cursor-pointer"
              />
            </label>
          </div>

          <div className="p-3 rounded-lg bg-blue-50/70 border border-blue-200 text-[11px] text-blue-900 leading-relaxed">
            <strong>Regla del Sistema:</strong> Cuando ambos switches están activos, el catálogo distribuidor
            mostrará dos opciones: <em>&quot;Cotizar por WhatsApp&quot;</em> y <em>&quot;Comprar Online&quot;</em>.
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button type="button" onClick={onClose} className="outline-button text-xs py-2 px-4">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="primary-button text-xs py-2 px-4 flex items-center gap-1.5"
            >
              <AppIcon name="save" size={14} />
              <span>{submitting ? 'Guardando...' : 'Guardar Cambios'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
