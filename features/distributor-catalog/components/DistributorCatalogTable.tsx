'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { DistributorCatalogProduct, StockAvailabilityLevel } from '../types'
import { DistributorCatalogTableSkeleton } from './DistributorCatalogSkeleton'

interface DistributorCatalogTableProps {
  products: DistributorCatalogProduct[]
  loading: boolean
  error: string | null
  selectedIds: string[]
  page: number
  totalPages: number
  total: number
  onPageChange: (page: number) => void
  onToggleSelect: (id: string) => void
  onToggleSelectAll: () => void
  onViewDetail: (product: DistributorCatalogProduct) => void
  onOpenPreview: (product: DistributorCatalogProduct) => void
  onPublish: (product: DistributorCatalogProduct) => void
  onHide: (product: DistributorCatalogProduct) => void
  onConfigurePurchase: (product: DistributorCatalogProduct) => void
  canPublish: boolean
  canUpdate: boolean
  canPreview: boolean
}

export function DistributorCatalogTable({
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
  onOpenPreview,
  onPublish,
  onHide,
  onConfigurePurchase,
  canPublish,
  canUpdate,
  canPreview,
}: DistributorCatalogTableProps) {
  const formatMoney = (val: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(val)
  }

  const getAvailabilityBadge = (av: StockAvailabilityLevel, label: string) => {
    switch (av) {
      case 'AVAILABLE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
            <span className="w-2 h-2 rounded-full bg-emerald-600" />
            {label}
          </span>
        )
      case 'LOW_STOCK':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-900 border border-amber-300">
            <span className="w-2 h-2 rounded-full bg-amber-600 animate-pulse" />
            {label}
          </span>
        )
      case 'OUT_OF_STOCK':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-800 border border-rose-300">
            <span className="w-2 h-2 rounded-full bg-rose-600" />
            {label}
          </span>
        )
    }
  }

  if (loading) {
    return <DistributorCatalogTableSkeleton />
  }

  if (error) {
    return (
      <div className="panel-container rounded-xl border border-rose-200 bg-rose-50/50 p-8 text-center my-4">
        <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3">
          <AppIcon name="close" size={24} />
        </div>
        <h3 className="text-base font-semibold text-rose-900 mb-1">
          Error al cargar catálogo
        </h3>
        <p className="text-xs text-rose-700 max-w-md mx-auto">{error}</p>
      </div>
    )
  }

  if (products.length === 0) {
    return (
      <div className="panel-container rounded-xl border border-slate-200 bg-white p-12 text-center my-4 shadow-xs">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4 text-slate-400">
          <AppIcon name="ecommerceDist" size={28} />
        </div>
        <h3 className="text-base font-bold text-slate-900 mb-1">
          No se encontraron productos
        </h3>
        <p className="text-xs text-slate-600 max-w-sm mx-auto">
          No hay artículos que coincidan con los filtros seleccionados o el catálogo está vacío.
        </p>
      </div>
    )
  }

  const isAllCurrentPageSelected =
    products.length > 0 && products.every((p) => selectedIds.includes(p.id))

  return (
    <div className="table-panel animated-table page-enter rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
      <div className="table-scroll overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="py-3.5 px-3 w-10 text-center">
                <input
                  type="checkbox"
                  checked={isAllCurrentPageSelected}
                  onChange={onToggleSelectAll}
                  aria-label="Seleccionar todos los productos de esta página"
                  className="rounded text-blue-600 cursor-pointer w-4 h-4"
                />
              </th>
              <th className="py-3.5 px-4 text-xs font-bold text-slate-700 uppercase tracking-wider">
                Producto / SKU
              </th>
              <th className="py-3.5 px-4 text-xs font-bold text-slate-700 uppercase tracking-wider">
                Categoría & Marca
              </th>
              <th className="py-3.5 px-4 text-xs font-bold text-slate-700 uppercase tracking-wider">
                Precio Distribuidor
              </th>
              <th className="py-3.5 px-4 text-xs font-bold text-slate-700 uppercase tracking-wider">
                Catálogo Distribuidora
              </th>
              <th className="py-3.5 px-4 text-xs font-bold text-slate-700 uppercase tracking-wider">
                Catálogo Super Más
              </th>
              <th className="py-3.5 px-4 text-xs font-bold text-slate-700 uppercase tracking-wider">
                Disponibilidad Red
              </th>
              <th className="py-3.5 px-4 text-xs font-bold text-slate-700 uppercase tracking-wider">
                Modalidad Venta
              </th>
              <th className="py-3.5 px-4 text-xs font-bold text-slate-700 uppercase tracking-wider text-right">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {products.map((prod) => {
              const isSelected = selectedIds.includes(prod.id)

              return (
                <tr
                  key={prod.id}
                  onClick={() => onViewDetail(prod)}
                  className={`hover:bg-slate-50 cursor-pointer transition-colors ${
                    isSelected ? 'bg-purple-50/70' : 'bg-white'
                  }`}
                >
                  {/* Checkbox */}
                  <td
                    className="py-3.5 px-3 text-center"
                    onClick={(e) => {
                      e.stopPropagation()
                      onToggleSelect(prod.id)
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleSelect(prod.id)}
                      aria-label={`Seleccionar ${prod.name}`}
                      className="rounded text-blue-600 cursor-pointer w-4 h-4"
                    />
                  </td>

                  {/* Producto & SKU */}
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-3">
                      {prod.imageUrl ? (
                        <img
                          src={prod.imageUrl}
                          alt={prod.name}
                          className="w-11 h-11 rounded-lg object-cover border border-slate-200 shrink-0 bg-slate-50"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 shrink-0">
                          <AppIcon name="products" size={20} />
                        </div>
                      )}
                      <div className="flex flex-col gap-0.5 max-w-[240px]">
                        <span className="font-bold text-slate-950 text-[13px] leading-tight line-clamp-2">
                          {prod.name}
                        </span>
                        <span className="text-xs text-slate-500 font-mono font-medium">
                          SKU: {prod.sku}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Categoría & Marca */}
                  <td className="py-3.5 px-4">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-bold text-slate-800 text-[13px]">
                        {prod.category}
                      </span>
                      <span className="text-xs text-slate-500 font-medium">{prod.brand}</span>
                    </div>
                  </td>

                  {/* Precio Distribuidor */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-950 text-sm">
                        {formatMoney(prod.distributorPrice)}
                      </span>
                      {prod.normalPrice > prod.distributorPrice && (
                        <span className="text-xs text-slate-500 font-medium line-through">
                          Público: {formatMoney(prod.normalPrice)}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Estado en Distribuidora */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    {prod.webDistribuidora ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        <AppIcon name="check" size={12} />
                        Publicado
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                        Oculto
                      </span>
                    )}
                  </td>

                  {/* Estado en Super Más */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    {prod.webSuperMas ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <AppIcon name="check" size={12} />
                        Activo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                        Inactivo
                      </span>
                    )}
                  </td>

                  {/* Disponibilidad Red */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    {getAvailabilityBadge(prod.availability, prod.availabilityLabel)}
                  </td>

                  {/* Modalidad de Venta */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <div className="flex flex-col gap-1">
                      {prod.canBuyDirectly ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200">
                          WhatsApp + Compra Web
                        </span>
                      ) : prod.canContactWhatsApp ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Solo WhatsApp
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500 font-medium">Sin Contacto</span>
                      )}
                    </div>
                  </td>

                  {/* Acciones Rápidas */}
                  <td
                    className="py-3.5 px-4 text-right whitespace-nowrap"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      {/* Vista Previa */}
                      {canPreview && (
                        <div className="relative group/tooltip">
                          <button
                            type="button"
                            onClick={() => onOpenPreview(prod)}
                            className="p-1.5 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 transition-all duration-200 hover:scale-110 active:scale-95 shadow-xs"
                            aria-label="Vista previa"
                          >
                            <AppIcon name="eye" size={16} />
                          </button>
                          <div className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-white shadow-lg opacity-0 -translate-y-1 group-hover/tooltip:opacity-100 group-hover/tooltip:translate-y-0 transition-all duration-200 ease-out z-50">
                            Vista previa
                            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-0.5 border-4 border-transparent border-t-slate-900" />
                          </div>
                        </div>
                      )}

                      {/* Configurar Compra */}
                      {canUpdate && (
                        <div className="relative group/tooltip">
                          <button
                            type="button"
                            onClick={() => onConfigurePurchase(prod)}
                            className="p-1.5 rounded-lg text-slate-600 hover:text-purple-600 hover:bg-purple-50 border border-slate-200 hover:border-purple-200 transition-all duration-200 hover:scale-110 active:scale-95 shadow-xs"
                            aria-label="Configurar canales"
                          >
                            <AppIcon name="settings" size={16} />
                          </button>
                          <div className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-white shadow-lg opacity-0 -translate-y-1 group-hover/tooltip:opacity-100 group-hover/tooltip:translate-y-0 transition-all duration-200 ease-out z-50">
                            Configurar canales
                            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-0.5 border-4 border-transparent border-t-slate-900" />
                          </div>
                        </div>
                      )}

                      {/* Publicar / Ocultar Toggle */}
                      {canPublish && (
                        <div className="relative group/tooltip">
                          {prod.webDistribuidora ? (
                            <button
                              type="button"
                              onClick={() => onHide(prod)}
                              className="px-2.5 py-1 rounded-lg border border-slate-300 text-slate-700 font-semibold text-xs hover:bg-slate-100 transition-all duration-200 hover:scale-105 active:scale-95 shadow-xs"
                              aria-label="Ocultar de catálogo distribuidora"
                            >
                              Ocultar
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onPublish(prod)}
                              className="px-2.5 py-1 rounded-lg bg-blue-600 text-white font-semibold text-xs hover:bg-blue-700 transition-all duration-200 hover:scale-105 active:scale-95 shadow-xs"
                              aria-label="Publicar en catálogo distribuidora"
                            >
                              Publicar
                            </button>
                          )}
                          <div className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-white shadow-lg opacity-0 -translate-y-1 group-hover/tooltip:opacity-100 group-hover/tooltip:translate-y-0 transition-all duration-200 ease-out z-50">
                            {prod.webDistribuidora ? 'Ocultar del catálogo' : 'Publicar en catálogo'}
                            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-0.5 border-4 border-transparent border-t-slate-900" />
                          </div>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      <div className="py-3.5 px-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600 bg-slate-50">
        <div>
          Mostrando <strong className="text-slate-900">{products.length}</strong> de <strong className="text-slate-900">{total}</strong> productos en catálogo
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="px-3 py-1.5 rounded-md border border-slate-300 bg-white font-medium text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors shadow-2xs"
          >
            Anterior
          </button>
          <span className="font-bold text-slate-800 px-1">
            Página {page} de {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="px-3 py-1.5 rounded-md border border-slate-300 bg-white font-medium text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors shadow-2xs"
          >
            Siguiente
          </button>
        </div>
      </div>
    </div>
  )
}
