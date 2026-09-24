/**
 * SUPER MÁS ERP/POS - Motor de Reglas Contables Automáticas (accountingRulesService)
 *
 * Transforma eventos operativos de compras, ventas, facturación, costo de ventas,
 * recaudos y pagos en asientos contables estrictamente balanceados (Partida Doble).
 */

import { accountingRepository } from '../repositories/accounting.repository'
import { AccountingEntry, AccountingEntryLine } from '../types'
import { db } from '@/lib/supabase/db'

export class AccountingRulesService {
  /**
   * Resuelve cuentas contables de inventario, costo e ingreso según producto, categoría o tipo
   */
  async resolveProductAccounts(criteria?: {
    productId?: string
    category?: string
    inventoryType?: string
  } | string): Promise<{
    inventoryAccountId: string
    inventoryAccountCode: string
    inventoryAccountName: string
    costAccountId: string
    costAccountCode: string
    costAccountName: string
    revenueAccountId: string
    revenueAccountCode: string
    revenueAccountName: string
  }> {
    const mappings = await accountingRepository.getCategoryMappings()
    let category = typeof criteria === 'string' ? criteria : criteria?.category
    let inventoryType = typeof criteria === 'object' ? criteria?.inventoryType : undefined
    const productId = typeof criteria === 'object' ? criteria?.productId : undefined

    if (productId && (!category || !inventoryType)) {
      const prod = ((db.products as any[]) || []).find((p) => p.id === productId)
      if (prod) {
        if (!category) category = prod.category
        if (!inventoryType) inventoryType = prod.inventoryType
      }
    }

    // 1. Prioridad: Buscar por Tipo de Inventario (RAW_MATERIAL, WORK_IN_PROCESS, FINISHED_GOOD, MERCHANDISE)
    let matched = inventoryType ? mappings.find((m) => m.inventoryType === inventoryType) : undefined

    // 2. Si no hay match por tipo, buscar por coincidencia en categoría
    if (!matched && category) {
      const catLower = category.toLowerCase().trim()
      matched = mappings.find((m) =>
        m.categoryName.toLowerCase().includes(catLower) ||
        catLower.includes(m.categoryName.toLowerCase())
      )
    }

    // 3. Fallback al mapeo predeterminado de mercancías
    if (!matched) {
      matched = mappings.find((m) => m.inventoryType === 'MERCHANDISE') || mappings[0]
    }

    if (matched) {
      return {
        inventoryAccountId: matched.inventoryAccountId,
        inventoryAccountCode: matched.inventoryAccountCode,
        inventoryAccountName: matched.inventoryAccountName,
        costAccountId: matched.costAccountId,
        costAccountCode: matched.costAccountCode,
        costAccountName: matched.costAccountName,
        revenueAccountId: matched.revenueAccountId,
        revenueAccountCode: matched.revenueAccountCode,
        revenueAccountName: matched.revenueAccountName,
      }
    }

    return {
      inventoryAccountId: 'acc-143501',
      inventoryAccountCode: '143501',
      inventoryAccountName: 'Inventario - Abarrotes y Granos',
      costAccountId: 'acc-613501',
      costAccountCode: '613501',
      costAccountName: 'Costo de Venta - Abarrotes y Granos',
      revenueAccountId: 'acc-413501',
      revenueAccountCode: '413501',
      revenueAccountName: 'Venta de Abarrotes y Víveres',
    }
  }

