'use client'

import React, { useState } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { SuperCatalogProduct } from '../../types'

interface SuperProductPreviewModalProps {
  isOpen: boolean
  product: SuperCatalogProduct | null
  onClose: () => void
  onAddToCart: (productId: string, quantity: number) => Promise<any>
}

export function SuperProductPreviewModal({
  isOpen,
  product,
  onClose,
  onAddToCart,
}: SuperProductPreviewModalProps) {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [quantity, setQuantity] = useState(1)
  const [adding, setAdding] = useState(false)
  const [addedSuccess, setAddedSuccess] = useState(false)

  if (!isOpen || !product) return null

  const images = product.images.length > 0 ? product.images : product.imageUrl ? [product.imageUrl] : []
  const activeImage = images[selectedImageIndex] || product.imageUrl

  const isAvailable = product.availability === 'AVAILABLE'
  const isLow = product.availability === 'LOW_STOCK'
  const isOut = product.availability === 'OUT_OF_STOCK'

  const availBg = isAvailable ? '#d1fae5' : isLow ? '#fef3c7' : '#fee2e2'
  const availColor = isAvailable ? '#065f46' : isLow ? '#92400e' : '#991b1b'

  const handleBuy = async () => {
    if (!product.canBuyDirectly) return
    try {
      setAdding(true)
      const res = await onAddToCart(product.id, quantity)
      if (res && res.success) {
        setAddedSuccess(true)
        setTimeout(() => setAddedSuccess(false), 3000)
      }
    } finally {
      setAdding(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          width: '740px',
          maxWidth: '100%',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          animation: 'scaleUp 0.25s ease-out',
        }}
      >
        {/* Barra superior de simulación de navegador ecommerce */}
        <div
          style={{
            background: '#0f172a',
            padding: '12px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            color: '#ffffff',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444' }} />
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f59e0b' }} />
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981' }} />
            <span style={{ fontSize: '12px', color: '#94a3b8', marginLeft: '8px', fontFamily: 'monospace' }}>
              supermas.com.co/tienda/{product.slug}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                background: 'rgba(255, 255, 255, 0.15)',
                padding: '2px 8px',
                borderRadius: '4px',
              }}
            >
              Vista Previa de Cliente
            </span>
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#cbd5e1',
                cursor: 'pointer',
                display: 'flex',
                padding: '2px',
              }}
            >
              <AppIcon name="close" size={18} />
            </button>
          </div>
        </div>

        {/* Tarjeta de Producto B2C */}
        <div
          style={{
            padding: '28px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '28px',
          }}
        >
          {/* Columna Izquierda: Galería de Fotos */}
          <div>
            <div
              style={{
                width: '100%',
                height: '280px',
                borderRadius: '12px',
                overflow: 'hidden',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '12px',
              }}
            >
              {activeImage ? (
                <img
                  src={activeImage}
                  alt={product.name}
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              ) : (
                <AppIcon name="products" size={48} />
              )}
            </div>

            {/* Miniaturas */}
            {images.length > 1 && (
              <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImageIndex(idx)}
                    style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      border: idx === selectedImageIndex ? '2px solid var(--red, #dc2626)' : '1px solid #cbd5e1',
                      padding: 0,
                      background: '#ffffff',
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    <img src={img} alt="Miniatura" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Columna Derecha: Información Comercial & Botón Comprar */}
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--red, #dc2626)', textTransform: 'uppercase' }}>
                  {product.brand} • {product.category}
                </span>

                {/* Badge de Disponibilidad al Cliente */}
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 10px',
                    borderRadius: '20px',
                    fontSize: '11px',
                    fontWeight: 700,
                    background: availBg,
                    color: availColor,
                  }}
                >
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: availColor }} />
                  {product.availabilityLabel}
                </span>
              </div>

              <h3
                style={{
                  fontSize: '1.35rem',
                  fontWeight: 700,
                  color: 'var(--navy, #0f172a)',
                  lineHeight: 1.3,
                  margin: '0 0 10px 0',
                }}
              >
                {product.name}
              </h3>

              <p style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.5, margin: '0 0 16px 0' }}>
                {product.description || 'Producto seleccionado de alta calidad con garantía y respaldo de Distribuidora Super Más.'}
              </p>

              {/* Precio Web al Consumidor */}
              {product.showPrice ? (
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                    <span style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--navy, #0f172a)' }}>
                      ${product.price.toLocaleString('es-CO')}
                    </span>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>
                      COP / {product.unitOfMeasure}
                    </span>
                  </div>
                  <span style={{ fontSize: '11px', color: '#059669', fontWeight: 500 }}>
                    {product.vatRatePercent > 0 ? `Incluye IVA (${product.vatRatePercent}%)` : 'Producto Exento de IVA'}
                  </span>
                </div>
              ) : (
                <div style={{ marginBottom: '20px', padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', color: '#64748b', fontSize: '13px' }}>
                  Precio disponible previa cotización comercial.
                </div>
              )}
            </div>

            {/* Acción de Compra Directa */}
            <div>
              {product.canBuyDirectly ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {/* Selector de Cantidad */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                      Cantidad:
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden' }}>
                      <button
                        onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                        style={{ padding: '6px 12px', background: '#f8fafc', border: 'none', cursor: 'pointer', fontWeight: 700 }}
                      >
                        -
                      </button>
                      <span style={{ padding: '6px 14px', fontSize: '14px', fontWeight: 700, minWidth: '36px', textAlign: 'center' }}>
                        {quantity}
                      </span>
                      <button
                        onClick={() => setQuantity((q) => q + 1)}
                        style={{ padding: '6px 12px', background: '#f8fafc', border: 'none', cursor: 'pointer', fontWeight: 700 }}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Botón Comprar / Agregar */}
                  <button
                    onClick={handleBuy}
                    disabled={adding}
                    style={{
                      width: '100%',
                      padding: '12px 20px',
                      fontSize: '14px',
                      fontWeight: 700,
                      borderRadius: '10px',
                      border: 'none',
                      background: addedSuccess
                        ? '#059669'
                        : 'linear-gradient(135deg, var(--red, #dc2626) 0%, #b91c1c 100%)',
                      color: '#ffffff',
                      cursor: adding ? 'wait' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 14px rgba(220, 38, 38, 0.3)',
                      transition: 'all 0.2s',
                    }}
                  >
                    <AppIcon name={addedSuccess ? 'check' : 'purchases'} size={18} />
                    <span>
                      {addedSuccess
                        ? '¡Agregado al Carrito!'
                        : adding
                        ? 'Agregando...'
                        : `Comprar Ahora • $${(product.price * quantity).toLocaleString('es-CO')}`}
                    </span>
                  </button>
                </div>
              ) : (
                <div
                  style={{
                    padding: '14px',
                    borderRadius: '10px',
                    background: '#f1f5f9',
                    textAlign: 'center',
                    color: '#64748b',
                    fontSize: '13px',
                  }}
                >
                  {isOut
                    ? 'Producto actualmente agotado en línea. Recibiremos inventario pronto.'
                    : !product.webSuperMas
                    ? 'Producto no publicado actualmente en la tienda web.'
                    : 'Compra directa desactivada temporalmente por administración.'}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
