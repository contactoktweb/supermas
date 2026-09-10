'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { CustomSelect } from '@/components/ui/CustomSelect'
import { salesCalculationService } from '../services/sales-calculation.service'
import { CreateSaleDTO, CreateSaleItemDTO, PaymentMethod } from '../types'
import { db } from '@/lib/supabase'

interface NewSaleDrawerProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (dto: CreateSaleDTO) => Promise<void>
  locations: { id: string; name: string }[]
}

interface CartItem extends CreateSaleItemDTO {
  productName: string
  sku: string
  barcode: string
  imageUrl: string
  unitOfMeasure: string
  availableUnits: number
  unitPrice: number
  unitCost: number
  discountAmount: number
  taxAmount: number
  subtotal: number
  total: number
}

function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function NewSaleDrawer({
  isOpen,
  onClose,
  onSubmit,
  locations,
}: NewSaleDrawerProps) {
  // Step state (1: Cliente, 2: Productos, 3: Resumen & Pago, 4: Confirmación)
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)

  // Form State
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('')
  const [selectedLocationId, setSelectedLocationId] = useState<string>('loc-001')
  const [cart, setCart] = useState<CartItem[]>([])
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('EFECTIVO')
  const [documentType, setDocumentType] = useState<'FACTURA_POS' | 'FACTURA_ELECTRONICA' | 'REMISION' | 'NINGUNO'>('FACTURA_POS')
  const [notes, setNotes] = useState<string>('')

  // Search States
  const [customerSearch, setCustomerSearch] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Data from mock-db
  const allCustomers = useMemo(() => db.customers || [], [])
  const allProducts = useMemo(() => db.products || [], [])
  const allStockLevels = useMemo(() => db.stockLevels || [], [])

  // Reset form on open
  useEffect(() => {
    if (isOpen) {
      setStep(1)
      setErrorMessage(null)
      setIsSubmitting(false)
      // Preselect first location if not set
      if (locations.length > 0 && !selectedLocationId) {
        setSelectedLocationId(locations[0].id)
      }
      // Set default generic customer if no customer selected
      const genericCust = allCustomers.find((c) => c.documentNumber === '222222222222')
      if (genericCust && !selectedCustomerId) {
        setSelectedCustomerId(genericCust.id)
      }
    }
  }, [isOpen, locations, allCustomers, selectedCustomerId, selectedLocationId])

  // Selected customer object
  const selectedCustomer = useMemo(() => {
    return allCustomers.find((c) => c.id === selectedCustomerId) || null
  }, [allCustomers, selectedCustomerId])

  // Filtered customers for search
  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) {
      return allCustomers.filter((c) => c.status === 'ACTIVE').slice(0, 5)
    }
    const q = customerSearch.toLowerCase().trim()
    return allCustomers.filter(
      (c) =>
        c.status === 'ACTIVE' &&
        (c.displayName.toLowerCase().includes(q) ||
          c.documentNumber.toLowerCase().includes(q) ||
          c.phone.toLowerCase().includes(q))
    )
  }, [allCustomers, customerSearch])

  // Filtered products for search
  const searchResultsProducts = useMemo(() => {
    if (!productSearch.trim()) return []
    const q = productSearch.toLowerCase().trim()

    return allProducts
      .filter(
        (p) =>
          p.status === 'ACTIVE' &&
          (p.name.toLowerCase().includes(q) ||
            p.sku.toLowerCase().includes(q) ||
            (p.barcode && p.barcode.toLowerCase().includes(q)))
      )
      .slice(0, 6)
      .map((p) => {
        // Stock en bodega seleccionada
        const stockEntry = allStockLevels.find(
          (s) => s.productId === p.id && s.locationId === selectedLocationId
        )
        const available = (stockEntry as any)?.availableUnits ?? (stockEntry as any)?.quantity ?? (p as any).availableUnits ?? 50
        const priceList = (selectedCustomer?.priceList as any) || 'DEFAULT'
        const unitPrice = salesCalculationService.resolveUnitPrice(p as any, priceList, 1)

        return {
          ...p,
          availableInLocation: available,
          computedUnitPrice: unitPrice,
        }
      })
  }, [allProducts, allStockLevels, productSearch, selectedLocationId, selectedCustomer])

  // Re-calculate cart totals
  const recalculatedCart = useMemo(() => {
    const priceList = (selectedCustomer?.priceList as any) || 'DEFAULT'
    return cart.map((item) => {
      const prod = allProducts.find((p) => p.id === item.productId)
      if (!prod) return item
      const line = salesCalculationService.calculateLineItem(
        prod as any,
        {
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discountPercent: item.discountPercent,
          notes: item.notes,
        },
        priceList
      )
      return {
        ...item,
        ...line,
      }
    })
  }, [cart, selectedCustomer, allProducts])

  const totals = useMemo(() => {
    return salesCalculationService.calculateSaleTotals(recalculatedCart as any)
  }, [recalculatedCart])

  // Add product to cart
  const handleAddProduct = (prod: any) => {
    setErrorMessage(null)
    const existingIndex = cart.findIndex((i) => i.productId === prod.id)

    // Stock check
    const stockEntry = allStockLevels.find(
      (s) => s.productId === prod.id && s.locationId === selectedLocationId
    )
    const available = (stockEntry as any)?.availableUnits ?? (stockEntry as any)?.quantity ?? (prod as any).availableUnits ?? 50

    if (available <= 0) {
      setErrorMessage(`El producto "${prod.name}" no tiene existencias disponibles en la bodega seleccionada.`)
      return
    }

    if (existingIndex >= 0) {
      const existing = cart[existingIndex]
      if (existing.quantity + 1 > available) {
        setErrorMessage(`No puedes agregar más unidades. Existencia máxima: ${available} unidades.`)
        return
      }
      const updated = [...cart]
      updated[existingIndex] = {
        ...existing,
        quantity: existing.quantity + 1,
      }
      setCart(updated)
    } else {
      const priceList = (selectedCustomer?.priceList as any) || 'DEFAULT'
      const unitPrice = salesCalculationService.resolveUnitPrice(prod, priceList, 1)
      const line = salesCalculationService.calculateLineItem(
        prod,
        { productId: prod.id, quantity: 1, unitPrice },
        priceList
      )

      setCart([
        ...cart,
        {
          ...line,
          barcode: prod.barcode || '',
          availableUnits: available,
        },
      ])
    }
    setProductSearch('')
  }

  // Update item quantity
  const handleUpdateQuantity = (productId: string, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveItem(productId)
      return
    }
    setCart((prev) =>
      prev.map((item) => {
        if (item.productId === productId) {
          if (newQty > item.availableUnits) {
            setErrorMessage(`Existencia insuficiente. Disponible: ${item.availableUnits} unidades.`)
            return { ...item, quantity: item.availableUnits }
          }
          return { ...item, quantity: newQty }
        }
        return item
      })
    )
  }

  // Update item discount
  const handleUpdateDiscount = (productId: string, discountPercent: number) => {
    const clamped = Math.min(100, Math.max(0, discountPercent))
    setCart((prev) =>
      prev.map((item) =>
        item.productId === productId ? { ...item, discountPercent: clamped } : item
      )
    )
  }

  // Remove item from cart
  const handleRemoveItem = (productId: string) => {
    setCart((prev) => prev.filter((i) => i.productId !== productId))
  }

  // Final Submit
  const handleFinalSubmit = async () => {
    if (!selectedCustomerId) {
      setErrorMessage('Debe seleccionar un cliente para la venta.')
      setStep(1)
      return
    }
    if (cart.length === 0) {
      setErrorMessage('Debe agregar al menos un producto al carrito.')
      setStep(2)
      return
    }

    try {
      setIsSubmitting(true)
      setErrorMessage(null)

      const payload: CreateSaleDTO = {
        customerId: selectedCustomerId,
        locationId: selectedLocationId,
        paymentMethod,
        documentTypeToGenerate: documentType,
        notes: notes.trim() || undefined,
        items: cart.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          discountPercent: i.discountPercent,
          notes: i.notes,
        })),
      }

      await onSubmit(payload)
      onClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al registrar la venta'
      setErrorMessage(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <div
        className="drawer-panel page-enter"
        style={{
          width: '100%',
          maxWidth: 680,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div className="drawer-header">
          <div>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--red)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Terminal de Venta / POS
            </span>
            <h2 style={{ fontSize: 18, color: 'var(--navy)', margin: '2px 0 0' }}>
              Nueva Venta Comercial
            </h2>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Cerrar formulario"
          >
            <AppIcon name="close" size={18} />
          </button>
        </div>

        {/* Multi-step progress bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 20px',
            background: '#f8fafc',
            borderBottom: '1px solid var(--line)',
          }}
        >
          {[
            { s: 1, label: '1. Cliente', icon: 'users' },
            { s: 2, label: '2. Productos', icon: 'products' },
            { s: 3, label: '3. Pago & Totales', icon: 'sales' },
            { s: 4, label: '4. Confirmar', icon: 'check' },
          ].map((item) => (
            <button
              key={item.s}
              type="button"
              onClick={() => setStep(item.s as any)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: step === item.s ? 700 : 500,
                color: step === item.s ? 'var(--navy)' : '#64748b',
                padding: '4px 8px',
                borderRadius: 6,
              }}
            >
              <span
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background:
                    step === item.s
                      ? 'var(--navy)'
                      : step > item.s
                      ? '#10b981'
                      : '#cbd5e1',
                  color: '#ffffff',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                {step > item.s ? '✓' : item.s}
              </span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        {/* Drawer Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {errorMessage && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: 10,
                background: '#fef2f2',
                border: '1.5px solid #fecaca',
                color: '#991b1b',
                fontSize: 13,
                marginBottom: 16,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <AppIcon name="warning" size={18} color="#dc2626" />
              <div style={{ flex: 1 }}>{errorMessage}</div>
            </div>
          )}

          {/* ================= STEP 1: CLIENTE ================= */}
          {step === 1 && (
            <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Quick Consumer Selector */}
              <div
                style={{
                  padding: 14,
                  borderRadius: 12,
                  background: '#eef4fd',
                  border: '1.5px solid #001b5c24',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <div>
                  <strong style={{ fontSize: 13, color: 'var(--navy)', display: 'block' }}>
                    Venta Rápida de Mostrador
                  </strong>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                    Asignar directamente a Consumidor Final (222222222222)
                  </span>
                </div>
                <button
                  type="button"
                  className="primary-button compact"
                  onClick={() => {
                    const generic = allCustomers.find((c) => c.documentNumber === '222222222222')
                    if (generic) {
                      setSelectedCustomerId(generic.id)
                      setStep(2)
                    }
                  }}
                >
                  <AppIcon name="pos" size={14} /> Consumidor Final
                </button>
              </div>

              {/* Customer Search Box */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)', display: 'block', marginBottom: 6 }}>
                  Buscar Cliente por Documento, Nombre o Teléfono
                </label>
                <div className="search-box" style={{ width: '100%' }}>
                  <AppIcon name="search" size={16} />
                  <input
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    placeholder="Escribe CC, NIT o nombre..."
                  />
                </div>
              </div>

              {/* Customers List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>
                  Clientes Disponibles
                </span>
                {filteredCustomers.map((cust) => {
                  const isSelected = selectedCustomerId === cust.id
                  return (
                    <div
                      key={cust.id}
                      onClick={() => setSelectedCustomerId(cust.id)}
                      style={{
                        padding: 12,
                        borderRadius: 10,
                        border: isSelected ? '2px solid var(--navy)' : '1.5px solid #cbd5e1',
                        background: isSelected ? '#f0f5ff' : '#ffffff',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div>
                        <strong style={{ fontSize: 13, color: 'var(--navy)', display: 'block' }}>
                          {cust.displayName}
                        </strong>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                          <span>{cust.documentType} {cust.documentNumber}</span>
                          <span>•</span>
                          <span>{cust.city}</span>
                          <span>•</span>
                          <span style={{ color: 'var(--navy)', fontWeight: 600 }}>
                            Lista: {cust.priceList === 'WHOLESALE' ? 'Mayorista' : cust.priceList === 'VIP' ? 'VIP' : 'Normal'}
                          </span>
                        </div>
                      </div>

                      <div style={{ textAlign: 'right', fontSize: 11 }}>
                        {cust.creditLimit > 0 && (
                          <span style={{ display: 'block', color: '#10b981', fontWeight: 600 }}>
                            Cupo: {formatCOP(cust.creditLimit)}
                          </span>
                        )}
                        {cust.currentBalance > 0 && (
                          <span style={{ display: 'block', color: 'var(--red)', fontWeight: 600 }}>
                            Deuda: {formatCOP(cust.currentBalance)}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ================= STEP 2: PRODUCTOS ================= */}
          {step === 2 && (
            <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Location Selector */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)', display: 'block', marginBottom: 6 }}>
                  Bodega / Punto de Venta de Despacho
                </label>
                <CustomSelect
                  value={selectedLocationId}
                  onChange={(val) => {
                    setSelectedLocationId(val)
                    // Reset cart if location changes to avoid cross-warehouse stock discrepancies
                    if (cart.length > 0) {
                      setCart([])
                    }
                  }}
                  options={locations.map((l) => ({ value: l.id, label: l.name }))}
                />
              </div>

              {/* Product Search Box */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)', display: 'block', marginBottom: 6 }}>
                  Buscar y Agregar Productos (Nombre, SKU o Código de Barras)
                </label>
                <div className="search-box" style={{ width: '100%' }}>
                  <AppIcon name="search" size={16} />
                  <input
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Ej. Arroz Diana, Aceite Premier, SKU..."
                    autoFocus
                  />
                </div>

                {/* Product Search Results Dropdown */}
                {searchResultsProducts.length > 0 && (
                  <div
                    style={{
                      marginTop: 6,
                      borderRadius: 10,
                      border: '1.5px solid var(--navy)',
                      background: '#ffffff',
                      boxShadow: '0 8px 24px rgba(0, 27, 92, 0.12)',
                      maxHeight: 240,
                      overflowY: 'auto',
                      zIndex: 100,
                    }}
                  >
                    {searchResultsProducts.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => handleAddProduct(p)}
                        style={{
                          padding: '10px 14px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          borderBottom: '1px solid var(--line)',
                          cursor: 'pointer',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f5ff')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = '#ffffff')}
                      >
                        <div>
                          <strong style={{ fontSize: 13, color: 'var(--navy)', display: 'block' }}>
                            {p.name}
                          </strong>
                          <small style={{ fontSize: 11, color: 'var(--muted)' }}>
                            SKU: {p.sku} • {p.unitOfMeasure}
                          </small>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)', display: 'block' }}>
                            {formatCOP(p.computedUnitPrice)}
                          </span>
                          <small
                            style={{
                              fontSize: 11,
                              color: p.availableInLocation > 0 ? '#10b981' : 'var(--red)',
                              fontWeight: 600,
                            }}
                          >
                            {p.availableInLocation > 0
                              ? `${p.availableInLocation} disponibles`
                              : 'Agotado'}
                          </small>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Cart Table */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)' }}>
                    Productos en la Venta ({recalculatedCart.length})
                  </span>
                  {recalculatedCart.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setCart([])}
                      style={{ fontSize: 11, color: 'var(--red)', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                    >
                      Vaciar carrito
                    </button>
                  )}
                </div>

                {recalculatedCart.length === 0 ? (
                  <div
                    style={{
                      padding: '32px 16px',
                      borderRadius: 10,
                      border: '1.5px dashed #cbd5e1',
                      textAlign: 'center',
                      color: 'var(--muted)',
                      fontSize: 13,
                    }}
                  >
                    Usa el buscador superior para agregar productos a la venta.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {recalculatedCart.map((item) => (
                      <div
                        key={item.productId}
                        style={{
                          padding: 12,
                          borderRadius: 10,
                          border: '1.5px solid #cbd5e1',
                          background: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 12,
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <strong
                            style={{
                              fontSize: 13,
                              color: 'var(--navy)',
                              display: 'block',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {item.productName}
                          </strong>
                          <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                            {formatCOP(item.unitPrice)} c/u • IVA {item.taxRatePercent}%
                          </span>
                        </div>

                        {/* Quantity Stepper */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <button
                            type="button"
                            className="icon-button"
                            onClick={() => handleUpdateQuantity(item.productId, item.quantity - 1)}
                            style={{ width: 28, height: 28 }}
                          >
                            -
                          </button>
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => handleUpdateQuantity(item.productId, parseInt(e.target.value) || 0)}
                            style={{
                              width: 44,
                              height: 28,
                              textAlign: 'center',
                              fontWeight: 700,
                              fontSize: 12,
                              border: '1.5px solid #cbd5e1',
                              borderRadius: 6,
                            }}
                          />
                          <button
                            type="button"
                            className="icon-button"
                            onClick={() => handleUpdateQuantity(item.productId, item.quantity + 1)}
                            style={{ width: 28, height: 28 }}
                          >
                            +
                          </button>
                        </div>

                        {/* Discount Input */}
                        <div style={{ width: 65 }}>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={item.discountPercent || 0}
                            onChange={(e) => handleUpdateDiscount(item.productId, parseFloat(e.target.value) || 0)}
                            placeholder="% Dcto"
                            title="Descuento porcentual"
                            style={{
                              width: '100%',
                              height: 28,
                              textAlign: 'center',
                              fontSize: 11,
                              border: '1.5px solid #cbd5e1',
                              borderRadius: 6,
                            }}
                          />
                        </div>

                        {/* Line Total */}
                        <div style={{ textAlign: 'right', minWidth: 90 }}>
                          <strong style={{ fontSize: 13, color: 'var(--navy)', display: 'block' }}>
                            {formatCOP(item.total)}
                          </strong>
                          {item.discountAmount > 0 && (
                            <small style={{ fontSize: 10, color: '#10b981' }}>
                              -{formatCOP(item.discountAmount)}
                            </small>
                          )}
                        </div>

                        {/* Delete button */}
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() => handleRemoveItem(item.productId)}
                          style={{ color: 'var(--red)', width: 28, height: 28 }}
                          aria-label="Eliminar producto"
                        >
                          <AppIcon name="close" size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================= STEP 3: PAGO & TOTALES ================= */}
          {step === 3 && (
            <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Payment Method Selector */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)', display: 'block', marginBottom: 6 }}>
                  Método de Pago
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  {[
                    { id: 'EFECTIVO', label: 'Efectivo', icon: 'dollar' },
                    { id: 'TRANSFERENCIA', label: 'Transferencia', icon: 'wallet' },
                    { id: 'TARJETA', label: 'Tarjeta Débito/Crédito', icon: 'creditCard' },
                    { id: 'CREDITO', label: 'Crédito Comercial', icon: 'accounting' },
                    { id: 'MIXTO', label: 'Pago Mixto', icon: 'sliders' },
                  ].map((pm) => (
                    <button
                      key={pm.id}
                      type="button"
                      onClick={() => setPaymentMethod(pm.id as PaymentMethod)}
                      style={{
                        padding: '12px 10px',
                        borderRadius: 10,
                        border: paymentMethod === pm.id ? '2px solid var(--navy)' : '1.5px solid #cbd5e1',
                        background: paymentMethod === pm.id ? '#f0f5ff' : '#ffffff',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 6,
                        fontWeight: paymentMethod === pm.id ? 700 : 500,
                        color: paymentMethod === pm.id ? 'var(--navy)' : '#475569',
                      }}
                    >
                      <AppIcon name={pm.icon as any} size={18} />
                      <span style={{ fontSize: 12 }}>{pm.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Financial Breakdown Box */}
              <div
                style={{
                  padding: 16,
                  borderRadius: 12,
                  background: '#f8fafc',
                  border: '1.5px solid #cbd5e1',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span>Subtotal bruto ({totals.totalUnits} unidades):</span>
                  <strong>{formatCOP(totals.subtotal + totals.discountTotal)}</strong>
                </div>

                {totals.discountTotal > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#10b981' }}>
                    <span>Descuentos comerciales:</span>
                    <strong>-{formatCOP(totals.discountTotal)}</strong>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span>Base gravable:</span>
                  <span>{formatCOP(totals.subtotal)}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span>Impuestos (IVA discriminado):</span>
                  <span>+{formatCOP(totals.taxTotal)}</span>
                </div>

                <div
                  style={{
                    borderTop: '2px solid var(--line)',
                    paddingTop: 10,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <strong style={{ fontSize: 16, color: 'var(--navy)' }}>Total a Pagar:</strong>
                  <strong style={{ fontSize: 20, color: 'var(--navy)' }}>{formatCOP(totals.totalAmount)}</strong>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)', display: 'block', marginBottom: 6 }}>
                  Observaciones / Notas de la Venta
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Detalles de entrega, despacho o condiciones pactadas..."
                  rows={2}
                  style={{ width: '100%', resize: 'none' }}
                />
              </div>
            </div>
          )}

          {/* ================= STEP 4: CONFIRMACIÓN ================= */}
          {step === 4 && (
            <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Document Type Selector */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)', display: 'block', marginBottom: 6 }}>
                  Documento a Emitir Automáticamente
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                  {[
                    { id: 'FACTURA_POS', label: 'Factura POS (Mostrador)', icon: 'pos', desc: 'Emisión inmediata de tirilla POS' },
                    { id: 'FACTURA_ELECTRONICA', label: 'Factura Electrónica DIAN', icon: 'fileText', desc: 'Validación con CUFE DIAN' },
                    { id: 'REMISION', label: 'Guía de Remisión', icon: 'remisiones', desc: 'Documento de despacho y entrega' },
                    { id: 'NINGUNO', label: 'Solo Registro de Venta', icon: 'sales', desc: 'Facturar o remitir posteriormente' },
                  ].map((doc) => (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => setDocumentType(doc.id as any)}
                      style={{
                        padding: 12,
                        borderRadius: 10,
                        border: documentType === doc.id ? '2px solid var(--navy)' : '1.5px solid #cbd5e1',
                        background: documentType === doc.id ? '#f0f5ff' : '#ffffff',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <AppIcon name={doc.icon as any} size={16} color="var(--navy)" />
                        <strong style={{ fontSize: 12, color: 'var(--navy)' }}>{doc.label}</strong>
                      </div>
                      <small style={{ fontSize: 11, color: 'var(--muted)', display: 'block' }}>{doc.desc}</small>
                    </button>
                  ))}
                </div>
              </div>

              {/* Final Checklist Card */}
              <div
                style={{
                  padding: 16,
                  borderRadius: 12,
                  background: '#f8fafc',
                  border: '1.5px solid #cbd5e1',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  fontSize: 12,
                }}
              >
                <div>
                  <span style={{ color: 'var(--muted)' }}>Cliente: </span>
                  <strong>{selectedCustomer?.displayName}</strong> ({selectedCustomer?.documentNumber})
                </div>
                <div>
                  <span style={{ color: 'var(--muted)' }}>Bodega: </span>
                  <strong>{locations.find((l) => l.id === selectedLocationId)?.name}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--muted)' }}>Ítems: </span>
                  <strong>{totals.itemsCount} productos ({totals.totalUnits} unidades)</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--muted)' }}>Método de Pago: </span>
                  <strong>{paymentMethod}</strong>
                </div>
                <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--line)' }}>
                  <span style={{ color: 'var(--muted)' }}>Total Venta: </span>
                  <strong style={{ fontSize: 15, color: 'var(--navy)' }}>{formatCOP(totals.totalAmount)}</strong>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="drawer-footer" style={{ display: 'flex', justifyContent: 'space-between' }}>
          {step > 1 ? (
            <button
              type="button"
              className="outline-button"
              onClick={() => setStep((step - 1) as any)}
              disabled={isSubmitting}
            >
              <AppIcon name="chevronLeft" size={14} /> Anterior
            </button>
          ) : (
            <button
              type="button"
              className="outline-button"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </button>
          )}

          {step < 4 ? (
            <button
              type="button"
              className="primary-button"
              onClick={() => {
                if (step === 1 && !selectedCustomerId) {
                  setErrorMessage('Por favor seleccione un cliente.')
                  return
                }
                if (step === 2 && cart.length === 0) {
                  setErrorMessage('Por favor agregue al menos un producto a la venta.')
                  return
                }
                setErrorMessage(null)
                setStep((step + 1) as any)
              }}
            >
              Siguiente <AppIcon name="chevronRight" size={14} />
            </button>
          ) : (
            <button
              type="button"
              className="primary-button"
              onClick={handleFinalSubmit}
              disabled={isSubmitting || cart.length === 0}
              style={{ minWidth: 160 }}
            >
              {isSubmitting ? (
                'Procesando...'
              ) : (
                <>
                  <AppIcon name="check" size={15} /> Confirmar Venta
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </>
  )
}
