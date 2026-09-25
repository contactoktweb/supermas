'use client'

import React, { useRef } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { POSProduct } from '../types'
import { POSProductCard } from './POSProductCard'

interface POSProductGridProps {
  products: POSProduct[]
  loading: boolean
  searchQuery: string
  onSearchChange: (q: string) => void
  selectedCategory: string
  onCategoryChange?: (cat: string) => void
  onSelectCategory?: (cat: string) => void
  categories: string[]
  onSelectProduct?: (product: POSProduct) => void
  onAddToCart?: (product: POSProduct) => void
  onScanBarcode: (code: string) => void
}

export function POSProductGrid({
  products,
  loading,
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  onSelectCategory,
  categories,
  onSelectProduct,
  onAddToCart,
  onScanBarcode,
}: POSProductGridProps) {
  const searchInputRef = useRef<HTMLInputElement>(null)
  const handleCategorySelect = onSelectCategory || onCategoryChange || (() => {})
  const handleProductAdd = onAddToCart || onSelectProduct || (() => {})

  // Handle Enter key for fast barcode scanner reads
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      e.preventDefault()
      // If exact barcode / SKU match, add immediately
      const exactMatch = products.find(
        (p) =>
          p.barcode.toLowerCase() === searchQuery.trim().toLowerCase() ||
          p.sku.toLowerCase() === searchQuery.trim().toLowerCase()
      )
      if (exactMatch) {
        handleProductAdd(exactMatch)
        onSearchChange('')
      } else if (products.length === 1) {
        handleProductAdd(products[0])
        onSearchChange('')
      } else {
        onScanBarcode(searchQuery.trim())
      }
    }
  }

  return (
    <section
      style={{
        flex: '1 1 60%',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#f8fafc',
        overflow: 'hidden',
      }}
    >
      {/* 1. Fast Search & Barcode Input Bar */}
      <div
        style={{
          padding: '12px 16px',
          background: '#ffffff',
          borderBottom: '1px solid var(--line)',
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <div
          className="search-box wide"
          style={{
            flex: 1,
            height: 44,
            borderRadius: 10,
            border: '2px solid #cbd5e1',
            background: '#f8fafc',
            display: 'flex',
            alignItems: 'center',
            padding: '0 12px',
            gap: 8,
          }}
        >
          <AppIcon name="search" size={18} color="var(--navy)" />
          <input
            id="pos-product-search"
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Buscar por Nombre, SKU o lector de Código de Barras (F2)..."
            style={{
              flex: 1,
              border: 'none',
              background: 'transparent',
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--navy)',
              outline: 'none',
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                onSearchChange('')
                searchInputRef.current?.focus()
              }}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: 'var(--muted)',
                padding: 4,
              }}
              aria-label="Limpiar búsqueda"
            >
              <AppIcon name="close" size={14} />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            if (searchQuery.trim()) {
              onScanBarcode(searchQuery.trim())
            } else {
              searchInputRef.current?.focus()
            }
          }}
          className="primary-button"
          style={{
            height: 44,
            padding: '0 16px',
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 700,
            gap: 6,
            flexShrink: 0,
          }}
        >
          <AppIcon name="products" size={16} />
          <span>Escanear</span>
        </button>
      </div>

      {/* 2. Category Filter Pills */}
      <div
        style={{
          padding: '8px 16px',
          background: '#ffffff',
          borderBottom: '1px solid var(--line)',
          display: 'flex',
          gap: 6,
          overflowX: 'auto',
          flexShrink: 0,
        }}
      >
        {categories.map((cat) => {
          const isSelected = selectedCategory === cat
          const label = cat === 'ALL' ? 'Todos' : cat
          return (
            <button
              key={cat}
              type="button"
              onClick={() => handleCategorySelect(cat)}
              style={{
                padding: '5px 12px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: isSelected ? 800 : 600,
                background: isSelected ? 'var(--navy)' : '#f1f5f9',
                color: isSelected ? '#ffffff' : 'var(--navy)',
                border: isSelected ? '1px solid var(--navy)' : '1px solid #e2e8f0',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* 3. Products Grid Area */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 16,
        }}
      >
        {loading ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
              gap: 12,
            }}
          >
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                style={{
                  height: 180,
                  borderRadius: 12,
                  background: '#e2e8f0',
                  animation: 'pulse 1.5s infinite',
                }}
              />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div
            style={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 24,
              textAlign: 'center',
              color: 'var(--muted)',
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 16,
                background: '#e2e8f0',
                display: 'grid',
                placeItems: 'center',
                marginBottom: 12,
              }}
            >
              <AppIcon name="products" size={28} color="var(--navy)" />
            </div>
            <strong style={{ fontSize: 15, color: 'var(--navy)', marginBottom: 4 }}>
              {!searchQuery && selectedCategory === 'ALL'
                ? 'No hay productos registrados'
                : 'No se encontraron productos'}
            </strong>
            <p style={{ fontSize: 13, maxWidth: 320, margin: 0 }}>
              {!searchQuery && selectedCategory === 'ALL'
                ? 'No existen productos con inventario disponible en el catálogo. Registra productos en el sistema para comenzar a facturar.'
                : 'Verifica el nombre, SKU, código de barras o la categoría seleccionada.'}
            </p>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(175px, 1fr))',
              gap: 12,
            }}
          >
            {products.map((product) => (
              <POSProductCard
                key={product.id}
                product={product}
                onSelect={() => handleProductAdd(product)}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
