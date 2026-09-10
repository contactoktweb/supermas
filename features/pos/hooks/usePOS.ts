'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { posService } from '../services/pos.service'
import {
  POSProduct,
  POSCustomer,
  POSCartItem,
  POSPaymentMethod,
  POSTicketReceipt,
  POSDailySaleSummary,
  POSUserContext,
} from '../types'
import { db } from '@/lib/supabase'

export function usePOS() {
  // Current cashier context
  const [userContext, setUserContext] = useState<POSUserContext>({
    userId: 'usr-cajero-01',
    userName: 'Cajero Centro',
    userRole: 'Cajero Operativo',
    locationId: 'loc-003', // Punto de Venta Centro por defecto
    locationName: 'Punto de Venta Centro',
    cashRegisterNumber: 'CAJA-01',
    permissions: [
      'pos.access',
      'pos.create_sale',
      'pos.discount',
      'pos.view_history',
    ],
  })

  // Catalog State
  const [products, setProducts] = useState<POSProduct[]>([])
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('ALL')

  // Customer State
  const [currentCustomer, setCurrentCustomer] = useState<POSCustomer | null>(null)
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false)
  const [customerSearchQuery, setCustomerSearchQuery] = useState('')
  const [customerSearchResults, setCustomerSearchResults] = useState<POSCustomer[]>([])

  // Cart State
  const [cart, setCart] = useState<POSCartItem[]>([])

  // Checkout State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<POSPaymentMethod>('EFECTIVO')
  const [amountPaid, setAmountPaid] = useState<number>(0)
  const [paymentLoading, setPaymentLoading] = useState(false)
  const [paymentError, setPaymentError] = useState<string | null>(null)

  // Receipt Modal State
  const [ticketReceipt, setTicketReceipt] = useState<POSTicketReceipt | null>(null)
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false)

  // Daily Sales Drawer State
  const [isDailySalesOpen, setIsDailySalesOpen] = useState(false)
  const [dailySales, setDailySales] = useState<POSDailySaleSummary[]>([])
  const [dailySalesLoading, setDailySalesLoading] = useState(false)

  // Discount Modal State
  const [itemForDiscount, setItemForDiscount] = useState<POSCartItem | null>(null)
  const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false)

  const isMountedRef = useRef(true)

  // 1. Load initial customer (Consumidor Final)
  useEffect(() => {
    async function loadDefaultCustomer() {
      try {
        const generic = await posService.getGenericCustomer()
        if (isMountedRef.current) {
          setCurrentCustomer(generic)
        }
      } catch (err) {
        console.error('Error al cargar consumidor final:', err)
      }
    }
    loadDefaultCustomer()
  }, [])

  // 2. Load products for selected location
  const fetchProducts = useCallback(async () => {
    try {
      setCatalogLoading(true)
      const data = await posService.getProducts(
        userContext.locationId,
        searchQuery,
        selectedCategory,
        userContext
      )
      if (isMountedRef.current) {
        setProducts(data)
      }
    } catch (err) {
      console.error('Error al cargar productos POS:', err)
    } finally {
      if (isMountedRef.current) {
        setCatalogLoading(false)
      }
    }
  }, [userContext, searchQuery, selectedCategory])

  useEffect(() => {
    isMountedRef.current = true
    fetchProducts()
    return () => {
      isMountedRef.current = false
    }
  }, [fetchProducts])

  // Extract available categories
  const categories = useMemo(() => {
    const rawCategories = Array.from(new Set(db.products.map((p) => p.category).filter(Boolean)))
    return ['ALL', ...rawCategories]
  }, [])

  // 3. Customer search
  const handleSearchCustomers = useCallback(async (query: string) => {
    setCustomerSearchQuery(query)
    try {
      const res = await posService.searchCustomers(query, userContext)
      if (isMountedRef.current) {
        setCustomerSearchResults(res)
      }
    } catch (err) {
      console.error('Error al buscar clientes:', err)
    }
  }, [userContext])

  useEffect(() => {
    if (isCustomerModalOpen) {
      handleSearchCustomers('')
    }
  }, [isCustomerModalOpen, handleSearchCustomers])

  // 4. Cart Operations
  const addToCart = useCallback((product: POSProduct, customQuantity: number = 1) => {
    if (!currentCustomer) return

    setCart((prevCart) => {
      const existingIndex = prevCart.findIndex((item) => item.productId === product.id)
      const unitPrice = posService.resolveUnitPrice(product, currentCustomer)
      const taxRatePercent = product.isExempt ? 0 : product.vatRatePercent

      if (existingIndex >= 0) {
        const existing = prevCart[existingIndex]
        const updatedQty = existing.quantity + customQuantity

        // Validar límite de stock
        if (updatedQty > product.availableStock) {
          alert(`Existencia máxima alcanzada para "${product.name}" (${product.availableStock} unidades disponibles).`)
          return prevCart
        }

        const gross = updatedQty * unitPrice
        const discountAmount = Math.round(gross * (existing.discountPercent / 100))
        const subtotal = gross - discountAmount
        const taxAmount = Math.round(subtotal * (taxRatePercent / 100))
        const total = subtotal + taxAmount

        const updated = [...prevCart]
        updated[existingIndex] = {
          ...existing,
          quantity: updatedQty,
          subtotal,
          taxAmount,
          total,
        }
        return updated
      } else {
        if (product.availableStock < customQuantity) {
          alert(`Existencia insuficiente para "${product.name}" (${product.availableStock} disponibles).`)
          return prevCart
        }

        const gross = customQuantity * unitPrice
        const subtotal = gross
        const taxAmount = Math.round(subtotal * (taxRatePercent / 100))
        const total = subtotal + taxAmount

        return [
          ...prevCart,
          {
            id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            productId: product.id,
            productName: product.name,
            sku: product.sku,
            barcode: product.barcode,
            unitOfMeasure: product.unitOfMeasure,
            imageUrl: product.imageUrl,
            quantity: customQuantity,
            unitPrice,
            discountPercent: 0,
            discountAmount: 0,
            taxRatePercent,
            taxAmount,
            subtotal,
            total,
            availableStock: product.availableStock,
          },
        ]
      }
    })
  }, [currentCustomer])

  const updateQuantity = useCallback((productId: string, newQty: number) => {
    if (newQty <= 0) {
      removeFromCart(productId)
      return
    }

    setCart((prev) =>
      prev.map((item) => {
        if (item.productId === productId) {
          if (newQty > item.availableStock) {
            alert(`No puedes agregar más de ${item.availableStock} unidades disponibles.`)
            return item
          }
          const gross = newQty * item.unitPrice
          const discountAmount = Math.round(gross * (item.discountPercent / 100))
          const subtotal = gross - discountAmount
          const taxAmount = Math.round(subtotal * (item.taxRatePercent / 100))
          const total = subtotal + taxAmount

          return {
            ...item,
            quantity: newQty,
            discountAmount,
            subtotal,
            taxAmount,
            total,
          }
        }
        return item
      })
    )
  }, [])

  const applyDiscount = useCallback((productId: string, percent: number, reason?: string) => {
    const clamped = Math.min(100, Math.max(0, percent))
    setCart((prev) =>
      prev.map((item) => {
        if (item.productId === productId) {
          const gross = item.quantity * item.unitPrice
          const discountAmount = Math.round(gross * (clamped / 100))
          const subtotal = gross - discountAmount
          const taxAmount = Math.round(subtotal * (item.taxRatePercent / 100))
          const total = subtotal + taxAmount

          return {
            ...item,
            discountPercent: clamped,
            discountAmount,
            subtotal,
            taxAmount,
            total,
            discountReason: reason,
          }
        }
        return item
      })
    )
  }, [])

  const removeFromCart = useCallback((productId: string) => {
    setCart((prev) => prev.filter((i) => i.productId !== productId))
  }, [])

  const clearCart = useCallback(() => {
    setCart([])
  }, [])

  // 5. Scan Barcode directly
  const handleScanBarcode = useCallback(async (code: string) => {
    if (!code.trim()) return
    try {
      const match = await posService.scanBarcode(code, userContext.locationId, userContext)
      if (match) {
        addToCart(match, 1)
        setSearchQuery('')
      } else {
        alert(`No se encontró ningún producto con el código de barras "${code}".`)
      }
    } catch (err) {
      console.error('Error al escanear código:', err)
    }
  }, [userContext, addToCart])

  // 6. Totals calculation
  const totals = useMemo(() => {
    return posService.calculateTotals(cart)
  }, [cart])

  // Set default amount paid equal to total
  useEffect(() => {
    if (isPaymentModalOpen) {
      setAmountPaid(totals.totalAmount)
      setPaymentError(null)
    }
  }, [isPaymentModalOpen, totals.totalAmount])

  // 7. Process Payment / Complete Sale
  const handleProcessSale = async () => {
    if (!currentCustomer) {
      setPaymentError('Debe haber un cliente seleccionado.')
      return
    }
    if (cart.length === 0) {
      setPaymentError('El carrito está vacío.')
      return
    }

    try {
      setPaymentLoading(true)
      setPaymentError(null)

      const receipt = await posService.processSale(
        {
          customerId: currentCustomer.id,
          locationId: userContext.locationId,
          paymentMethod,
          amountPaid,
          items: cart.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            discountPercent: i.discountPercent,
            discountReason: i.discountReason,
          })),
        },
        userContext
      )

      setTicketReceipt(receipt)
      setIsPaymentModalOpen(false)
      setIsReceiptModalOpen(true)
      clearCart()
      await fetchProducts() // Refresh stocks
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al procesar la venta POS'
      setPaymentError(msg)
    } finally {
      setPaymentLoading(false)
    }
  }

  // 8. Daily Sales
  const fetchDailySales = useCallback(async () => {
    try {
      setDailySalesLoading(true)
      const data = await posService.getDailySales(
        userContext.userName,
        userContext.locationId,
        userContext
      )
      if (isMountedRef.current) {
        setDailySales(data)
      }
    } catch (err) {
      console.error('Error al cargar ventas del día:', err)
    } finally {
      if (isMountedRef.current) {
        setDailySalesLoading(false)
      }
    }
  }, [userContext])

  const openDailySales = () => {
    setIsDailySalesOpen(true)
    fetchDailySales()
  }

  return {
    // User / Context
    userContext,
    setUserContext,
    // Catalog
    products,
    catalogLoading,
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
    categories,
    handleScanBarcode,
    refreshProducts: fetchProducts,
    // Customer
    currentCustomer,
    setCurrentCustomer,
    isCustomerModalOpen,
    setIsCustomerModalOpen,
    customerSearchQuery,
    customerSearchResults,
    handleSearchCustomers,
    // Cart
    cart,
    addToCart,
    updateQuantity,
    applyDiscount,
    removeFromCart,
    clearCart,
    totals,
    // Checkout
    isPaymentModalOpen,
    setIsPaymentModalOpen,
    paymentMethod,
    setPaymentMethod,
    amountPaid,
    setAmountPaid,
    paymentLoading,
    paymentError,
    handleProcessSale,
    // Receipt
    ticketReceipt,
    isReceiptModalOpen,
    setIsReceiptModalOpen,
    // Daily Sales
    isDailySalesOpen,
    setIsDailySalesOpen,
    dailySales,
    dailySalesLoading,
    openDailySales,
    // Discount modal
    itemForDiscount,
    setItemForDiscount,
    isDiscountModalOpen,
    setIsDiscountModalOpen,
  }
}
