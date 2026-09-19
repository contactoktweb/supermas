'use client'

import React, { useState } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { SuperBulkActionType } from '../../types'

interface SuperBulkActionModalProps {
  isOpen: boolean
  actionType: SuperBulkActionType
  selectedCount: number
  onClose: () => void
  onConfirm: (action: SuperBulkActionType) => Promise<void>
}

export function SuperBulkActionModal({
  isOpen,
  actionType,
  selectedCount,
  onClose,
  onConfirm,
}: SuperBulkActionModalProps) {
  const [loading, setLoading] = useState(false)

  if (!isOpen) return null

  const getActionInfo = () => {
    switch (actionType) {
      case 'PUBLISH':
        return {
          title: 'Publicar Productos en Tienda Web',
          desc: `Se activará la visibilidad pública de ${selectedCount} productos en el Catálogo Super Más.`,
          icon: 'visibility',
          color: '#059669',
          btnBg: '#059669',
          btnText: 'Sí, Publicar',
        }
      case 'HIDE':
        return {
          title: 'Ocultar Productos de Tienda Web',
          desc: `Se ocultarán ${selectedCount} productos del catálogo público y se desactivará su compra directa.`,
          icon: 'close',
          color: '#dc2626',
          btnBg: '#dc2626',
          btnText: 'Sí, Ocultar',
        }
      case 'ENABLE_PURCHASE':
        return {
          title: 'Activar Compra Directa Online',
          desc: `Los clientes podrán agregar ${selectedCount} productos al carrito y generar Pedidos Web.`,
          icon: 'check',
          color: '#0284c7',
          btnBg: '#0284c7',
          btnText: 'Activar Compra',
        }
      case 'DISABLE_PURCHASE':
        return {
          title: 'Desactivar Compra Directa',
          desc: `Se inhabilitará el carrito y la compra directa para ${selectedCount} productos.`,
          icon: 'alert',
          color: '#d97706',
          btnBg: '#d97706',
          btnText: 'Desactivar Compra',
        }
    }
  }

  const info = getActionInfo()

  const handleExecute = async () => {
    try {
      setLoading(true)
      await onConfirm(actionType)
    } finally {
      setLoading(false)
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
          width: '440px',
          maxWidth: '100%',
          padding: '24px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: '52px',
            height: '52px',
            borderRadius: '50%',
            background: `${info.color}15`,
            color: info.color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px auto',
          }}
        >
          <AppIcon name={info.icon as any} size={26} />
        </div>

        <h3 style={{ margin: '0 0 8px 0', fontSize: '17px', fontWeight: 700, color: 'var(--navy, #0f172a)' }}>
          {info.title}
        </h3>

        <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>
          {info.desc}
        </p>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              padding: '10px 18px',
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
            onClick={handleExecute}
            disabled={loading}
            style={{
              padding: '10px 20px',
              fontSize: '13px',
              fontWeight: 600,
              borderRadius: '8px',
              border: 'none',
              background: info.btnBg,
              color: '#ffffff',
              cursor: loading ? 'wait' : 'pointer',
              boxShadow: `0 4px 12px ${info.color}40`,
            }}
          >
            {loading ? 'Aplicando...' : info.btnText}
          </button>
        </div>
      </div>
    </div>
  )
}
