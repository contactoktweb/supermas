/**
 * SUPER MÁS ERP/POS - Servicio de Negocio de Tesorería (treasuryService)
 *
 * Separa las responsabilidades operativas de flujo de fondos (pagos, recibos,
 * bancos, caja) de las responsabilidades de registro contable oficial (PUC, partida doble).
 *
 * Flujo canónico:
 * 1. Operación (Compra o Factura) genera cuenta por pagar/cobrar.
 * 2. Tesorería programa y efectúa el desembolso/recaudo bancario con soporte.
 * 3. Al confirmarse el desembolso, Tesorería genera de forma automática
 *    el asiento oficial en Contabilidad (Débito: Proveedor 220505, Crédito: Banco 111005).
 */

import { treasuryRepository } from '../repositories/treasury.repository'
import { accountingService } from '@/features/accounting/services/accounting.service'
import { auditService } from '@/features/audit/services/audit.service'
import {
  BankAccount,
  TreasuryPayment,
  TreasuryReceipt,
  TreasuryStats,
} from '../types'

export class TreasuryService {
  async getStats(): Promise<TreasuryStats> {
    return treasuryRepository.getStats()
  }

  async getBankAccounts(): Promise<BankAccount[]> {
    return treasuryRepository.getBankAccounts()
  }

  async getPayments(filters?: {
    status?: string
    bankAccountId?: string
    query?: string
  }): Promise<TreasuryPayment[]> {
    return treasuryRepository.getPayments(filters)
  }

  async getReceipts(filters?: {
    status?: string
    bankAccountId?: string
    query?: string
  }): Promise<TreasuryReceipt[]> {
    return treasuryRepository.getReceipts(filters)
  }

  /**
   * Programa un pago a proveedor en el calendario de tesorería
   */
  async scheduleSupplierPayment(
    data: {
      purchaseId?: string
      purchaseNumber?: string
      supplierInvoiceNumber?: string
      supplierId: string
      supplierName: string
      supplierDoc: string
      bankAccountId: string
      amount: number
      scheduledDate: string
      paymentMethod?: 'TRANSFERENCIA' | 'CHEQUE' | 'EFECTIVO'
      notes?: string
    },
    user: { id: string; name: string; role: string }
  ): Promise<TreasuryPayment> {
    const bank = await treasuryRepository.getBankAccountById(data.bankAccountId)
    if (!bank) {
      throw new Error(`Cuenta bancaria ${data.bankAccountId} no encontrada en tesorería.`)
    }

    const scheduled = await treasuryRepository.createScheduledPayment({
      type: 'SUPPLIER_PAYMENT',
      purchaseId: data.purchaseId,
      purchaseNumber: data.purchaseNumber,
      supplierInvoiceNumber: data.supplierInvoiceNumber,
      thirdPartyType: 'SUPPLIER',
      thirdPartyId: data.supplierId,
      thirdPartyName: data.supplierName,
      thirdPartyDoc: data.supplierDoc,
      bankAccountId: bank.id,
      bankAccountName: `${bank.bankName} (${bank.accountNumber})`,
      paymentMethod: data.paymentMethod || 'TRANSFERENCIA',
      amount: data.amount,
      paymentDate: data.scheduledDate,
      dueDate: data.scheduledDate,
      status: 'SCHEDULED',
      accountingEntryId: null,
      accountingEntryNumber: null,
      debitAccountCode: '220505',
      debitAccountName: 'Proveedores Nacionales',
      creditAccountCode: bank.accountingAccountCode || '111005',
      creditAccountName: bank.accountingAccountName || 'Bancos Nacionales',
      notes: data.notes || `Programación de pago a ${data.supplierName}`,
      createdById: user.id,
      createdByName: user.name,
    })

    await auditService.log({
      action: 'TREASURY_PAYMENT_SCHEDULED' as any,
      module: 'FINANCIAL' as any,
      entityType: 'TREASURY_PAYMENT',
      entityId: scheduled.id,
      entityReference: scheduled.paymentNumber,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      level: 'INFO',
      result: 'SUCCESS',
      details: `Programación de pago ${scheduled.paymentNumber} a proveedor ${scheduled.thirdPartyName} por $${scheduled.amount.toLocaleString()} COP`,
    })

    return scheduled
  }

