'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '@/components/ui/Icon'
import { CustomSelect } from '@/components/ui/CustomSelect'
import { CreateRemissionPayload } from '../types'
import { db } from '@/lib/supabase'

interface NewRemissionDrawerProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (payload: CreateRemissionPayload) => Promise<any>
}

export function NewRemissionDrawer({
  isOpen,
  onClose,
  onSubmit,
}: NewRemissionDrawerProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)

  // Step 1: Customer
  const [customerSearch, setCustomerSearch] = useState('')
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [isGenericCustomer, setIsGenericCustomer] = useState(false)

  // Step 2: Location
  const [selectedLocationId, setSelectedLocationId] = useState('loc-001')

  // Step 3: Products
  const [productSearch, setProductSearch] = useState('')
  const [selectedItems, setSelectedItems] = useState<
    Array<{
      productId: string
      productName: string
      sku: string
      barcode?: string
      unitOfMeasure: string
      quantityRequested: number
      availableStock: number
      unitPrice: number
      notes?: string
    }>
  >([])

  // Step 4: Destination & Notes
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [deliveryCity, setDeliveryCity] = useState('Bogotá, D.C.')
  const [contactPerson, setContactPerson] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [notes, setNotes] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const customers = db.customers || []
  const locations = db.locations || []
  const products = db.products || []
  const stockLevels = db.stockLevels || []

  // Filtered Customers
  const filteredCustomers = useMemo(() => {
    if (!customerSearch) return customers.slice(0, 8)
    const q = customerSearch.toLowerCase()
    return customers.filter((c: any) => {
      const name = c.displayName || c.businessName || c.name || ''
      return (
        name.toLowerCase().includes(q) ||
        (c.documentNumber && c.documentNumber.includes(q)) ||
        (c.phone && c.phone.includes(q))
      )
    })
  }, [customers, customerSearch])

  // Selected Customer Object
  const selectedCustomer = useMemo(() => {
    if (isGenericCustomer) {
      return {
        id: 'cust-generic',
        name: 'Cliente Mostrador / Genérico',
        displayName: 'Cliente Mostrador / Genérico',
        documentNumber: '222222222222',
        phone: '+57 300 000 0000',
        address: 'Punto de Venta',
        city: 'Bogotá, D.C.',
      }
    }
    const found = customers.find((c: any) => c.id === selectedCustomerId)
    if (!found) return null
    return {
      ...found,
      name: found.displayName || (found as any).businessName || (found as any).name || 'Cliente',
    }
  }, [customers, selectedCustomerId, isGenericCustomer])

  // Filtered Products
  const filteredProducts = useMemo(() => {
    if (!productSearch) return products.slice(0, 8)
    const q = productSearch.toLowerCase()
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.barcode && p.barcode.includes(q))
    )
  }, [products, productSearch])

  if (!isOpen) return null

  // Helpers
  const handleSelectCustomer = (c: any) => {
    setSelectedCustomerId(c.id)
    setIsGenericCustomer(false)
    setDeliveryAddress(c.address || '')
    setDeliveryCity(c.city || 'Bogotá, D.C.')
    setContactPerson(c.contactPerson || c.displayName || c.name || '')
    setContactPhone(c.phone || c.mobile || '')
  }

  const handleSelectGenericCustomer = () => {
    setIsGenericCustomer(true)
    setSelectedCustomerId('cust-generic')
    setDeliveryAddress('Punto de Entrega Mostrador')
    setDeliveryCity('Bogotá, D.C.')
    setContactPerson('Cliente Mostrador')
    setContactPhone('+57 300 000 0000')
  }

  const handleAddProduct = (prod: any) => {
    const existingIndex = selectedItems.findIndex((it) => it.productId === prod.id)
    const stockEntry = stockLevels.find(
      (s: any) => s.productId === prod.id && s.locationId === selectedLocationId
    )
    const available = stockEntry ? (stockEntry.currentStock || (stockEntry as any).availableUnits || 0) : 100

    if (existingIndex >= 0) {
      setSelectedItems((prev) =>
        prev.map((it, idx) =>
          idx === existingIndex ? { ...it, quantityRequested: it.quantityRequested + 1 } : it
        )
      )
    } else {
      setSelectedItems((prev) => [
        ...prev,
        {
          productId: prod.id,
          productName: prod.name,
          sku: prod.sku,
          barcode: prod.barcode,
          unitOfMeasure: prod.unitOfMeasure || 'UND',
          quantityRequested: 1,
          availableStock: available,
          unitPrice: prod.salePrice || 0,
        },
      ])
    }
  }

  const handleUpdateItemQuantity = (productId: string, qty: number) => {
    setSelectedItems((prev) =>
      prev.map((it) => (it.productId === productId ? { ...it, quantityRequested: Math.max(1, qty) } : it))
    )
  }

  const handleRemoveItem = (productId: string) => {
    setSelectedItems((prev) => prev.filter((it) => it.productId !== productId))
  }

  const totalUnits = selectedItems.reduce((acc, it) => acc + it.quantityRequested, 0)

  // Step Navigations
  const handleNext = () => {
    setError(null)
    if (step === 1) {
      if (!selectedCustomer && !isGenericCustomer) {
        setError('Debes seleccionar un cliente para continuar.')
        return
      }
      setStep(2)
    } else if (step === 2) {
      if (!selectedLocationId) {
        setError('Debes seleccionar la bodega origen.')
        return
      }
      setStep(3)
    } else if (step === 3) {
      if (selectedItems.length === 0) {
        setError('Debes agregar al menos un producto a la remisión.')
        return
      }
      setStep(4)
    }
  }

  const handleBack = () => {
    setError(null)
    if (step > 1) {
      setStep((step - 1) as 1 | 2 | 3 | 4)
    }
  }

  // Final Submit
  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCustomer) {
      setError('Falta información del cliente.')
      return
    }

    if (selectedItems.length === 0) {
      setError('La remisión debe tener al menos un producto.')
      return
    }

    try {
      setSubmitting(true)
      setError(null)
      const loc = locations.find((l) => l.id === selectedLocationId)
      await onSubmit({
        customerId: selectedCustomer.id,
        customerName: selectedCustomer.name,
        customerDoc: selectedCustomer.documentNumber || (selectedCustomer as any).nit || '222222222222',
        customerPhone: contactPhone || selectedCustomer.phone,
        customerAddress: deliveryAddress || selectedCustomer.address,
        customerCity: deliveryCity || selectedCustomer.city,
        locationId: selectedLocationId,
        locationName: loc?.name || 'Bodega Principal',
        deliveryAddress,
        deliveryCity,
        contactPerson,
        contactPhone,
        notes,
        status: 'CREATED',
        items: selectedItems.map((it) => ({
          productId: it.productId,
          productName: it.productName,
          sku: it.sku,
          barcode: it.barcode,
          unitOfMeasure: it.unitOfMeasure,
          quantityRequested: it.quantityRequested,
          unitPrice: it.unitPrice,
        })),
      })
    } catch (err: any) {
      setError(err.message || 'Error al emitir la remisión.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!mounted || !isOpen) return null

  return createPortal(
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
          overflowY: 'auto',
          background: '#ffffff',
        }}
      >
        {/* Drawer Header */}
        <div className="drawer-header" style={{ borderBottom: '1px solid #e2e8f0', padding: '16px 24px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span className="eyebrow" style={{ margin: 0 }}>Nueva Remisión</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--navy)', background: '#eef4fd', padding: '2px 6px', borderRadius: 4 }}>
                Paso {step} de 4
              </span>
            </div>
            <h2 style={{ fontSize: 18, color: 'var(--navy)', margin: 0, fontWeight: 800 }}>
              {step === 1 && '1. Seleccionar Cliente'}
              {step === 2 && '2. Bodega Origen'}
              {step === 3 && '3. Agregar Productos'}
              {step === 4 && '4. Revisión y Confirmación'}
            </h2>
          </div>

          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Cerrar modal"
            style={{ width: 34, height: 34 }}
          >
            <AppIcon name="close" size={18} />
          </button>
        </div>

        {/* Wizard Steps Stepper */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid #e2e8f0',
            background: '#f8fafc',
          }}
        >
          {[
            { num: 1, label: 'Cliente' },
            { num: 2, label: 'Bodega' },
            { num: 3, label: 'Productos' },
            { num: 4, label: 'Revisión' },
          ].map((s) => (
            <div
              key={s.num}
              style={{
                flex: 1,
                padding: '10px 6px',
                textAlign: 'center',
                fontSize: 11,
                fontWeight: 700,
                color: step === s.num ? 'var(--navy)' : step > s.num ? '#10b981' : 'var(--muted)',
                borderBottom: step === s.num ? '2px solid var(--navy)' : 'none',
                background: step === s.num ? '#fff' : 'transparent',
              }}
            >
              {step > s.num ? '✓ ' : `${s.num}. `}
              {s.label}
            </div>
          ))}
        </div>

        {/* Wizard Body Content */}
        <div style={{ padding: '20px 24px', flex: 1, overflowY: 'auto' }}>
          {error && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 8,
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#991b1b',
                fontSize: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 16,
              }}
            >
              <AppIcon name="warning" size={16} color="var(--red)" />
              <span>{error}</span>
            </div>
          )}

          {/* PASO 1: CLIENTE */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)' }}>
                  Buscar Cliente por Nombre, NIT o Teléfono:
                </label>
                <button
                  type="button"
                  className="outline-button"
                  onClick={handleSelectGenericCustomer}
                  style={{ height: 28, fontSize: 11, padding: '0 8px' }}
                >
                  <AppIcon name="customers" size={12} /> Cliente Genérico
                </button>
              </div>

              <div className="search-box filter-search-primary" style={{ width: '100%' }}>
                <AppIcon name="search" size={16} />
                <input
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  placeholder="Ej. Comercializadora, 900123456..."
                />
              </div>

              {/* Selected Customer Card Preview */}
              {selectedCustomer && (
                <div
                  style={{
                    padding: '12px 16px',
                    borderRadius: 8,
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <span style={{ fontSize: 10, color: '#1e40af', fontWeight: 700 }}>
                      CLIENTE SELECCIONADO
                    </span>
                    <strong style={{ display: 'block', fontSize: 13, color: 'var(--navy)' }}>
                      {selectedCustomer.name}
                    </strong>
                    <small style={{ color: '#64748b' }}>
                      NIT/CC: {selectedCustomer.documentNumber || (selectedCustomer as any).nit} · Tel: {selectedCustomer.phone}
                    </small>
                  </div>
                  <AppIcon name="check" size={20} color="#10b981" />
                </div>
              )}

              {/* Customers List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 300, overflowY: 'auto' }}>
                {filteredCustomers.map((cust) => {
                  const isSel = selectedCustomerId === cust.id && !isGenericCustomer
                  return (
                    <div
                      key={cust.id}
                      onClick={() => handleSelectCustomer(cust)}
                      style={{
                        padding: '10px 14px',
                        borderRadius: 8,
                        background: isSel ? '#eff6ff' : '#f8fafc',
                        border: `1px solid ${isSel ? 'var(--navy)' : '#e2e8f0'}`,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div>
                        <strong style={{ fontSize: 12, color: 'var(--navy)' }}>
                          {cust.displayName || (cust as any).businessName || (cust as any).name || 'Cliente'}
                        </strong>
                        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                          {cust.documentNumber || (cust as any).nit} · {cust.city || 'Bogotá'} · {cust.phone}
                        </div>
                      </div>
                      <AppIcon name="chevronRight" size={14} color="var(--muted)" />
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* PASO 2: BODEGA */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)' }}>
                Selecciona la Bodega Origen para el Despacho:
              </label>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {locations.map((loc) => {
                  const isSel = selectedLocationId === loc.id
                  return (
                    <div
                      key={loc.id}
                      onClick={() => setSelectedLocationId(loc.id)}
                      style={{
                        padding: '14px 18px',
                        borderRadius: 8,
                        background: isSel ? '#eff6ff' : '#f8fafc',
                        border: `1px solid ${isSel ? 'var(--navy)' : '#e2e8f0'}`,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 8,
                            background: isSel ? 'var(--navy)' : '#e2e8f0',
                            color: isSel ? '#fff' : '#475569',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <AppIcon name="warehouse" size={18} />
                        </div>
                        <div>
                          <strong style={{ fontSize: 13, color: 'var(--navy)' }}>{loc.name}</strong>
                          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                            {loc.address} · {loc.city} ({loc.type || 'Principal'})
                          </div>
                        </div>
                      </div>

                      {isSel && <AppIcon name="check" size={20} color="#10b981" />}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* PASO 3: PRODUCTOS */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)' }}>
                Buscar y Agregar Productos:
              </label>

              <div className="search-box filter-search-primary" style={{ width: '100%' }}>
                <AppIcon name="search" size={16} />
                <input
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Buscar producto por nombre o SKU..."
                />
              </div>

              {/* Products Quick Selector Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8, maxHeight: 180, overflowY: 'auto' }}>
                {filteredProducts.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleAddProduct(p)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 6,
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <strong style={{ fontSize: 11, color: 'var(--navy)', display: 'block' }}>{p.name}</strong>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
                      <span>{p.sku}</span>
                      <span>+ Agregar</span>
                    </div>
                  </button>
                ))}
              </div>

              {/* Selected Items Table */}
              <div style={{ marginTop: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)', display: 'block', marginBottom: 6 }}>
                  Productos en la Remisión ({selectedItems.length} ítems · {totalUnits} unidades):
                </span>

                {selectedItems.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', background: '#f8fafc', borderRadius: 8, border: '1px dashed #cbd5e1', fontSize: 12, color: 'var(--muted)' }}>
                    No has agregado productos a la remisión.
                  </div>
                ) : (
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                          <th style={{ padding: '8px 10px', color: 'var(--muted)', fontWeight: 600 }}>Producto</th>
                          <th style={{ padding: '8px 10px', color: 'var(--muted)', fontWeight: 600, textAlign: 'center', width: 80 }}>Cant.</th>
                          <th style={{ padding: '8px 10px', width: 30 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedItems.map((it) => (
                          <tr key={it.productId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 10px' }}>
                              <strong style={{ color: 'var(--navy)', display: 'block' }}>{it.productName}</strong>
                              <small style={{ color: 'var(--muted)' }}>{it.sku} · {it.unitOfMeasure}</small>
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                              <input
                                type="number"
                                min="1"
                                value={it.quantityRequested}
                                onChange={(e) =>
                                  handleUpdateItemQuantity(it.productId, parseInt(e.target.value, 10) || 1)
                                }
                                style={{
                                  width: 60,
                                  height: 30,
                                  textAlign: 'center',
                                  borderRadius: 4,
                                  border: '1px solid #cbd5e1',
                                  fontWeight: 700,
                                }}
                              />
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(it.productId)}
                                style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer' }}
                              >
                                <AppIcon name="close" size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* PASO 4: REVISIÓN */}
          {step === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Summary Card */}
              <div
                style={{
                  padding: '14px 18px',
                  borderRadius: 8,
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700 }}>DESTINATARIO:</span>
                    <strong style={{ display: 'block', fontSize: 13, color: 'var(--navy)' }}>
                      {selectedCustomer?.name}
                    </strong>
                    <small style={{ color: '#64748b' }}>NIT/CC: {selectedCustomer?.documentNumber}</small>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700 }}>BODEGA ORIGEN:</span>
                    <strong style={{ display: 'block', fontSize: 13, color: 'var(--navy)' }}>
                      {locations.find((l) => l.id === selectedLocationId)?.name}
                    </strong>
                  </div>
                </div>

                <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--navy)' }}>
                    Total a Despachar: {selectedItems.length} productos ({totalUnits} unidades)
                  </span>
                </div>
              </div>

              {/* Destination & Contact Fields */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--navy)', display: 'block', marginBottom: 4 }}>
                    Dirección de Entrega
                  </label>
                  <input
                    type="text"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder="Ej. Cra 15 # 45-20"
                    style={{ width: '100%', height: 36, padding: '0 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12 }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--navy)', display: 'block', marginBottom: 4 }}>
                    Ciudad de Destino
                  </label>
                  <input
                    type="text"
                    value={deliveryCity}
                    onChange={(e) => setDeliveryCity(e.target.value)}
                    placeholder="Ej. Bogotá, D.C."
                    style={{ width: '100%', height: 36, padding: '0 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12 }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--navy)', display: 'block', marginBottom: 4 }}>
                    Persona de Contacto
                  </label>
                  <input
                    type="text"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    placeholder="Ej. Andrés Morales (Recepción)"
                    style={{ width: '100%', height: 36, padding: '0 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12 }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--navy)', display: 'block', marginBottom: 4 }}>
                    Teléfono Contacto
                  </label>
                  <input
                    type="text"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="Ej. +57 300 123 4567"
                    style={{ width: '100%', height: 36, padding: '0 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12 }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--navy)', display: 'block', marginBottom: 4 }}>
                  Observaciones / Instrucciones de Despacho
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Instrucciones de descarga, horario o especificaciones..."
                  rows={2}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12, resize: 'none' }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Drawer Navigation Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid #e2e8f0',
            background: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {step > 1 ? (
            <button
              type="button"
              className="outline-button"
              onClick={handleBack}
              disabled={submitting}
            >
              <AppIcon name="chevronLeft" size={14} /> Anterior
            </button>
          ) : (
            <button
              type="button"
              className="outline-button"
              onClick={onClose}
              disabled={submitting}
            >
              Cancelar
            </button>
          )}

          {step < 4 ? (
            <button
              type="button"
              className="primary-button compact"
              onClick={handleNext}
            >
              Siguiente <AppIcon name="chevronRight" size={14} />
            </button>
          ) : (
            <button
              type="button"
              className="primary-button compact"
              onClick={handleFinalSubmit}
              disabled={submitting}
            >
              <AppIcon name="remisiones" size={14} />
              {submitting ? 'Generando Remisión...' : 'Crear Remisión'}
            </button>
          )}
        </div>
      </aside>
    </div>,
    document.body
  )
}
