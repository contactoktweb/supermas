'use client'

import React, { useState, useEffect } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { SuperCatalogProduct, ProductWebConfigUpdate } from '../../types'

interface SuperProductDetailDrawerProps {
  isOpen: boolean
  product: SuperCatalogProduct | null
  taxConfigs: any[]
  onClose: () => void
  onSaveConfig: (id: string, config: ProductWebConfigUpdate) => Promise<void>
  onOpenPreview: (product: SuperCatalogProduct) => void
  canUpdate: boolean
}

export function SuperProductDetailDrawer({
  isOpen,
  product,
  taxConfigs,
  onClose,
  onSaveConfig,
  onOpenPreview,
  canUpdate,
}: SuperProductDetailDrawerProps) {
  const [webSuperMas, setWebSuperMas] = useState(false)
  const [webDirectPurchaseEnabled, setWebDirectPurchaseEnabled] = useState(false)
  const [showPrice, setShowPrice] = useState(true)
  const [price, setPrice] = useState(0)
  const [webLowStockThreshold, setWebLowStockThreshold] = useState(10)
  const [taxConfigId, setTaxConfigId] = useState('')
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'config' | 'inventory' | 'metrics'>('config')

  useEffect(() => {
    if (product) {
      setWebSuperMas(product.webSuperMas)
      setWebDirectPurchaseEnabled(product.webDirectPurchaseEnabled)
      setShowPrice(product.showPrice)
      setPrice(product.price)
      setWebLowStockThreshold(product.webLowStockThreshold)
      setTaxConfigId(product.taxConfigId)
    }
  }, [product])

  if (!isOpen || !product) return null

  const handleSave = async () => {
    try {
      setSaving(true)
      await onSaveConfig(product.id, {
        webSuperMas,
        webDirectPurchaseEnabled,
        showPrice,
        price,
        webLowStockThreshold,
        taxConfigId,
      })
      onClose()
    } catch (err) {
      // Toast handled by hook
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.45)',
          backdropFilter: 'blur(3px)',
          zIndex: 9998,
          animation: 'fadeIn 0.2s ease-out',
        }}
      />

      <aside
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '540px',
          maxWidth: '100vw',
          background: '#ffffff',
          boxShadow: '-8px 0 30px rgba(0, 0, 0, 0.15)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideLeft 0.25s ease-out',
        }}
      >
        {/* Cabecera del Drawer */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#f8fafc',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '8px',
                overflow: 'hidden',
                background: '#e2e8f0',
                border: '1px solid #cbd5e1',
                flexShrink: 0,
              }}
            >
              {product.imageUrl ? (
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <AppIcon name="products" size={24} />
              )}
            </div>
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: '15px',
                  fontWeight: 700,
                  color: 'var(--navy, #0f172a)',
                  lineHeight: 1.3,
                }}
              >
                {product.name}
              </h2>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                SKU: {product.sku} | {product.category}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#64748b',
              padding: '6px',
            }}
            aria-label="Cerrar"
          >
            <AppIcon name="close" size={20} />
          </button>
        </div>

        {/* Tabs internas */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid #e2e8f0',
            padding: '0 24px',
            background: '#ffffff',
          }}
        >
          <button
            onClick={() => setActiveTab('config')}
            style={{
              padding: '12px 16px',
              fontSize: '13px',
              fontWeight: 600,
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'config' ? '2px solid var(--red, #dc2626)' : '2px solid transparent',
              color: activeTab === 'config' ? 'var(--red, #dc2626)' : '#64748b',
              cursor: 'pointer',
            }}
          >
            Configuración Web
          </button>
          <button
            onClick={() => setActiveTab('inventory')}
            style={{
              padding: '12px 16px',
              fontSize: '13px',
              fontWeight: 600,
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'inventory' ? '2px solid var(--red, #dc2626)' : '2px solid transparent',
              color: activeTab === 'inventory' ? 'var(--red, #dc2626)' : '#64748b',
              cursor: 'pointer',
            }}
          >
            Stock por Bodega
          </button>
          <button
            onClick={() => setActiveTab('metrics')}
            style={{
              padding: '12px 16px',
              fontSize: '13px',
              fontWeight: 600,
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'metrics' ? '2px solid var(--red, #dc2626)' : '2px solid transparent',
              color: activeTab === 'metrics' ? 'var(--red, #dc2626)' : '#64748b',
              cursor: 'pointer',
            }}
          >
            Métricas Web
          </button>
        </div>

        {/* Contenido del Drawer */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
          {activeTab === 'config' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Switch Publicación Web */}
              <div
                style={{
                  padding: '16px',
                  borderRadius: '10px',
                  background: webSuperMas ? '#f0fdf4' : '#f8fafc',
                  border: `1px solid ${webSuperMas ? '#bbf7d0' : '#e2e8f0'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <strong style={{ fontSize: '13px', color: 'var(--navy, #0f172a)', display: 'block' }}>
                    Publicado en Catálogo Super Más
                  </strong>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>
                    Controla si el producto es visible para clientes en la tienda oficial.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={webSuperMas}
                  onChange={(e) => {
                    setWebSuperMas(e.target.checked)
                    if (!e.target.checked) {
                      setWebDirectPurchaseEnabled(false)
                    }
                  }}
                  disabled={!canUpdate}
                  style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                />
              </div>

              {/* Switch Compra Directa */}
              <div
                style={{
                  padding: '16px',
                  borderRadius: '10px',
                  background: webDirectPurchaseEnabled ? '#f0fdf4' : '#f8fafc',
                  border: `1px solid ${webDirectPurchaseEnabled ? '#bbf7d0' : '#e2e8f0'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <strong style={{ fontSize: '13px', color: 'var(--navy, #0f172a)', display: 'block' }}>
                    Habilitar Compra Directa
                  </strong>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>
                    Permite al cliente agregar el producto al carrito y completar Pedido Web.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={webDirectPurchaseEnabled}
                  disabled={!webSuperMas || !canUpdate}
                  onChange={(e) => setWebDirectPurchaseEnabled(e.target.checked)}
                  style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                />
              </div>

              {/* Switch Mostrar Precio */}
              <div
                style={{
                  padding: '16px',
                  borderRadius: '10px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <strong style={{ fontSize: '13px', color: 'var(--navy, #0f172a)', display: 'block' }}>
                    Mostrar Precio al Público
                  </strong>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>
                    Si está desactivado, el cliente verá la ficha pero requerirá contactar a ventas.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={showPrice}
                  disabled={!canUpdate}
                  onChange={(e) => setShowPrice(e.target.checked)}
                  style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                />
              </div>

              {/* Precio de Venta Web */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Precio de Venta Web (COP)
                </label>
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  disabled={!canUpdate}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: '14px',
                    fontWeight: 600,
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: 'var(--navy, #0f172a)',
                  }}
                />
              </div>

              {/* Umbral de Pocas Unidades Configurable */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Umbral de Pocas Unidades (Alert Threshold)
                </label>
                <input
                  type="number"
                  value={webLowStockThreshold}
                  onChange={(e) => setWebLowStockThreshold(Math.max(1, Number(e.target.value)))}
                  disabled={!canUpdate}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: '13px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#334155',
                  }}
                />
                <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'block' }}>
                  Si el stock total multi-bodega es menor o igual a este valor, se muestra "Pocas unidades".
                </span>
              </div>

              {/* Perfil Tributario / IVA */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Perfil Tributario DIAN
                </label>
                <select
                  value={taxConfigId}
                  onChange={(e) => setTaxConfigId(e.target.value)}
                  disabled={!canUpdate}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: '13px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#334155',
                  }}
                >
                  {taxConfigs.map((tax) => (
                    <option key={tax.id} value={tax.id}>
                      {tax.name} ({tax.ratePercent}%)
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {activeTab === 'inventory' && (
            <div>
              <div
                style={{
                  background: '#f1f5f9',
                  padding: '12px 14px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: '#475569',
                  marginBottom: '16px',
                }}
              >
                <strong>Nota Administrativa:</strong> La disponibilidad pública se calcula agregando todas las bodegas. Sin embargo, las salidas por Pedidos Web se procesan exclusivamente desde la <strong>bodega ecommerce autorizada</strong>.
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {product.warehouseStockSummary.map((item) => (
                  <div
                    key={item.locationId}
                    style={{
                      padding: '14px 16px',
                      borderRadius: '10px',
                      border: '1px solid #e2e8f0',
                      background: item.isEcommerceSource ? '#eff6ff' : '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <strong style={{ fontSize: '13px', color: 'var(--navy, #0f172a)' }}>
                          {item.locationName}
                        </strong>
                        {item.isEcommerceSource && (
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 700,
                              background: '#2563eb',
                              color: '#ffffff',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              textTransform: 'uppercase',
                            }}
                          >
                            Bodega Ecommerce
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>
                        Código: {item.locationCode}
                      </span>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div
                        style={{
                          fontSize: '16px',
                          fontWeight: 700,
                          color: item.currentStock > 0 ? '#059669' : '#dc2626',
                        }}
                      >
                        {item.currentStock} unds
                      </div>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>
                        {item.currentStock > 0 ? 'En existencia' : 'Agotado'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'metrics' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div
                style={{
                  padding: '16px',
                  borderRadius: '10px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                }}
              >
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '8px',
                    background: '#e0f2fe',
                    color: '#0284c7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <AppIcon name="eye" size={20} />
                </div>
                <div>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>Visualizaciones en Tienda</span>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--navy, #0f172a)' }}>
                    {product.webViewsCount.toLocaleString()} visitas
                  </div>
                </div>
              </div>

              <div
                style={{
                  padding: '16px',
                  borderRadius: '10px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                }}
              >
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '8px',
                    background: '#dcfce7',
                    color: '#15803d',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <AppIcon name="sales" size={20} />
                </div>
                <div>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>Unidades Vendidas Online</span>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--navy, #0f172a)' }}>
                    {product.totalSoldUnits} unidades
                  </div>
                </div>
              </div>

              <div
                style={{
                  padding: '16px',
                  borderRadius: '10px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                }}
              >
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '8px',
                    background: '#ede9fe',
                    color: '#7c3aed',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <AppIcon name="webOrders" size={20} />
                </div>
                <div>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>Pedidos Web Relacionados</span>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--navy, #0f172a)' }}>
                    {product.webOrdersCount} pedidos
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer del Drawer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid #e2e8f0',
            background: '#f8fafc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <button
            onClick={() => onOpenPreview(product)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              fontSize: '13px',
              fontWeight: 600,
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#0284c7',
              cursor: 'pointer',
            }}
          >
            <AppIcon name="eye" size={16} />
            <span>Vista Previa</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
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

            {canUpdate && activeTab === 'config' && (
              <button
                onClick={handleSave}
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
                  boxShadow: '0 4px 12px rgba(220, 38, 38, 0.25)',
                }}
              >
                {saving ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  )
}
