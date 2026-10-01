'use client'

import React, { useEffect, useState } from 'react'
import { supabaseClient } from '@/lib/supabase/client'
import { usePOS } from '../hooks/usePOS'
import { POSHeader } from './POSHeader'
import { POSProductGrid } from './POSProductGrid'
import { POSCart } from './POSCart'
import { POSCustomerModal } from './POSCustomerModal'
import { POSPaymentModal } from './POSPaymentModal'
import { POSTicketReceiptModal } from './POSTicketReceiptModal'
import { POSDailySalesDrawer } from './POSDailySalesDrawer'
import { POSDiscountModal } from './POSDiscountModal'

interface POSViewProps {
  onExit?: () => void
}

export const POSView: React.FC<POSViewProps> = ({ onExit }) => {
  const [isCompanyConfigured, setIsCompanyConfigured] = useState(true)

  const {
    // Locations
    locations,
    locationsLoading,
    changeLocation,
    // User / Context
    userContext,
    // Catalog
    products,
    catalogLoading,
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
    categories,
    handleScanBarcode,
    refreshProducts,
    // Customer
    currentCustomer,
    setCurrentCustomer,
    isCustomerModalOpen,
    setIsCustomerModalOpen,
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
  } = usePOS()

  const [isFullscreen, setIsFullscreen] = useState(false)

  // Verify company configuration from PostgreSQL
  useEffect(() => {
    async function checkCompany() {
      try {
        const { data, error } = await supabaseClient
          .from('companies')
          .select('id, name, tax_id')
          .limit(1)
          .maybeSingle()
        if (!error && data) {
          setIsCompanyConfigured(Boolean(data.name && data.tax_id))
        }
      } catch {
        setIsCompanyConfigured(true)
      }
    }
    checkCompany()
  }, [])

  // Fullscreen toggle handler
  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error('Error al entrar en pantalla completa:', err)
      })
      setIsFullscreen(true)
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch((err) => {
          console.error('Error al salir de pantalla completa:', err)
        })
        setIsFullscreen(false)
      }
    }
  }

  // Keyboard shortcut listeners (F2, F4, F8, F9, Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input unless it's a function key
      if (e.key === 'F2') {
        e.preventDefault()
        const searchInput = document.getElementById('pos-product-search') as HTMLInputElement
        searchInput?.focus()
      } else if (e.key === 'F4') {
        e.preventDefault()
        setIsCustomerModalOpen(true)
      } else if (e.key === 'F8') {
        e.preventDefault()
        if (cart.length > 0) {
          setIsPaymentModalOpen(true)
        }
      } else if (e.key === 'F9') {
        e.preventDefault()
        openDailySales()
      } else if (e.key === 'Escape') {
        if (isCustomerModalOpen) setIsCustomerModalOpen(false)
        if (isPaymentModalOpen) setIsPaymentModalOpen(false)
        if (isReceiptModalOpen) setIsReceiptModalOpen(false)
        if (isDailySalesOpen) setIsDailySalesOpen(false)
        if (isDiscountModalOpen) setIsDiscountModalOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    cart.length,
    isCustomerModalOpen,
    isPaymentModalOpen,
    isReceiptModalOpen,
    isDailySalesOpen,
    isDiscountModalOpen,
    openDailySales,
    setIsCustomerModalOpen,
    setIsPaymentModalOpen,
    setIsReceiptModalOpen,
    setIsDailySalesOpen,
    setIsDiscountModalOpen,
  ])

  const handleOpenDiscountModal = (item: typeof cart[0]) => {
    setItemForDiscount(item)
    setIsDiscountModalOpen(true)
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-100 overflow-hidden font-sans select-none">
      {/* 1. POS Top Bar */}
      <POSHeader
        userContext={userContext}
        locationName={userContext.locationName}
        cashierName={userContext.userName}
        cashRegisterNumber={userContext.cashRegisterNumber}
        locations={locations}
        selectedLocationId={userContext.locationId}
        onLocationChange={changeLocation}
        locationsLoading={locationsLoading}
        onOpenDailySales={openDailySales}
        onToggleFullscreen={handleToggleFullscreen}
        isFullscreen={isFullscreen}
        onExit={onExit}
      />

      {/* Alerta si la empresa no está configurada */}
      {!isCompanyConfigured && (
        <div style={{
          background: '#fffbeb',
          borderBottom: '1px solid #fde68a',
          padding: '10px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          color: '#92400e',
          fontSize: '13px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 16 }}>⚠️</span>
            <strong>Configure la empresa antes de operar</strong>
            <span style={{ color: '#b45309' }}>
              — Debes registrar la información legal y tributaria de tu empresa para habilitar la facturación y ventas en caja.
            </span>
          </div>
          <a
            href="/configuracion"
            style={{
              padding: '6px 14px',
              background: '#d97706',
              color: '#fff',
              borderRadius: 6,
              textDecoration: 'none',
              fontSize: 12,
              fontWeight: 600,
              whiteSpace: 'nowrap'
            }}
          >
            Configurar Empresa
          </a>
        </div>
      )}

      {/* 2. Main POS Workspace: Split Screen */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Side: Product Catalog, Search & Quick Filters */}
        <section 
          className="flex-1 flex flex-col overflow-hidden bg-slate-50 border-r border-slate-200"
          aria-label="Catálogo de productos"
        >
          <POSProductGrid
            products={products}
            loading={catalogLoading}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            categories={categories}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            onAddToCart={(product) => addToCart(product, 1)}
            onScanBarcode={handleScanBarcode}
          />
        </section>

        {/* Right Side: Active Cart & Total Summary */}
        <aside 
          className="w-full lg:w-[420px] xl:w-[460px] shrink-0 flex flex-col overflow-hidden bg-white shadow-xl z-10"
          aria-label="Carrito de compras"
        >
          <POSCart
            items={cart}
            totals={totals}
            customer={currentCustomer}
            onOpenCustomerModal={() => setIsCustomerModalOpen(true)}
            onUpdateQuantity={updateQuantity}
            onRemoveItem={removeFromCart}
            onOpenDiscountModal={handleOpenDiscountModal}
            onCheckout={() => {
              if (!isCompanyConfigured) {
                alert('Configure la empresa antes de operar.')
                return
              }
              setIsPaymentModalOpen(true)
            }}
            onClearCart={clearCart}
          />
        </aside>
      </main>

      {/* 3. Interactive Modals & Drawers */}
      
      {/* Customer Lookup & Select Modal */}
      <POSCustomerModal
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        currentCustomer={currentCustomer}
        onSelectCustomer={setCurrentCustomer}
        onSearch={handleSearchCustomers}
        searchResults={customerSearchResults}
      />

      {/* Payment & Checkout Modal */}
      <POSPaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        customer={currentCustomer}
        totals={totals}
        paymentMethod={paymentMethod}
        setPaymentMethod={setPaymentMethod}
        amountPaid={amountPaid}
        setAmountPaid={setAmountPaid}
        onConfirmPayment={handleProcessSale}
        loading={paymentLoading}
        error={paymentError}
      />

      {/* Thermal Ticket Receipt Modal */}
      <POSTicketReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        receipt={ticketReceipt}
      />

      {/* Shift Daily Sales Drawer */}
      <POSDailySalesDrawer
        isOpen={isDailySalesOpen}
        onClose={() => setIsDailySalesOpen(false)}
        sales={dailySales}
        loading={dailySalesLoading}
        cashierName={userContext.userName}
        cashRegisterNumber={userContext.cashRegisterNumber || 'CAJA-01'}
        onRefresh={openDailySales}
      />

      {/* Item Discount Modal */}
      <POSDiscountModal
        isOpen={isDiscountModalOpen}
        onClose={() => setIsDiscountModalOpen(false)}
        item={itemForDiscount}
        onApplyDiscount={applyDiscount}
      />
    </div>
  )
}
