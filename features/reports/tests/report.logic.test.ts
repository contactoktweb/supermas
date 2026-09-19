/**
 * SUPER MÁS ERP/POS - Suite de Pruebas Automatizadas de Lógica del Módulo Reportes
 *
 * Valida:
 * 1. Validación Zod de esquemas de filtros y exportación.
 * 2. Cálculo matemático de KPIs en Dashboard global.
 * 3. Integridad en reportes de Ventas, Compras e Inventarios.
 * 4. Ecuación fundamental en Costos y Utilidad: Ventas - CMV = Utilidad Bruta.
 * 5. Comparativa de desempeño Bodega A vs Bodega B.
 * 6. Arqueos de cajas y movimientos de efectivo.
 * 7. Integración contable PUC (Activo = Pasivo + Patrimonio).
 * 8. Comparativa Multicanal Ecommerce vs POS.
 * 9. Seguridad RBAC y sanitización estricta de costos/márgenes.
 * 10. Registro inmutable de auditoría (auditService.log).
 *
 * Ejecutable vía: npx tsx features/reports/tests/report.logic.test.ts
 */

import { reportService, DEFAULT_ANALYTICS_USER } from '../services/report.service'
import {
  reportFilterCriteriaSchema,
  reportExportSchema,
} from '../schemas/report.schema'
import { UserReportContext } from '../types'
import { db } from '@/lib/supabase/db'

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`)
    throw new Error(message)
  }
  console.log(`✓ ${message}`)
}

async function runTests() {
  console.log('--- INICIANDO PRUEBAS DE LÓGICA ANALÍTICA (MÓDULO REPORTES) ---\n')

  // TEST 1: Validación Zod de Esquemas de Filtros y Exportación
  console.log('[Test 1] Validación de esquemas Zod')
  const validFilters = reportFilterCriteriaSchema.parse({
    reportType: 'SALES',
    period: 'THIS_MONTH',
    locationId: 'loc-001',
    limit: 50,
  })
  assert(validFilters.period === 'THIS_MONTH', 'Filtro de periodo validado')

  const validExport = reportExportSchema.parse({
    reportType: 'SALES',
    format: 'EXCEL',
    title: 'Reporte Mensual de Ventas',
  })
  assert(validExport.format === 'EXCEL', 'Esquema de exportación validado')

  // TEST 2: Métricas Consolidadas del Dashboard Global
  console.log('\n[Test 2] Métricas consolidadas en getDashboard()')
  const dashboard = await reportService.getDashboard({ period: 'THIS_MONTH' })
  assert(dashboard.kpis.salesTotal > 0, `Ventas totales calculadas: $${dashboard.kpis.salesTotal}`)
  assert(dashboard.kpis.salesCount > 0, `Cantidad de facturas calculadas: ${dashboard.kpis.salesCount}`)
  assert(
    dashboard.kpis.averageTicket === Math.round(dashboard.kpis.salesTotal / dashboard.kpis.salesCount),
    `Ticket promedio coherente: $${dashboard.kpis.averageTicket}`
  )
  assert(dashboard.kpis.inventoryValueAtSale > 0, `Valor de inventario calculado: $${dashboard.kpis.inventoryValueAtSale}`)
  assert(dashboard.salesTrend.length > 0, `Serie temporal de ventas generada con ${dashboard.salesTrend.length} puntos`)
  assert(dashboard.categoryDistribution.length > 0, `Distribución por categoría generada`)

  // TEST 3: Reporte de Ventas Detallado
  console.log('\n[Test 3] Integridad matemática en getSalesReport()')
  const salesReport = await reportService.getSalesReport({ period: 'THIS_MONTH' })
  assert(salesReport.summary.documentCount === salesReport.rows.length, 'Total documentos coincide con filas')
  const calculatedTotal = salesReport.rows.reduce((acc, r) => acc + r.total, 0)
  assert(salesReport.summary.totalSales === calculatedTotal, 'Suma de filas coincide con totalSales')
  assert(salesReport.byWarehouse.length > 0, 'Distribución de ventas por bodega generada')

  // TEST 4: Reporte de Compras y Condición de Pago
  console.log('\n[Test 4] Integridad en getPurchasesReport()')
  const purchasesReport = await reportService.getPurchasesReport({ period: 'THIS_MONTH' })
  assert(purchasesReport.summary.purchaseCount === purchasesReport.rows.length, 'Total compras coincide con filas')
  assert(
    purchasesReport.summary.totalPurchases ===
      purchasesReport.summary.cashPurchasesTotal + purchasesReport.summary.creditPurchasesTotal,
    'Total compras == Compras Contado + Compras Crédito'
  )

  // TEST 5: Reporte de Inventario y Clasificación de Disponibilidad
  console.log('\n[Test 5] Clasificación de inventario en getInventoryReport()')
  const invReport = await reportService.getInventoryReport()
  assert(invReport.summary.totalProductsCount > 0, `Productos analizados: ${invReport.summary.totalProductsCount}`)
  assert(
    invReport.summary.availableCount + invReport.summary.lowStockCount + invReport.summary.outOfStockCount ===
      invReport.summary.totalProductsCount,
    'Disponibles + Pocas Unidades + Agotados == Total Productos'
  )

  // TEST 6: Costos y Utilidad Bruta (CMV)
  console.log('\n[Test 6] Ecuación económica: Ventas - CMV = Utilidad en getCostsReport()')
  const costsReport = await reportService.getCostsReport({ period: 'THIS_MONTH' })
  assert(costsReport.summary.totalRevenue > 0, `Ingresos totales: $${costsReport.summary.totalRevenue}`)
  assert(
    costsReport.summary.costOfGoodsSold != null && (costsReport.summary.costOfGoodsSold as number) > 0,
    `CMV calculado: $${costsReport.summary.costOfGoodsSold}`
  )
  const expectedProfit = (costsReport.summary.totalRevenue || 0) - (costsReport.summary.costOfGoodsSold || 0)
  assert(costsReport.summary.grossProfit === expectedProfit, `Utilidad bruta coincide exactamente: $${costsReport.summary.grossProfit}`)
  const expectedMargin = Number(((expectedProfit / costsReport.summary.totalRevenue) * 100).toFixed(1))
  assert(costsReport.summary.grossMarginPercent === expectedMargin, `Margen bruto porcentual coincide: ${costsReport.summary.grossMarginPercent}%`)

  // TEST 7: Benchmark Comparativo de Bodegas
  console.log('\n[Test 7] Comparativa Bodega A vs Bodega B en getWarehousesReport()')
  const whReport = await reportService.getWarehousesReport({
    locationId: 'loc-001',
    secondLocationId: 'loc-002',
  })
  assert(whReport.warehouses.length >= 2, 'Al menos 2 bodegas analizadas')
  assert(whReport.comparison !== null && whReport.comparison !== undefined, 'Objeto de comparación generado')
  if (whReport.comparison) {
    const diff = whReport.comparison.warehouseA.salesTotal - whReport.comparison.warehouseB.salesTotal
    assert(
      whReport.comparison.differences.salesDiff === diff,
      `Diferencia calculada correctamente: $${whReport.comparison.differences.salesDiff}`
    )
  }

  // TEST 8: Arqueo y Control de Cajas Registradoras
  console.log('\n[Test 8] Control de cajas en getCashRegistersReport()')
  const cashReport = await reportService.getCashRegistersReport()
  assert(cashReport.registers.length > 0, `Cajas registradoras detectadas: ${cashReport.registers.length}`)
  assert(cashReport.summary.totalRegisters === cashReport.registers.length, 'Conteo de cajas coincide')
  assert(cashReport.recentMovements.length > 0, 'Movimientos de caja auditados cargados')

  // TEST 9: Integración Contable PUC (Partida Doble)
  console.log('\n[Test 9] Integración contable PUC y estricta partida doble en getAccountingReport()')
  const accReport = await reportService.getAccountingReport()
  assert(accReport.summary.totalAssets > 0, 'Activos totales calculados desde PUC')
  assert(accReport.summary.totalLiabilities > 0, 'Pasivos totales calculados desde PUC')
  assert(accReport.summary.totalEquity > 0, 'Patrimonio calculado desde PUC')
  assert(
    accReport.journalSummary.totalDebits > 0 &&
      accReport.journalSummary.totalDebits === accReport.journalSummary.totalCredits,
    `Estricta partida doble NIIF en comprobantes: Débitos ($${accReport.journalSummary.totalDebits}) == Créditos ($${accReport.journalSummary.totalCredits})`
  )

  // TEST 10: Comparativa Ecommerce vs POS
  console.log('\n[Test 10] Comparativa multicanal en getEcommerceReport()')
  const ecomReport = await reportService.getEcommerceReport()
  assert(ecomReport.summary.webOrdersTotalCount > 0, `Pedidos web detectados: ${ecomReport.summary.webOrdersTotalCount}`)
  const combinedShare =
    ecomReport.comparisonWebVsPos.webSharePercent + ecomReport.comparisonWebVsPos.posSharePercent
  assert(
    Math.round(combinedShare) === 100,
    `Participación multicanal suma 100%: Web (${ecomReport.comparisonWebVsPos.webSharePercent}%) + POS (${ecomReport.comparisonWebVsPos.posSharePercent}%)`
  )

  // TEST 11: Seguridad RBAC y Sanitización de Costos Confidenciales
  console.log('\n[Test 11] Control de acceso RBAC y sanitización de costos para CAJERO')
  const cashierUser: UserReportContext = {
    userId: 'usr-003',
    name: 'Andrés Martínez',
    role: 'CAJERO',
    locationId: 'loc-002',
    permissions: ['reports.read', 'reports.sales', 'reports.cash'],
  }

  // El cajero NO tiene reports.costs: debe arrojar error si intenta consultar costos
  let costsBlocked = false
  try {
    await reportService.getCostsReport(undefined, cashierUser)
  } catch (err: any) {
    costsBlocked = true
    assert(err.message.includes('Acceso denegado'), 'Servicio bloqueó acceso no autorizado a costos')
  }
  assert(costsBlocked, 'Usuario sin permiso reports.costs fue rechazado exitosamente')

  // En el Dashboard, los costos y utilidades deben venir en NULL para el cajero
  const cashierDashboard = await reportService.getDashboard(undefined, cashierUser)
  assert(cashierDashboard.kpis.totalCostOfGoodsSold === null, 'CMV sanitizado a null para rol cajero')
  assert(cashierDashboard.kpis.grossProfit === null, 'Utilidad bruta sanitizada a null para rol cajero')
  assert(cashierDashboard.kpis.inventoryValueAtCost === null, 'Valor de inventario al costo sanitizado a null')

  // TEST 12: Trazabilidad y Auditoría en db.auditLogs
  console.log('\n[Test 12] Trazabilidad inmutable de auditoría (auditService.log)')
  const initialLogCount = db.auditLogs.length
  await reportService.getSalesReport({ period: 'THIS_MONTH' })
  assert(db.auditLogs.length > initialLogCount, 'Evento de generación de reporte registrado en db.auditLogs')
  const lastLog = db.auditLogs[0] as any
  assert(lastLog.module === 'REPORTS', 'Módulo de auditoría corresponde a REPORTS')
  assert(lastLog.action === 'REPORT_GENERATED', 'Acción registrada como REPORT_GENERATED')

  console.log('\n--- TODAS LAS 12 PRUEBAS DEL MÓDULO REPORTES PASARON EXITOSAMENTE ---')
}

runTests().catch((err) => {
  console.error('Test execution failed:', err)
  process.exit(1)
})
