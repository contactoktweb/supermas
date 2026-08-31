'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '@/components/ui/Icon'
import { CustomSelect } from '@/components/ui/CustomSelect'
import { FileUpload } from '@/components/ui/FileUpload'
import { ScrollableTabs } from '@/components/ui/ScrollableTabs'
import {
  Product,
  CreateProductInput,
  UpdateProductInput,
  TaxProfile,
  UnitOfMeasure,
} from '../types'
import { productFormSchema } from '../schemas/product.schema'
import {
  PRODUCT_CATEGORIES_MOCK,
  PRODUCT_BRANDS_MOCK,
  TAX_CONFIGS_MOCK,
} from '../mocks/product.mock'
import { productService } from '../services/product.service'

interface ProductFormDrawerProps {
  isOpen: boolean
  mode: 'create' | 'edit'
  initialProduct?: Product | null
  onClose: () => void
  onSubmit: (data: CreateProductInput | UpdateProductInput) => Promise<void>
}

const UNIT_OPTIONS = [
  { value: 'UND', label: 'Unidad (UND)' },
  { value: 'KG', label: 'Kilogramo (KG)' },
  { value: 'PAQ', label: 'Paquete (PAQ)' },
  { value: 'CAJA', label: 'Caja (CAJA)' },
  { value: 'LT', label: 'Litro (LT)' },
  { value: 'GR', label: 'Gramo (GR)' },
  { value: 'MT', label: 'Metro (MT)' },
  { value: 'DOCENA', label: 'Docena (DOC)' },
]

