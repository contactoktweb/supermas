'use client'

import React, { useState, useEffect } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { SuperCatalogProduct } from '../../types'

interface SuperProductPriceModalProps {
  isOpen: boolean
  product: SuperCatalogProduct | null
  taxConfigs: any[]
  onClose: () => void
  onSavePrice: (productId: string, price: number, showPrice: boolean, taxConfigId: string) => Promise<any>
}

export function SuperProductPriceModal({
  isOpen,
  product,
  taxConfigs,
  onClose,
  onSavePrice,
}: SuperProductPriceModalProps) {
  const [price, setPrice] = useState(0)
  const [showPrice, setShowPrice] = useState(true)
  const [taxConfigId, setTaxConfigId] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (product) {
      setPrice(product.price)
      setShowPrice(product.showPrice)
      setTaxConfigId(product.taxConfigId)
    }
  }, [product])

  if (!isOpen || !product) return null

  const selectedTax = taxConfigs.find((t) => t.id === taxConfigId) || taxConfigs[0]
  const taxPercent = selectedTax ? selectedTax.ratePercent : 0
  const subtotalWithoutTax = Math.round(price / (1 + taxPercent / 100))
  const taxAmount = price - subtotalWithoutTax

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (price <= 0) return
    try {
      setSaving(true)
      await onSavePrice(product.id, price, showPrice, taxConfigId)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(3px)',
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
          borderRadius: '14px',
          width: '460px',
          maxWidth: '100%',
          padding: '24px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: '#ede9fe',
                color: '#7c3aed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AppIcon name="sales" size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--navy, #0f172a)' }}>
                Editar Precio Web e Impuestos
              </h3>
              <span style={{ fontSize: '12px', color: '#64748b' }}>{product.name}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
          >
            <AppIcon name="close" size={18} />
          </button>
        </div>

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              Precio de Venta al Público (COP)
            </label>
            <input
              type="number"
              min="1"
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
              required
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: '15px',
                fontWeight: 700,
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                color: 'var(--navy, #0f172a)',
                outline: 'none',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              Perfil Tributario DIAN
            </label>
            <select
              value={taxConfigId}
              onChange={(e) => setTaxConfigId(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: '13px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#334155',
                outline: 'none',
              }}
            >
              {taxConfigs.map((tax) => (
                <option key={tax.id} value={tax.id}>
                  {tax.name} ({tax.ratePercent}%)
                </option>
              ))}
            </select>
          </div>

          {/* Desglose informativo del IVA */}
          <div
            style={{
              padding: '12px',
              borderRadius: '8px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              fontSize: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
              <span>Base gravable estimada:</span>
              <strong>${subtotalWithoutTax.toLocaleString('es-CO')}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
              <span>Impuesto IVA ({taxPercent}%):</span>
              <strong>${taxAmount.toLocaleString('es-CO')}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--navy, #0f172a)', fontWeight: 700, borderTop: '1px dashed #cbd5e1', paddingTop: '6px' }}>
              <span>Total final al cliente:</span>
              <span>${price.toLocaleString('es-CO')}</span>
            </div>
          </div>

          {/* Toggle Mostrar Precio */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 12px',
              borderRadius: '8px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
            }}
          >
            <div>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155', display: 'block' }}>
                Mostrar Precio en Web
              </span>
              <span style={{ fontSize: '11px', color: '#64748b' }}>
                Visible para cualquier visitante sin iniciar sesión.
              </span>
            </div>
            <input
              type="checkbox"
              checked={showPrice}
              onChange={(e) => setShowPrice(e.target.checked)}
              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 14px',
                fontSize: '13px',
                fontWeight: 500,
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#475569',
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: '8px 18px',
                fontSize: '13px',
                fontWeight: 600,
                borderRadius: '8px',
                border: 'none',
                background: 'linear-gradient(135deg, var(--red, #dc2626) 0%, #b91c1c 100%)',
                color: '#ffffff',
                cursor: saving ? 'wait' : 'pointer',
              }}
            >
              {saving ? 'Guardando...' : 'Guardar Precio'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
