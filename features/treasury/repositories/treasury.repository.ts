/**
 * SUPER MÁS ERP/POS - Repositorio de Tesorería
 *
 * Administra el acceso a datos para cuentas bancarias, pagos a proveedores,
 * recaudos de clientes y movimientos bancarios.
 */

import { db } from '@/lib/supabase/db'
import {
  BankAccount,
  TreasuryPayment,
  TreasuryReceipt,
  BankMovement,
  TreasuryStats,
} from '../types'

export class TreasuryRepository {
  async getBankAccounts(): Promise<BankAccount[]> {
    const list = (db.bankAccounts as unknown as BankAccount[]) || []
    return JSON.parse(JSON.stringify(list))
  }

  async getBankAccountById(id: string): Promise<BankAccount | null> {
    const list = (db.bankAccounts as unknown as BankAccount[]) || []
    const acc = list.find((a) => a.id === id)
    return acc ? JSON.parse(JSON.stringify(acc)) : null
  }

  async getPayments(filters?: {
    status?: string
    bankAccountId?: string
    query?: string
  }): Promise<TreasuryPayment[]> {
    let list = (db.treasuryPayments as unknown as TreasuryPayment[]) || []

    if (filters?.query) {
      const q = filters.query.toLowerCase().trim()
      list = list.filter(
        (p) =>
          p.paymentNumber.toLowerCase().includes(q) ||
          p.thirdPartyName.toLowerCase().includes(q) ||
          p.thirdPartyDoc.includes(q) ||
          p.supplierInvoiceNumber?.toLowerCase().includes(q) ||
          p.notes?.toLowerCase().includes(q)
      )
    }

    if (filters?.status && filters.status !== 'ALL') {
      list = list.filter((p) => p.status === filters.status)
    }

    if (filters?.bankAccountId && filters.bankAccountId !== 'ALL') {
      list = list.filter((p) => p.bankAccountId === filters.bankAccountId)
    }

    list.sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime())
    return JSON.parse(JSON.stringify(list))
  }

  async getReceipts(filters?: {
    status?: string
    bankAccountId?: string
    query?: string
  }): Promise<TreasuryReceipt[]> {
    let list = (db.treasuryReceipts as unknown as TreasuryReceipt[]) || []

    if (filters?.query) {
      const q = filters.query.toLowerCase().trim()
      list = list.filter(
        (r) =>
          r.receiptNumber.toLowerCase().includes(q) ||
          r.customerName.toLowerCase().includes(q) ||
          r.customerDoc.includes(q) ||
          r.invoiceNumber?.toLowerCase().includes(q)
      )
    }

    if (filters?.status && filters.status !== 'ALL') {
      list = list.filter((r) => r.status === filters.status)
    }

    if (filters?.bankAccountId && filters.bankAccountId !== 'ALL') {
      list = list.filter((r) => r.bankAccountId === filters.bankAccountId)
    }

    list.sort((a, b) => new Date(b.receiptDate).getTime() - new Date(a.receiptDate).getTime())
    return JSON.parse(JSON.stringify(list))
  }

  async createScheduledPayment(payment: Omit<TreasuryPayment, 'id' | 'paymentNumber' | 'createdAt'>): Promise<TreasuryPayment> {
    const list = (db.treasuryPayments as unknown as TreasuryPayment[]) || []
    const seq = list.length + 1
    const newPayment: TreasuryPayment = {
      ...payment,
      id: `tes-pag-${Date.now()}`,
      paymentNumber: `TES-PAG-${new Date().getFullYear()}-${String(seq).padStart(5, '0')}`,
      createdAt: new Date().toISOString(),
    }
    list.unshift(newPayment)
    return JSON.parse(JSON.stringify(newPayment))
  }

  async markPaymentAsPaid(
    paymentId: string,
    updateData: {
      paymentDate: string
      bankAccountId: string
      referenceNumber?: string
      supportDocumentUrl?: string
      accountingEntryId: string
      accountingEntryNumber: string
    }
  ): Promise<TreasuryPayment> {
    const list = (db.treasuryPayments as unknown as TreasuryPayment[]) || []
    const payment = list.find((p) => p.id === paymentId)
    if (!payment) {
      throw new Error(`Pago de tesorería con ID ${paymentId} no encontrado.`)
    }

    payment.status = 'PAID'
    payment.paymentDate = updateData.paymentDate
    payment.bankAccountId = updateData.bankAccountId
    payment.referenceNumber = updateData.referenceNumber || payment.referenceNumber
    payment.supportDocumentUrl = updateData.supportDocumentUrl || payment.supportDocumentUrl
    payment.accountingEntryId = updateData.accountingEntryId
    payment.accountingEntryNumber = updateData.accountingEntryNumber

    // Actualizar saldo de la cuenta bancaria
    const bankList = (db.bankAccounts as unknown as BankAccount[]) || []
    const bank = bankList.find((b) => b.id === updateData.bankAccountId)
    if (bank) {
      bank.currentBalance = Math.max(0, bank.currentBalance - payment.amount)
    }

    return JSON.parse(JSON.stringify(payment))
  }

  async createReceipt(receipt: Omit<TreasuryReceipt, 'id' | 'receiptNumber' | 'createdAt'>): Promise<TreasuryReceipt> {
    const list = (db.treasuryReceipts as unknown as TreasuryReceipt[]) || []
    const seq = list.length + 1
    const newReceipt: TreasuryReceipt = {
      ...receipt,
      id: `tes-rec-${Date.now()}`,
      receiptNumber: `TES-REC-${new Date().getFullYear()}-${String(seq).padStart(5, '0')}`,
      createdAt: new Date().toISOString(),
    }
    list.unshift(newReceipt)

    // Aumentar saldo bancario
    const bankList = (db.bankAccounts as unknown as BankAccount[]) || []
    const bank = bankList.find((b) => b.id === receipt.bankAccountId)
    if (bank) {
      bank.currentBalance += receipt.amount
    }

    return JSON.parse(JSON.stringify(newReceipt))
  }

  async getStats(): Promise<TreasuryStats> {
    const bankAccounts = await this.getBankAccounts()
    const payments = await this.getPayments()
    const receipts = await this.getReceipts()

    const totalCashAndBanks = bankAccounts.reduce((acc, b) => acc + (Number(b.currentBalance) || 0), 0)
    const scheduled = payments.filter((p) => p.status === 'SCHEDULED')
    const scheduledPaymentsTotal = scheduled.reduce((acc, p) => acc + p.amount, 0)
    const scheduledPaymentsCount = scheduled.length

    const paidThisMonthTotal = payments
      .filter((p) => p.status === 'PAID')
      .reduce((acc, p) => acc + p.amount, 0)

    const collectedThisMonthTotal = receipts
      .filter((r) => r.status === 'COLLECTED')
      .reduce((acc, r) => acc + r.amount, 0)

    return {
      totalCashAndBanks,
      scheduledPaymentsTotal,
      scheduledPaymentsCount,
      paidThisMonthTotal,
      collectedThisMonthTotal,
      activeAccountsCount: bankAccounts.filter((b) => b.status === 'ACTIVE').length,
    }
  }
}

export const treasuryRepository = new TreasuryRepository()
