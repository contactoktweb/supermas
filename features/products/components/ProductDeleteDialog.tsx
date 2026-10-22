'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '@/components/ui/Icon'
import { Product } from '../types'
import { productService } from '../services/product.service'

interface ProductDeleteDialogProps {
  product: Product | null
  isOpen: boolean
  onClose: () => void
  onConfirm: (id: string) => Promise<void>
}

export function ProductDeleteDialog({
  product,
  isOpen,
  onClose,
  onConfirm,
}: ProductDeleteDialogProps) {
  const [mounted, setMounted] = useState(false)
  const [step, setStep] = useState<1 | 2>(1)
  const [confirmationWord, setConfirmationWord] = useState('')
  const [acknowledged, setAcknowledged] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [usageCheck, setUsageCheck] = useState<{
    loading: boolean
    hasTransactions: boolean
    movementsCount: number
    salesCount: number
  }>({
    loading: false,
    hasTransactions: false,
    movementsCount: 0,
    salesCount: 0,
  })

  useEffect(() => {
    setMounted(true)
  }, [])

  // Reset states when opening
  useEffect(() => {
    if (isOpen && product) {
      setStep(1)
      setConfirmationWord('')
      setAcknowledged(false)
      setError(null)

      // Verificar si el producto tiene historial en Kardex o ventas
      setUsageCheck({ loading: true, hasTransactions: false, movementsCount: 0, salesCount: 0 })
      productService
        .checkProductTransactions(product.id)
        .then((res) => {
          setUsageCheck({
            loading: false,
            hasTransactions: res.hasHistoricalRecords,
            movementsCount: res.movementsCount,
            salesCount: res.salesCount,
          })
        })
        .catch(() => {
          setUsageCheck({ loading: false, hasTransactions: false, movementsCount: 0, salesCount: 0 })
        })
    }
  }, [isOpen, product])

  if (!isOpen || !product || !mounted) return null

  const isConfirmedCorrectly = confirmationWord.trim() === 'CONFIRMAR'
  const isLowercaseWarning =
    confirmationWord.trim().toLowerCase() === 'confirmar' && confirmationWord.trim() !== 'CONFIRMAR'

  const handleDelete = async () => {
    if (!isConfirmedCorrectly) return

    try {
      setIsDeleting(true)
      setError(null)
      await onConfirm(product.id)
      onClose()
    } catch (err: any) {
      setError(err?.message || 'Ocurrió un error al intentar eliminar el producto.')
    } finally {
      setIsDeleting(false)
    }
  }

  return createPortal(
    <div
      className="drawer-backdrop modal-center p-3 sm:p-4 z-50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-product-title"
    >
      <div
        className="modal-card animate-scale-up"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 540,
          background: '#ffffff',
          borderRadius: 16,
          boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.35)',
          overflow: 'hidden',
          border: '1px solid #fee2e2',
        }}
      >
        {/* Cabecera de Alerta Crítica */}
        <div className="px-6 py-4 border-b border-red-100 bg-red-50/70 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
              <AppIcon name="trash" size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-200">
                  Acción Irreversible
                </span>
                <span className="text-[10.5px] font-bold text-slate-500">
                  Doble Confirmación ({step}/2)
                </span>
              </div>
              <h2 id="delete-product-title" className="text-base font-extrabold text-slate-900 m-0 mt-0.5">
                Eliminar Producto Definitivamente
              </h2>
            </div>
          </div>

          <button
            type="button"
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-red-100/60 transition-colors"
            onClick={onClose}
            aria-label="Cerrar ventana de eliminación"
          >
            <AppIcon name="close" size={18} />
          </button>
        </div>

        {/* Cuerpo del Diálogo */}
        <div className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-center gap-2.5">
              <AppIcon name="warning" size={18} className="text-rose-600 shrink-0" />
              <span className="font-semibold">{error}</span>
            </div>
          )}

          {/* Ficha Resumen del Producto a Eliminar */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 rounded-lg bg-white border border-slate-200 flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
                {product.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <AppIcon name="products" size={22} className="text-slate-400" />
                )}
              </div>
              <div className="min-w-0">
                <span className="text-[10.5px] text-slate-500 font-semibold block uppercase">
                  {product.categoryName || product.category?.name || 'Producto'}
                </span>
                <strong className="text-slate-900 font-bold block text-sm truncate" title={product.name}>
                  {product.name}
                </strong>
                <div className="flex items-center gap-2 mt-0.5 font-mono text-[11px] text-slate-600">
                  <span className="bg-white px-1.5 py-0.2 rounded border border-slate-200 font-bold">
                    SKU: {product.sku}
                  </span>
                  {product.barcode && <span>Barras: {product.barcode}</span>}
                </div>
              </div>
            </div>

            <div className="text-right shrink-0">
              <span className="text-[10px] text-slate-500 uppercase font-bold block">Stock actual</span>
              <span className="font-bold font-mono text-xs text-slate-900">
                {product.totalStock} {product.unitOfMeasure}s
              </span>
            </div>
          </div>

          {/* PASO 1: Advertencia y Confirmación de Impacto */}
          {step === 1 ? (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-red-50/80 border border-red-200 text-red-950 space-y-2">
                <div className="flex items-center gap-2 text-red-800 font-bold">
                  <AppIcon name="warning" size={16} />
                  <span>¿Qué sucederá al eliminar este producto?</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-[11.5px] text-red-900/90 pl-1 leading-relaxed">
                  <li>El producto será <strong>eliminado por completo del catálogo</strong>.</li>
                  <li>Se suprimirán los niveles de inventario en todas las bodegas.</li>
                  <li>Se retirará automáticamente de los catálogos web de Super Más y Distribuidora.</li>
                  <li>Esta operación no se puede revertir ni recuperar posteriormente.</li>
                </ul>
              </div>

              {/* Verificación de historial de transacciones */}
              {usageCheck.loading ? (
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-slate-500 text-[11px] animate-pulse">
                  Verificando transacciones históricas en Kardex y ventas...
                </div>
              ) : usageCheck.hasTransactions ? (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] space-y-1">
                  <strong className="block font-bold flex items-center gap-1.5 text-amber-950">
                    <AppIcon name="audit" size={14} className="text-amber-700" />
                    Protección Contable & Tributaria DIAN
                  </strong>
                  <p className="m-0 leading-normal text-amber-900/90">
                    Este producto tiene <strong>{usageCheck.salesCount} ventas</strong> y{' '}
                    <strong>{usageCheck.movementsCount} movimientos</strong> de Kardex asentados. Por norma DIAN, no se pueden romper comprobantes ya emitidos. Al confirmar, el sistema retirará y desvinculará el producto por completo de todas las listas activas y POS preservando su historial.
                  </p>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-[11px] flex items-center gap-2">
                  <AppIcon name="checkSimple" size={14} className="text-emerald-700" aria-hidden="true" />
                  <span>
                    El producto no registra movimientos de inventario ni ventas históricas. Será <strong>borrado al 100%</strong> de la base de datos sin dejar rastro.
                  </span>
                </div>
              )}

              {/* Checkbox de Aceptación del Paso 1 */}
              <label className="p-3 rounded-xl border border-slate-200 hover:border-slate-300 bg-white flex items-start gap-2.5 cursor-pointer select-none transition-colors">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                  className="rounded border-slate-300 text-red-600 focus:ring-red-500 w-4 h-4 mt-0.5"
                />
                <span className="font-semibold text-slate-900 leading-tight">
                  He leído las advertencias y confirmo que deseo proceder a eliminar permanentemente este producto.
                </span>
              </label>
            </div>
          ) : (
            /* PASO 2: Escribir CONFIRMAR en Mayúscula */
            <div className="space-y-4 animate-scale-up">
              <div className="p-4 rounded-xl bg-red-50/90 border border-red-300 text-red-950 space-y-2">
                <strong className="block font-bold text-xs flex items-center gap-1.5 text-red-900">
                  <AppIcon name="lock" size={14} />
                  Confirmación de Seguridad Final
                </strong>
                <p className="text-[11.5px] leading-relaxed text-red-900 m-0">
                  Para autorizar el borrado definitivo de <strong>{product.name}</strong>, escribe la palabra exacta{' '}
                  <span className="font-mono font-black text-red-950 px-1.5 py-0.5 rounded bg-red-200 border border-red-300">
                    CONFIRMAR
                  </span>{' '}
                  en mayúsculas en el siguiente campo:
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                  Escribe CONFIRMAR para habilitar el borrado:
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={confirmationWord}
                    onChange={(e) => setConfirmationWord(e.target.value)}
                    placeholder="Escribe CONFIRMAR aquí..."
                    autoFocus
                    className={`w-full h-10 px-3.5 text-xs font-mono font-bold rounded-lg border focus:outline-none transition-all shadow-2xs ${
                      isConfirmedCorrectly
                        ? 'border-emerald-500 bg-emerald-50/50 text-emerald-900 ring-2 ring-emerald-500/20'
                        : isLowercaseWarning
                        ? 'border-amber-500 bg-amber-50/50 text-amber-900 ring-2 ring-amber-500/20'
                        : 'border-slate-300 bg-white text-slate-900 focus:border-red-500 focus:ring-2 focus:ring-red-500/20'
                    }`}
                  />
                  {isConfirmedCorrectly && (
                    <span className="absolute right-3 top-2.5 text-emerald-600 font-bold text-xs flex items-center gap-1">
                      <AppIcon name="checkSimple" size={12} aria-hidden="true" />
                      Correcto
                    </span>
                  )}
                </div>

                {isLowercaseWarning && (
                  <p className="text-[11px] text-amber-700 font-semibold mt-1.5 m-0 flex items-center gap-1">
                    <AppIcon name="warning" size={12} aria-hidden="true" />
                    Debe estar escrito en <strong>MAYÚSCULAS</strong>: CONFIRMAR
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Pie del Diálogo */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <button
            type="button"
            className="outline-button compact text-xs"
            onClick={onClose}
            disabled={isDeleting}
          >
            Cancelar
          </button>

          <div className="flex items-center gap-2">
            {step === 1 ? (
              <button
                type="button"
                className="primary-button compact text-xs flex items-center gap-1.5 font-bold"
                style={{ background: '#b91c1c' }}
                onClick={() => setStep(2)}
                disabled={!acknowledged || usageCheck.loading}
              >
                <span>Siguiente: Escribir CONFIRMAR</span>
                <span className="text-sm">→</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="outline-button compact text-xs"
                  onClick={() => setStep(1)}
                  disabled={isDeleting}
                >
                  ← Volver
                </button>

                <button
                  type="button"
                  className="primary-button compact text-xs flex items-center gap-2 font-black shadow-sm"
                  style={{
                    background: isConfirmedCorrectly ? '#dc2626' : '#cbd5e1',
                    cursor: isConfirmedCorrectly ? 'pointer' : 'not-allowed',
                    color: isConfirmedCorrectly ? '#ffffff' : '#64748b',
                  }}
                  onClick={handleDelete}
                  disabled={!isConfirmedCorrectly || isDeleting}
                >
                  <AppIcon name="trash" size={14} className={isDeleting ? 'animate-bounce' : ''} />
                  <span>{isDeleting ? 'Eliminando producto...' : 'Eliminar Producto Definitivamente'}</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