  /**
   * Genera el comprobante contable automático para una COMPRA de mercancías
   * DEBE: Inventario (1435) + IVA descontable (240810)
   * HABER: Proveedores (2205) o Caja/Banco (1105/1110)
   */
  async generatePurchaseEntry(purchase: any, user: { id: string; name: string }): Promise<AccountingEntry> {
    const date = purchase.date || new Date().toISOString()
    const period = date.substring(0, 7)
    const isPeriodOpen = await accountingRepository.isPeriodOpen(period)
    if (!isPeriodOpen) {
      throw new Error(`El periodo contable ${period} se encuentra CERRADO. No es posible generar comprobantes de compra en periodos clausurados.`)
    }
    const lines: AccountingEntryLine[] = []

    // 1. Débito a Inventario por valor antes de impuestos
    const subtotal = purchase.subtotal || purchase.totalCost || (purchase.total - (purchase.taxTotal || 0))
    const firstItem = purchase.items?.[0]
    const accounts = await this.resolveProductAccounts({
      productId: firstItem?.productId,
      category: firstItem?.category,
      inventoryType: firstItem?.inventoryType,
    })

    lines.push({
      id: `line-pur-inv-${Date.now()}`,
      accountId: accounts.inventoryAccountId,
      accountCode: accounts.inventoryAccountCode,
      accountName: accounts.inventoryAccountName,
      debit: subtotal,
      credit: 0,
      description: `Ingreso de mercancía según factura compra ${purchase.purchaseNumber || purchase.id}`,
    })

    // 2. Débito a IVA Descontable si causó impuesto
    const taxTotal = purchase.taxTotal || 0
    if (taxTotal > 0) {
      lines.push({
        id: `line-pur-tax-${Date.now()}`,
        accountId: 'acc-240810',
        accountCode: '240810',
        accountName: 'IVA Descontable en Compras de Inventario (19%)',
        debit: taxTotal,
        credit: 0,
        taxConfigId: 'tax-19',
        taxRatePercent: 19,
        baseAmount: subtotal,
        description: `IVA descontable compras soportado en factura proveedor ${purchase.supplierInvoiceNumber || ''}`,
      })
    }

    // 3. Crédito a Proveedores o Caja/Banco
    const totalPayable = subtotal + taxTotal
    const isCash = purchase.paymentTerms === 'CONTADO' || purchase.paymentType === 'EFECTIVO'

    lines.push({
      id: `line-pur-pay-${Date.now()}`,
      accountId: isCash ? 'acc-110505' : 'acc-220505',
      accountCode: isCash ? '110505' : '220505',
      accountName: isCash ? 'Caja General y Puntos de Venta' : 'Proveedores Nacionales de Mercancías',
      debit: 0,
      credit: totalPayable,
      description: `Obligación con proveedor ${purchase.supplierName || 'Proveedor Nacional'}`,
    })

    const totalDebit = lines.reduce((acc, l) => acc + l.debit, 0)
    const totalCredit = lines.reduce((acc, l) => acc + l.credit, 0)

    const entry: AccountingEntry = {
      id: `entry-pur-${purchase.id || Date.now()}`,
      entryNumber: `AST-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`,
      date,
      period,
      sourceType: 'PURCHASE',
      sourceId: purchase.id,
      documentNumber: purchase.purchaseNumber || purchase.supplierInvoiceNumber,
      description: `Causación contable compra de mercancías proveedor ${purchase.supplierName || ''}`,
      status: 'POSTED',
      locationId: purchase.locationId || purchase.destinationLocationId,
      locationName: purchase.destinationLocationName || 'Bodega Principal',
      thirdPartyId: purchase.supplierId,
      thirdPartyName: purchase.supplierName,
      thirdPartyDoc: purchase.supplierNit,
      lines,
      totalDebit,
      totalCredit,
      isBalanced: Math.abs(totalDebit - totalCredit) < 0.01,
      createdByUserId: user.id,
      createdByUserName: user.name,
      confirmedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    }

    return entry
  }