  /**
   * Ejecuta el desembolso en tesorería y genera automáticamente el comprobante contable
   */
  async executePayment(
    paymentId: string,
    executionData: {
      paymentDate: string
      bankAccountId: string
      referenceNumber: string
      supportDocumentUrl?: string
    },
    user: { id: string; name: string; role: string }
  ): Promise<TreasuryPayment> {
    const payments = await treasuryRepository.getPayments()
    const target = payments.find((p) => p.id === paymentId)
    if (!target) {
      throw new Error(`Pago de tesorería ${paymentId} no encontrado.`)
    }

    const bank = await treasuryRepository.getBankAccountById(executionData.bankAccountId)
    if (!bank) {
      throw new Error(`Cuenta bancaria no existe.`)
    }

    if (bank.currentBalance < target.amount) {
      throw new Error(
        `Saldo insuficiente en ${bank.bankName} ($${bank.currentBalance.toLocaleString()}) para cubrir el desembolso de $${target.amount.toLocaleString()}.`
      )
    }

    // 1. Generar asiento en Contabilidad (Partida Doble oficial)
    // Débito: Cuenta Proveedor (220505) - Disminuye Pasivo
    // Crédito: Cuenta Banco (111005) - Disminuye Activo
    const accountingEntry = await accountingService.createManualEntry(
      {
        date: executionData.paymentDate,
        description: `Pago Tesorería ${target.paymentNumber} a ${target.thirdPartyName}. Ref: ${executionData.referenceNumber}. Factura Proveedor: ${target.supplierInvoiceNumber || '—'}`,
        thirdPartyId: target.thirdPartyId,
        thirdPartyName: target.thirdPartyName,
        thirdPartyDoc: target.thirdPartyDoc,
        lines: [
          {
            accountId: 'acc-220505',
            accountCode: '220505',
            accountName: 'Proveedores Nacionales',
            debit: target.amount,
            credit: 0,
            description: `Cancelación / Abono factura proveedor ${target.thirdPartyName}`,
          },
          {
            accountId: bank.accountingAccountId || 'acc-111005',
            accountCode: bank.accountingAccountCode || '111005',
            accountName: bank.accountingAccountName || 'Bancos Nacionales',
            debit: 0,
            credit: target.amount,
            description: `Egreso bancario ${bank.bankName} comprobante ${target.paymentNumber}`,
          },
        ],
      },
      user
    )

    // 2. Marcar como pagado en Tesorería con vínculo al asiento
    const paidPayment = await treasuryRepository.markPaymentAsPaid(paymentId, {
      paymentDate: executionData.paymentDate,
      bankAccountId: bank.id,
      referenceNumber: executionData.referenceNumber,
      supportDocumentUrl: executionData.supportDocumentUrl,
      accountingEntryId: accountingEntry.id,
      accountingEntryNumber: accountingEntry.entryNumber,
    })

    // 3. Auditoría transversal
    await auditService.log({
      action: 'TREASURY_PAYMENT_EXECUTED' as any,
      module: 'FINANCIAL' as any,
      entityType: 'TREASURY_PAYMENT',
      entityId: paidPayment.id,
      entityReference: `${paidPayment.paymentNumber} -> ${accountingEntry.entryNumber}`,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      level: 'INFO',
      result: 'SUCCESS',
      details: `Desembolso ejecutado por tesorería. Asiento contable ${accountingEntry.entryNumber} generado exitosamente por $${paidPayment.amount.toLocaleString()} COP.`,
    })

    return paidPayment
  }

  /**
   * Registra un recaudo de cartera en tesorería y genera automáticamente el comprobante contable
   */
  async executeCustomerCollection(
    data: {
      customerId: string
      customerName: string
      customerDoc: string
      invoiceId?: string
      invoiceNumber?: string
      bankAccountId: string
      amount: number
      receiptDate: string
      paymentMethod?: 'TRANSFERENCIA' | 'CONSIGNACION' | 'EFECTIVO' | 'TARJETA'
      referenceNumber?: string
      notes?: string
    },
    user: { id: string; name: string; role: string }
  ): Promise<TreasuryReceipt> {
    const bank = await treasuryRepository.getBankAccountById(data.bankAccountId)
    if (!bank) {
      throw new Error(`Cuenta bancaria seleccionada no existe.`)
    }

    // 1. Asiento en Contabilidad:
    // Débito: Bancos / Caja (Aumenta Activo)
    // Crédito: Clientes (Disminuye Cartera)
    const accountingEntry = await accountingService.createManualEntry(
      {
        date: data.receiptDate,
        description: `Recaudo Tesorería de cliente ${data.customerName}. Factura: ${data.invoiceNumber || 'Venta'} Ref: ${data.referenceNumber || '—'}`,
        thirdPartyId: data.customerId,
        thirdPartyName: data.customerName,
        thirdPartyDoc: data.customerDoc,
        lines: [
          {
            accountId: bank.accountingAccountId || 'acc-111005',
            accountCode: bank.accountingAccountCode || '111005',
            accountName: bank.accountingAccountName || 'Bancos Nacionales',
            debit: data.amount,
            credit: 0,
            description: `Ingreso por recaudo cliente ${data.customerName}`,
          },
          {
            accountId: 'acc-130505',
            accountCode: '130505',
            accountName: 'Clientes Nacionales',
            debit: 0,
            credit: data.amount,
            description: `Abono a cartera de cliente ${data.customerName}`,
          },
        ],
      },
      user
    )

    // 2. Registrar en tesorería
    const receipt = await treasuryRepository.createReceipt({
      invoiceId: data.invoiceId,
      invoiceNumber: data.invoiceNumber,
      customerId: data.customerId,
      customerName: data.customerName,
      customerDoc: data.customerDoc,
      bankAccountId: bank.id,
      bankAccountName: `${bank.bankName} (${bank.accountNumber})`,
      paymentMethod: data.paymentMethod || 'TRANSFERENCIA',
      amount: data.amount,
      receiptDate: data.receiptDate,
      referenceNumber: data.referenceNumber,
      status: 'COLLECTED',
      accountingEntryId: accountingEntry.id,
      accountingEntryNumber: accountingEntry.entryNumber,
      debitAccountCode: bank.accountingAccountCode || '111005',
      debitAccountName: bank.accountingAccountName || 'Bancos Nacionales',
      creditAccountCode: '130505',
      creditAccountName: 'Clientes Nacionales',
      notes: data.notes,
    })

    await auditService.log({
      action: 'TREASURY_RECEIPT_REGISTERED' as any,
      module: 'FINANCIAL' as any,
      entityType: 'TREASURY_RECEIPT',
      entityId: receipt.id,
      entityReference: `${receipt.receiptNumber} -> ${accountingEntry.entryNumber}`,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      level: 'INFO',
      result: 'SUCCESS',
      details: `Recaudo registrado en tesorería por $${receipt.amount.toLocaleString()} COP. Asiento contable ${accountingEntry.entryNumber} creado.`,
    })

    return receipt
  }
}

export const treasuryService = new TreasuryService()
