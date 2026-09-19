'use client'

import React from 'react'
import Link from 'next/link'
import { useReports } from '../hooks/useReports'
import { ReportType } from '../types'
import { ReportHeader } from './ReportHeader'
import { ReportFilterBar } from './ReportFilterBar'
import { ReportSkeleton } from './ReportSkeleton'
import { ReportToast } from './ReportToast'
import { ReportItemDetailDrawer } from './drawers/ReportItemDetailDrawer'
import { Footer } from '@/components/Footer'

// Vistas individuales
import { ReportDashboardView } from './views/ReportDashboardView'
import { SalesReportView } from './views/SalesReportView'
import { PurchasesReportView } from './views/PurchasesReportView'
import { InventoryReportView } from './views/InventoryReportView'
import { KardexReportView } from './views/KardexReportView'
import { CostsReportView } from './views/CostsReportView'
import { WarehousesReportView } from './views/WarehousesReportView'
import { CustomersReportView } from './views/CustomersReportView'
import { SuppliersReportView } from './views/SuppliersReportView'
import { CashRegistersReportView } from './views/CashRegistersReportView'
import { BillingReportView } from './views/BillingReportView'
import { AccountingReportView } from './views/AccountingReportView'
import { EcommerceReportView } from './views/EcommerceReportView'

interface ReportsHubPageProps {
  initialReportType?: ReportType
}

const REPORT_TITLES: Record<ReportType, { title: string; desc: string; category?: string }> = {
  OVERVIEW: {
    title: 'Reportes y Analítica',
    desc: 'Analiza la información comercial, operativa y financiera de Super Más.',
  },
  SALES: {
    title: 'Reporte de Ventas',
    desc: 'Evolución de ingresos, facturas emitidas, ticket promedio y rendimiento de vendedores.',
    category: 'Ventas',
  },
  PURCHASES: {
    title: 'Reporte de Compras',
    desc: 'Abastecimiento, órdenes a proveedores, pagos de contado y financiamiento a crédito.',
    category: 'Compras',
  },
  INVENTORY: {
    title: 'Reporte de Inventario',
    desc: 'Existencias consolidadas, valorización de stock y control de unidades agotadas.',
    category: 'Inventario',
  },
  KARDEX: {
    title: 'Kardex Valorizado',
    desc: 'Historial auditado de entradas, salidas, transferencias y saldos resultantes.',
    category: 'Kardex',
  },
  COSTS: {
    title: 'Costos y Utilidad',
    desc: 'Costo de mercancía vendida (CMV), utilidad bruta y márgenes porcentuales por producto.',
    category: 'Costos y Utilidad',
  },
  WAREHOUSES: {
    title: 'Desempeño por Bodega',
    desc: 'Métricas operativas y herramienta de benchmark comparativo entre bodegas.',
    category: 'Bodegas',
  },
  CUSTOMERS: {
    title: 'Reporte de Clientes',
    desc: 'Comportamiento comercial, frecuencia de compra, ticket promedio y cartera por cobrar.',
    category: 'Clientes',
  },
  SUPPLIERS: {
    title: 'Reporte de Proveedores',
    desc: 'Volumen adquirido, histórico de abastecimiento y cuentas por pagar pendientes.',
    category: 'Proveedores',
  },
  CASH: {
    title: 'Cajas Registradoras',
    desc: 'Control de turnos, aperturas, arqueos de cierre, efectivo real y diferencias.',
    category: 'Cajas',
  },
  BILLING: {
    title: 'Facturación Electrónica',
    desc: 'Validaciones ante la DIAN, código CUFE, notas crédito e impuestos recaudados.',
    category: 'Facturación',
  },
  ACCOUNTING: {
    title: 'Reporte Contable PUC',
    desc: 'Balance general, estado de resultados (P&L) y libros contables de doble partida.',
    category: 'Contabilidad',
  },
  ECOMMERCE: {
    title: 'Reporte Ecommerce Web',
    desc: 'Ventas online, conversión en carrito, tiempos de preparación y comparativa vs POS.',
    category: 'Ecommerce',
  },
}

