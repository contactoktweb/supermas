'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '@/components/ui/Icon'
import { TaxConfig, TaxAssociatedProduct } from '../types'
import { taxService } from '../services/tax.service'
import { taxCalculationService } from '../services/tax-calculation.service'

interface TaxProductsModalProps {
  tax: TaxConfig | null
  isOpen: boolean
  onClose: () => void
}

export function TaxProductsModal({ tax, isOpen, onClose }: TaxProductsModalProps) {
  const [mounted, setMounted] = useState(false)
  const [products, setProducts] = useState<TaxAssociatedProduct[]>([])
  const [total, setTotal] = useState(0)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (tax && isOpen) {
      setIsLoading(true)
      taxService
        .getAssociatedProducts(tax.id, { query, page, pageSize: 8 })
        .then((res) => {
          setProducts(res.data)
          setTotal(res.total)
        })
        .finally(() => setIsLoading(false))
    }
  }, [tax, isOpen, query, page])

  // Cerrar con Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!mounted || !isOpen || !tax) return null

  const totalPages = Math.ceil(total / 8) || 1

  const modalContent = (
    <div
      className="drawer-backdrop modal-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tax-products-title"
    >
      <div
        className="product-card"
        style={{
          width: 'min(92vw, 840px)',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 24,
          background: '#fff',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          borderRadius: 16,
          cursor: 'default',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--line)', paddingBottom: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="state publicado">
                <span>{tax.code} ({tax.ratePercent}%)</span>
              </span>
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                {total} productos asociados
              </span>
            </div>
            <h2 id="tax-products-title" style={{ margin: '6px 0 0', fontSize: 18, color: 'var(--foreground)' }}>
              Productos gravados con {tax.name}
            </h2>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Cerrar modal"
          >
            <AppIcon name="close" size={18} />
          </button>
        </div>

        {/* Barra de búsqueda */}
        <div style={{ margin: '14px 0', display: 'flex', gap: 10 }}>
          <div className="search-box" style={{ flex: 1 }}>
            <AppIcon name="search" size={16} />
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setPage(1)
              }}
              placeholder="Buscar por SKU, código de barras, nombre o categoría..."
              aria-label="Buscar en productos asociados"
            />
          </div>
        </div>

        {/* Tabla de Productos */}
        <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--line)', borderRadius: 10 }}>
          {isLoading ? (
            <div style={{ padding: '50px 0', textAlign: 'center', color: 'var(--muted)' }}>
              <AppIcon name="refresh" size={24} className="animate-spin" />
              <p style={{ marginTop: 10, fontSize: 12 }}>Consultando productos asociados...</p>
            </div>
          ) : products.length === 0 ? (
            <div style={{ padding: '50px 0', textAlign: 'center', color: 'var(--muted)' }}>
              <AppIcon name="products" size={28} />
              <p style={{ margin: '10px 0 0', fontSize: 13, fontWeight: 700 }}>
                No se encontraron productos
              </p>
              <small style={{ fontSize: 11 }}>
                Esta configuración tributaria aún no está asignada a productos que coincidan con la búsqueda.
              </small>
            </div>
          ) : (
            <table style={{ width: '100%', minWidth: 600, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--line)' }}>
                  <th style={{ padding: '10px 14px', fontSize: 11 }}>SKU / Código</th>
                  <th style={{ padding: '10px 14px', fontSize: 11 }}>Producto</th>
                  <th style={{ padding: '10px 14px', fontSize: 11 }}>Categoría</th>
                  <th style={{ padding: '10px 14px', fontSize: 11, textAlign: 'right' }}>Precio Normal</th>
                  <th style={{ padding: '10px 14px', fontSize: 11, textAlign: 'center' }}>Stock Total</th>
                  <th style={{ padding: '10px 14px', fontSize: 11, textAlign: 'center' }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 14px' }}>
                      <span className="mono" style={{ fontWeight: 700, color: 'var(--navy)' }}>
                        {p.sku}
                      </span>
                      <small style={{ display: 'block', color: 'var(--muted)', fontSize: 10 }}>
                        {p.barcode}
                      </small>
                    </td>

                    <td style={{ padding: '10px 14px' }}>
                      <strong style={{ fontSize: 12, color: 'var(--foreground)' }}>
                        {p.name}
                      </strong>
                      <span style={{ display: 'block', color: 'var(--muted)', fontSize: 10 }}>
                        Marca: {p.brand} · {p.unitOfMeasure}
                      </span>
                    </td>

                    <td style={{ padding: '10px 14px', fontSize: 11, color: 'var(--muted)' }}>
                      {p.category}
                    </td>

                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, fontSize: 12, color: 'var(--navy)' }}>
                      {taxCalculationService.formatCOP(p.normalPrice)}
                    </td>

                    <td style={{ padding: '10px 14px', textAlign: 'center', fontSize: 11 }}>
                      <span style={{ fontWeight: 700 }}>{p.totalStock}</span> {p.unitOfMeasure}
                    </td>

                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                      <span className="state disponible" style={{ fontSize: 10 }}>
                        {p.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer paginador */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, paddingTop: 10, borderTop: '1px solid var(--line)', fontSize: 11, color: 'var(--muted)' }}>
          <span>
            Mostrando <strong>{products.length}</strong> de <strong>{total}</strong> productos gravados
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>Página {page} de {totalPages}</span>
            <button
              type="button"
              className="outline-button compact"
              disabled={page <= 1}
              onClick={() => setPage((prev) => prev - 1)}
              style={{ height: 28, padding: '0 8px' }}
            >
              <AppIcon name="chevronLeft" size={12} />
            </button>
            <button
              type="button"
              className="outline-button compact"
              disabled={page >= totalPages}
              onClick={() => setPage((prev) => prev + 1)}
              style={{ height: 28, padding: '0 8px' }}
            >
              <AppIcon name="chevronRight" size={12} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
