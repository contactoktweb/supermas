'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '@/components/ui/Icon'
import { CustomSelect } from '@/components/ui/CustomSelect'
import {
  PurchaseItem,
  SupplierOption,
  PurchasePaymentType,
  CreatePurchaseInput,
} from '../types'
import { LocationOption } from '../services/location.service'
import { purchaseCalculationService } from '../services/purchase-calculation.service'
import { productService } from '@/features/products/services/product.service'

interface PurchaseNewDrawerProps {
  isOpen: boolean
  suppliers: SupplierOption[]
  locations: LocationOption[]
  onClose: () => void
  onSubmit: (input: CreatePurchaseInput) => Promise<void>
}

interface ProductSearchResult {
  id: string
  name: string
  sku: string
  barcode?: string
  imageUrl?: string
  unitOfMeasure: string
  currentCost: number
  currentStock: number
  vatRatePercent: number
  taxProfile: string
}

export function PurchaseNewDrawer({
  isOpen,
  suppliers,
  locations,
  onClose,
  onSubmit,
}: PurchaseNewDrawerProps) {
  const [mounted, setMounted] = useState(false)
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Step 1: General Info
  const [supplierId, setSupplierId] = useState<string>(suppliers[0]?.id || '')
  const [destinationLocationId, setDestinationLocationId] = useState<string>(
    locations[0]?.id || ''
  )
  const [date, setDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  )
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState<string>('')
  const [paymentType, setPaymentType] = useState<PurchasePaymentType>('CONTADO')
  const [dueDate, setDueDate] = useState<string>('')
  const [notes, setNotes] = useState<string>('')

  // Step 2: Products
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<ProductSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [items, setItems] = useState<PurchaseItem[]>([])

  // Taxes
  const taxConfigs = purchaseCalculationService.getTaxConfigs()

  // Step 3: Attachment (Supabase Storage preview)
  const [attachment, setAttachment] = useState<{
    fileName: string
    fileType: string
    fileSize: number
    url: string
  } | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Sync default options when loaded
  useEffect(() => {
    if (!supplierId && suppliers.length > 0) {
      setSupplierId(suppliers[0].id)
    }
  }, [suppliers, supplierId])

  useEffect(() => {
    if (!destinationLocationId && locations.length > 0) {
      setDestinationLocationId(locations[0].id)
    }
  }, [locations, destinationLocationId])

  // Reactive product search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }

    const timer = setTimeout(async () => {
      setIsSearching(true)
      try {
        const results = await productService.search(
          searchQuery,
          destinationLocationId
        )
        setSearchResults(results)
      } catch (err) {
        console.error('Error searching products:', err)
      } finally {
        setIsSearching(false)
      }
    }, 250)

    return () => clearTimeout(timer)
  }, [searchQuery, destinationLocationId])

  if (!isOpen || !mounted) return null

  // Formatters
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(val)
  }

  // Handle adding product to items
  const handleAddProduct = (prod: ProductSearchResult) => {
    // Check if already in items
    const existingIndex = items.findIndex((i) => i.productId === prod.id)
    if (existingIndex >= 0) {
      // Increase quantity by 1
      const updated = [...items]
      const existing = updated[existingIndex]
      const newQty = existing.quantity + 1
      updated[existingIndex] = purchaseCalculationService.calculateLineItem(
        {
          productId: existing.productId,
          productName: existing.productName,
          sku: existing.sku,
          barcode: existing.barcode,
          unitOfMeasure: existing.unitOfMeasure,
          imageUrl: existing.imageUrl,
          quantity: newQty,
          unitCost: existing.unitCost,
          discountPercent: existing.discountPercent,
          taxRatePercent: existing.taxRatePercent,
          taxCode: existing.taxCode,
        },
        existing.id
      )
      setItems(updated)
    } else {
      // Find matching tax config
      const defaultTax =
        taxConfigs.find((t) => t.ratePercent === prod.vatRatePercent) ||
        taxConfigs.find((t) => t.isDefault) || {
          code: 'IVA_19',
          ratePercent: 19,
        }

      const newLine = purchaseCalculationService.calculateLineItem({
        productId: prod.id,
        productName: prod.name,
        sku: prod.sku,
        barcode: prod.barcode,
        unitOfMeasure: prod.unitOfMeasure,
        imageUrl: prod.imageUrl,
        quantity: 1,
        unitCost: prod.currentCost > 0 ? prod.currentCost : 1000,
        discountPercent: 0,
        taxRatePercent: defaultTax.ratePercent,
        taxCode: defaultTax.code,
      })

      setItems((prev) => [...prev, newLine])
    }

    setSearchQuery('')
    setSearchResults([])
  }

  // Handle line item change
  const handleUpdateItem = (
    index: number,
    field: 'quantity' | 'unitCost' | 'discountPercent' | 'taxCode',
    value: any
  ) => {
    const updated = [...items]
    const item = updated[index]

    let qty = item.quantity
    let cost = item.unitCost
    let disc = item.discountPercent
    let taxCode = item.taxCode
    let taxRate = item.taxRatePercent

    if (field === 'quantity') qty = Number(value) || 0
    if (field === 'unitCost') cost = Number(value) || 0
    if (field === 'discountPercent') disc = Number(value) || 0
    if (field === 'taxCode') {
      taxCode = value
      const conf = taxConfigs.find((t) => t.code === value)
      taxRate = conf ? conf.ratePercent : 19
    }

    updated[index] = purchaseCalculationService.calculateLineItem(
      {
        productId: item.productId,
        productName: item.productName,
        sku: item.sku,
        barcode: item.barcode,
        unitOfMeasure: item.unitOfMeasure,
        imageUrl: item.imageUrl,
        quantity: qty,
        unitCost: cost,
        discountPercent: disc,
        taxRatePercent: taxRate,
        taxCode,
      },
      item.id
    )

    setItems(updated)
  }

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  // File upload simulation (Supabase Storage)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setAttachment({
      fileName: file.name,
      fileType: file.type || 'application/pdf',
      fileSize: file.size,
      url: URL.createObjectURL(file),
    })
  }

  // Calculated totals
  const totals = purchaseCalculationService.calculateTotals(items)

  // Step validations
  const validateStep1 = () => {
    if (!supplierId) {
      setError('Por favor seleccione un proveedor.')
      return false
    }
    if (!destinationLocationId) {
      setError('Por favor seleccione una bodega destino.')
      return false
    }
    if (!date) {
      setError('La fecha de compra es obligatoria.')
      return false
    }
    if (!supplierInvoiceNumber.trim()) {
      setError('Ingrese el número de factura o remisión del proveedor.')
      return false
    }
    if (paymentType === 'CREDITO' && !dueDate) {
      setError('Para compras a crédito es obligatorio definir la fecha de vencimiento.')
      return false
    }
    setError(null)
    return true
  }

  const validateStep2 = () => {
    if (items.length === 0) {
      setError('Debe agregar al menos un producto a la compra.')
      return false
    }
    for (const it of items) {
      if (it.quantity <= 0) {
        setError(`El producto "${it.productName}" tiene una cantidad inválida.`)
        return false
      }
      if (it.unitCost < 0) {
        setError(`El producto "${it.productName}" tiene un costo negativo.`)
        return false
      }
    }
    setError(null)
    return true
  }

  // Submit action
  const handleFinalSubmit = async (saveAsDraft: boolean) => {
    setError(null)
    setIsSubmitting(true)

    try {
      const payload: CreatePurchaseInput = {
        supplierId,
        supplierInvoiceNumber: supplierInvoiceNumber.trim(),
        destinationLocationId,
        date,
        paymentType,
        dueDate: paymentType === 'CREDITO' ? dueDate : undefined,
        notes: notes.trim() || undefined,
        saveAsDraft,
        items: items.map((it) => ({
          productId: it.productId,
          productName: it.productName,
          sku: it.sku,
          barcode: it.barcode,
          unitOfMeasure: it.unitOfMeasure,
          imageUrl: it.imageUrl,
          quantity: it.quantity,
          unitCost: it.unitCost,
          discountPercent: it.discountPercent,
          taxCode: it.taxCode,
          taxRatePercent: it.taxRatePercent,
        })),
        attachment: attachment || undefined,
      }

      await onSubmit(payload)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Error al guardar la orden de compra.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const selectedSupplier = suppliers.find((s) => s.id === supplierId)
  const selectedLocation = locations.find((l) => l.id === destinationLocationId)

  return createPortal(
    <div
      className="drawer-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-purchase-drawer-title"
    >
      <div
        className="product-drawer product-detail-drawer page-enter"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 860, width: '92vw' }}
      >
        {/* Header */}
        <div className="drawer-header" style={{ padding: '18px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              className="stat-icon blue"
              style={{ width: 42, height: 42, borderRadius: 12 }}
            >
              <AppIcon name="purchases" size={22} />
            </div>
            <div>
              <span className="product-category-eyebrow">
                Gestión de Abastecimiento
              </span>
              <h2
                id="new-purchase-drawer-title"
                style={{
                  margin: 0,
                  fontSize: 18,
                  fontWeight: 800,
                  color: 'var(--navy)',
                }}
              >
                Nueva Compra a Proveedor
              </h2>
            </div>
          </div>
          <button
            type="button"
            className="drawer-close-btn"
            onClick={onClose}
            aria-label="Cerrar formulario"
          >
            <AppIcon name="close" size={18} />
          </button>
        </div>

        {/* Wizard Stepper Tabs */}
        <div
          className="wizard-steps-header"
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--border)',
            background: 'var(--bg-subtle, #f8fafc)',
          }}
        >
          {[
            { num: 1, title: 'Información general' },
            { num: 2, title: 'Productos' },
            { num: 3, title: 'Impuestos y totales' },
            { num: 4, title: 'Confirmación' },
          ].map((s) => (
            <button
              key={s.num}
              type="button"
              className={`wizard-step-btn ${step === s.num ? 'active' : ''} ${
                step > s.num ? 'completed' : ''
              }`}
              onClick={() => {
                if (s.num === 1) setStep(1)
                if (s.num === 2 && validateStep1()) setStep(2)
                if (s.num === 3 && validateStep1() && validateStep2()) setStep(3)
                if (s.num === 4 && validateStep1() && validateStep2()) setStep(4)
              }}
              style={{
                flex: 1,
                padding: '12px 6px',
                fontSize: 12,
                fontWeight: 700,
                border: 0,
                background: step === s.num ? '#fff' : 'transparent',
                borderBottom:
                  step === s.num
                    ? '2px solid var(--navy)'
                    : '2px solid transparent',
                color: step === s.num ? 'var(--navy)' : 'var(--muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <span>{s.num}.</span>
              <span>{s.title}</span>
            </button>
          ))}
        </div>

        {/* Body Content */}
        <div
          className="drawer-body"
          style={{ padding: 24, overflowY: 'auto', flex: 1 }}
        >
          {error && (
            <div
              className="incident-alert-banner page-enter"
              style={{
                background: '#fef2f2',
                borderColor: '#fca5a5',
                padding: '10px 14px',
                borderRadius: 8,
                marginBottom: 16,
                color: '#dc2626',
                fontSize: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <AppIcon name="warning" size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* =========================================================================
              PASO 1: INFORMACIÓN GENERAL
             ========================================================================= */}
          {step === 1 && (
            <div className="page-enter">
              <h3
                style={{
                  margin: '0 0 4px',
                  fontSize: 15,
                  fontWeight: 800,
                  color: 'var(--navy)',
                }}
              >
                Paso 1: Información General de la Compra
              </h3>
              <p
                style={{
                  margin: '0 0 18px',
                  fontSize: 13,
                  color: 'var(--muted)',
                }}
              >
                Seleccione el proveedor comercial, la bodega donde ingresará la
                mercancía y las condiciones del pago.
              </p>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 16,
                  marginBottom: 16,
                }}
              >
                {/* Proveedor */}
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 12,
                      fontWeight: 700,
                      marginBottom: 6,
                    }}
                  >
                    Proveedor comercial <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <CustomSelect
                    value={supplierId}
                    onChange={(val) => setSupplierId(val)}
                    options={suppliers.map((s) => ({
                      value: s.id,
                      label: s.name,
                      description: s.nit ? `NIT: ${s.nit}` : undefined,
                    }))}
                    placeholder="Seleccione proveedor"
                  />
                  {selectedSupplier && selectedSupplier.nit && (
                    <div
                      style={{
                        marginTop: 4,
                        fontSize: 11,
                        color: 'var(--muted)',
                      }}
                    >
                      NIT: {selectedSupplier.nit} • Tel:{' '}
                      {selectedSupplier.phone || 'No registrado'}
                    </div>
                  )}
                </div>

                {/* Bodega Destino */}
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 12,
                      fontWeight: 700,
                      marginBottom: 6,
                    }}
                  >
                    Bodega destino de recepción{' '}
                    <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <CustomSelect
                    value={destinationLocationId}
                    onChange={(val) => setDestinationLocationId(val)}
                    options={locations.map((l) => ({
                      value: l.id,
                      label: l.name,
                      description: l.code,
                    }))}
                    placeholder="Seleccione bodega"
                  />
                  {selectedLocation && (
                    <div
                      style={{
                        marginTop: 4,
                        fontSize: 11,
                        color: 'var(--muted)',
                      }}
                    >
                      Código: {selectedLocation.code} • Ciudad:{' '}
                      {selectedLocation.city}
                    </div>
                  )}
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 16,
                  marginBottom: 16,
                }}
              >
                {/* Fecha Compra */}
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 12,
                      fontWeight: 700,
                      marginBottom: 6,
                    }}
                  >
                    Fecha de compra <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="date"
                    className="filter-date-input"
                    style={{ width: '100%' }}
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>

                {/* Número Factura Proveedor */}
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 12,
                      fontWeight: 700,
                      marginBottom: 6,
                    }}
                  >
                    N° Factura / Remisión Proveedor{' '}
                    <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="filter-date-input"
                    style={{ width: '100%' }}
                    placeholder="Ej. FAC-89214 o REM-0012"
                    value={supplierInvoiceNumber}
                    onChange={(e) => setSupplierInvoiceNumber(e.target.value)}
                  />
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 16,
                  marginBottom: 16,
                }}
              >
                {/* Tipo de Compra */}
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 12,
                      fontWeight: 700,
                      marginBottom: 6,
                    }}
                  >
                    Condición de pago <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <CustomSelect
                    value={paymentType}
                    onChange={(val) =>
                      setPaymentType(val as PurchasePaymentType)
                    }
                    options={[
                      {
                        value: 'CONTADO',
                        label: 'Contado (Inmediato)',
                        description: 'Pago al momento de la compra',
                      },
                      {
                        value: 'CREDITO',
                        label: 'Crédito (Cuenta por pagar)',
                        description: 'Genera obligación con fecha límite',
                      },
                    ]}
                  />
                </div>

                {/* Fecha Vencimiento (si es crédito) */}
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 12,
                      fontWeight: 700,
                      marginBottom: 6,
                    }}
                  >
                    Fecha de vencimiento{' '}
                    {paymentType === 'CREDITO' && (
                      <span style={{ color: '#dc2626' }}>*</span>
                    )}
                  </label>
                  <input
                    type="date"
                    className="filter-date-input"
                    style={{
                      width: '100%',
                      opacity: paymentType === 'CREDITO' ? 1 : 0.5,
                    }}
                    disabled={paymentType !== 'CREDITO'}
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
              </div>

              {/* Observaciones */}
              <div style={{ marginBottom: 16 }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: 12,
                    fontWeight: 700,
                    marginBottom: 6,
                  }}
                >
                  Observaciones comerciales o logísticas
                </label>
                <textarea
                  className="filter-date-input"
                  style={{
                    width: '100%',
                    minHeight: 64,
                    resize: 'vertical',
                    fontFamily: 'inherit',
                  }}
                  placeholder="Instrucciones de entrega, acuerdos de flete o descuentos por pronto pago..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* =========================================================================
              PASO 2: PRODUCTOS Y LÍNEAS
             ========================================================================= */}
          {step === 2 && (
            <div className="page-enter">
              <h3
                style={{
                  margin: '0 0 4px',
                  fontSize: 15,
                  fontWeight: 800,
                  color: 'var(--navy)',
                }}
              >
                Paso 2: Búsqueda y Selección de Productos
              </h3>
              <p
                style={{
                  margin: '0 0 16px',
                  fontSize: 13,
                  color: 'var(--muted)',
                }}
              >
                Busque productos en catálogo por nombre, SKU o código de barras
                para agregarlos a la orden de compra.
              </p>

              {/* Buscador reactivo */}
              <div style={{ position: 'relative', marginBottom: 16 }}>
                <div className="search-box wide products-search-box">
                  <AppIcon name="search" size={16} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar producto por nombre, SKU o código de barras..."
                    autoFocus
                  />
                  {isSearching && (
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                      Buscando...
                    </span>
                  )}
                </div>

                {/* Dropdown de resultados */}
                {searchResults.length > 0 && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      background: '#fff',
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      boxShadow: '0 10px 25px rgba(0,0,0,0.12)',
                      maxHeight: 260,
                      overflowY: 'auto',
                      zIndex: 50,
                      marginTop: 4,
                    }}
                  >
                    {searchResults.map((prod) => (
                      <div
                        key={prod.id}
                        onClick={() => handleAddProduct(prod)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: '10px 14px',
                          borderBottom: '1px solid #f1f5f9',
                          cursor: 'pointer',
                          transition: 'background 0.15s ease',
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.background = '#f8fafc')
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.background = '#fff')
                        }
                      >
                        {prod.imageUrl ? (
                          <img
                            src={prod.imageUrl}
                            alt={prod.name}
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 6,
                              objectFit: 'cover',
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 6,
                              background: '#eff6ff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'var(--navy)',
                            }}
                          >
                            <AppIcon name="products" size={18} />
                          </div>
                        )}
                        <div style={{ flex: 1 }}>
                          <strong
                            style={{
                              fontSize: 13,
                              color: 'var(--text-main)',
                              display: 'block',
                            }}
                          >
                            {prod.name}
                          </strong>
                          <div
                            style={{
                              fontSize: 11,
                              color: 'var(--muted)',
                              display: 'flex',
                              gap: 8,
                            }}
                          >
                            <span>SKU: {prod.sku}</span>
                            <span>•</span>
                            <span>Stock actual: {prod.currentStock} uds</span>
                            <span>•</span>
                            <span>Costo actual: {formatCurrency(prod.currentCost)}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="outline-button-sm"
                          style={{ fontSize: 11 }}
                        >
                          <AppIcon name="plus" size={12} /> Agregar
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Tabla de Líneas Agregadas */}
              {items.length === 0 ? (
                <div
                  style={{
                    padding: 32,
                    textAlign: 'center',
                    background: '#f8fafc',
                    borderRadius: 8,
                    border: '1px dashed var(--border)',
                  }}
                >
                  <AppIcon name="purchases" size={28} />
                  <p
                    style={{
                      margin: '8px 0 0',
                      fontSize: 13,
                      color: 'var(--muted)',
                    }}
                  >
                    No hay productos en la orden de compra. Utilice el buscador
                    arriba para agregar items.
                  </p>
                </div>
              ) : (
                <div
                  className="table-responsive"
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                  }}
                >
                  <table className="products-table" style={{ fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th>Producto</th>
                        <th style={{ width: 90 }}>Cant.</th>
                        <th style={{ width: 115 }}>Costo Unit.</th>
                        <th style={{ width: 110 }}>IVA</th>
                        <th style={{ width: 75 }}>Desc %</th>
                        <th className="numeric">Subtotal</th>
                        <th className="numeric">Total</th>
                        <th style={{ width: 40 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, idx) => (
                        <tr key={item.id}>
                          <td>
                            <div>
                              <strong
                                style={{
                                  fontSize: 12,
                                  color: 'var(--text-main)',
                                }}
                              >
                                {item.productName}
                              </strong>
                              <div
                                style={{ fontSize: 10, color: 'var(--muted)' }}
                              >
                                SKU: {item.sku} • {item.unitOfMeasure}
                              </div>
                            </div>
                          </td>
                          <td>
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) =>
                                handleUpdateItem(idx, 'quantity', e.target.value)
                              }
                              className="filter-date-input"
                              style={{ width: '100%', padding: '4px 6px' }}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              value={item.unitCost}
                              onChange={(e) =>
                                handleUpdateItem(idx, 'unitCost', e.target.value)
                              }
                              className="filter-date-input"
                              style={{ width: '100%', padding: '4px 6px' }}
                            />
                          </td>
                          <td>
                            <select
                              value={item.taxCode}
                              onChange={(e) =>
                                handleUpdateItem(idx, 'taxCode', e.target.value)
                              }
                              className="filter-date-input"
                              style={{ width: '100%', padding: '4px 6px' }}
                            >
                              {taxConfigs.map((tc) => (
                                <option key={tc.id} value={tc.code}>
                                  {tc.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={item.discountPercent}
                              onChange={(e) =>
                                handleUpdateItem(
                                  idx,
                                  'discountPercent',
                                  e.target.value
                                )
                              }
                              className="filter-date-input"
                              style={{ width: '100%', padding: '4px 6px' }}
                            />
                          </td>
                          <td className="numeric font-tabular">
                            {formatCurrency(item.subtotal)}
                          </td>
                          <td className="numeric font-tabular">
                            <strong>{formatCurrency(item.total)}</strong>
                          </td>
                          <td>
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="icon-button-sm"
                              title="Quitar producto"
                              style={{ color: '#dc2626' }}
                            >
                              <AppIcon name="trash" size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* =========================================================================
              PASO 3: IMPUESTOS, TOTALES Y DOCUMENTOS
             ========================================================================= */}
          {step === 3 && (
            <div className="page-enter">
              <h3
                style={{
                  margin: '0 0 4px',
                  fontSize: 15,
                  fontWeight: 800,
                  color: 'var(--navy)',
                }}
              >
                Paso 3: Impuestos Liquidados y Documento Soporte
              </h3>
              <p
                style={{
                  margin: '0 0 16px',
                  fontSize: 13,
                  color: 'var(--muted)',
                }}
              >
                Revise la liquidación tributaria consolidada y adjunte el archivo
                PDF o imagen de la factura electrónica del proveedor.
              </p>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.2fr 1fr',
                  gap: 20,
                  marginBottom: 16,
                }}
              >
                {/* Desglose de Totales */}
                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: 16,
                  }}
                >
                  <h4
                    style={{
                      margin: '0 0 12px',
                      fontSize: 13,
                      color: 'var(--navy)',
                      fontWeight: 700,
                    }}
                  >
                    Liquidación de la Orden
                  </h4>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: 8,
                      fontSize: 13,
                    }}
                  >
                    <span style={{ color: 'var(--muted)' }}>
                      Subtotal bruto ({items.length} items):
                    </span>
                    <strong className="font-tabular">
                      {formatCurrency(totals.subtotal)}
                    </strong>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: 8,
                      fontSize: 13,
                      color: '#b45309',
                    }}
                  >
                    <span>Descuentos comerciales:</span>
                    <strong className="font-tabular">
                      -{formatCurrency(totals.discountTotal)}
                    </strong>
                  </div>

                  {/* Impuestos discriminados */}
                  <div
                    style={{
                      borderTop: '1px dashed var(--border)',
                      borderBottom: '1px dashed var(--border)',
                      padding: '8px 0',
                      margin: '8px 0',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: 'var(--navy)',
                        marginBottom: 4,
                      }}
                    >
                      Discriminación de IVA (DIAN):
                    </div>
                    {Object.values(totals.taxBreakdown).map((tb) => (
                      <div
                        key={tb.code}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: 12,
                          color: 'var(--muted)',
                          marginBottom: 4,
                        }}
                      >
                        <span>
                          {tb.name} (Base {formatCurrency(tb.baseAmount)}):
                        </span>
                        <span className="font-tabular">
                          {formatCurrency(tb.taxAmount)}
                        </span>
                      </div>
                    ))}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: 13,
                        fontWeight: 600,
                        marginTop: 6,
                      }}
                    >
                      <span>Total impuestos:</span>
                      <strong className="font-tabular">
                        {formatCurrency(totals.taxTotal)}
                      </strong>
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 16,
                      fontWeight: 800,
                      color: 'var(--navy)',
                      marginTop: 12,
                    }}
                  >
                    <span>Total a Pagar:</span>
                    <span className="font-tabular" style={{ color: '#16a34a' }}>
                      {formatCurrency(totals.total)}
                    </span>
                  </div>
                </div>

                {/* Adjuntar Factura / PDF (Supabase Storage preview) */}
                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: 16,
                  }}
                >
                  <h4
                    style={{
                      margin: '0 0 8px',
                      fontSize: 13,
                      color: 'var(--navy)',
                      fontWeight: 700,
                    }}
                  >
                    Factura / Soporte Proveedor
                  </h4>
                  <p
                    style={{
                      margin: '0 0 12px',
                      fontSize: 12,
                      color: 'var(--muted)',
                    }}
                  >
                    Adjunte la factura electrónica (PDF o imagen) para auditoría
                    y cuentas por pagar.
                  </p>

                  <div
                    style={{
                      border: '2px dashed var(--border)',
                      borderRadius: 8,
                      padding: '16px 12px',
                      textAlign: 'center',
                      background: '#fff',
                    }}
                  >
                    <input
                      type="file"
                      id="purchase-file-upload"
                      accept=".pdf,image/*"
                      onChange={handleFileUpload}
                      style={{ display: 'none' }}
                    />
                    <label
                      htmlFor="purchase-file-upload"
                      style={{
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <AppIcon name="upload" size={24} />
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: 'var(--navy)',
                        }}
                      >
                        {attachment
                          ? 'Cambiar archivo adjunto'
                          : 'Cargar factura digital'}
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--muted)' }}>
                        PDF, PNG o JPG hasta 10MB
                      </span>
                    </label>
                  </div>

                  {attachment && (
                    <div
                      style={{
                        marginTop: 12,
                        padding: 10,
                        background: '#eff6ff',
                        borderRadius: 6,
                        border: '1px solid #bfdbfe',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                        }}
                      >
                        <AppIcon name="invoices" size={18} />
                        <div>
                          <strong
                            style={{
                              fontSize: 12,
                              color: 'var(--navy)',
                              display: 'block',
                            }}
                          >
                            {attachment.fileName}
                          </strong>
                          <span style={{ fontSize: 10, color: 'var(--muted)' }}>
                            {(attachment.fileSize / 1024).toFixed(1)} KB •{' '}
                            {attachment.fileType}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAttachment(null)}
                        className="icon-button-sm"
                        style={{ color: '#dc2626' }}
                        title="Quitar archivo"
                      >
                        <AppIcon name="close" size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
              PASO 4: CONFIRMACIÓN Y EMISIÓN
             ========================================================================= */}
          {step === 4 && (
            <div className="page-enter">
              <h3
                style={{
                  margin: '0 0 4px',
                  fontSize: 15,
                  fontWeight: 800,
                  color: 'var(--navy)',
                }}
              >
                Paso 4: Confirmación y Emisión de la Compra
              </h3>
              <p
                style={{
                  margin: '0 0 16px',
                  fontSize: 13,
                  color: 'var(--muted)',
                }}
              >
                Verifique los datos de la orden. Puede guardarla como Borrador o
                emitirla oficialmente para que quede pendiente de recepción física
                e ingreso a Kardex.
              </p>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 14,
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    padding: 12,
                    background: '#f8fafc',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                  }}
                >
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                    Proveedor
                  </div>
                  <strong style={{ fontSize: 14, color: 'var(--navy)' }}>
                    {selectedSupplier?.name}
                  </strong>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                    NIT: {selectedSupplier?.nit}
                  </div>
                </div>

                <div
                  style={{
                    padding: 12,
                    background: '#f8fafc',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                  }}
                >
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                    Bodega Destino
                  </div>
                  <strong style={{ fontSize: 14, color: 'var(--navy)' }}>
                    {selectedLocation?.name}
                  </strong>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                    Código: {selectedLocation?.code}
                  </div>
                </div>

                <div
                  style={{
                    padding: 12,
                    background: '#f8fafc',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                  }}
                >
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                    Factura Proveedor / Fecha
                  </div>
                  <strong style={{ fontSize: 13, color: 'var(--text-main)' }}>
                    {supplierInvoiceNumber}
                  </strong>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                    Fecha: {date}
                  </div>
                </div>

                <div
                  style={{
                    padding: 12,
                    background: '#f8fafc',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                  }}
                >
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                    Condición de Pago
                  </div>
                  <strong style={{ fontSize: 13, color: 'var(--text-main)' }}>
                    {paymentType === 'CREDITO'
                      ? `Crédito (Vence: ${dueDate})`
                      : 'Contado'}
                  </strong>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                    {items.length} {items.length === 1 ? 'producto' : 'productos'}{' '}
                    • Total: {formatCurrency(totals.total)}
                  </div>
                </div>
              </div>

              <div
                style={{
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: 8,
                  padding: 14,
                  color: '#166534',
                  fontSize: 12,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontWeight: 700,
                    marginBottom: 4,
                  }}
                >
                  <AppIcon name="check" size={16} />
                  <span>Control de Inventario y Kardex:</span>
                </div>
                <p style={{ margin: 0 }}>
                  Al emitir la orden quedará registrada como{' '}
                  <strong>Pendiente de Recepción</strong>. El inventario físico
                  en bodega y los movimientos de Kardex se actualizarán de forma
                  transaccional únicamente al confirmar la recepción física.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div
          className="drawer-footer"
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#fff',
          }}
        >
          <div>
            {step > 1 && (
              <button
                type="button"
                className="outline-button"
                onClick={() => setStep((s) => (s - 1) as any)}
                disabled={isSubmitting}
              >
                ← Anterior
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="outline-button"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </button>

            {step < 4 ? (
              <button
                type="button"
                className="primary-button"
                onClick={() => {
                  if (step === 1 && validateStep1()) setStep(2)
                  else if (step === 2 && validateStep2()) setStep(3)
                  else if (step === 3) setStep(4)
                }}
              >
                <span>Siguiente →</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="outline-button"
                  onClick={() => handleFinalSubmit(true)}
                  disabled={isSubmitting}
                  title="Guardar orden en borrador sin emitir"
                >
                  <AppIcon name="edit" size={14} />
                  <span>Guardar Borrador</span>
                </button>

                <button
                  type="button"
                  className="primary-button"
                  onClick={() => handleFinalSubmit(false)}
                  disabled={isSubmitting}
                  title="Aprobar y emitir orden de compra"
                >
                  <AppIcon name="check" size={14} />
                  <span>{isSubmitting ? 'Guardando...' : 'Aprobar y Emitir'}</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