export function ReportsHubPage({ initialReportType = 'OVERVIEW' }: ReportsHubPageProps) {
  const {
    loading,
    error,
    toastMessage,
    showToast,
    reportType,
    setReportType,
    period,
    setPeriod,
    locationId,
    setLocationId,
    secondLocationId,
    setSecondLocationId,
    categoryId,
    setCategoryId,
    searchQuery,
    setSearchQuery,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    filterOptions,
    navCards,
    dashboardData,
    salesData,
    purchasesData,
    inventoryData,
    kardexData,
    costsData,
    warehousesData,
    customersData,
    suppliersData,
    cashData,
    billingData,
    accountingData,
    ecommerceData,
    detailItem,
    setDetailItem,
    exportReport,
    refetch,
  } = useReports({
    initialType: initialReportType,
  })

  const currentMeta = REPORT_TITLES[reportType] || REPORT_TITLES.OVERVIEW

  return (
    <div className="min-h-screen bg-slate-50/50 text-slate-900 flex flex-col justify-between">
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
        {/* Header con migas de pan y filtros globales */}
        <ReportHeader
          title={currentMeta.title}
          description={currentMeta.desc}
          categoryName={currentMeta.category}
          period={period}
          setPeriod={setPeriod}
          locationId={locationId}
          setLocationId={setLocationId}
          locations={filterOptions.locations}
          periods={filterOptions.periods}
          onExport={exportReport}
          onRefresh={refetch}
          loading={loading}
        />

        {/* Pestañas de Navegación Rápida entre Módulos Analíticos */}
        <div className="tabs" role="tablist" aria-label="Módulos de Reportes">
          {[
            { id: 'OVERVIEW', label: 'Resumen General' },
            { id: 'SALES', label: 'Ventas' },
            { id: 'PURCHASES', label: 'Compras' },
            { id: 'INVENTORY', label: 'Inventario' },
            { id: 'KARDEX', label: 'Kardex' },
            { id: 'COSTS', label: 'Costos & CMV' },
            { id: 'WAREHOUSES', label: 'Bodegas' },
            { id: 'CUSTOMERS', label: 'Clientes' },
            { id: 'SUPPLIERS', label: 'Proveedores' },
            { id: 'CASH', label: 'Cajas' },
            { id: 'BILLING', label: 'Facturación DIAN' },
            { id: 'ACCOUNTING', label: 'Contabilidad' },
            { id: 'ECOMMERCE', label: 'Ecommerce' },
          ].map((tab) => {
            const isActive = reportType === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={isActive ? 'active' : ''}
                onClick={() => setReportType(tab.id as ReportType)}
              >
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Barra de Filtros Contextuales (no requerida en Dashboard general si no se busca) */}
        {reportType !== 'OVERVIEW' && (
          <ReportFilterBar
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            searchPlaceholder={`Buscar en ${currentMeta.title}...`}
            categoryId={categoryId}
            setCategoryId={['INVENTORY', 'SALES', 'COSTS'].includes(reportType) ? setCategoryId : undefined}
            categories={filterOptions.categories}
            period={period}
            startDate={startDate}
            setStartDate={setStartDate}
            endDate={endDate}
            setEndDate={setEndDate}
            showWarehouseComparison={reportType === 'WAREHOUSES'}
            locationId={locationId}
            secondLocationId={secondLocationId}
            setSecondLocationId={setSecondLocationId}
            locations={filterOptions.locations}
            onReset={() => {
              setSearchQuery('')
              setCategoryId('ALL')
            }}
          />
        )}

        {/* Mensaje de Error si ocurre */}
        {error && (
          <div className="p-4 mb-6 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-center justify-between">
            <span>{error}</span>
            <button
              onClick={refetch}
              className="px-2.5 py-1 rounded bg-rose-900/60 hover:bg-rose-800 text-white font-semibold transition-colors"
            >
              Reintentar
            </button>
          </div>
        )}

        {/* Contenido Principal con Skeleton o Vista Activa */}
        {loading && !dashboardData && !salesData && !inventoryData ? (
          <ReportSkeleton />
        ) : (
          <main>
            {reportType === 'OVERVIEW' && (
              <ReportDashboardView
                data={dashboardData}
                navCards={navCards}
                loading={loading}
              />
            )}

            {reportType === 'SALES' && (
              <SalesReportView
                data={salesData}
                loading={loading}
                onViewDetail={(row) =>
                  setDetailItem({
                    type: 'SALE',
                    id: row.id,
                    title: `Venta ${row.invoiceNumber}`,
                    data: row,
                  })
                }
              />
            )}

            {reportType === 'PURCHASES' && (
              <PurchasesReportView
                data={purchasesData}
                loading={loading}
                onViewDetail={(row) =>
                  setDetailItem({
                    type: 'PURCHASE',
                    id: row.id,
                    title: `Compra ${row.purchaseNumber}`,
                    data: row,
                  })
                }
              />
            )}

            {reportType === 'INVENTORY' && (
              <InventoryReportView
                data={inventoryData}
                loading={loading}
                onViewDetail={(row) =>
                  setDetailItem({
                    type: 'PRODUCT',
                    id: row.productId,
                    title: `Producto ${row.sku} - ${row.name}`,
                    data: row,
                  })
                }
              />
            )}

            {reportType === 'KARDEX' && (
              <KardexReportView
                data={kardexData}
                loading={loading}
                onViewDetail={(row) =>
                  setDetailItem({
                    type: 'PRODUCT',
                    id: row.productId,
                    title: `Movimiento ${row.reference}`,
                    data: row,
                  })
                }
              />
            )}

            {reportType === 'COSTS' && (
              <CostsReportView
                data={costsData}
                loading={loading}
                onViewDetail={(row) =>
                  setDetailItem({
                    type: 'PRODUCT',
                    id: row.productId,
                    title: `Rentabilidad ${row.sku}`,
                    data: row,
                  })
                }
              />
            )}

            {reportType === 'WAREHOUSES' && (
              <WarehousesReportView
                data={warehousesData}
                loading={loading}
                selectedLocationId={locationId}
                secondLocationId={secondLocationId}
                onSelectWarehouse={setLocationId}
                onSelectSecondWarehouse={setSecondLocationId}
              />
            )}

            {reportType === 'CUSTOMERS' && (
              <CustomersReportView
                data={customersData}
                loading={loading}
                onViewDetail={(row) =>
                  setDetailItem({
                    type: 'CUSTOMER',
                    id: row.customerId,
                    title: `Cliente ${row.name}`,
                    data: row,
                  })
                }
              />
            )}

            {reportType === 'SUPPLIERS' && (
              <SuppliersReportView
                data={suppliersData}
                loading={loading}
                onViewDetail={(row) =>
                  setDetailItem({
                    type: 'SUPPLIER',
                    id: row.supplierId,
                    title: `Proveedor ${row.name}`,
                    data: row,
                  })
                }
              />
            )}

            {reportType === 'CASH' && (
              <CashRegistersReportView
                data={cashData}
                loading={loading}
                onViewDetail={(row) =>
                  setDetailItem({
                    type: 'REGISTER',
                    id: row.id,
                    title: `Caja ${row.code} - ${row.name}`,
                    data: row,
                  })
                }
              />
            )}

            {reportType === 'BILLING' && (
              <BillingReportView
                data={billingData}
                loading={loading}
                onViewDetail={(row) =>
                  setDetailItem({
                    type: 'SALE',
                    id: row.id,
                    title: `Factura ${row.invoiceNumber}`,
                    data: row,
                  })
                }
              />
            )}

            {reportType === 'ACCOUNTING' && (
              <AccountingReportView
                data={accountingData}
                loading={loading}
              />
            )}

            {reportType === 'ECOMMERCE' && (
              <EcommerceReportView
                data={ecommerceData}
                loading={loading}
              />
            )}
          </main>
        )}

        {/* Drawer de Detalle Analítico */}
        <ReportItemDetailDrawer
          item={detailItem}
          onClose={() => setDetailItem(null)}
        />

        {/* Notificaciones flotantes */}
        <ReportToast
          message={toastMessage}
          onClose={() => showToast('', 'info')}
        />
      </div>

      {/* Footer Reglamentario Oficial (Reglas 29-32) */}
      <Footer isDark={false} />
    </div>
  )
}
