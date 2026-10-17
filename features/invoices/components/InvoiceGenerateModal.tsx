'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { AppIcon } from '@/components/ui/Icon'
import { CustomSelect } from '@/components/ui/CustomSelect'
import { GenerateInvoicePayload, InvoiceType, InvoicePaymentMethod } from '../types'
import { salesRepository } from '@/features/sales/repositories/sales.repository'
import { supabaseClient } from '@/lib/supabase/client'

interface InvoiceGenerateModalProps {
  isOpen: boolean
  onClose: () => void
  pendingSales: any[]
  loadingPendingSales: boolean
  onGenerateInvoice: (payload: GenerateInvoicePayload) => Promise<any>
  onRefreshPendingSales?: () => void
  onNavigate?: (view: string) => void
}

type InvoicingMode = 'FROM_SALE' | 'DIRECT'

interface DirectItem {
  id: string
  productId?: string
  productName: string
  quantity: number
  unitPrice: number
  taxRatePercent: number
}

export function InvoiceGenerateModal({
  isOpen,
  onClose,
  pendingSales,
  loadingPendingSales,
  onGenerateInvoice,
  onRefreshPendingSales,
  onNavigate,
}: InvoiceGenerateModalProps) {
  const router = useRouter()
  const [mode, setMode] = useState<InvoicingMode>('FROM_SALE')

  // Estado Modo 1: Desde Venta Registrada
  const [selectedSaleId, setSelectedSaleId] = useState<string>('')
  const [invoiceType, setInvoiceType] = useState<InvoiceType>('ELECTRONICA')
  const [paymentMethod, setPaymentMethod] = useState<InvoicePaymentMethod>('EFECTIVO')
  const [paymentTerms, setPaymentTerms] = useState<string>('Contado')
  const [sendToDianImmediately, setSendToDianImmediately] = useState<boolean>(true)
  const [notes, setNotes] = useState<string>('')

  // Estado Modo 2: Facturación Directa
  const [customers, setCustomers] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [locations, setLocations] = useState<any[]>([])
  const [directCustomerId, setDirectCustomerId] = useState<string>('CONSUMIDOR_FINAL')
  const [directCustomerName, setDirectCustomerName] = useState<string>('Consumidor Final')
  const [directCustomerDoc, setDirectCustomerDoc] = useState<string>('222222222222')
  const [directCustomerDocType, setDirectCustomerDocType] = useState<string>('CC')
  const [directCustomerEmail, setDirectCustomerEmail] = useState<string>('')
  const [directLocationId, setDirectLocationId] = useState<string>('')
  const [directItems, setDirectItems] = useState<DirectItem[]>([
    {
      id: 'item-1',
      productName: 'Producto / Servicio comercial',
      quantity: 1,
      unitPrice: 50000,
      taxRatePercent: 19,
    },
  ])

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showHowItWorks, setShowHowItWorks] = useState(false)

  // Cargar clientes, productos y bodegas para el modo directo
  useEffect(() => {
    if (isOpen) {
      const loadDirectData = async () => {
        try {
          const [custRes, prodRes, locRes] = await Promise.all([
            supabaseClient
              .from('customers')
              .select('id, first_name, last_name, company_name, document_type, document_number, email')
              .limit(50),
            supabaseClient
              .from('products')
              .select('id, name, sku, public_sale_price, tax_rate_percent')
              .limit(50),
            supabaseClient.from('locations').select('id, name, code'),
          ])

          if (custRes.data) setCustomers(custRes.data)
          if (prodRes.data) setProducts(prodRes.data)
          if (locRes.data) {
            setLocations(locRes.data)
            if (locRes.data.length > 0 && !directLocationId) {
              setDirectLocationId(locRes.data[0].id)
            }
          }
        } catch (e) {
          console.error('Error cargando catálogos para facturación directa:', e)
        }
      }
      loadDirectData()
    }
  }, [isOpen, directLocationId])

  // Auto-seleccionar la primera venta pendiente si está disponible
  useEffect(() => {
    if (pendingSales.length > 0 && !selectedSaleId) {
      setSelectedSaleId(pendingSales[0].id)
      setMode('FROM_SALE')
    } else if (pendingSales.length === 0) {
      setSelectedSaleId('')
    }
  }, [pendingSales, selectedSaleId])

  if (!isOpen) return null

  const selectedSale = pendingSales.find((s) => s.id === selectedSaleId)

  const formatCOP = (val: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(val || 0)
  }

  // Cálculos de totales para Facturación Directa
  const directSubtotal = directItems.reduce((acc, it) => acc + it.quantity * it.unitPrice, 0)
  const directTax = directItems.reduce(
    (acc, it) => acc + Math.round(it.quantity * it.unitPrice * (it.taxRatePercent / 100)),
    0
  )
  const directTotal = directSubtotal + directTax

  // Validaciones fiscales del adquirente / cliente
  const isMissingDoc = !selectedSale?.customerDoc
  const isMissingEmail = !selectedSale?.customerEmail && invoiceType === 'ELECTRONICA'
  const hasFiscalWarning = isMissingDoc || isMissingEmail

  const handleNavigateTo = (path: string, viewName: string) => {
    onClose()
    if (onNavigate) {
      onNavigate(viewName)
    } else {
      router.push(path)
    }
  }

  // Manejo de cambio de cliente en Factura Directa
  const handleSelectDirectCustomer = (cId: string) => {
    setDirectCustomerId(cId)
    if (cId === 'CONSUMIDOR_FINAL') {
      setDirectCustomerName('Consumidor Final')
      setDirectCustomerDoc('222222222222')
      setDirectCustomerDocType('CC')
      setDirectCustomerEmail('')
      return
    }

    const c = customers.find((cust) => cust.id === cId)
    if (c) {
      const name = c.company_name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Cliente'
      setDirectCustomerName(name)
      setDirectCustomerDoc(c.document_number || '')
      setDirectCustomerDocType(c.document_type || 'CC')
      setDirectCustomerEmail(c.email || '')
    }
  }

  // Agregar ítem en Factura Directa
  const handleAddDirectItem = () => {
    setDirectItems((prev) => [
      ...prev,
      {
        id: `item-${Date.now()}`,
        productName: 'Nuevo ítem / servicio',
        quantity: 1,
        unitPrice: 10000,
        taxRatePercent: 19,
      },
    ])
  }

  // Eliminar ítem en Factura Directa
  const handleRemoveDirectItem = (id: string) => {
    if (directItems.length <= 1) return
    setDirectItems((prev) => prev.filter((it) => it.id !== id))
  }

  // Actualizar ítem en Factura Directa
  const handleUpdateDirectItem = (id: string, field: keyof DirectItem, value: any) => {
    setDirectItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it
        return { ...it, [field]: value }
      })
    )
  }

  // Selección de producto predefinido en Factura Directa
  const handleSelectPresetProduct = (itemId: string, prodId: string) => {
    const prod = products.find((p) => p.id === prodId)
    if (!prod) return
    setDirectItems((prev) =>
      prev.map((it) => {
        if (it.id !== itemId) return it
        return {
          ...it,
          productId: prod.id,
          productName: prod.name,
          unitPrice: Number(prod.public_sale_price || 0),
          taxRatePercent: Number(prod.tax_rate_percent ?? 19),
        }
      })
    )
  }

  // Emisión de factura
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (mode === 'FROM_SALE') {
      if (!selectedSaleId) {
        setError('Debes seleccionar una venta comercial para facturar.')
        return
      }

      try {
        setSubmitting(true)
        setError(null)
        await onGenerateInvoice({
          saleId: selectedSaleId,
          type: invoiceType,
          paymentMethod,
          paymentTerms,
          sendToDianImmediately: invoiceType === 'ELECTRONICA' ? sendToDianImmediately : false,
          notes,
        })
      } catch (err: any) {
        setError(err.message || 'Error al emitir la factura.')
      } finally {
        setSubmitting(false)
      }
      return
    }

    // Modo 2: Facturación Directa (Creación de venta comercial inmediata y emisión)
    try {
      setSubmitting(true)
      setError(null)

      if (directItems.length === 0 || directTotal <= 0) {
        setError('Debes incluir al menos un ítem con valor válido para facturar.')
        return
      }

      const activeLocation = locations.find((l) => l.id === directLocationId) || locations[0]
      const locId = activeLocation?.id || '00000000-0000-0000-0000-000000000001'
      const locName = activeLocation?.name || 'Sede Principal'
      const nowIso = new Date().toISOString()
      const saleSeq = Math.floor(1000 + Math.random() * 9000)
      const saleNumber = `VTA-${saleSeq}`

      // Registrar venta directa
      const createdSale = await salesRepository.create({
        id: crypto.randomUUID ? crypto.randomUUID() : `sale-${Date.now()}`,
        saleNumber,
        customerId: directCustomerId === 'CONSUMIDOR_FINAL' ? '00000000-0000-0000-0000-000000000000' : directCustomerId,
        customerName: directCustomerName,
        customerDoc: directCustomerDoc,
        customerType: 'NATURAL',
        customerCategory: 'RETAIL',
        priceList: 'DEFAULT',
        locationId: locId,
        locationName: locName,
        sellerId: '00000000-0000-0000-0000-000000000001',
        sellerName: 'Vendedor Mostrador',
        date: nowIso,
        items: directItems.map((it, idx) => ({
          id: `item-${Date.now()}-${idx}`,
          productId: it.productId || '00000000-0000-0000-0000-000000000001',
          productName: it.productName,
          sku: 'DIR',
          barcode: '',
          imageUrl: '',
          unitOfMeasure: 'UND',
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          unitCost: Math.round(it.unitPrice * 0.7),
          discountPercent: 0,
          discountAmount: 0,
          taxRatePercent: it.taxRatePercent,
          taxAmount: Math.round(it.quantity * it.unitPrice * (it.taxRatePercent / 100)),
          subtotal: it.quantity * it.unitPrice,
          total: it.quantity * it.unitPrice * (1 + it.taxRatePercent / 100),
        })),
        itemsCount: directItems.length,
        totalUnits: directItems.reduce((acc, it) => acc + it.quantity, 0),
        subtotal: directSubtotal,
        discountTotal: 0,
        taxTotal: directTax,
        totalAmount: directTotal,
        totalCost: Math.round(directSubtotal * 0.7),
        totalProfit: directSubtotal - Math.round(directSubtotal * 0.7),
        profitMarginPercent: 30,
        paymentMethod,
        paymentStatus: 'PAID',
        paymentTerms,
        status: 'CONFIRMED',
        documentType: 'FACTURA_ELECTRONICA',
        notes: notes || 'Factura electrónica generada por emisión directa.',
        createdAt: nowIso,
        updatedAt: nowIso,
      })

      // Emitir factura oficial sobre la venta
      await onGenerateInvoice({
        saleId: createdSale.id,
        type: invoiceType,
        paymentMethod,
        paymentTerms,
        sendToDianImmediately: invoiceType === 'ELECTRONICA' ? sendToDianImmediately : false,
        notes,
      })
    } catch (err: any) {
      console.error('Error generando factura directa:', err)
      setError(err.message || 'Error al emitir la factura directa.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="drawer-backdrop modal-center p-3 sm:p-4" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="modal-card animate-scale-up"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 720,
          maxHeight: '94vh',
          display: 'flex',
          flexDirection: 'column',
          background: '#ffffff',
          borderRadius: 16,
          boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
          overflow: 'hidden',
        }}
      >
        {/* Cabecera del Modal */}
        <div className="px-6 py-4 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-2xs"
              style={{ background: 'var(--navy, #001B5C)' }}
            >
              <AppIcon name="invoices" size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 m-0">
                  Facturar Venta Comercial
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-900 border border-blue-200 font-mono">
                  DIAN Anexo 1.9
                </span>
              </div>
              <p className="text-xs text-slate-500 m-0 mt-0.5">
                Genera el documento fiscal oficial, asigna consecutivo y transmite a la DIAN.
              </p>
            </div>
          </div>

          <button
            type="button"
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
            onClick={onClose}
            aria-label="Cerrar modal"
          >
            <AppIcon name="close" size={18} />
          </button>
        </div>

        {/* Barra de Modos de Facturación (Segmented Control Elegante) */}
        <div className="px-6 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center bg-slate-200/80 p-0.5 rounded-lg text-xs font-semibold">
            <button
              type="button"
              onClick={() => setMode('FROM_SALE')}
              className={`py-1 px-3 rounded-md transition-all flex items-center gap-1.5 ${
                mode === 'FROM_SALE'
                  ? 'bg-white text-blue-950 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <AppIcon name="receipt" size={13} />
              <span>Desde Venta Registrada ({pendingSales.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setMode('DIRECT')}
              className={`py-1 px-3 rounded-md transition-all flex items-center gap-1.5 ${
                mode === 'DIRECT'
                  ? 'bg-white text-blue-950 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <AppIcon name="plus" size={13} />
              <span>Factura Directa (Nueva)</span>
            </button>
          </div>

          {/* Botón sutil de Guía DIAN (Sin emojis) */}
          <button
            type="button"
            onClick={() => setShowHowItWorks(!showHowItWorks)}
            className="text-[11px] font-semibold text-blue-800 hover:text-blue-950 inline-flex items-center gap-1 hover:underline"
          >
            <AppIcon name="alerts" size={13} />
            <span>{showHowItWorks ? 'Ocultar Guía' : '¿Cómo funciona?'}</span>
          </button>
        </div>

        {/* Guía Explicativa Plegable DIAN */}
        {showHowItWorks && (
          <div className="px-6 py-3 bg-blue-50/70 border-b border-blue-200 text-slate-800 text-xs shrink-0">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="p-2.5 bg-white rounded-lg border border-blue-100 shadow-2xs">
                <strong className="block text-blue-950 font-bold mb-0.5 text-[11px]">
                  1. Registro Comercial
                </strong>
                <span className="text-[10.5px] text-slate-600 leading-tight block">
                  Se registra la venta en el POS o por facturación directa con su cliente (NIT/CC) y productos.
                </span>
              </div>
              <div className="p-2.5 bg-white rounded-lg border border-blue-100 shadow-2xs">
                <strong className="block text-blue-950 font-bold mb-0.5 text-[11px]">
                  2. Emisión Fiscal
                </strong>
                <span className="text-[10.5px] text-slate-600 leading-tight block">
                  Se asigna el consecutivo oficial autorizado bajo resolución DIAN vigente y se calcula el IVA.
                </span>
              </div>
              <div className="p-2.5 bg-white rounded-lg border border-blue-100 shadow-2xs">
                <strong className="block text-blue-950 font-bold mb-0.5 text-[11px]">
                  3. Transmisión DIAN
                </strong>
                <span className="text-[10.5px] text-slate-600 leading-tight block">
                  Se genera el archivo XML UBL 2.1 con firma digital, código CUFE y QR oficial.
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Cuerpo del Modal */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4 text-xs">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-center gap-2.5">
              <AppIcon name="warning" size={18} className="text-rose-600 shrink-0" />
              <span className="font-medium">{error}</span>
            </div>
          )}

          {/* MODO 1: DESDE VENTA REGISTRADA */}
          {mode === 'FROM_SALE' && (
            <>
              {!loadingPendingSales && pendingSales.length === 0 ? (
                <div className="p-6 text-center bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto text-white shadow-2xs"
                    style={{ background: 'var(--navy, #001B5C)' }}
                  >
                    <AppIcon name="receipt" size={22} />
                  </div>

                  <div className="max-w-md mx-auto">
                    <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 mb-1.5 uppercase tracking-wide">
                      Ventas al Día
                    </span>
                    <h3 className="text-sm font-bold text-slate-900 m-0 mb-1">
                      No hay ventas pendientes por facturar
                    </h3>
                    <p className="text-xs text-slate-500 m-0 leading-relaxed">
                      Todas las ventas comerciales registradas ya cuentan con factura emitida, o aún no se han registrado ventas en el sistema. Puedes emitir una factura electrónica directa o registrar una venta en el punto de cobro.
                    </p>
                  </div>

                  {/* Fila de botones perfectamente alineada */}
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                    <button
                      type="button"
                      className="primary-button text-xs py-1.5 px-3 flex items-center gap-1.5 font-bold shadow-2xs"
                      style={{ background: 'var(--navy, #001B5C)' }}
                      onClick={() => setMode('DIRECT')}
                    >
                      <AppIcon name="plus" size={14} />
                      <span>Emitir Factura Directa</span>
                    </button>

                    <button
                      type="button"
                      className="outline-button text-xs py-1.5 px-3 flex items-center gap-1.5 font-bold bg-white"
                      onClick={() => handleNavigateTo('/pos', 'pos')}
                    >
                      <AppIcon name="pos" size={14} />
                      <span>Ir a Cobrar en POS</span>
                    </button>

                    <button
                      type="button"
                      className="outline-button text-xs py-1.5 px-3 flex items-center gap-1.5 font-bold bg-white"
                      onClick={() => handleNavigateTo('/ventas', 'ventas')}
                    >
                      <AppIcon name="receipt" size={14} />
                      <span>Ver Ventas</span>
                    </button>

                    {onRefreshPendingSales && (
                      <button
                        type="button"
                        className="outline-button text-xs py-1.5 px-2.5 flex items-center gap-1 bg-white text-slate-600 hover:text-slate-900"
                        onClick={onRefreshPendingSales}
                        title="Comprobar de nuevo ventas pendientes"
                      >
                        <AppIcon name="refresh" size={13} />
                        <span>Actualizar</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <form id="invoice-generate-form" onSubmit={handleSubmit} className="space-y-4">
                  {/* Selector de Venta Comercial Pendiente */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                        <span className="w-4.5 h-4.5 rounded-full bg-blue-900 text-white inline-flex items-center justify-center text-[10px] font-bold">
                          1
                        </span>
                        Seleccionar Venta Comercial *
                      </label>
                      <span className="text-[11px] text-slate-500 font-medium">
                        {pendingSales.length} {pendingSales.length === 1 ? 'venta lista' : 'ventas listas'}
                      </span>
                    </div>

                    {loadingPendingSales ? (
                      <div className="p-3 text-slate-500 text-xs bg-slate-50 rounded-lg border border-slate-200 animate-pulse">
                        Cargando ventas pendientes de facturar...
                      </div>
                    ) : (
                      <CustomSelect
                        value={selectedSaleId}
                        onChange={(val) => setSelectedSaleId(val)}
                        options={pendingSales.map((s) => ({
                          value: s.id,
                          label: `${s.saleNumber} · ${s.customerName} · ${formatCOP(s.totalAmount || s.total)} (${s.locationName || 'Sede Principal'})`,
                        }))}
                        placeholder="Selecciona una venta para facturar..."
                      />
                    )}
                  </div>

                  {/* Tarjeta de Detalle Fiscal de la Venta Seleccionada */}
                  {selectedSale && (
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                        <div className="flex items-center gap-2">
                          <strong className="text-xs font-bold text-slate-900">
                            Venta: {selectedSale.saleNumber}
                          </strong>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-900 border border-blue-200">
                            {selectedSale.locationName || 'Sede Principal'}
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] text-slate-500 uppercase font-bold mr-1.5">
                            Total Venta:
                          </span>
                          <strong className="text-sm font-mono font-bold text-blue-950">
                            {formatCOP(selectedSale.totalAmount || selectedSale.total)}
                          </strong>
                        </div>
                      </div>

                      {/* Datos del Cliente */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                        <div>
                          <span className="text-[10px] text-slate-500 block font-semibold uppercase">
                            Adquirente / Cliente:
                          </span>
                          <strong className="text-slate-900 block truncate">
                            {selectedSale.customerName || 'Consumidor Final'}
                          </strong>
                        </div>

                        <div>
                          <span className="text-[10px] text-slate-500 block font-semibold uppercase">
                            NIT / C.C. DIAN:
                          </span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="font-mono font-bold text-slate-900">
                              {selectedSale.customerDoc || '222222222222'}
                            </span>
                            <span className="text-[9px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded">
                              {selectedSale.customerDoc ? 'Registrado' : 'Consumidor Final'}
                            </span>
                          </div>
                        </div>

                        <div>
                          <span className="text-[10px] text-slate-500 block font-semibold uppercase">
                            Correo Envío DIAN:
                          </span>
                          <span className="text-slate-800 block truncate font-mono text-[11px] mt-0.5">
                            {selectedSale.customerEmail || 'Sin correo registrado'}
                          </span>
                        </div>
                      </div>

                      {/* Desglose de ítems */}
                      {selectedSale.items && selectedSale.items.length > 0 && (
                        <div className="pt-2 border-t border-slate-200">
                          <span className="text-[10.5px] font-bold text-slate-700 block mb-1">
                            Productos a facturar ({selectedSale.items.length} ítems):
                          </span>
                          <div className="max-h-24 overflow-y-auto space-y-1 bg-white p-2 rounded-lg border border-slate-200 text-[11px]">
                            {selectedSale.items.map((it: any, i: number) => (
                              <div key={i} className="flex items-center justify-between text-slate-700">
                                <span className="truncate pr-2">
                                  <strong>{it.quantity}x</strong> {it.productName}
                                </span>
                                <span className="font-mono font-semibold text-slate-900 shrink-0">
                                  {formatCOP(it.total || it.quantity * it.unitPrice)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Advertencia Fiscal si faltan datos */}
                      {hasFiscalWarning && (
                        <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px] flex items-center gap-2">
                          <AppIcon name="warning" size={14} className="text-amber-600 shrink-0" />
                          <span>
                            {isMissingDoc && 'Falta NIT/CC específico del cliente (se usará Consumidor Final). '}
                            {isMissingEmail && 'Para facturación electrónica se recomienda registrar el correo para envío automático.'}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tipo de Comprobante & Método de Pago */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-900 font-bold mb-1 uppercase tracking-wider text-[10.5px]">
                        Tipo de Comprobante *
                      </label>
                      <CustomSelect
                        value={invoiceType}
                        onChange={(val) => setInvoiceType(val as InvoiceType)}
                        options={[
                          { value: 'ELECTRONICA', label: 'Factura Electrónica de Venta (DIAN)' },
                          { value: 'POS', label: 'Factura POS (Punto de Venta / Tirilla)' },
                        ]}
                        placeholder="Seleccionar tipo de comprobante"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-900 font-bold mb-1 uppercase tracking-wider text-[10.5px]">
                        Método de Pago DIAN *
                      </label>
                      <CustomSelect
                        value={paymentMethod}
                        onChange={(val) => setPaymentMethod(val as InvoicePaymentMethod)}
                        options={[
                          { value: 'EFECTIVO', label: 'Efectivo (10)' },
                          { value: 'TRANSFERENCIA', label: 'Transferencia Bancaria (47)' },
                          { value: 'TARJETA', label: 'Tarjeta Débito / Crédito (48)' },
                          { value: 'CREDITO', label: 'Crédito Comercial (30)' },
                          { value: 'MIXTO', label: 'Pago Mixto' },
                        ]}
                        placeholder="Seleccionar método de pago"
                      />
                    </div>
                  </div>

                  {/* Condiciones & Transmisión Inmediata */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                    <div>
                      <label className="block text-slate-900 font-bold mb-1 uppercase tracking-wider text-[10.5px]">
                        Condiciones de Pago:
                      </label>
                      <input
                        type="text"
                        value={paymentTerms}
                        onChange={(e) => setPaymentTerms(e.target.value)}
                        placeholder="Ej. Contado, Crédito 15 días"
                        className="w-full h-8 px-2.5 text-xs bg-white border border-slate-300 rounded-md text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    {invoiceType === 'ELECTRONICA' ? (
                      <div className="pt-2">
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-900 select-none">
                          <input
                            type="checkbox"
                            checked={sendToDianImmediately}
                            onChange={(e) => setSendToDianImmediately(e.target.checked)}
                            className="rounded border-slate-300 text-blue-900 focus:ring-blue-900 w-4 h-4"
                          />
                          <span>Transmitir a la DIAN inmediatamente</span>
                        </label>
                        <span className="text-[10px] text-slate-500 block ml-6">
                          Genera CUFE y código QR oficial en tiempo real
                        </span>
                      </div>
                    ) : null}
                  </div>

                  {/* Observaciones */}
                  <div>
                    <label className="block text-slate-900 font-bold mb-1 uppercase tracking-wider text-[10.5px]">
                      Notas u Observaciones:
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Añade observaciones visibles en la factura..."
                      rows={2}
                      className="w-full p-2 text-xs bg-white border border-slate-300 rounded-md text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                    />
                  </div>
                </form>
              )}
            </>
          )}

          {/* MODO 2: FACTURACIÓN DIRECTA */}
          {mode === 'DIRECT' && (
            <form id="invoice-generate-form" onSubmit={handleSubmit} className="space-y-4">
              {/* Cliente y Sucursal */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-900 font-bold mb-1 uppercase tracking-wider text-[10.5px]">
                    Adquirente / Cliente *
                  </label>
                  <select
                    className="w-full h-8 px-2.5 text-xs bg-white border border-slate-300 rounded-md text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 truncate"
                    value={directCustomerId}
                    onChange={(e) => handleSelectDirectCustomer(e.target.value)}
                  >
                    <option value="CONSUMIDOR_FINAL">Consumidor Final (222222222222)</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.document_number ? `${c.document_number} - ` : ''}
                        {c.company_name || `${c.first_name || ''} ${c.last_name || ''}`.trim()}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-900 font-bold mb-1 uppercase tracking-wider text-[10.5px]">
                    Sucursal / Sede Emisora:
                  </label>
                  <select
                    className="w-full h-8 px-2.5 text-xs bg-white border border-slate-300 rounded-md text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    value={directLocationId}
                    onChange={(e) => setDirectLocationId(e.target.value)}
                  >
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name} ({loc.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Datos de contacto del cliente */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-semibold block">Nombre / Razón:</span>
                  <input
                    type="text"
                    value={directCustomerName}
                    onChange={(e) => setDirectCustomerName(e.target.value)}
                    className="w-full h-7 px-2 text-xs bg-white border border-slate-300 rounded text-slate-800 font-medium"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-semibold block">NIT / Cédula:</span>
                  <input
                    type="text"
                    value={directCustomerDoc}
                    onChange={(e) => setDirectCustomerDoc(e.target.value)}
                    className="w-full h-7 px-2 text-xs bg-white border border-slate-300 rounded text-slate-800 font-mono"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-semibold block">Correo DIAN:</span>
                  <input
                    type="email"
                    value={directCustomerEmail}
                    onChange={(e) => setDirectCustomerEmail(e.target.value)}
                    placeholder="correo@ejemplo.com"
                    className="w-full h-7 px-2 text-xs bg-white border border-slate-300 rounded text-slate-800 font-mono"
                  />
                </div>
              </div>

              {/* Ítems a Facturar */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                    Líneas de Factura ({directItems.length}) *
                  </label>
                  <button
                    type="button"
                    onClick={handleAddDirectItem}
                    className="text-[11px] font-semibold text-blue-800 hover:text-blue-950 inline-flex items-center gap-1"
                  >
                    <AppIcon name="plus" size={12} />
                    <span>Agregar Línea</span>
                  </button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto p-1">
                  {directItems.map((item, idx) => (
                    <div
                      key={item.id}
                      className="p-2.5 rounded-lg border border-slate-200 bg-white grid grid-cols-12 gap-2 items-center text-xs"
                    >
                      <div className="col-span-5">
                        <span className="text-[9.5px] text-slate-400 block mb-0.5">Concepto / Producto:</span>
                        <input
                          type="text"
                          value={item.productName}
                          onChange={(e) => handleUpdateDirectItem(item.id, 'productName', e.target.value)}
                          placeholder="Descripción del ítem"
                          className="w-full h-7 px-2 text-xs bg-slate-50 border border-slate-300 rounded"
                        />
                      </div>

                      <div className="col-span-2">
                        <span className="text-[9.5px] text-slate-400 block mb-0.5">Cant:</span>
                        <input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) => handleUpdateDirectItem(item.id, 'quantity', Number(e.target.value) || 1)}
                          className="w-full h-7 px-1.5 text-xs bg-slate-50 border border-slate-300 rounded text-center"
                        />
                      </div>

                      <div className="col-span-2">
                        <span className="text-[9.5px] text-slate-400 block mb-0.5">Precio Unit:</span>
                        <input
                          type="number"
                          min={0}
                          value={item.unitPrice}
                          onChange={(e) => handleUpdateDirectItem(item.id, 'unitPrice', Number(e.target.value) || 0)}
                          className="w-full h-7 px-1.5 text-xs bg-slate-50 border border-slate-300 rounded text-right font-mono"
                        />
                      </div>

                      <div className="col-span-2 text-right">
                        <span className="text-[9.5px] text-slate-400 block mb-0.5">Total:</span>
                        <span className="font-mono font-bold text-slate-900 block leading-7 truncate">
                          {formatCOP(item.quantity * item.unitPrice * (1 + item.taxRatePercent / 100))}
                        </span>
                      </div>

                      <div className="col-span-1 text-right">
                        {directItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveDirectItem(item.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                            title="Eliminar línea"
                          >
                            <AppIcon name="close" size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Resumen Financiero Directo */}
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 mt-2 flex flex-wrap items-center justify-between gap-4 font-mono text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block font-sans font-semibold">Subtotal:</span>
                    <strong className="text-slate-800">{formatCOP(directSubtotal)}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block font-sans font-semibold">IVA (19%):</span>
                    <strong className="text-slate-800">{formatCOP(directTax)}</strong>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 uppercase block font-sans font-semibold">Total a Facturar:</span>
                    <strong className="text-base text-blue-950 font-black">{formatCOP(directTotal)}</strong>
                  </div>
                </div>
              </div>

              {/* Método de Pago y Condiciones */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-900 font-bold mb-1 uppercase tracking-wider text-[10.5px]">
                    Método de Pago DIAN *
                  </label>
                  <CustomSelect
                    value={paymentMethod}
                    onChange={(val) => setPaymentMethod(val as InvoicePaymentMethod)}
                    options={[
                      { value: 'EFECTIVO', label: 'Efectivo (10)' },
                      { value: 'TRANSFERENCIA', label: 'Transferencia Bancaria (47)' },
                      { value: 'TARJETA', label: 'Tarjeta Débito / Crédito (48)' },
                      { value: 'CREDITO', label: 'Crédito Comercial (30)' },
                    ]}
                    placeholder="Seleccionar método de pago"
                  />
                </div>

                <div>
                  <label className="block text-slate-900 font-bold mb-1 uppercase tracking-wider text-[10.5px]">
                    Condiciones:
                  </label>
                  <input
                    type="text"
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                    placeholder="Ej. Contado"
                    className="w-full h-8 px-2.5 text-xs bg-white border border-slate-300 rounded-md text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            </form>
          )}
        </div>

        {/* Pie del Modal */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-500 hidden sm:inline">
            Resolución DIAN No. 18764000001 autorizada (Rango FE-1000 a FE-50000).
          </span>

          <div className="flex items-center gap-2.5 ml-auto">
            <button
              type="button"
              className="outline-button compact text-xs"
              onClick={onClose}
              disabled={submitting}
            >
              Cancelar
            </button>

            {(mode === 'DIRECT' || pendingSales.length > 0) && (
              <button
                type="submit"
                form="invoice-generate-form"
                className="primary-button compact text-xs flex items-center gap-2 font-bold shadow-2xs"
                style={{ background: 'var(--navy, #001B5C)' }}
                disabled={submitting || (mode === 'FROM_SALE' && !selectedSaleId)}
              >
                <AppIcon name="invoices" size={14} className={submitting ? 'animate-bounce' : ''} />
                <span>
                  {submitting
                    ? 'Emitiendo Factura...'
                    : mode === 'DIRECT'
                    ? 'Emitir Factura Directa'
                    : invoiceType === 'ELECTRONICA'
                    ? 'Emitir Factura Electrónica'
                    : 'Emitir Factura POS'}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
