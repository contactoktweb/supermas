'use client'

import React, { useState } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { CustomerStats } from './CustomerStats'
import { CustomerFilters } from './CustomerFilters'
import { CustomerTable } from './CustomerTable'
import { CustomerFormDrawer } from './CustomerFormDrawer'
import { CustomerDetailDrawer } from './CustomerDetailDrawer'
import { CustomerPaymentModal } from './CustomerPaymentModal'
import { CustomerDeactivateModal } from './CustomerDeactivateModal'
import { useCustomers } from '../hooks/useCustomers'
import { useCustomerDetail } from '../hooks/useCustomerDetail'
import { Customer, CreateCustomerDTO, UpdateCustomerDTO, CustomerPaymentDTO } from '../types'
import { db } from '@/lib/supabase'

interface CustomersPageProps {
  onNavigate?: (view: string) => void
}

export function CustomersPage({ onNavigate }: CustomersPageProps) {
  const {
    items: customers,
    stats,
    filters,
    total,
    page,
    pageSize,
    totalPages,
    loading,
    statsLoading,
    error,
    setFilter,
    resetFilters,
    refresh,
    createCustomer,
    updateCustomer,
    deactivateCustomer,
    reactivateCustomer,
  } = useCustomers()

  // Modal / Drawer UI states
  const [isFormDrawerOpen, setIsFormDrawerOpen] = useState(false)
  const [customerToEdit, setCustomerToEdit] = useState<Customer | null>(null)

  const [selectedCustomerIdForDetail, setSelectedCustomerIdForDetail] = useState<string | null>(null)
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false)

  const [customerForPayment, setCustomerForPayment] = useState<Customer | null>(null)
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)

  const [customerForDeactivate, setCustomerForDeactivate] = useState<Customer | null>(null)
  const [isDeactivateModalOpen, setIsDeactivateModalOpen] = useState(false)

  // Customer Detail Hook
  const {
    customer: customerDetail,
    loading: detailLoading,
    addPayment: addDetailPayment,
    addDocument: addDetailDocument,
    refresh: refreshDetail,
  } = useCustomerDetail(selectedCustomerIdForDetail)

  // Locations for drawer
  const locations = db.locations.map((l) => ({
    id: l.id,
    name: l.name,
    code: l.code,
  }))

  // Extract unique cities
  const cities = Array.from(
    new Set((db.customers as unknown as Customer[]).map((c) => c.city).filter(Boolean))
  )

  // Handlers
  const handleOpenCreate = () => {
    setCustomerToEdit(null)
    setIsFormDrawerOpen(true)
  }

  const handleOpenEdit = (customer: Customer) => {
    setCustomerToEdit(customer)
    setIsFormDrawerOpen(true)
  }

  const handleViewDetail = (customer: Customer) => {
    setSelectedCustomerIdForDetail(customer.id)
    setIsDetailDrawerOpen(true)
  }

  const handleOpenPayment = (customer: Customer) => {
    setCustomerForPayment(customer)
    setIsPaymentModalOpen(true)
  }

  const handleOpenDeactivate = (customer: Customer) => {
    setCustomerForDeactivate(customer)
    setIsDeactivateModalOpen(true)
  }

  const handleFormSubmit = async (dto: CreateCustomerDTO | UpdateCustomerDTO) => {
    if (customerToEdit) {
      await updateCustomer(customerToEdit.id, dto as UpdateCustomerDTO)
      if (selectedCustomerIdForDetail === customerToEdit.id) {
        await refreshDetail()
      }
    } else {
      await createCustomer(dto as CreateCustomerDTO)
    }
  }

  const handlePaymentSubmit = async (dto: CustomerPaymentDTO) => {
    if (selectedCustomerIdForDetail) {
      await addDetailPayment(dto)
    }
    await refresh()
  }

  const handleExportCSV = () => {
    const headers = [
      'ID',
      'Nombre / Razón Social',
      'Tipo Persona',
      'Tipo Documento',
      'Número Documento',
      'Teléfono',
      'Email',
      'Dirección',
      'Ciudad',
      'Departamento',
      'Categoría',
      'Lista de Precios',
      'Total Comprado',
      'Compras',
      'Saldo Cartera',
      'Estado',
    ]

    const rows = customers.map((c) => [
      c.id,
      `"${c.displayName.replace(/"/g, '""')}"`,
      c.customerType,
      c.documentType,
      `"${c.documentNumber}"`,
      `"${c.phone}"`,
      c.email,
      `"${c.address.replace(/"/g, '""')}"`,
      c.city,
      c.department,
      c.category,
      c.priceList,
      c.totalPurchased,
      c.purchasesCount,
      c.currentBalance,
      c.status,
    ])

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n')

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `clientes_supermas_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="customers-module page-enter" style={{ width: '100%' }}>
      {/* 1. Page Header */}
      <div className="welcome-row page-heading">
        <div>
          <h1>
            Clientes <span>Super Más</span>
          </h1>
          <p className="welcome-subtitle">
            Administra clientes, historial de compras y datos comerciales.
          </p>
        </div>

        <div className="heading-actions" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            type="button"
            className="outline-button"
            onClick={handleExportCSV}
            title="Exportar directorio de clientes a CSV"
          >
            <AppIcon name="download" size={15} />
            <span>Exportar</span>
          </button>

          <button
            type="button"
            className="primary-button"
            onClick={handleOpenCreate}
          >
            <AppIcon name="plus" size={16} color="#fff" />
            <span>Nuevo cliente</span>
          </button>
        </div>
      </div>

      {/* 2. KPI Statistics Grid */}
      <CustomerStats stats={stats} loading={statsLoading} />

      {/* 3. Filter Toolbar */}
      <CustomerFilters
        filters={filters}
        onFilterChange={setFilter}
        onResetFilters={resetFilters}
        cities={cities}
      />

      {/* 4. Error state alert */}
      {error && (
        <div
          style={{
            padding: '14px 18px',
            borderRadius: 10,
            background: '#fef2f2',
            border: '1.5px solid #fecaca',
            color: '#dc2626',
            fontSize: 13,
            fontWeight: 600,
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <AppIcon name="warning" size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* 5. Main Customer Table */}
      <CustomerTable
        customers={customers}
        loading={loading}
        total={total}
        page={page}
        pageSize={pageSize}
        totalPages={totalPages}
        sortBy={filters.sortBy}
        sortDirection={filters.sortDirection}
        onSort={(field) => {
          const isSame = filters.sortBy === field
          const newDir = isSame && filters.sortDirection === 'asc' ? 'desc' : 'asc'
          setFilter('sortBy', field)
          setFilter('sortDirection', newDir)
        }}
        onPageChange={(p) => setFilter('page', p)}
        onViewDetail={handleViewDetail}
        onEdit={handleOpenEdit}
        onAddPayment={handleOpenPayment}
        onDeactivate={handleOpenDeactivate}
        onReactivate={(c) => reactivateCustomer(c.id)}
      />

      {/* 6. Form Drawer (Create & Edit) */}
      <CustomerFormDrawer
        isOpen={isFormDrawerOpen}
        customerToEdit={customerToEdit}
        onClose={() => setIsFormDrawerOpen(false)}
        onSubmit={handleFormSubmit}
        locations={locations}
      />

      {/* 7. Detail Drawer (8 Animated Tabs) */}
      <CustomerDetailDrawer
        isOpen={isDetailDrawerOpen}
        customer={customerDetail}
        loading={detailLoading}
        onClose={() => setIsDetailDrawerOpen(false)}
        onEdit={() => {
          if (customerDetail) {
            handleOpenEdit(customerDetail)
          }
        }}
        onAddPayment={() => {
          if (customerDetail) {
            handleOpenPayment(customerDetail)
          }
        }}
        onAddDocument={async (dto) => {
          await addDetailDocument(dto)
        }}
      />

      {/* 8. Payment Modal */}
      <CustomerPaymentModal
        isOpen={isPaymentModalOpen}
        customer={customerForPayment}
        invoices={customerDetail?.invoices || []}
        onClose={() => setIsPaymentModalOpen(false)}
        onSubmit={handlePaymentSubmit}
      />

      {/* 9. Deactivate Modal */}
      <CustomerDeactivateModal
        isOpen={isDeactivateModalOpen}
        customer={customerForDeactivate}
        onClose={() => setIsDeactivateModalOpen(false)}
        onConfirm={async (id, reason) => {
          await deactivateCustomer(id, reason)
        }}
      />
    </div>
  )
}