  /**
   * Genera el comprobante contable automático para una VENTA / Factura Electrónica
   * DEBE: Cliente (1305) o Caja/Banco (1105/1110)
   * HABER: Ingresos (4135) + IVA generado (240805 / 240806)
   */
  async generateSaleEntry(sale: any, user: { id: string; name: string }): Promise<AccountingEntry> {
    const date = sale.date || new Date().toISOString()
    const period = date.substring(0, 7)
    const isPeriodOpen = await accountingRepository.isPeriodOpen(period)
    if (!isPeriodOpen) {
      throw new Error(`El periodo contable ${period} se encuentra CERRADO. No es posible generar comprobantes de venta en periodos clausurados.`)
    }
    const lines: AccountingEntryLine[] = []

    const subtotal = sale.subtotal || sale.totalAmount - (sale.taxTotal || 0)
    const taxTotal = sale.taxTotal || 0
    const grandTotal = sale.totalAmount || sale.total || subtotal + taxTotal

    const isCredit =
      sale.paymentMethod === 'CREDITO' ||
      sale.customerCategory === 'WHOLESALE' ||
      sale.paymentStatus === 'PARTIALLY_PAID' ||
      sale.paymentStatus === 'PAYMENT_PENDING'

    // 1. Débito a Clientes o Caja/Bancos por el total facturado
    lines.push({
      id: `line-sale-cxc-${Date.now()}`,
      accountId: isCredit
        ? 'acc-130505'
        : sale.paymentMethod === 'TRANSFERENCIA'
        ? 'acc-111005'
        : 'acc-110505',
      accountCode: isCredit ? '130505' : sale.paymentMethod === 'TRANSFERENCIA' ? '111005' : '110505',
      accountName: isCredit
        ? 'Clientes Nacionales'
        : sale.paymentMethod === 'TRANSFERENCIA'
        ? 'Bancos Nacionales (Bancolombia)'
        : 'Caja General y Puntos de Venta',
      debit: grandTotal,
      credit: 0,
      description: `Cuentas por cobrar / recaudo venta ${sale.saleNumber || sale.id}`,
    })

    // 2. Crédito a Ingresos Operacionales
    const firstItem = sale.items?.[0]
    const accounts = await this.resolveProductAccounts({
      productId: firstItem?.productId,
      category: firstItem?.category,
      inventoryType: firstItem?.inventoryType,
    })

    lines.push({
      id: `line-sale-rev-${Date.now()}`,
      accountId: accounts.revenueAccountId,
      accountCode: accounts.revenueAccountCode,
      accountName: accounts.revenueAccountName,
      debit: 0,
      credit: subtotal,
      description: `Ingreso operacional por venta de mercancías ${sale.customerName || ''}`,
    })

    // 3. Crédito a IVA Generado si aplica
    if (taxTotal > 0) {
      lines.push({
        id: `line-sale-tax-${Date.now()}`,
        accountId: 'acc-240805',
        accountCode: '240805',
        accountName: 'IVA Generado en Ventas (19%)',
        debit: 0,
        credit: taxTotal,
        taxConfigId: 'tax-19',
        taxRatePercent: 19,
        baseAmount: subtotal,
        description: `IVA generado tarifa general ventas ${sale.documentNumber || sale.saleNumber || ''}`,
      })
    }

    const totalDebit = lines.reduce((acc, l) => acc + l.debit, 0)
    const totalCredit = lines.reduce((acc, l) => acc + l.credit, 0)

    const entry: AccountingEntry = {
      id: `entry-sale-${sale.id || Date.now()}`,
      entryNumber: `AST-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`,
      date,
      period,
      sourceType: 'SALE',
      sourceId: sale.id,
      documentNumber: sale.saleNumber || sale.documentNumber,
      description: `Contabilización de venta a ${sale.customerName || 'Cliente'}`,
      status: 'POSTED',
      locationId: sale.locationId,
      locationName: sale.locationName || 'Bodega Principal',
      thirdPartyId: sale.customerId,
      thirdPartyName: sale.customerName,
      thirdPartyDoc: sale.customerDoc,
      lines,
      totalDebit,
      totalCredit,
      isBalanced: Math.abs(totalDebit - totalCredit) < 0.01,
      createdByUserId: user.id,
      createdByUserName: user.name,
      confirmedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    }

    return entry
  }

