'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '@/components/ui/Icon'
import { CustomSelect, SelectOption } from '@/components/ui/CustomSelect'
import { FileUpload } from '@/components/ui/FileUpload'
import { ScrollableTabs } from '@/components/ui/ScrollableTabs'
import {
  Product,
  CreateProductInput,
  UpdateProductInput,
  TaxProfile,
  UnitOfMeasure,
  TaxRateConfig,
  PriceTier,
} from '../types'
import { productFormSchema } from '../schemas/product.schema'
import { productService } from '../services/product.service'
import { categoryService } from '@/features/categories/services/category.service'
import { brandService } from '@/features/brands/services/brand.service'
import { extractErrorMessage } from '@/lib/utils'
import { supabaseClient } from '@/lib/supabase/client'

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
  const [activeTab, setActiveTab] = useState<'info' | 'prices' | 'initialStock' | 'tax' | 'web' | 'governance'>('info')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [activeWarehouses, setActiveWarehouses] = useState<{ id: string; code: string; name: string }[]>([])
  const [initialStockMap, setInitialStockMap] = useState<Record<string, { quantity: number; unitCost: number }>>({})

  // Form States
  const [name, setName] = useState('')
  const [sku, setSku] = useState('')
  const [barcode, setBarcode] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [brandId, setBrandId] = useState('')
  const [categoryOptions, setCategoryOptions] = useState<SelectOption[]>([])
  const [brandOptions, setBrandOptions] = useState<SelectOption[]>([])
  const [taxRates, setTaxRates] = useState<TaxRateConfig[]>([])
  const [loadingCatalogs, setLoadingCatalogs] = useState(true)
  const [unitOfMeasure, setUnitOfMeasure] = useState<UnitOfMeasure>('UND')
  const [imageUrl, setImageUrl] = useState('')

  // Prices State (Extensible structure backed by public.product_prices)
  const [normalPrice, setNormalPrice] = useState<number>(0)

  const [wholesalePrice, setWholesalePrice] = useState<number>(0)
  const [minWholesaleQuantity, setMinWholesaleQuantity] = useState<number>(6)
  const [isWholesaleActive, setIsWholesaleActive] = useState<boolean>(true)

  const [distributorPrice, setDistributorPrice] = useState<number>(0)
  const [minDistributorQuantity, setMinDistributorQuantity] = useState<number>(24)
  const [isDistributorActive, setIsDistributorActive] = useState<boolean>(false)

  const [customPriceTiers, setCustomPriceTiers] = useState<PriceTier[]>([])
  const [isAddingCustomTier, setIsAddingCustomTier] = useState<boolean>(false)
  const [newTierCode, setNewTierCode] = useState<string>('')
  const [newTierName, setNewTierName] = useState<string>('')
  const [newTierPrice, setNewTierPrice] = useState<number>(0)
  const [newTierMinQty, setNewTierMinQty] = useState<number>(1)
  const [newTierStartDate, setNewTierStartDate] = useState<string>('')
  const [newTierEndDate, setNewTierEndDate] = useState<string>('')

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

  // Cargar catálogos reales desde Supabase (Categorías, Marcas, Impuestos)
  useEffect(() => {
    let isMounted = true
    setLoadingCatalogs(true)

    Promise.all([
      categoryService.listCategories({ status: 'ACTIVE', sortBy: 'SORT_ORDER_ASC' }),
      brandService.listBrands({ status: 'ACTIVE', sortBy: 'NAME_ASC' }),
      productService.getTaxConfigs(),
      supabaseClient.from('locations').select('id, code, name').eq('status', 'ACTIVE').order('name', { ascending: true }),
    ])
      .then(([catsRes, brandsRes, taxesRes, locsRes]) => {
        if (!isMounted) return

        const cats: SelectOption[] = ((catsRes as any).data || []).map((c: any) => ({
          value: c.id,
          label: `${c.level > 0 ? '— '.repeat(c.level) : ''}${c.name}`,
        }))

        const brands: SelectOption[] = ((brandsRes as any).data || []).map((b: any) => ({
          value: b.id,
          label: b.name,
        }))

        setCategoryOptions(cats)
        setBrandOptions(brands)
        setTaxRates(taxesRes || [])
        if (locsRes?.data) {
          setActiveWarehouses(locsRes.data)
        }

        if (mode === 'create') {
          if (cats.length > 0) setCategoryId((prev) => prev || cats[0].value)
          if (brands.length > 0) setBrandId((prev) => prev || brands[0].value)
        }
      })
      .catch((err) => {
        console.error('Error cargando catálogos reales de Supabase:', err)
      })
      .finally(() => {
        if (isMounted) setLoadingCatalogs(false)
      })

    return () => {
      isMounted = false
    }
  }, [mode])

  useEffect(() => {
    if (isOpen) {
      setErrors({})
      setActiveTab('info')

      if (mode === 'edit' && initialProduct) {
        setName(initialProduct.name)
        setSku(initialProduct.sku)
        setBarcode(initialProduct.barcode || '')
        setDescription(initialProduct.description || '')
        setCategoryId(initialProduct.categoryId || (categoryOptions[0]?.value ?? ''))
        setBrandId(initialProduct.brandId || (brandOptions[0]?.value ?? ''))
        setUnitOfMeasure(initialProduct.unitOfMeasure)
        setImageUrl(initialProduct.imageUrl || '')
        // Mapear listas de precios reales desde initialProduct.prices
        const normalTier = initialProduct.prices?.find((p) => p.code === 'NORMAL' || p.isDefault)
        const mayoristaTier = initialProduct.prices?.find((p) => p.code === 'MAYORISTA')
        const distribuidorTier = initialProduct.prices?.find((p) => p.code === 'DISTRIBUIDOR')
        const otherTiers = (initialProduct.prices || []).filter(
          (p) => p.code !== 'NORMAL' && p.code !== 'MAYORISTA' && p.code !== 'DISTRIBUIDOR'
        )

        setNormalPrice(normalTier ? normalTier.price : initialProduct.normalPrice)

        setWholesalePrice(
          mayoristaTier ? mayoristaTier.price : initialProduct.wholesalePrice
        )
        setMinWholesaleQuantity(
          mayoristaTier?.minQuantity || initialProduct.minWholesaleQuantity || 6
        )
        setIsWholesaleActive(mayoristaTier ? mayoristaTier.isActive !== false : true)

        setDistributorPrice(
          distribuidorTier ? distribuidorTier.price : (initialProduct.distributorPrice || 0)
        )
        setMinDistributorQuantity(distribuidorTier?.minQuantity || 24)
        setIsDistributorActive(
          distribuidorTier
            ? distribuidorTier.isActive !== false
            : Boolean(initialProduct.distributorPrice && initialProduct.distributorPrice > 0)
        )

        setCustomPriceTiers(otherTiers)
        setIsAddingCustomTier(false)

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
        setCategoryId(categoryOptions[0]?.value || '')
        setBrandId(brandOptions[0]?.value || '')
        setUnitOfMeasure('UND')
        setImageUrl('')
        setNormalPrice(0)
        setWholesalePrice(0)
        setMinWholesaleQuantity(6)
        setIsWholesaleActive(true)
        setDistributorPrice(0)
        setMinDistributorQuantity(24)
        setIsDistributorActive(false)
        setCustomPriceTiers([])
        setIsAddingCustomTier(false)
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
  }, [isOpen, mode, initialProduct, categoryOptions, brandOptions])

  if (!isOpen || !mounted) return null

  // Tax Profile change handler
  const handleTaxProfileChange = (selectedCode: string) => {
    const found = taxRates.find((t) => t.code === selectedCode)
    if (found) {
      setTaxProfile(found.code as any)
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

    const pricesPayload: PriceTier[] = [
      {
        code: 'NORMAL',
        name: 'Precio Normal (Público)',
        price: Number(normalPrice),
        minQuantity: 1,
        isDefault: true,
        isActive: true,
      },
      {
        code: 'MAYORISTA',
        name: 'Precio Mayorista',
        price: Number(wholesalePrice) || Number(normalPrice),
        minQuantity: Number(minWholesaleQuantity) || 6,
        isDefault: false,
        isActive: isWholesaleActive,
      },
    ]

    if (distributorPrice > 0 || isDistributorActive) {
      pricesPayload.push({
        code: 'DISTRIBUIDOR',
        name: 'Precio Distribuidor Especial',
        price: Number(distributorPrice),
        minQuantity: Number(minDistributorQuantity) || 24,
        isDefault: false,
        isActive: isDistributorActive,
      })
    }

    customPriceTiers.forEach((tier) => {
      pricesPayload.push({
        code: tier.code.trim().toUpperCase(),
        name: tier.name.trim(),
        price: Number(tier.price),
        minQuantity: Number(tier.minQuantity || 1),
        isDefault: false,
        isActive: tier.isActive ?? true,
        startDate: tier.startDate || null,
        endDate: tier.endDate || null,
      })
    })

    const initialStockPayload = activeWarehouses
      .map((w) => {
        const item = initialStockMap[w.id] || { quantity: 0, unitCost: estimatedCost }
        return {
          locationId: w.id,
          locationName: w.name,
          locationCode: w.code,
          quantity: Number(item.quantity || 0),
          unitCost: Number(item.unitCost !== undefined && item.unitCost !== null && item.unitCost > 0 ? item.unitCost : estimatedCost || 0),
        }
      })
      .filter((s) => s.quantity > 0)

    const payload: CreateProductInput = {
      name: name.trim(),
      sku: sku.trim().toUpperCase(),
      barcode: barcode.trim(),
      description: description.trim(),
      categoryId,
      brandId,
      unitOfMeasure,
      imageUrl: imageUrl.trim(),
      status,
      taxProfile,
      vatRatePercent: Number(vatRatePercent),
      prices: pricesPayload,
      costPrice: Number(estimatedCost || 0),
      minStockThreshold: Number(minStockThreshold),
      criticalStockThreshold: Number(criticalStockThreshold),
      webSuperMas,
      webDistribuidora,
      initialStock: initialStockPayload,
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
      const cleanMessage = extractErrorMessage(err, 'Error al guardar el producto')
      const issues = err?.issues || err?.errors
      if (Array.isArray(issues) && issues.length > 0) {
        const fieldErrors: Record<string, string> = { general: cleanMessage }
        issues.forEach((zErr: any) => {
          const field = Array.isArray(zErr.path) ? zErr.path.join('.') : String(zErr.path || '')
          if (field) {
            fieldErrors[field] = zErr.message
          }
        })
        setErrors(fieldErrors)

        // Cambiar automáticamente a la pestaña correspondiente al primer error
        const firstField = issues[0]?.path?.[0]
        if (firstField === 'prices' && activeTab !== 'prices') {
          setActiveTab('prices')
        } else if ((firstField === 'taxProfile' || firstField === 'vatRatePercent') && activeTab !== 'tax') {
          setActiveTab('tax')
        } else if ((firstField === 'webSuperMas' || firstField === 'webDistribuidora') && activeTab !== 'web') {
          setActiveTab('web')
        } else if (firstField === 'auditReason' && activeTab !== 'governance') {
          setActiveTab('governance')
        }
      } else {
        setErrors({ general: cleanMessage })
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

          {mode === 'create' && (
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'initialStock'}
              className={activeTab === 'initialStock' ? 'active' : ''}
              onClick={() => setActiveTab('initialStock')}
            >
              <AppIcon name="inventory" size={14} />
              <span>Inventario Inicial</span>
              {Object.values(initialStockMap).some((s) => s.quantity > 0) && (
                <span
                  style={{
                    display: 'inline-block',
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: 'var(--green, #16a34a)',
                    marginLeft: 4,
                  }}
                />
              )}
            </button>
          )}

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
            <span>{extractErrorMessage(errors.general)}</span>
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
                    options={categoryOptions}
                    value={categoryId}
                    onChange={setCategoryId}
                    disabled={categoryOptions.length === 0}
                    placeholder={loadingCatalogs ? 'Cargando categorías...' : 'Selecciona una categoría'}
                  />
                  {errors.categoryId && (
                    <span className="field-error-text">{errors.categoryId}</span>
                  )}
                  {categoryOptions.length === 0 && !loadingCatalogs && (
                    <small className="field-hint" style={{ color: 'var(--amber)' }}>
                      * No hay categorías activas en Supabase para tu empresa.
                    </small>
                  )}
                </div>

                <div className="form-field">
                  <label>
                    Marca <em>*</em>
                  </label>
                  <CustomSelect
                    options={brandOptions}
                    value={brandId}
                    onChange={setBrandId}
                    disabled={brandOptions.length === 0}
                    placeholder={loadingCatalogs ? 'Cargando marcas...' : 'Selecciona una marca'}
                  />
                  {errors.brandId && (
                    <span className="field-error-text">{errors.brandId}</span>
                  )}
                  {brandOptions.length === 0 && !loadingCatalogs && (
                    <small className="field-hint" style={{ color: 'var(--amber)' }}>
                      * No hay marcas activas en Supabase para tu empresa.
                    </small>
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
          {/* TAB 2: LISTAS DE PRECIOS EXTENSIBLES (public.product_prices) */}
          {activeTab === 'prices' && (
            <div className="form-tab-content page-enter">
              <div className="info-banner-compact">
                <AppIcon name="sales" size={16} />
                <span>
                  Super Más utiliza un esquema extensible de listas de precios (public.product_prices).
                  Puedes definir precio normal, mayorista, distribuidor y listas personalizadas con cantidades mínimas y vigencia.
                </span>
              </div>

              {/* LISTA 1: PRECIO NORMAL */}
              <div className="drawer-section" style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div>
                    <strong style={{ fontSize: 15, color: 'var(--navy)' }}>Precio Normal de Venta (Público)</strong>
                    <div style={{ fontSize: 12, color: '#64748b' }}>Tarifa principal obligatoria — Aplica desde 1 unidad</div>
                  </div>
                  <span className="code-badge" style={{ background: '#e0f2fe', color: '#0369a1' }}>PREDETERMINADA</span>
                </div>

                <div className="form-field" style={{ marginBottom: 0 }}>
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
              </div>

              {/* LISTA 2: PRECIO MAYORISTA */}
              <div className="drawer-section" style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', marginTop: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div>
                    <strong style={{ fontSize: 15, color: 'var(--navy)' }}>Precio Mayorista (Volumen)</strong>
                    <div style={{ fontSize: 12, color: '#64748b' }}>Descuento por volumen para clientes mayoristas</div>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
                    <input
                      type="checkbox"
                      checked={isWholesaleActive}
                      onChange={(e) => setIsWholesaleActive(e.target.checked)}
                    />
                    <span>{isWholesaleActive ? 'Activa' : 'Inactiva'}</span>
                  </label>
                </div>

                <div className="form-grid-2">
                  <div className="form-field">
                    <label>Precio unitario mayorista</label>
                    <div className="input-wrap">
                      <span className="input-prefix">$</span>
                      <input
                        type="number"
                        value={wholesalePrice || ''}
                        onChange={(e) => setWholesalePrice(Number(e.target.value))}
                        placeholder="0"
                        min={0}
                        step={100}
                        disabled={!isWholesaleActive}
                      />
                    </div>
                  </div>

                  <div className="form-field">
                    <label>Cantidad mínima requerida</label>
                    <div className="input-wrap">
                      <input
                        type="number"
                        value={minWholesaleQuantity || ''}
                        onChange={(e) => setMinWholesaleQuantity(Number(e.target.value))}
                        placeholder="6"
                        min={1}
                        disabled={!isWholesaleActive}
                      />
                      <span className="input-suffix">uds</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* LISTA 3: PRECIO DISTRIBUIDOR */}
              <div className="drawer-section" style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', marginTop: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div>
                    <strong style={{ fontSize: 15, color: 'var(--navy)' }}>Precio Distribuidor Especial</strong>
                    <div style={{ fontSize: 12, color: '#64748b' }}>Tarifa preferencial para distribución a gran escala</div>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
                    <input
                      type="checkbox"
                      checked={isDistributorActive}
                      onChange={(e) => setIsDistributorActive(e.target.checked)}
                    />
                    <span>{isDistributorActive ? 'Activa' : 'Inactiva'}</span>
                  </label>
                </div>

                <div className="form-grid-2">
                  <div className="form-field">
                    <label>Precio distribuidor</label>
                    <div className="input-wrap">
                      <span className="input-prefix">$</span>
                      <input
                        type="number"
                        value={distributorPrice || ''}
                        onChange={(e) => setDistributorPrice(Number(e.target.value))}
                        placeholder="0"
                        min={0}
                        step={100}
                        disabled={!isDistributorActive}
                      />
                    </div>
                  </div>

                  <div className="form-field">
                    <label>Cantidad mínima requerida</label>
                    <div className="input-wrap">
                      <input
                        type="number"
                        value={minDistributorQuantity || ''}
                        onChange={(e) => setMinDistributorQuantity(Number(e.target.value))}
                        placeholder="24"
                        min={1}
                        disabled={!isDistributorActive}
                      />
                      <span className="input-suffix">uds</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* LISTAS PERSONALIZADAS EXTENSIBLES */}
              <div className="drawer-section" style={{ marginTop: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h3 style={{ margin: 0 }}>Listas de Precios Personalizadas</h3>
                  {!isAddingCustomTier && (
                    <button
                      type="button"
                      className="outline-button"
                      style={{ fontSize: 12, padding: '4px 10px' }}
                      onClick={() => setIsAddingCustomTier(true)}
                    >
                      <AppIcon name="plus" size={14} />
                      <span>Agregar lista</span>
                    </button>
                  )}
                </div>

                {customPriceTiers.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {customPriceTiers.map((tier) => (
                      <div
                        key={tier.code}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '10px 14px',
                          background: '#fff',
                          border: '1px solid #e2e8f0',
                          borderRadius: '6px',
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <strong>{tier.name}</strong>
                            <span className="code-badge">{tier.code}</span>
                            <span
                              className={`status-indicator-pill ${
                                tier.isActive !== false ? 'active' : 'inactive'
                              }`}
                              style={{ fontSize: 10, padding: '2px 6px' }}
                            >
                              {tier.isActive !== false ? 'Activa' : 'Inactiva'}
                            </span>
                          </div>
                          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                            Mín. {tier.minQuantity || 1} uds
                            {(tier.startDate || tier.endDate) && (
                              <span>
                                {' '}· Vigencia: {tier.startDate || 'Inicio'} a {tier.endDate || 'Indefinido'}
                              </span>
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <strong style={{ fontSize: 15, color: 'var(--navy)' }}>
                            {productService.formatCurrency(tier.price)}
                          </strong>
                          <button
                            type="button"
                            className="icon-button"
                            title="Alternar estado"
                            onClick={() => {
                              setCustomPriceTiers((prev) =>
                                prev.map((t) =>
                                  t.code === tier.code ? { ...t, isActive: !t.isActive } : t
                                )
                              )
                            }}
                          >
                            <AppIcon name={tier.isActive !== false ? 'check' : 'close'} size={14} />
                          </button>
                          <button
                            type="button"
                            className="icon-button"
                            title="Eliminar lista"
                            onClick={() => {
                              setCustomPriceTiers((prev) => prev.filter((t) => t.code !== tier.code))
                            }}
                          >
                            <AppIcon name="trash" size={14} color="#ef4444" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  !isAddingCustomTier && (
                    <div style={{ padding: '16px', textAlign: 'center', color: '#94a3b8', fontSize: 13, border: '1px dashed #cbd5e1', borderRadius: '6px' }}>
                      No hay listas personalizadas adicionales. Puedes crear tarifas como HORECA, INSTITUCIONAL o PROMOCIÓN.
                    </div>
                  )
                )}

                {/* Subformulario para agregar nueva lista personalizada */}
                {isAddingCustomTier && (
                  <div style={{ background: '#f1f5f9', padding: '16px', borderRadius: '8px', border: '1px solid #cbd5e1', marginTop: 12 }}>
                    <h4 style={{ margin: '0 0 12px 0', fontSize: 14, color: 'var(--navy)' }}>Nueva Lista de Precios</h4>
                    <div className="form-grid-2">
                      <div className="form-field">
                        <label>Código único (ej: HORECA, INST) <em>*</em></label>
                        <div className="input-wrap">
                          <input
                            value={newTierCode}
                            onChange={(e) => setNewTierCode(e.target.value.toUpperCase())}
                            placeholder="Ej: HORECA"
                            required
                          />
                        </div>
                      </div>
                      <div className="form-field">
                        <label>Nombre descriptivo <em>*</em></label>
                        <div className="input-wrap">
                          <input
                            value={newTierName}
                            onChange={(e) => setNewTierName(e.target.value)}
                            placeholder="Ej: Hoteles y Restaurantes"
                            required
                          />
                        </div>
                      </div>
                    </div>

                    <div className="form-grid-2">
                      <div className="form-field">
                        <label>Precio unitario <em>*</em></label>
                        <div className="input-wrap">
                          <span className="input-prefix">$</span>
                          <input
                            type="number"
                            value={newTierPrice || ''}
                            onChange={(e) => setNewTierPrice(Number(e.target.value))}
                            placeholder="0"
                            min={0}
                            step={100}
                            required
                          />
                        </div>
                      </div>
                      <div className="form-field">
                        <label>Cantidad mínima</label>
                        <div className="input-wrap">
                          <input
                            type="number"
                            value={newTierMinQty || ''}
                            onChange={(e) => setNewTierMinQty(Number(e.target.value))}
                            placeholder="1"
                            min={1}
                          />
                          <span className="input-suffix">uds</span>
                        </div>
                      </div>
                    </div>

                    <div className="form-grid-2">
                      <div className="form-field">
                        <label>Vigente desde (opcional)</label>
                        <div className="input-wrap">
                          <input
                            type="date"
                            value={newTierStartDate}
                            onChange={(e) => setNewTierStartDate(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="form-field">
                        <label>Vigente hasta (opcional)</label>
                        <div className="input-wrap">
                          <input
                            type="date"
                            value={newTierEndDate}
                            onChange={(e) => setNewTierEndDate(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                      <button
                        type="button"
                        className="outline-button"
                        style={{ fontSize: 13 }}
                        onClick={() => {
                          setIsAddingCustomTier(false)
                          setNewTierCode('')
                          setNewTierName('')
                          setNewTierPrice(0)
                        }}
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        className="solid-button"
                        style={{ fontSize: 13, background: 'var(--navy)', color: '#fff' }}
                        onClick={() => {
                          const code = newTierCode.trim().toUpperCase()
                          const name = newTierName.trim()
                          if (!code || !name) {
                            alert('El código y el nombre de la lista son obligatorios.')
                            return
                          }
                          if (
                            code === 'NORMAL' ||
                            code === 'MAYORISTA' ||
                            code === 'DISTRIBUIDOR' ||
                            customPriceTiers.some((t) => t.code === code)
                          ) {
                            alert(`El código "${code}" ya está en uso. Elige un código diferente.`)
                            return
                          }
                          setCustomPriceTiers((prev) => [
                            ...prev,
                            {
                              code,
                              name,
                              price: Number(newTierPrice),
                              minQuantity: Number(newTierMinQty) || 1,
                              isDefault: false,
                              isActive: true,
                              startDate: newTierStartDate || null,
                              endDate: newTierEndDate || null,
                            },
                          ])
                          setIsAddingCustomTier(false)
                          setNewTierCode('')
                          setNewTierName('')
                          setNewTierPrice(0)
                          setNewTierStartDate('')
                          setNewTierEndDate('')
                        }}
                      >
                        Guardar Lista
                      </button>
                    </div>
                  </div>
                )}
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

          {/* TAB: INVENTARIO INICIAL (SOLO AL CREAR PRODUCTO) */}
          {activeTab === 'initialStock' && mode === 'create' && (
            <div className="form-tab-content page-enter">
              <div
                className="info-banner-compact"
                style={{
                  background: '#f0f9ff',
                  borderColor: '#bae6fd',
                  color: '#0369a1',
                }}
              >
                <AppIcon name="inventory" size={16} />
                <span>
                  Indica las existencias iniciales por bodega física. Si una bodega tiene 0 unidades, no se generará movimiento innecesario. Para cantidades mayores a 0, se registrará una entrada formal en el Kardex (<code>POSITIVE_ADJUSTMENT</code>) con tipo de documento <code>INVENTARIO_INICIAL</code> y la base de datos actualizará el saldo mediante <code>process_inventory_movement()</code>.
                </span>
              </div>

              <div style={{ marginTop: 16 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 12,
                  }}
                >
                  <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--navy)' }}>
                    Bodegas Físicas Activas ({activeWarehouses.length})
                  </h4>
                  <span className="time-muted" style={{ fontSize: 12 }}>
                    Costo base de referencia: ${Number(estimatedCost || 0).toLocaleString('es-CO')}
                  </span>
                </div>

                {activeWarehouses.length === 0 ? (
                  <div
                    className="empty-state-card"
                    style={{ padding: 24, textAlign: 'center', background: '#f8fafc', borderRadius: 8 }}
                  >
                    <p style={{ margin: 0, color: '#64748b', fontSize: 13 }}>
                      No se encontraron bodegas activas en la empresa.
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {activeWarehouses.map((w) => {
                      const currentItem = initialStockMap[w.id] || {
                        quantity: 0,
                        unitCost: estimatedCost || 0,
                      }
                      const qty = Number(currentItem.quantity || 0)
                      const cost = Number(
                        currentItem.unitCost !== undefined &&
                          currentItem.unitCost !== null &&
                          currentItem.unitCost > 0
                          ? currentItem.unitCost
                          : estimatedCost || 0
                      )
                      const subtotal = qty * cost

                      return (
                        <div
                          key={w.id}
                          style={{
                            padding: '14px 16px',
                            background: qty > 0 ? '#f0fdf4' : '#ffffff',
                            border: `1px solid ${qty > 0 ? '#86efac' : '#e2e8f0'}`,
                            borderRadius: 8,
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              marginBottom: 10,
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <AppIcon name="warehouse" size={16} />
                              <strong style={{ fontSize: 14, color: 'var(--navy)' }}>{w.name}</strong>
                              <span className="code-badge">{w.code}</span>
                            </div>
                            {qty > 0 && (
                              <span
                                style={{
                                  fontSize: 12,
                                  fontWeight: 700,
                                  color: 'var(--green, #16a34a)',
                                }}
                              >
                                Valor inicial: ${subtotal.toLocaleString('es-CO')}
                              </span>
                            )}
                          </div>

                          <div className="form-grid-2">
                            <div className="form-field">
                              <label style={{ fontSize: 12, fontWeight: 600 }}>
                                Cantidad inicial (uds)
                              </label>
                              <div className="input-wrap">
                                <input
                                  type="number"
                                  min={0}
                                  value={currentItem.quantity || ''}
                                  onChange={(e) => {
                                    const val = Math.max(0, Number(e.target.value) || 0)
                                    setInitialStockMap((prev) => ({
                                      ...prev,
                                      [w.id]: {
                                        ...prev[w.id],
                                        quantity: val,
                                        unitCost: prev[w.id]?.unitCost ?? (estimatedCost || 0),
                                      },
                                    }))
                                  }}
                                  placeholder="0"
                                />
                                <span className="input-suffix">{unitOfMeasure}</span>
                              </div>
                            </div>

                            <div className="form-field">
                              <label style={{ fontSize: 12, fontWeight: 600 }}>
                                Costo unitario de entrada ($)
                              </label>
                              <div className="input-wrap">
                                <span className="input-prefix">$</span>
                                <input
                                  type="number"
                                  min={0}
                                  step={100}
                                  value={currentItem.unitCost || ''}
                                  onChange={(e) => {
                                    const val = Math.max(0, Number(e.target.value) || 0)
                                    setInitialStockMap((prev) => ({
                                      ...prev,
                                      [w.id]: {
                                        ...prev[w.id],
                                        quantity: prev[w.id]?.quantity || 0,
                                        unitCost: val,
                                      },
                                    }))
                                  }}
                                  placeholder={String(estimatedCost || 0)}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
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
                  options={
                    taxRates.length > 0
                      ? taxRates.map((t) => ({
                          value: t.code,
                          label: `${t.name} (${t.ratePercent}%)`,
                        }))
                      : [{ value: 'IVA_19', label: 'IVA General 19%' }]
                  }
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