export function ProductFormDrawer({
  isOpen,
  mode,
  initialProduct,
  onClose,
  onSubmit,
}: ProductFormDrawerProps) {
  const [mounted, setMounted] = useState(false)
  const [activeTab, setActiveTab] = useState<'info' | 'prices' | 'tax' | 'web' | 'governance'>('info')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Form States
  const [name, setName] = useState('')
  const [sku, setSku] = useState('')
  const [barcode, setBarcode] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('Abarrotes y Despensa')
  const [brand, setBrand] = useState('Super Más Premium')
  const [unitOfMeasure, setUnitOfMeasure] = useState<UnitOfMeasure>('UND')
  const [imageUrl, setImageUrl] = useState('')

  // Prices State (Extensible structure)
  const [normalPrice, setNormalPrice] = useState<number>(0)
  const [wholesalePrice, setWholesalePrice] = useState<number>(0)
  const [distributorPrice, setDistributorPrice] = useState<number>(0)
  const [estimatedCost, setEstimatedCost] = useState<number>(0)

  // Tax Profile State
  const [taxProfile, setTaxProfile] = useState<TaxProfile>('IVA_19')
  const [vatRatePercent, setVatRatePercent] = useState<number>(19)

  // Web Channels State
  const [webSuperMas, setWebSuperMas] = useState(true)
  const [webDistribuidora, setWebDistribuidora] = useState(false)

  // Governance & Stock Thresholds
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE')
  const [minStockThreshold, setMinStockThreshold] = useState<number>(15)
  const [criticalStockThreshold, setCriticalStockThreshold] = useState<number>(5)
  const [auditReason, setAuditReason] = useState('')

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (isOpen) {
      setErrors({})
      setActiveTab('info')

      if (mode === 'edit' && initialProduct) {
        setName(initialProduct.name)
        setSku(initialProduct.sku)
        setBarcode(initialProduct.barcode || '')
        setDescription(initialProduct.description || '')
        setCategory(initialProduct.category)
        setBrand(initialProduct.brand)
        setUnitOfMeasure(initialProduct.unitOfMeasure)
        setImageUrl(initialProduct.imageUrl || '')
        setNormalPrice(initialProduct.normalPrice)
        setWholesalePrice(initialProduct.wholesalePrice)
        setDistributorPrice(initialProduct.distributorPrice || 0)
        setEstimatedCost(initialProduct.averageCost || 0)
        setTaxProfile(initialProduct.taxProfile)
        setVatRatePercent(initialProduct.vatRatePercent)
        setWebSuperMas(initialProduct.webSuperMas)
        setWebDistribuidora(initialProduct.webDistribuidora)
        setStatus(initialProduct.status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE')
        setMinStockThreshold(initialProduct.minStockThreshold)
        setCriticalStockThreshold(initialProduct.criticalStockThreshold)
        setAuditReason('')
      } else {
        // Reset defaults for Create
        setName('')
        setSku('')
        setBarcode('')
        setDescription('')
        setCategory('Abarrotes y Despensa')
        setBrand('Super Más Premium')
        setUnitOfMeasure('UND')
        setImageUrl('')
        setNormalPrice(0)
        setWholesalePrice(0)
        setDistributorPrice(0)
        setEstimatedCost(0)
        setTaxProfile('IVA_19')
        setVatRatePercent(19)
        setWebSuperMas(true)
        setWebDistribuidora(false)
        setStatus('ACTIVE')
        setMinStockThreshold(15)
        setCriticalStockThreshold(5)
        setAuditReason('')
      }
    }
  }, [isOpen, mode, initialProduct])

  if (!isOpen || !mounted) return null

  // Tax Profile change handler
  const handleTaxProfileChange = (selectedCode: string) => {
    const found = TAX_CONFIGS_MOCK.find((t) => t.code === selectedCode)
    if (found) {
      setTaxProfile(found.code)
      setVatRatePercent(found.ratePercent)
    } else {
      setTaxProfile('CUSTOM')
    }
  }

  // Live calculation of estimated profit margin
  const liveMargin = productService.calculateProfitMargin(
    normalPrice,
    vatRatePercent,
    estimatedCost
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})

    const pricesPayload = [
      { code: 'NORMAL', name: 'Precio Normal (Público)', price: Number(normalPrice), minQuantity: 1 },
      { code: 'MAYORISTA', name: 'Precio Mayorista (Volumen)', price: Number(wholesalePrice) || Number(normalPrice), minQuantity: 6 },
    ]

    if (distributorPrice > 0) {
      pricesPayload.push({
        code: 'DISTRIBUIDOR',
        name: 'Precio Distribuidor Especial',
        price: Number(distributorPrice),
        minQuantity: 24,
      })
    }

    const payload: CreateProductInput = {
      name: name.trim(),
      sku: sku.trim().toUpperCase(),
      barcode: barcode.trim(),
      description: description.trim(),
      category,
      brand,
      unitOfMeasure,
      imageUrl: imageUrl.trim(),
      status,
      taxProfile,
      vatRatePercent: Number(vatRatePercent),
      prices: pricesPayload,
      minStockThreshold: Number(minStockThreshold),
      criticalStockThreshold: Number(criticalStockThreshold),
      webSuperMas,
      webDistribuidora,
    }

    try {
      // Validate schema client side
      productFormSchema.parse({
        ...payload,
        auditReason: auditReason.trim() || undefined,
      })

      setIsSubmitting(true)
      await onSubmit(
        mode === 'edit'
          ? { ...payload, auditReason: auditReason.trim() || 'Actualización de producto' }
          : payload
      )
      onClose()
    } catch (err: any) {
      if (err.errors) {
        const fieldErrors: Record<string, string> = {}
        err.errors.forEach((zErr: any) => {
          const field = zErr.path.join('.')
          fieldErrors[field] = zErr.message
        })
        setErrors(fieldErrors)
      } else {
        setErrors({ general: err.message || 'Error al guardar el producto' })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return createPortal(
    <div
      className="drawer-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="product-drawer product-form-drawer page-enter"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="drawer-header">
          <div className="dialog-title-group">
            <div className="dialog-icon-badge">
              <AppIcon
                name={mode === 'create' ? 'plus' : 'edit'}
                size={20}
                color="var(--navy)"
              />
            </div>
            <div>
              <h2>{mode === 'create' ? 'Nuevo producto' : 'Editar producto'}</h2>
              <p>
                {mode === 'create'
                  ? 'Registra un nuevo ítem en el catálogo general de Super Más'
                  : `Modificando especificaciones de ${initialProduct?.name || ''}`}
              </p>
            </div>
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

        {/* Tab Navigation */}
        <ScrollableTabs className="form-tabs">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'info'}
            className={activeTab === 'info' ? 'active' : ''}
            onClick={() => setActiveTab('info')}
          >
            <AppIcon name="products" size={14} />
            <span>Información</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'prices'}
            className={activeTab === 'prices' ? 'active' : ''}
            onClick={() => setActiveTab('prices')}
          >
            <AppIcon name="sales" size={14} />
            <span>Precios</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'tax'}
            className={activeTab === 'tax' ? 'active' : ''}
            onClick={() => setActiveTab('tax')}
          >
            <AppIcon name="receipt" size={14} />
            <span>Tributación</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'web'}
            className={activeTab === 'web' ? 'active' : ''}
            onClick={() => setActiveTab('web')}
          >
            <AppIcon name="webOrders" size={14} />
            <span>Canales Web</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'governance'}
            className={activeTab === 'governance' ? 'active' : ''}
            onClick={() => setActiveTab('governance')}
          >
            <AppIcon name="audit" size={14} />
            <span>Gobernanza</span>
          </button>
        </ScrollableTabs>

        {/* Global Form Errors Banner */}
        {errors.general && (
          <div className="form-error-banner page-enter">
            <AppIcon name="warning" size={16} />
            <span>{errors.general}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="product-form-body">
          {/* TAB 1: INFORMACIÓN GENERAL */}
          {activeTab === 'info' && (
            <div className="form-tab-content page-enter">
              <div className="form-field">
                <label>
                  Nombre del producto <em>*</em>
                </label>
                <div className={`input-wrap ${errors.name ? 'is-invalid' : ''}`}>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej. Arroz Diana Premium Extra 5kg"
                    required
                  />
                </div>
                {errors.name && <span className="field-error-text">{errors.name}</span>}
              </div>

              <div className="form-grid-2">
                <div className="form-field">
                  <label>
                    SKU (Código único) <em>*</em>
                  </label>
                  <div className={`input-wrap ${errors.sku ? 'is-invalid' : ''}`}>
                    <input
                      value={sku}
                      onChange={(e) => setSku(e.target.value.toUpperCase())}
                      placeholder="Ej. ABA-ARR-001"
                      required
                    />
                  </div>
                  {errors.sku && <span className="field-error-text">{errors.sku}</span>}
                </div>

                <div className="form-field">
                  <label>Código de barras EAN/UPC</label>
                  <div className={`input-wrap ${errors.barcode ? 'is-invalid' : ''}`}>
                    <input
                      value={barcode}
                      onChange={(e) => setBarcode(e.target.value)}
                      placeholder="Ej. 7702001001234"
                    />
                  </div>
                  {errors.barcode && (
                    <span className="field-error-text">{errors.barcode}</span>
                  )}
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-field">
                  <label>
                    Categoría <em>*</em>
                  </label>
                  <CustomSelect
                    options={PRODUCT_CATEGORIES_MOCK.map((c) => ({
                      value: c,
                      label: c,
                    }))}
                    value={category}
                    onChange={setCategory}
                  />
                  {errors.category && (
                    <span className="field-error-text">{errors.category}</span>
                  )}
                </div>

                <div className="form-field">
                  <label>
                    Marca <em>*</em>
                  </label>
                  <CustomSelect
                    options={PRODUCT_BRANDS_MOCK.map((b) => ({
                      value: b,
                      label: b,
                    }))}
                    value={brand}
                    onChange={setBrand}
                  />
                  {errors.brand && (
                    <span className="field-error-text">{errors.brand}</span>
                  )}
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-field">
                  <label>Unidad de medida</label>
                  <CustomSelect
                    options={UNIT_OPTIONS}
                    value={unitOfMeasure}
                    onChange={(val) => setUnitOfMeasure(val as UnitOfMeasure)}
                  />
                </div>
              </div>

              <div className="form-field">
                <FileUpload
                  label="Fotografía / Imagen del producto"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  value={imageUrl}
                  onChange={(dataUrl) => setImageUrl(dataUrl)}
                  onRemove={() => setImageUrl('')}
                  helperText="Selecciona o arrastra una imagen (PNG, JPG, WEBP, SVG máx. 5MB)"
                />
              </div>

              <div className="form-field">
                <label>Descripción detallada</label>
                <textarea
                  className="form-textarea"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Especificaciones, características y presentación del producto..."
                  rows={3}
                />
              </div>
            </div>
          )}

          {/* TAB 2: LISTAS DE PRECIOS EXTENSIBLES */}
          {activeTab === 'prices' && (
            <div className="form-tab-content page-enter">
              <div className="info-banner-compact">
                <AppIcon name="sales" size={16} />
                <span>
                  Super Más utiliza un esquema extensible de listas de precios.
                  Puedes definir precio normal, mayorista y tarifas para distribuidores.
                </span>
              </div>

              <div className="form-field">
                <label>
                  Precio Normal de Venta (Público) <em>*</em>
                </label>
                <div className={`input-wrap ${errors.prices ? 'is-invalid' : ''}`}>
                  <span className="input-prefix">$</span>
                  <input
                    type="number"
                    value={normalPrice || ''}
                    onChange={(e) => setNormalPrice(Number(e.target.value))}
                    placeholder="0"
                    min={0}
                    step={100}
                    required
                  />
                </div>
                {errors.prices && (
                  <span className="field-error-text">{errors.prices}</span>
                )}
              </div>

              <div className="form-grid-2">
                <div className="form-field">
                  <label>Precio Mayorista (Mín. 6 unidades)</label>
                  <div className="input-wrap">
                    <span className="input-prefix">$</span>
                    <input
                      type="number"
                      value={wholesalePrice || ''}
                      onChange={(e) => setWholesalePrice(Number(e.target.value))}
                      placeholder="0"
                      min={0}
                      step={100}
                    />
                  </div>
                </div>

                <div className="form-field">
                  <label>Precio Distribuidor (Mín. 24 unidades)</label>
                  <div className="input-wrap">
                    <span className="input-prefix">$</span>
                    <input
                      type="number"
                      value={distributorPrice || ''}
                      onChange={(e) => setDistributorPrice(Number(e.target.value))}
                      placeholder="0"
                      min={0}
                      step={100}
                    />
                  </div>
                </div>
              </div>

              {/* Costo estimado para simulación */}
              <div className="form-field">
                <label>Costo promedio de referencia (Simulación)</label>
                <div className="input-wrap">
                  <span className="input-prefix">$</span>
                  <input
                    type="number"
                    value={estimatedCost || ''}
                    onChange={(e) => setEstimatedCost(Number(e.target.value))}
                    placeholder="0"
                    min={0}
                    step={100}
                  />
                </div>
                <small className="field-hint">
                  * El costo real proviene de las facturas de compra y del Kardex por bodega.
                </small>
              </div>

              {/* Live Margin Calculation Card */}
              <div className="margin-preview-card">
                <div className="margin-card-header">
                  <strong>Análisis de Margen de Utilidad en Vivo</strong>
                  <span className="code-badge">IVA {vatRatePercent}%</span>
                </div>
                <div className="margin-metrics-grid">
                  <div>
                    <span>Precio antes de IVA:</span>
                    <b>
                      {productService.formatCurrency(
                        normalPrice / (1 + vatRatePercent / 100)
                      )}
                    </b>
                  </div>
                  <div>
                    <span>Utilidad bruta por unidad:</span>
                    <b className="positive-text">
                      {productService.formatCurrency(liveMargin.amount)}
                    </b>
                  </div>
                  <div>
                    <span>Margen sobre venta:</span>
                    <strong className="margin-percentage-hero">
                      {liveMargin.percentage.toFixed(1)}%
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: TRIBUTACIÓN E IMPUESTOS */}
          {activeTab === 'tax' && (
            <div className="form-tab-content page-enter">
              <div className="info-banner-compact">
                <AppIcon name="receipt" size={16} />
                <span>
                  Configura el régimen de IVA aplicable según el Estatuto Tributario
                  colombiano. La tarifa no está quemada a un solo valor.
                </span>
              </div>

              <div className="form-field">
                <label>Perfil Tributario DIAN</label>
                <CustomSelect
                  options={TAX_CONFIGS_MOCK.map((t) => ({
                    value: t.code,
                    label: `${t.name} (${t.ratePercent}%)`,
                  }))}
                  value={taxProfile}
                  onChange={handleTaxProfileChange}
                />
              </div>

              <div className="form-field">
                <label>Tarifa de IVA aplicable (%)</label>
                <div className="input-wrap">
                  <input
                    type="number"
                    value={vatRatePercent}
                    onChange={(e) => setVatRatePercent(Number(e.target.value))}
                    min={0}
                    max={100}
                    step={0.5}
                    required
                  />
                  <span className="input-suffix">%</span>
                </div>
              </div>

              <div className="tax-summary-box">
                <div className="tax-summary-row">
                  <span>Tratamiento:</span>
                  <strong>
                    {taxProfile === 'EXENTO'
                      ? 'Bien Exento (Art. 477 ET)'
                      : taxProfile === 'EXCLUIDO'
                      ? 'Bien Excluido (No causa IVA)'
                      : `Gravado a tarifa general del ${vatRatePercent}%`}
                  </strong>
                </div>
                <div className="tax-summary-row">
                  <span>Impacto en precio de $20,000:</span>
                  <span>
                    IVA recaudado: $
                    {((20000 * vatRatePercent) / (100 + vatRatePercent)).toFixed(0)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: CANALES WEB / ECOMMERCE */}
          {activeTab === 'web' && (
            <div className="form-tab-content page-enter">
              <div className="info-banner-compact">
                <AppIcon name="webOrders" size={16} />
                <span>
                  Controla la visibilidad pública en las vitrinas digitales. La
                  disponibilidad se deriva automáticamente sin exponer costos ni inventario exacto.
                </span>
              </div>

              <div className="web-channels-selection">
                {/* Catálogo Super Más */}
                <label className={`web-channel-card ${webSuperMas ? 'is-selected' : ''}`}>
                  <div className="web-channel-head">
                    <input
                      type="checkbox"
                      checked={webSuperMas}
                      onChange={(e) => setWebSuperMas(e.target.checked)}
                    />
                    <div>
                      <strong>Catálogo Super Más</strong>
                      <span className="code-badge">Compra Directa</span>
                    </div>
                  </div>
                  <p>
                    Producto disponible para compra directa y despacho en la tienda
                    online de Super Más.
                  </p>
                </label>

                {/* Catálogo Distribuidora */}
                <label
                  className={`web-channel-card ${
                    webDistribuidora ? 'is-selected' : ''
                  }`}
                >
                  <div className="web-channel-head">
                    <input
                      type="checkbox"
                      checked={webDistribuidora}
                      onChange={(e) => setWebDistribuidora(e.target.checked)}
                    />
                    <div>
                      <strong>Catálogo Distribuidora</strong>
                      <span className="code-badge">Contacto WhatsApp</span>
                    </div>
                  </div>
                  <p>
                    Producto visible en el catálogo corporativo con botón de enlace y
                    cotización directa a WhatsApp comercial.
                  </p>
                </label>
              </div>

              {/* Status summary pill */}
              <div className="web-status-preview-box">
                <span>Estado combinado en vitrina:</span>
                {webSuperMas && webDistribuidora ? (
                  <strong className="positive-text">
                    Compra directa Web + WhatsApp
                  </strong>
                ) : webSuperMas ? (
                  <strong className="positive-text">Compra directa Web</strong>
                ) : webDistribuidora ? (
                  <strong className="positive-text">Contacto WhatsApp</strong>
                ) : (
                  <strong style={{ color: 'var(--muted)' }}>
                    No publicado en canales web
                  </strong>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: ESTADO Y GOBERNANZA */}
          {activeTab === 'governance' && (
            <div className="form-tab-content page-enter">
              <div className="form-field">
                <label>Estado operativo del producto</label>
                <div className="segmented-toggle-wrap">
                  <button
                    type="button"
                    className={status === 'ACTIVE' ? 'selected positive' : ''}
                    onClick={() => setStatus('ACTIVE')}
                  >
                    Activo para la venta
                  </button>
                  <button
                    type="button"
                    className={status === 'INACTIVE' ? 'selected negative' : ''}
                    onClick={() => setStatus('INACTIVE')}
                  >
                    Inactivo / Pausado
                  </button>
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-field">
                  <label>Umbral de Stock Mínimo (Alerta preventiva)</label>
                  <div className="input-wrap">
                    <input
                      type="number"
                      value={minStockThreshold}
                      onChange={(e) => setMinStockThreshold(Number(e.target.value))}
                      min={0}
                    />
                    <span className="input-suffix">uds</span>
                  </div>
                </div>

                <div className="form-field">
                  <label>Umbral de Stock Crítico (Alerta urgente)</label>
                  <div className="input-wrap">
                    <input
                      type="number"
                      value={criticalStockThreshold}
                      onChange={(e) =>
                        setCriticalStockThreshold(Number(e.target.value))
                      }
                      min={0}
                    />
                    <span className="input-suffix">uds</span>
                  </div>
                </div>
              </div>

              {mode === 'edit' && (
                <div className="form-field">
                  <label>Motivo del cambio (Registro de auditoría)</label>
                  <div className="input-wrap">
                    <input
                      value={auditReason}
                      onChange={(e) => setAuditReason(e.target.value)}
                      placeholder="Ej. Ajuste de tarifa mayorista por cambio de proveedor..."
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Drawer Footer Actions */}
          <div className="dialog-footer form-drawer-footer">
            <button
              type="button"
              className="outline-button"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </button>

            <button
              type="submit"
              className="primary-button"
              disabled={isSubmitting}
            >
              <AppIcon name="check" size={16} />
              <span>
                {isSubmitting
                  ? 'Guardando...'
                  : mode === 'create'
                  ? 'Crear producto'
                  : 'Guardar cambios'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