  /**
   * Genera el asiento contable del COSTO DE VENTAS (baja de inventario)
   * DEBE: Costo de mercancía vendida (6135)
   * HABER: Inventario (1435)
   */
  async generateCostOfSalesEntry(sale: any, user: { id: string; name: string }): Promise<AccountingEntry> {
    const cost = Number(sale.totalCost) || 0
    if (cost <= 0) {
      throw new Error('No se puede generar asiento de costo de ventas con costo 0.')
    }

    const date = sale.date || new Date().toISOString()
    const period = date.substring(0, 7)
    const isPeriodOpen = await accountingRepository.isPeriodOpen(period)
    if (!isPeriodOpen) {
      throw new Error(`El periodo contable ${period} se encuentra CERRADO. No es posible causar costo de ventas en periodos clausurados.`)
    }
    const firstItem = sale.items?.[0]
    const accounts = await this.resolveProductAccounts({
      productId: firstItem?.productId,
      category: firstItem?.category,
      inventoryType: firstItem?.inventoryType,
    })

    const lines: AccountingEntryLine[] = [
      {
        id: `line-cos-deb-${Date.now()}`,
        accountId: accounts.costAccountId,
        accountCode: accounts.costAccountCode,
        accountName: accounts.costAccountName,
        debit: cost,
        credit: 0,
        description: `Causación costo de venta factura ${sale.saleNumber || sale.documentNumber || sale.id}`,
      },
      {
        id: `line-cos-crd-${Date.now()}`,
        accountId: accounts.inventoryAccountId,
        accountCode: accounts.inventoryAccountCode,
        accountName: accounts.inventoryAccountName,
        debit: 0,
        credit: cost,
        description: `Salida de inventario a costo promedio venta ${sale.saleNumber || sale.id}`,
      },
    ]

    const entry: AccountingEntry = {
      id: `entry-cos-${sale.id || Date.now()}`,
      entryNumber: `AST-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`,
      date,
      period,
      sourceType: 'COST_OF_SALES',
      sourceId: sale.id,
      documentNumber: sale.saleNumber || sale.documentNumber,
      description: `Causación costo mercancía vendida ${sale.saleNumber || sale.documentNumber || ''}`,
      status: 'POSTED',
      locationId: sale.locationId,
      locationName: sale.locationName || 'Bodega Principal',
      thirdPartyId: sale.customerId,
      thirdPartyName: sale.customerName,
      thirdPartyDoc: sale.customerDoc,
      lines,
      totalDebit: cost,
      totalCredit: cost,
      isBalanced: true,
      createdByUserId: user.id,
      createdByUserName: user.name,
      confirmedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    }

    return entry
  }

