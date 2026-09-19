'use client'

import React, { useState } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { DistributorCatalogProduct } from '../../types'

interface DistributorProductPreviewModalProps {
  isOpen: boolean
  product: DistributorCatalogProduct | null
  catalogProducts: DistributorCatalogProduct[]
  onClose: () => void
}

export function DistributorProductPreviewModal({
  isOpen,
  product,
  catalogProducts,
  onClose,
}: DistributorProductPreviewModalProps) {
  const [selectedProduct, setSelectedProduct] = useState<DistributorCatalogProduct | null>(product)

  if (!isOpen) return null

  // Si se seleccionó uno, mostrarlo como principal; sino mostrar el primer producto publicado
  const activeProduct =
    selectedProduct || product || catalogProducts.find((p) => p.webDistribuidora) || catalogProducts[0]

  const formatMoney = (val: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(val)
  }

  const publishedList = catalogProducts.filter((p) => p.webDistribuidora)

  return (
    <div className="drawer-backdrop modal-center" onClick={onClose}>
      <div
        className="modal-card animate-scale-up"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 920,
          maxHeight: '90vh',
          background: '#ffffff',
          borderRadius: 16,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header de la Vista Previa */}
        <div className="p-4 px-6 border-b border-slate-200 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center font-extrabold text-sm text-white">
              SM
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white m-0 tracking-tight">
                  Distribuidora Super Más
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-purple-600/60 text-purple-200">
                  Vista Previa Cliente Distribuidor
                </span>
              </div>
              <p className="text-[11px] text-slate-400 m-0">
                Así visualizan los distribuidores el catálogo público en tiempo real
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Cerrar vista previa"
          >
            <AppIcon name="close" size={18} />
          </button>
        </div>

        {/* Cuerpo con dos columnas: Tarjeta Destacada & Selector */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50 flex flex-col lg:flex-row gap-6">
          {/* Tarjeta de Producto como la ve el Distribuidor */}
          <div className="flex-1">
            {activeProduct ? (
              <article className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between h-full">
                <div>
                  {/* Categoría & Disponibilidad */}
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      {activeProduct.category}
                    </span>
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        activeProduct.availability === 'AVAILABLE'
                          ? 'bg-emerald-100 text-emerald-800'
                          : activeProduct.availability === 'LOW_STOCK'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {activeProduct.availabilityLabel}
                    </span>
                  </div>

                  {/* Imagen */}
                  <div className="relative h-64 w-full bg-slate-100 rounded-xl overflow-hidden mb-5 border border-slate-100">
                    {activeProduct.imageUrl ? (
                      <img
                        src={activeProduct.imageUrl}
                        alt={activeProduct.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400">
                        <AppIcon name="products" size={48} />
                      </div>
                    )}
                    <span className="absolute top-3 left-3 bg-white/90 backdrop-blur-md px-2.5 py-1 rounded-md text-[11px] font-mono font-bold text-slate-700 shadow-xs">
                      SKU: {activeProduct.sku}
                    </span>
                  </div>

                  {/* Título & Marca */}
                  <h3 className="text-lg font-extrabold text-slate-900 mb-1 leading-snug">
                    {activeProduct.name}
                  </h3>
                  <p className="text-xs text-slate-500 mb-3">
                    Marca: <strong>{activeProduct.brand}</strong> • Empaque:{' '}
                    <strong>{activeProduct.unitOfMeasure}</strong>
                  </p>

                  {/* Descripción */}
                  <p className="text-xs text-slate-600 leading-relaxed mb-4">
                    {activeProduct.description ||
                      'Producto garantizado de alta rotación para distribución mayorista.'}
                  </p>
                </div>

                {/* Precios & Botones de Acción Comercial */}
                <div className="pt-4 border-t border-slate-100">
                  <div className="flex items-baseline justify-between mb-4">
                    <div>
                      <span className="text-[11px] text-slate-400 block font-medium">
                        Precio Distribuidor / Mayorista
                      </span>
                      <strong className="text-2xl font-black text-slate-900 tracking-tight">
                        {formatMoney(activeProduct.distributorPrice)}
                      </strong>
                    </div>

                    {activeProduct.normalPrice > activeProduct.distributorPrice && (
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block">PVP Sugerido</span>
                        <span className="text-xs text-slate-500 font-semibold line-through">
                          {formatMoney(activeProduct.normalPrice)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Botones Resultantes */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* Botón WhatsApp */}
                    {activeProduct.canContactWhatsApp ? (
                      <a
                        href={activeProduct.whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="py-3 px-4 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 shadow-xs"
                      >
                        <span className="text-base">💬</span>
                        <span>Cotizar por WhatsApp</span>
                      </a>
                    ) : (
                      <div className="py-2.5 px-3 rounded-xl bg-slate-100 text-slate-400 text-xs text-center">
                        WhatsApp Deshabilitado
                      </div>
                    )}

                    {/* Botón Comprar Online (si aplica) */}
                    {activeProduct.canBuyDirectly ? (
                      <button
                        type="button"
                        onClick={() =>
                          alert(
                            `Simulación de compra directa: Redirigiendo a Tienda Online Super Más con el producto "${activeProduct.name}" (ID: ${activeProduct.id}) agregado al carrito para generar Pedido Web.`
                          )
                        }
                        className="py-3 px-4 rounded-xl bg-blue-600 text-white font-bold text-xs hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-xs"
                      >
                        <AppIcon name="purchases" size={16} />
                        <span>Comprar Online (Super Más)</span>
                      </button>
                    ) : (
                      <div className="py-2.5 px-3 rounded-xl bg-slate-100 text-slate-400 text-xs text-center flex items-center justify-center">
                        Solo Consulta Mayorista
                      </div>
                    )}
                  </div>
                </div>
              </article>
            ) : (
              <div className="p-8 text-center text-slate-400">Selecciona un producto</div>
            )}
          </div>

          {/* Selector de Otros Productos en el Catálogo */}
          <div className="w-full lg:w-72 space-y-3">
            <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
              Explorar Otros Productos ({publishedList.length})
            </p>

            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {publishedList.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedProduct(p)}
                  className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-center gap-3 ${
                    activeProduct?.id === p.id
                      ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-100'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {p.imageUrl ? (
                    <img
                      src={p.imageUrl}
                      alt={p.name}
                      className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                      <AppIcon name="products" size={16} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <span className="font-bold text-xs text-slate-800 block truncate">
                      {p.name}
                    </span>
                    <span className="text-[10px] text-slate-400 block font-mono">
                      {p.sku} • {formatMoney(p.distributorPrice)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 px-6 border-t border-slate-200 bg-white flex justify-end">
          <button type="button" onClick={onClose} className="outline-button text-xs py-2 px-5">
            Cerrar Vista Previa
          </button>
        </div>
      </div>
    </div>
  )
}
