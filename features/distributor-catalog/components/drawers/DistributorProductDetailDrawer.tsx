'use client'

import React, { useState, useEffect } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { DistributorCatalogProduct, ProductCatalogConfigUpdate } from '../../types'

interface DistributorProductDetailDrawerProps {
  isOpen: boolean
  product: DistributorCatalogProduct | null
  onClose: () => void
  onSaveConfig: (productId: string, config: ProductCatalogConfigUpdate) => Promise<any>
  onOpenPreview: (product: DistributorCatalogProduct) => void
  canUpdate: boolean
}

export function DistributorProductDetailDrawer({
  isOpen,
  product,
  onClose,
  onSaveConfig,
  onOpenPreview,
  canUpdate,
}: DistributorProductDetailDrawerProps) {
  const [webDistribuidora, setWebDistribuidora] = useState(false)
  const [webSuperMas, setWebSuperMas] = useState(false)
  const [webDirectPurchaseEnabled, setWebDirectPurchaseEnabled] = useState(false)
  const [webWhatsAppInquiryEnabled, setWebWhatsAppInquiryEnabled] = useState(true)
  const [webWhatsAppPhone, setWebWhatsAppPhone] = useState('+57 312 884 9021')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (product) {
      setWebDistribuidora(product.webDistribuidora)
      setWebSuperMas(product.webSuperMas)
      setWebDirectPurchaseEnabled(product.webDirectPurchaseEnabled)
      setWebWhatsAppInquiryEnabled(product.webWhatsAppInquiryEnabled)
      setWebWhatsAppPhone(product.webWhatsAppPhone || '+57 312 884 9021')
      setError(null)
    }
  }, [product])

  if (!isOpen || !product) return null

  const formatMoney = (val: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(val)
  }

  // Previsualización dinámica del mensaje
  const dynamicMessage = `Hola Distribuidora Super Más, estoy interesado en cotizar el producto "${product.name}" (SKU: ${product.sku}).`
  const dynamicWaUrl = `https://wa.me/${webWhatsAppPhone.replace(/\D/g, '')}?text=${encodeURIComponent(
    dynamicMessage
  )}`

  // Reglas de visualización de botones resultantes
  const resultingWhatsApp = webDistribuidora && webWhatsAppInquiryEnabled
  const resultingBuy =
    webDistribuidora &&
    webSuperMas &&
    webDirectPurchaseEnabled &&
    product.availability !== 'OUT_OF_STOCK'

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setSubmitting(true)
      setError(null)
      await onSaveConfig(product.id, {
        webDistribuidora,
        webSuperMas,
        webDirectPurchaseEnabled,
        webWhatsAppInquiryEnabled,
        webWhatsAppPhone: webWhatsAppPhone.trim(),
      })
      onClose()
    } catch (err: any) {
      setError(err.message || 'Error al guardar la configuración.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside
        className="product-drawer page-enter"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 680,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          background: '#ffffff',
          overflow: 'hidden',
        }}
      >
        {/* Drawer Header */}
        <div className="drawer-header border-b border-slate-200 dark:border-slate-800 p-5 flex items-center justify-between shrink-0 bg-slate-50/50">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="eyebrow m-0 text-slate-500">Configuración Comercial B2B</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-800">
                Catálogo Distribuidora
              </span>
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight m-0 truncate max-w-md">
              {product.name}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenPreview(product)}
              className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-slate-200/60 transition-colors"
              title="Vista previa cliente"
              aria-label="Vista previa"
            >
              <AppIcon name="eye" size={18} />
            </button>
            <button
              type="button"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
              onClick={onClose}
              aria-label="Cerrar detalle"
            >
              <AppIcon name="close" size={18} />
            </button>
          </div>
        </div>

        {/* Drawer Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
              {error}
            </div>
          )}

          {/* Información del Producto Maestro */}
          <section className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-4 border border-slate-200 dark:border-slate-800 text-xs">
            <div className="flex items-start gap-4">
              {product.imageUrl ? (
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="w-20 h-20 rounded-xl object-cover border border-slate-200 shrink-0 shadow-xs"
                />
              ) : (
                <div className="w-20 h-20 rounded-xl bg-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                  <AppIcon name="products" size={28} />
                </div>
              )}
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-slate-400 font-semibold">SKU: {product.sku}</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      product.availability === 'AVAILABLE'
                        ? 'bg-emerald-100 text-emerald-800'
                        : product.availability === 'LOW_STOCK'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    Disponibilidad: {product.availabilityLabel}
                  </span>
                </div>
                <h3 className="font-bold text-slate-900 text-sm m-0">{product.name}</h3>
                <p className="text-slate-500 m-0">
                  {product.category} • {product.brand} ({product.unitOfMeasure})
                </p>
                <div className="pt-2 flex items-center gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Precio Distribuidor</span>
                    <strong className="text-slate-900 text-sm">
                      {formatMoney(product.distributorPrice)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Precio Público Sugerido</span>
                    <span className="text-slate-600 font-semibold">
                      {formatMoney(product.normalPrice)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {product.description && (
              <p className="mt-3 pt-3 border-t border-slate-200 text-slate-600 leading-relaxed text-xs m-0">
                {product.description}
              </p>
            )}
          </section>

          {/* Configuración de Canales y Publicación */}
          <section className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 m-0">
              <AppIcon name="settings" size={14} />
              <span>Configuración de Canales y Visibilidad</span>
            </h3>

            {/* Switch: Catálogo Distribuidora */}
            <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-slate-900 block">
                  Publicado en Catálogo Distribuidora
                </span>
                <span className="text-[11px] text-slate-500 block">
                  Hace visible este producto en el catálogo comercial para distribuidores.
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={webDistribuidora}
                  onChange={(e) => setWebDistribuidora(e.target.checked)}
                  disabled={!canUpdate}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {/* Switch: Catálogo Super Más */}
            <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-slate-900 block">
                  Activo en Catálogo Super Más (Web Retail)
                </span>
                <span className="text-[11px] text-slate-500 block">
                  Disponible para venta retail en la tienda online principal.
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={webSuperMas}
                  onChange={(e) => setWebSuperMas(e.target.checked)}
                  disabled={!canUpdate}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            {/* Switch: Compra Directa Online */}
            <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-slate-900 block">
                  Permitir Compra Directa Online (Botón Comprar)
                </span>
                <span className="text-[11px] text-slate-500 block">
                  Requiere que Catálogo Super Más esté activo. Si se desmarca, el distribuidor solo podrá consultar vía WhatsApp.
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={webDirectPurchaseEnabled}
                  onChange={(e) => setWebDirectPurchaseEnabled(e.target.checked)}
                  disabled={!canUpdate}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
            </div>

            {/* Switch: Contacto WhatsApp */}
            <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-slate-900 block">
                  Habilitar Botón de Contacto por WhatsApp
                </span>
                <span className="text-[11px] text-slate-500 block">
                  Permite a los distribuidores abrir un chat directo con el asesor comercial.
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={webWhatsAppInquiryEnabled}
                  onChange={(e) => setWebWhatsAppInquiryEnabled(e.target.checked)}
                  disabled={!canUpdate}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            {/* Teléfono de WhatsApp */}
            {webWhatsAppInquiryEnabled && (
              <div className="space-y-1.5 pt-2">
                <label className="text-xs font-bold text-slate-700">
                  Línea de WhatsApp Comercial Asignada
                </label>
                <input
                  type="text"
                  value={webWhatsAppPhone}
                  onChange={(e) => setWebWhatsAppPhone(e.target.value)}
                  disabled={!canUpdate}
                  placeholder="+57 312 884 9021"
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-200 font-mono"
                />
              </div>
            )}
          </section>

          {/* Simulación de Botones Resultantes */}
          <section className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-4 border border-slate-200 dark:border-slate-800 text-xs space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 m-0">
              <AppIcon name="eye" size={14} />
              <span>Simulación de Botones en Catálogo Público</span>
            </h3>

            <div className="p-3 rounded-lg bg-white border border-slate-200 space-y-2">
              <p className="text-[11px] text-slate-500 m-0">
                Según la configuración seleccionada, el cliente distribuidor verá en la ficha:
              </p>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                {resultingWhatsApp ? (
                  <a
                    href={dynamicWaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2 rounded-lg bg-emerald-600 text-white font-semibold text-xs hover:bg-emerald-700 transition-colors flex items-center gap-1.5 shadow-xs"
                    onClick={(e) => e.preventDefault()}
                  >
                    <span>💬 Contactar por WhatsApp</span>
                  </a>
                ) : (
                  <span className="text-slate-400 text-xs italic">WhatsApp inactivo</span>
                )}

                {resultingBuy ? (
                  <button
                    type="button"
                    className="px-3 py-2 rounded-lg bg-blue-600 text-white font-semibold text-xs hover:bg-blue-700 transition-colors flex items-center gap-1.5 shadow-xs"
                    onClick={(e) => e.preventDefault()}
                  >
                    <AppIcon name="purchases" size={14} />
                    <span>Comprar Online (Super Más)</span>
                  </button>
                ) : (
                  webDistribuidora && (
                    <span className="text-slate-400 text-xs italic">
                      {webSuperMas && !webDirectPurchaseEnabled
                        ? '(Compra web inhabilitada)'
                        : !webSuperMas
                        ? '(No disponible para compra online)'
                        : ''}
                    </span>
                  )
                )}
              </div>

              {resultingWhatsApp && (
                <div className="mt-2 p-2 rounded bg-slate-50 border border-slate-100 text-[11px] text-slate-600">
                  <span className="font-semibold text-slate-800 block">Mensaje predeterminado:</span>
                  &quot;{dynamicMessage}&quot;
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Drawer Action Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="outline-button text-xs py-2 px-4"
          >
            Cancelar
          </button>

          {canUpdate && (
            <button
              type="button"
              onClick={handleSave}
              disabled={submitting}
              className="primary-button text-xs py-2 px-5 flex items-center gap-1.5"
            >
              <AppIcon name="save" size={15} />
              <span>{submitting ? 'Guardando...' : 'Guardar Configuración'}</span>
            </button>
          )}
        </div>
      </aside>
    </div>
  )
}
