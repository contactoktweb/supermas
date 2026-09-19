'use client'

import React, { useState } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { SuperCatalogProduct, SuperBulkActionType } from '../types'
import { SuperCatalogTableSkeleton } from './SuperCatalogSkeleton'

interface SuperCatalogTableProps {
  products: SuperCatalogProduct[]
  loading: boolean
  error: string | null
  selectedIds: string[]
  page: number
  totalPages: number
  total: number
  onPageChange: (page: number) => void
  onToggleSelect: (id: string) => void
  onToggleSelectAll: () => void
  onViewDetail: (product: SuperCatalogProduct) => void
  onEditPrice: (product: SuperCatalogProduct) => void
  onManageImages: (product: SuperCatalogProduct) => void
  onOpenPreview: (product: SuperCatalogProduct) => void
  onPublish: (id: string) => void
  onHide: (id: string) => void
  onOpenBulkModal: (action: SuperBulkActionType) => void
  canPublish: boolean
  canPrice: boolean
  canImages: boolean
  canUpdate: boolean
}

export function SuperCatalogTable({
  products,
  loading,
  error,
  selectedIds,
  page,
  totalPages,
  total,
  onPageChange,
  onToggleSelect,
  onToggleSelectAll,
  onViewDetail,
  onEditPrice,
  onManageImages,
  onOpenPreview,
  onPublish,
  onHide,
  onOpenBulkModal,
  canPublish,
  canPrice,
  canImages,
  canUpdate,
}: SuperCatalogTableProps) {
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null)

  if (loading) {
    return <SuperCatalogTableSkeleton />
  }

  if (error) {
    return (
      <div
        style={{
          padding: '40px',
          textAlign: 'center',
          background: '#fee2e2',
          borderRadius: '12px',
          border: '1px solid #fca5a5',
          color: '#b91c1c',
        }}
      >
        <AppIcon name="alerts" size={32} />
        <h3 style={{ margin: '12px 0 6px 0', fontSize: '16px' }}>Error al cargar el catálogo</h3>
        <p style={{ margin: 0, fontSize: '13px' }}>{error}</p>
      </div>
    )
  }

  if (products.length === 0) {
    return (
      <div
        style={{
          padding: '60px 20px',
          textAlign: 'center',
          background: 'var(--card-bg, #ffffff)',
          borderRadius: '12px',
          border: '1px dashed #cbd5e1',
          color: '#64748b',
        }}
      >
        <div style={{ display: 'inline-flex', padding: '16px', background: '#f1f5f9', borderRadius: '50%', marginBottom: '12px' }}>
          <AppIcon name="products" size={32} />
        </div>
        <h3 style={{ margin: '0 0 6px 0', color: 'var(--navy, #0f172a)', fontSize: '16px' }}>
          No se encontraron productos
        </h3>
        <p style={{ margin: 0, fontSize: '13px' }}>
          Prueba cambiando los términos de búsqueda o los filtros aplicados.
        </p>
      </div>
    )
  }

  const allSelected = products.length > 0 && products.every((p) => selectedIds.includes(p.id))

  return (
    <div className="relative">
      {/* Barra flotante de acciones masivas */}
      {selectedIds.length > 0 && (
        <div className="sticky top-4 z-40 mb-4 p-3.5 rounded-xl bg-purple-50 border border-purple-200 shadow-sm flex items-center justify-between flex-wrap gap-3 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-600 animate-pulse" />
            <span className="text-xs font-bold text-purple-900">
              {selectedIds.length} {selectedIds.length === 1 ? 'producto seleccionado' : 'productos seleccionados'}
            </span>
            <span className="text-xs text-purple-700 hidden sm:inline">
              — Acciones para Catálogo Super Más:
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {canPublish && (
              <>
                <button
                  type="button"
                  onClick={() => onOpenBulkModal('PUBLISH')}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  <AppIcon name="eye" size={13} />
                  <span>Publicar en Web</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenBulkModal('HIDE')}
                  className="px-3 py-1.5 rounded-lg bg-slate-700 text-white text-xs font-semibold hover:bg-slate-800 transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  <AppIcon name="close" size={13} />
                  <span>Ocultar de Web</span>
                </button>
              </>
            )}

            {canUpdate && (
              <>
                <button
                  type="button"
                  onClick={() => onOpenBulkModal('ENABLE_PURCHASE')}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  <AppIcon name="check" size={13} />
                  <span>Activar Compra</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenBulkModal('DISABLE_PURCHASE')}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  <AppIcon name="close" size={13} />
                  <span>Desactivar Compra</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Contenedor de la tabla */}
      <div className="table-panel animated-table page-enter rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="table-scroll overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th className="py-3 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={onToggleSelectAll}
                    aria-label="Seleccionar todos los productos"
                    className="rounded text-blue-600 cursor-pointer w-4 h-4"
                  />
                </th>
                <th className="py-3 px-3">Producto</th>
                <th className="py-3 px-3">Categoría / Marca</th>
                <th className="py-3 px-3">Precio Web</th>
                <th className="py-3 px-3">Disponibilidad</th>
                <th className="py-3 px-3">Catálogo Web</th>
                <th className="py-3 px-3">Compra Directa</th>
                <th className="py-3 px-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.map((p) => {
                const isSelected = selectedIds.includes(p.id)
                const isAvailable = p.availability === 'AVAILABLE'
                const isLow = p.availability === 'LOW_STOCK'

                const isMenuOpen = activeMenuId === p.id

                return (
                  <tr
                    key={p.id}
                    className={`hover:bg-slate-50/80 transition-colors ${
                      isSelected ? 'bg-purple-50/30' : ''
                    } ${isMenuOpen ? 'relative z-30' : 'relative z-0'}`}
                  >
                    {/* Checkbox */}
                    <td className="py-3 px-3 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleSelect(p.id)}
                        aria-label={`Seleccionar ${p.name}`}
                        className="rounded text-blue-600 cursor-pointer w-4 h-4"
                      />
                    </td>

                    {/* Producto (Imagen + Nombre + SKU) */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center text-slate-400">
                          {p.imageUrl ? (
                            <img
                              src={p.imageUrl}
                              alt={p.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <AppIcon name="products" size={18} />
                          )}
                        </div>
                        <div>
                          <strong
                            onClick={() => onViewDetail(p)}
                            className="text-slate-900 hover:text-blue-600 cursor-pointer font-bold block text-xs"
                          >
                            {p.name}
                          </strong>
                          <span className="text-[11px] text-slate-500 font-mono">
                            SKU: {p.sku} | Barras: {p.barcode}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Categoría / Marca */}
                    <td className="py-3 px-3 font-sans">
                      <div className="font-semibold text-slate-800">{p.category}</div>
                      <span className="text-[11px] text-slate-500">{p.brand}</span>
                    </td>

                    {/* Precio Web con IVA */}
                    <td className="py-3 px-3 font-mono">
                      <div className="font-extrabold text-slate-950 text-xs">
                        ${p.price.toLocaleString('es-CO')}
                      </div>
                      <span
                        className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded mt-0.5 border ${
                          p.vatRatePercent > 0
                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                      >
                        {p.vatRatePercent > 0 ? `IVA ${p.vatRatePercent}%` : 'Exento'}
                      </span>
                    </td>

                    {/* Disponibilidad */}
                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                          isAvailable
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                            : isLow
                            ? 'bg-amber-50 text-amber-900 border-amber-300'
                            : 'bg-rose-50 text-rose-800 border-rose-300'
                        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${
                            isAvailable
                              ? 'bg-emerald-600'
                              : isLow
                              ? 'bg-amber-600 animate-pulse'
                              : 'bg-rose-600'
                          }`}
                        />
                        {p.availabilityLabel}
                      </span>
                    </td>

                    {/* Estado Catálogo Web (Publicado / Oculto) */}
                    <td className="py-3 px-3">
                      {p.webSuperMas ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                          <AppIcon name="eye" size={12} />
                          Publicado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                          <AppIcon name="close" size={12} />
                          Oculto
                        </span>
                      )}
                    </td>

                    {/* Estado Compra Directa */}
                    <td className="py-3 px-3">
                      {p.canBuyDirectly ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <AppIcon name="check" size={12} />
                          Permitida
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-400 border border-slate-200">
                          Desactivada
                        </span>
                      )}
                    </td>

                    {/* Acciones */}
                    <td className={`py-3 px-3 text-right ${isMenuOpen ? 'relative z-50' : 'relative z-10'}`}>
                      <div className="inline-flex items-center gap-1.5">
                        {/* Vista Previa */}
                        <div className="relative group/tooltip">
                          <button
                            type="button"
                            onClick={() => onOpenPreview(p)}
                            className="p-1.5 rounded-lg bg-slate-50 hover:bg-blue-50 text-slate-600 hover:text-blue-700 border border-slate-200 hover:border-blue-300 transition-all duration-200 hover:scale-110 active:scale-95 shadow-xs"
                            aria-label="Vista previa cliente"
                          >
                            <AppIcon name="eye" size={14} />
                          </button>
                          <div className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-white shadow-lg opacity-0 -translate-y-1 group-hover/tooltip:opacity-100 group-hover/tooltip:translate-y-0 transition-all duration-200 ease-out z-50">
                            Vista previa
                            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-0.5 border-4 border-transparent border-t-slate-900" />
                          </div>
                        </div>

                        {/* Editar / Detalle */}
                        <div className="relative group/tooltip">
                          <button
                            type="button"
                            onClick={() => onViewDetail(p)}
                            className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-300 transition-all duration-200 hover:scale-110 active:scale-95 shadow-xs"
                            aria-label="Ver detalle y configuración"
                          >
                            <AppIcon name="edit" size={14} />
                          </button>
                          <div className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-white shadow-lg opacity-0 -translate-y-1 group-hover/tooltip:opacity-100 group-hover/tooltip:translate-y-0 transition-all duration-200 ease-out z-50">
                            Configuración
                            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-0.5 border-4 border-transparent border-t-slate-900" />
                          </div>
                        </div>

                        {/* Botón rápido publicar/ocultar */}
                        {canPublish && (
                          <div className="relative group/tooltip">
                            <button
                              type="button"
                              onClick={() => (p.webSuperMas ? onHide(p.id) : onPublish(p.id))}
                              className={`p-1.5 rounded-lg border transition-all duration-200 hover:scale-110 active:scale-95 shadow-xs ${
                                p.webSuperMas
                                  ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200 hover:border-rose-300'
                                  : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200 hover:border-blue-300'
                              }`}
                              aria-label={p.webSuperMas ? 'Ocultar de la tienda' : 'Publicar en la tienda'}
                            >
                              <AppIcon name={p.webSuperMas ? 'close' : 'check'} size={14} />
                            </button>
                            <div className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-white shadow-lg opacity-0 -translate-y-1 group-hover/tooltip:opacity-100 group-hover/tooltip:translate-y-0 transition-all duration-200 ease-out z-50">
                              {p.webSuperMas ? 'Ocultar de web' : 'Publicar en web'}
                              <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-0.5 border-4 border-transparent border-t-slate-900" />
                            </div>
                          </div>
                        )}

                        {/* Menú desplegable animado */}
                        <div className="relative group/tooltip">
                          <button
                            type="button"
                            onClick={() => setActiveMenuId(activeMenuId === p.id ? null : p.id)}
                            className={`p-1.5 rounded-lg border transition-all duration-200 hover:scale-110 active:scale-95 shadow-xs ${
                              activeMenuId === p.id
                                ? 'bg-slate-200 border-slate-300 text-slate-900 scale-105'
                                : 'bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-800 border-slate-200'
                            }`}
                            aria-expanded={activeMenuId === p.id}
                            aria-label="Más acciones"
                          >
                            <AppIcon name="more" size={14} />
                          </button>
                          {activeMenuId !== p.id && (
                            <div className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-white shadow-lg opacity-0 -translate-y-1 group-hover/tooltip:opacity-100 group-hover/tooltip:translate-y-0 transition-all duration-200 ease-out z-50">
                              Más opciones
                              <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-0.5 border-4 border-transparent border-t-slate-900" />
                            </div>
                          )}

                          {activeMenuId === p.id && (
                            <>
                              <div
                                className="fixed inset-0 z-40"
                                onClick={() => setActiveMenuId(null)}
                              />
                              <div
                                role="menu"
                                className="absolute right-0 top-full mt-2 bg-white/95 backdrop-blur-sm border border-slate-200/80 rounded-2xl shadow-xl min-w-[215px] z-50 p-1.5 flex flex-col text-left animate-in fade-in zoom-in-95 duration-150 origin-top-right divide-y divide-slate-100 transition-all"
                              >
                                <div className="space-y-0.5 pb-1">
                                  {canPrice && (
                                    <button
                                      type="button"
                                      role="menuitem"
                                      onClick={() => {
                                        onEditPrice(p)
                                        setActiveMenuId(null)
                                      }}
                                      className="group/item w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-purple-50/70 hover:text-purple-900 rounded-xl transition-all duration-150 active:scale-[0.98]"
                                    >
                                      <div className="p-1 rounded-md bg-purple-50 text-purple-700 group-hover/item:bg-purple-100 group-hover/item:scale-110 transition-all duration-150">
                                        <AppIcon name="sales" size={14} />
                                      </div>
                                      <span>Editar Precio e IVA</span>
                                    </button>
                                  )}

                                  {canImages && (
                                    <button
                                      type="button"
                                      role="menuitem"
                                      onClick={() => {
                                        onManageImages(p)
                                        setActiveMenuId(null)
                                      }}
                                      className="group/item w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-blue-50/70 hover:text-blue-900 rounded-xl transition-all duration-150 active:scale-[0.98]"
                                    >
                                      <div className="p-1 rounded-md bg-blue-50 text-blue-700 group-hover/item:bg-blue-100 group-hover/item:scale-110 transition-all duration-150">
                                        <AppIcon name="layers" size={14} />
                                      </div>
                                      <span>Gestionar Imágenes</span>
                                    </button>
                                  )}
                                </div>

                                <div className="pt-1">
                                  <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() => {
                                      onViewDetail(p)
                                      setActiveMenuId(null)
                                    }}
                                    className="group/item w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-emerald-50/70 hover:text-emerald-900 rounded-xl transition-all duration-150 active:scale-[0.98]"
                                  >
                                    <div className="p-1 rounded-md bg-emerald-50 text-emerald-700 group-hover/item:bg-emerald-100 group-hover/item:scale-110 transition-all duration-150">
                                      <AppIcon name="inventory" size={14} />
                                    </div>
                                    <span>Stock por Bodega</span>
                                  </button>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        <div className="p-3.5 border-t border-slate-200 bg-white flex items-center justify-between text-xs text-slate-500 flex-wrap gap-2">
          <div>
            Mostrando <strong className="text-slate-900">{products.length}</strong> de <strong className="text-slate-900">{total}</strong> productos en el catálogo
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Anterior
            </button>
            <span className="font-bold text-slate-900 px-1">
              Página {page} de {totalPages}
            </span>
            <button
              type="button"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
