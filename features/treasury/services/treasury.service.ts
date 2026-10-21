/**
 * SUPER MÁS ERP/POS - Servicio de Negocio de Tesorería (treasuryService)
 *
 * Separa las responsabilidades operativas de flujo de fondos (pagos, recibos,
 * bancos, caja) de las responsabilidades de registro contable oficial (PUC, partida doble).
 *
 * Flujo canónico:
 * 1. Operación (Compra o Factura) genera cuenta por pagar/cobrar.
 * 2. Tesorería programa y efectúa el desembolso/recaudo bancario con soporte.
 * 3. El servidor ejecuta el desembolso/recaudo y causa su comprobante (CE, RC o CI) en la misma
 *    transacción, con la subcuenta PUC real de la cuenta bancaria o caja (migración 073).
 */

import { treasuryRepository } from '../repositories/treasury.repository'
import { auditService } from '@/features/audit/services/audit.service'
import {
  BankAccount,
  TreasuryPayment,
  TreasuryReceipt,
  TreasuryStats,
  BankMovement,
  TreasuryPostingResult,
  ReceiptCustomerOption,
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
   * Ejecuta el desembolso. El servidor valida permisos y fondos, mueve el banco, abona la CxP y causa
   * el comprobante de egreso (CE) en la misma transacción: si algo falla, no queda nada a medias.
   */
  async executePayment(
    paymentId: string,
    executionData: { bankAccountId: string; referenceNumber?: string },
    user: { id: string; name: string; role: string }
  ): Promise<TreasuryPostingResult> {
    const result = await treasuryRepository.executePayment(paymentId, executionData)

    await auditService.log({
      action: 'TREASURY_PAYMENT_EXECUTED' as any,
      module: 'FINANCIAL' as any,
      entityType: 'TREASURY_PAYMENT',
      entityId: result.documentId,
      entityReference: `${result.documentNumber} -> ${result.accountingEntryNumber || ''}`,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      level: 'INFO',
      result: 'SUCCESS',
      details: `Desembolso ${result.documentNumber} por $${result.amount.toLocaleString('es-CO')} COP. Comprobante ${result.accountingEntryNumber || 'sin número'}.`,
    })

    return result
  }

  /**
   * Registra un recaudo de cartera. El servidor mueve el banco o la caja, abona la cartera del cliente
   * y causa el comprobante RC (caja) o CI (banco) en la misma transacción.
   */
  async executeCustomerCollection(
    data: {
      customerId: string
      bankAccountId: string
      amount: number
      receiptDate?: string
      paymentMethod: TreasuryReceipt['paymentMethod']
      referenceNumber?: string
      invoiceId?: string
      notes?: string
      idempotencyKey: string
    },
    user: { id: string; name: string; role: string }
  ): Promise<TreasuryPostingResult> {
    if (!(data.amount > 0)) {
      throw new Error('El valor del recaudo debe ser mayor a cero.')
    }
    const result = await treasuryRepository.createReceipt(data)

    if (!result.idempotentReplay) {
      await auditService.log({
        action: 'TREASURY_RECEIPT_REGISTERED' as any,
        module: 'FINANCIAL' as any,
        entityType: 'TREASURY_RECEIPT',
        entityId: result.documentId,
        entityReference: `${result.documentNumber} -> ${result.accountingEntryNumber || ''}`,
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        level: 'INFO',
        result: 'SUCCESS',
        details: `Recaudo ${result.documentNumber} por $${result.amount.toLocaleString('es-CO')} COP. Comprobante ${result.accountingEntryNumber || 'sin número'}.`,
      })
    }

    return result
  }

  /** Contabiliza un pago o recaudo que quedó sin comprobante (registros anteriores a la causación automática). */
  async causePendingAccounting(kind: 'PAYMENT' | 'RECEIPT', documentId: string): Promise<string | null> {
    return kind === 'PAYMENT'
      ? treasuryRepository.causePaymentAccounting(documentId)
      : treasuryRepository.causeReceiptAccounting(documentId)
  }

  async getReceiptCustomers(): Promise<ReceiptCustomerOption[]> {
    return treasuryRepository.getReceiptCustomers()
  }

  /**
   * Registra una nueva cuenta bancaria
   */
  async createBankAccount(
    data: {
      bankName: string
      accountNumber: string
      accountType?: string
      currency?: string
      initialBalance?: number
      locationId?: string
      description?: string
    },
    user?: { id: string; name: string; role: string }
  ): Promise<any> {
    const res = await treasuryRepository.createBankAccount(data)
    if (user) {
      await auditService.log({
        action: 'TREASURY_ACCOUNT_CREATED' as any,
        module: 'FINANCIAL' as any,
        entityType: 'BANK_ACCOUNT',
        entityId: res.bank_account_id,
        entityReference: data.accountNumber,
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        level: 'INFO',
        result: 'SUCCESS',
        details: `Cuenta bancaria creada ${data.bankName} (${data.accountNumber}) con saldo inicial $${(data.initialBalance || 0).toLocaleString()} COP`,
      })
    }
    return res
  }

  /**
   * Consulta los movimientos fiduciarios de una cuenta o de todas
   */
  async getBankMovements(bankAccountId?: string): Promise<BankMovement[]> {
    return treasuryRepository.getBankMovements(bankAccountId)
  }

  /**
   * Marca un movimiento bancario como conciliado fiduciariamente
   */
  async reconcileMovement(
    movementId: string,
    reconciled: boolean = true,
    user?: { id: string; name: string; role: string }
  ): Promise<any> {
    const res = await treasuryRepository.reconcileMovement(movementId, reconciled)
    if (user) {
      await auditService.log({
        action: 'BANK_MOVEMENT_RECONCILED' as any,
        module: 'FINANCIAL' as any,
        entityType: 'BANK_MOVEMENT',
        entityId: movementId,
        entityReference: movementId,
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        level: 'INFO',
        result: 'SUCCESS',
        details: `Movimiento bancario ${movementId} conciliado fiduciariamente (${reconciled ? 'CONCILIADO' : 'PENDIENTE'})`,
      })
    }
    return res
  }
}

export const treasuryService = new TreasuryService()