  /**
   * Genera comprobante de PAGO A PROVEEDOR
   * DEBE: Proveedor Nacional (220505)
   * HABER: Banco o Caja (111005 / 110505)
   */
  async generateSupplierPaymentEntry(
    payment: {
      id: string
      supplierId: string
      supplierName: string
      supplierDoc?: string
      amount: number
      paymentMethod: 'TRANSFERENCIA' | 'EFECTIVO' | 'CHEQUE'
      reference: string
      date?: string
      locationId?: string
    },
    user: { id: string; name: string }
  ): Promise<AccountingEntry> {
    const date = payment.date || new Date().toISOString()
    const isPeriodOpen = await accountingRepository.isPeriodOpen(date)
    if (!isPeriodOpen) {
      throw new Error(`El periodo contable ${date.slice(0, 7)} se encuentra CERRADO. No es posible registrar pagos en periodos clausurados.`)
    }
    const isBank = payment.paymentMethod === 'TRANSFERENCIA'

    const lines: AccountingEntryLine[] = [
      {
        id: `line-spay-deb-${Date.now()}`,
        accountId: 'acc-220505',
        accountCode: '220505',
        accountName: 'Proveedores Nacionales de Mercancías',
        debit: payment.amount,
        credit: 0,
        description: `Disminución pasivo proveedor ${payment.supplierName}`,
      },
      {
        id: `line-spay-crd-${Date.now()}`,
        accountId: isBank ? 'acc-111005' : 'acc-110505',
        accountCode: isBank ? '111005' : '110505',
        accountName: isBank ? 'Bancos Nacionales (Bancolombia)' : 'Caja General y Puntos de Venta',
        debit: 0,
        credit: payment.amount,
        description: `Egreso de fondos por pago a proveedor Ref: ${payment.reference}`,
      },
    ]

    return {
      id: `entry-spay-${payment.id || Date.now()}`,
      entryNumber: `AST-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`,
      date,
      period: date.substring(0, 7),
      sourceType: 'SUPPLIER_PAYMENT',
      sourceId: payment.id,
      documentNumber: payment.reference,
      description: `Egreso pago a proveedor ${payment.supplierName}`,
      status: 'POSTED',
      locationId: payment.locationId,
      thirdPartyId: payment.supplierId,
      thirdPartyName: payment.supplierName,
      thirdPartyDoc: payment.supplierDoc,
      lines,
      totalDebit: payment.amount,
      totalCredit: payment.amount,
      isBalanced: true,
      createdByUserId: user.id,
      createdByUserName: user.name,
      confirmedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    }
  }

  /**
   * Genera comprobante de RECAUDO / PAGO DE CLIENTE
   * DEBE: Caja o Bancos (110505 / 111005)
   * HABER: Clientes Nacionales (130505)
   */
  async generateCustomerPaymentEntry(
    payment: {
      id: string
      customerId: string
      customerName: string
      customerDoc?: string
      amount: number
      paymentMethod: 'TRANSFERENCIA' | 'EFECTIVO'
      receiptNumber: string
      date?: string
      locationId?: string
    },
    user: { id: string; name: string }
  ): Promise<AccountingEntry> {
    const date = payment.date || new Date().toISOString()
    const isPeriodOpen = await accountingRepository.isPeriodOpen(date)
    if (!isPeriodOpen) {
      throw new Error(`El periodo contable ${date.slice(0, 7)} se encuentra CERRADO. No es posible registrar recaudos en periodos clausurados.`)
    }
    const isBank = payment.paymentMethod === 'TRANSFERENCIA'

    const lines: AccountingEntryLine[] = [
      {
        id: `line-cpay-deb-${Date.now()}`,
        accountId: isBank ? 'acc-111005' : 'acc-110505',
        accountCode: isBank ? '111005' : '110505',
        accountName: isBank ? 'Bancos Nacionales (Bancolombia)' : 'Caja General y Puntos de Venta',
        debit: payment.amount,
        credit: 0,
        description: `Ingreso de fondos por recaudo cliente ${payment.receiptNumber}`,
      },
      {
        id: `line-cpay-crd-${Date.now()}`,
        accountId: 'acc-130505',
        accountCode: '130505',
        accountName: 'Clientes Nacionales',
        debit: 0,
        credit: payment.amount,
        description: `Abono a cartera comercial ${payment.customerName}`,
      },
    ]

    return {
      id: `entry-cpay-${payment.id || Date.now()}`,
      entryNumber: `AST-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`,
      date,
      period: date.substring(0, 7),
      sourceType: 'CUSTOMER_PAYMENT',
      sourceId: payment.id,
      documentNumber: payment.receiptNumber,
      description: `Recaudo de cartera cliente ${payment.customerName}`,
      status: 'POSTED',
      locationId: payment.locationId,
      thirdPartyId: payment.customerId,
      thirdPartyName: payment.customerName,
      thirdPartyDoc: payment.customerDoc,
      lines,
      totalDebit: payment.amount,
      totalCredit: payment.amount,
      isBalanced: true,
      createdByUserId: user.id,
      createdByUserName: user.name,
      confirmedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    }
  }
}

export const accountingRulesService = new AccountingRulesService()
