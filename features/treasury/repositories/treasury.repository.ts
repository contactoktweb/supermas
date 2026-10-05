import { supabaseClient } from '@/lib/supabase/client'
import {
  BankAccount,
  TreasuryPayment,
  TreasuryReceipt,
  BankMovement,
  TreasuryStats,
} from '../types'

export class TreasuryRepository {
  /**
   * Consulta las cuentas bancarias reales de la empresa desde public.bank_accounts
   */
  async getBankAccounts(): Promise<BankAccount[]> {
    const { data, error } = await supabaseClient
      .from('bank_accounts')
      .select(`
        id,
        company_id,
        location_id,
        bank_name,
        account_number,
        account_type,
        currency,
        current_balance,
        accounting_account_id,
        is_active,
        description,
        created_at,
        updated_at,
        locations (
          name
        ),
        accounting_accounts (
          code,
          name
        )
      `)
      .order('bank_name', { ascending: true })

    if (error || !data) {
      console.warn('Advertencia consultando cuentas bancarias:', error?.message)
      return []
    }

    return data.map((row: any) => ({
      id: row.id,
      companyId: row.company_id,
      locationId: row.location_id,
      locationName: row.locations?.name || null,
      bankName: row.bank_name,
      accountNumber: row.account_number,
      accountType: (row.account_type as any) || 'CORRIENTE',
      currency: row.currency || 'COP',
      currentBalance: Number(row.current_balance || 0),
      accountingAccountId: row.accounting_account_id || '',
      accountingAccountCode: row.accounting_accounts?.code || '111005',
      accountingAccountName: row.accounting_accounts?.name || 'Bancos Nacionales',
      status: row.is_active ? 'ACTIVE' : 'INACTIVE',
      description: row.description || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))
  }

  async getBankAccountById(id: string): Promise<BankAccount | null> {
    const accounts = await this.getBankAccounts()
    return accounts.find((a) => a.id === id) || null
  }

  async getPayments(filters?: {
    status?: string
    bankAccountId?: string
    query?: string
  }): Promise<TreasuryPayment[]> {
    let query = supabaseClient.from('treasury_payments').select(`
      id,
      company_id,
      location_id,
      payment_number,
      payment_type,
      purchase_id,
      supplier_id,
      bank_account_id,
      amount,
      payment_date,
      due_date,
      payment_method,
      reference_number,
      support_document_url,
      status,
      accounting_entry_id,
      notes,
      created_at,
      updated_at,
      suppliers (
        id,
        name,
        legal_name,
        tax_id
      ),
      bank_accounts (
        id,
        bank_name,
        account_number
      ),
      purchases (
        id,
        purchase_number,
        supplier_invoice_number
      )
    `)

    if (filters?.status && filters.status !== 'ALL') {
      query = query.eq('status', filters.status)
    }
    if (filters?.bankAccountId && filters.bankAccountId !== 'ALL') {
      query = query.eq('bank_account_id', filters.bankAccountId)
    }

    const { data, error } = await query.order('payment_date', { ascending: false })
    if (error || !data) return []

    let list: TreasuryPayment[] = data.map((row: any) => {
      const sup = row.suppliers || {}
      const bank = row.bank_accounts || {}
      const pur = row.purchases || {}
      return {
        id: row.id,
        companyId: row.company_id,
        locationId: row.location_id,
        paymentNumber: row.payment_number,
        type: (row.payment_type as any) || 'SUPPLIER_PAYMENT',
        purchaseId: row.purchase_id,
        purchaseNumber: pur.purchase_number,
        supplierInvoiceNumber: pur.supplier_invoice_number,
        thirdPartyType: 'SUPPLIER',
        thirdPartyId: row.supplier_id || sup.id || '',
        thirdPartyName: sup.name || sup.legal_name || 'Proveedor',
        thirdPartyDoc: sup.tax_id || '',
        bankAccountId: row.bank_account_id,
        bankAccountName: bank.bank_name ? `${bank.bank_name} (${bank.account_number})` : 'Cuenta Bancaria',
        paymentMethod: (row.payment_method as any) || 'TRANSFERENCIA',
        amount: Number(row.amount || 0),
        paymentDate: row.payment_date,
        dueDate: row.due_date,
        referenceNumber: row.reference_number,
        supportDocumentUrl: row.support_document_url,
        status: (row.status as any) || 'SCHEDULED',
        accountingEntryId: row.accounting_entry_id,
        debitAccountCode: '220505',
        debitAccountName: 'Proveedores Nacionales',
        creditAccountCode: '111005',
        creditAccountName: 'Bancos Nacionales',
        notes: row.notes,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }
    })

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

    return list
  }

  async getReceipts(filters?: {
    status?: string
    bankAccountId?: string
    query?: string
  }): Promise<TreasuryReceipt[]> {
    let query = supabaseClient.from('treasury_receipts').select(`
      id,
      company_id,
      location_id,
      receipt_number,
      customer_id,
      invoice_id,
      bank_account_id,
      amount,
      receipt_date,
      payment_method,
      reference_number,
      status,
      accounting_entry_id,
      notes,
      created_at,
      updated_at,
      customers (
        id,
        company_name,
        first_name,
        last_name,
        tax_id
      ),
      bank_accounts (
        id,
        bank_name,
        account_number
      )
    `)

    if (filters?.status && filters.status !== 'ALL') {
      query = query.eq('status', filters.status)
    }
    if (filters?.bankAccountId && filters.bankAccountId !== 'ALL') {
      query = query.eq('bank_account_id', filters.bankAccountId)
    }

    const { data, error } = await query.order('receipt_date', { ascending: false })
    if (error || !data) return []

    let list: TreasuryReceipt[] = data.map((row: any) => {
      const cust = row.customers || {}
      const bank = row.bank_accounts || {}
      const custName = cust.company_name || `${cust.first_name || ''} ${cust.last_name || ''}`.trim() || 'Cliente'
      return {
        id: row.id,
        companyId: row.company_id,
        locationId: row.location_id,
        receiptNumber: row.receipt_number,
        invoiceId: row.invoice_id,
        customerId: row.customer_id,
        customerName: custName,
        customerDoc: cust.tax_id || '',
        bankAccountId: row.bank_account_id,
        bankAccountName: bank.bank_name ? `${bank.bank_name} (${bank.account_number})` : 'Cuenta Bancaria',
        paymentMethod: (row.payment_method as any) || 'TRANSFERENCIA',
        amount: Number(row.amount || 0),
        receiptDate: row.receipt_date,
        referenceNumber: row.reference_number,
        status: (row.status as any) || 'COLLECTED',
        accountingEntryId: row.accounting_entry_id,
        debitAccountCode: '111005',
        debitAccountName: 'Bancos Nacionales',
        creditAccountCode: '130505',
        creditAccountName: 'Clientes Nacionales',
        notes: row.notes,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }
    })

    if (filters?.query) {
      const q = filters.query.toLowerCase().trim()
      list = list.filter(
        (r) =>
          r.receiptNumber.toLowerCase().includes(q) ||
          r.customerName.toLowerCase().includes(q) ||
          r.customerDoc.includes(q) ||
          r.notes?.toLowerCase().includes(q)
      )
    }

    return list
  }

  async createBankAccount(data: {
    bankName: string
    accountNumber: string
    accountType?: string
    currency?: string
    initialBalance?: number
    locationId?: string
    description?: string
  }): Promise<any> {
    const { data: res, error } = await supabaseClient.rpc('fn_create_bank_account', {
      p_bank_name: data.bankName,
      p_account_number: data.accountNumber,
      p_account_type: data.accountType || 'CORRIENTE',
      p_currency: data.currency || 'COP',
      p_initial_balance: data.initialBalance || 0.00,
      p_location_id: data.locationId || null,
      p_description: data.description || null,
    })

    if (error || !res?.success) {
      console.error('Error creando cuenta bancaria en RPC:', error)
      throw new Error(`Error al crear cuenta bancaria: ${error?.message || 'Error desconocido'}`)
    }

    return res
  }

  async createScheduledPayment(
    payment: Omit<TreasuryPayment, 'id' | 'paymentNumber' | 'createdAt'>
  ): Promise<TreasuryPayment> {
    const { data, error } = await supabaseClient.rpc('fn_schedule_treasury_payment', {
      p_supplier_id: payment.thirdPartyId,
      p_bank_account_id: payment.bankAccountId,
      p_amount: payment.amount,
      p_payment_date: payment.paymentDate,
      p_due_date: payment.dueDate || null,
      p_purchase_id: payment.purchaseId || null,
      p_payment_method: payment.paymentMethod || 'TRANSFERENCIA',
      p_reference_number: payment.referenceNumber || null,
      p_notes: payment.notes || null,
    })

    if (error || !data?.success) {
      console.error('Error programando pago en RPC:', error)
      throw new Error(`Error programando pago: ${error?.message || 'Error desconocido'}`)
    }

    return {
      ...payment,
      id: data.payment_id,
      paymentNumber: data.payment_number,
      status: 'SCHEDULED',
      createdAt: new Date().toISOString(),
    }
  }

  async markPaymentAsPaid(
    paymentId: string,
    updateData: {
      paymentDate: string
      bankAccountId: string
      referenceNumber?: string
      supportDocumentUrl?: string
      accountingEntryId?: string
      accountingEntryNumber?: string
    }
  ): Promise<TreasuryPayment> {
    const { data, error } = await supabaseClient.rpc('fn_execute_treasury_payment', {
      p_payment_id: paymentId,
      p_bank_account_id: updateData.bankAccountId || null,
      p_reference_number: updateData.referenceNumber || null,
      p_support_document_url: updateData.supportDocumentUrl || null,
      p_payment_date: updateData.paymentDate || null,
    })

    if (error || !data?.success) {
      console.error('Error ejecutando desembolso en RPC:', error)
      throw new Error(`Error ejecutando desembolso: ${error?.message || 'Error desconocido'}`)
    }

    const { data: currentPay } = await supabaseClient
      .from('treasury_payments')
      .select('*')
      .eq('id', paymentId)
      .single()

    return {
      ...(currentPay || {}),
      id: paymentId,
      paymentNumber: data.payment_number,
      status: 'PAID',
      amount: data.amount,
      paymentDate: updateData.paymentDate,
      bankAccountId: updateData.bankAccountId,
      referenceNumber: updateData.referenceNumber,
      accountingEntryId: updateData.accountingEntryId || null,
      accountingEntryNumber: updateData.accountingEntryNumber || null,
    } as TreasuryPayment
  }

  async createReceipt(
    receipt: Omit<TreasuryReceipt, 'id' | 'receiptNumber' | 'createdAt'>
  ): Promise<TreasuryReceipt> {
    const { data, error } = await supabaseClient.rpc('fn_register_treasury_receipt', {
      p_customer_id: receipt.customerId,
      p_bank_account_id: receipt.bankAccountId,
      p_amount: receipt.amount,
      p_receipt_date: receipt.receiptDate,
      p_payment_method: receipt.paymentMethod || 'TRANSFERENCIA',
      p_reference_number: receipt.referenceNumber || null,
      p_invoice_id: receipt.invoiceId || null,
      p_notes: receipt.notes || null,
    })

    if (error || !data?.success) {
      console.error('Error registrando recaudo en RPC:', error)
      throw new Error(`Error registrando recaudo: ${error?.message || 'Error desconocido'}`)
    }

    return {
      ...receipt,
      id: data.receipt_id,
      receiptNumber: data.receipt_number,
      status: 'COLLECTED',
      createdAt: new Date().toISOString(),
    }
  }

  async reconcileMovement(movementId: string, reconciled: boolean = true): Promise<any> {
    const { data, error } = await supabaseClient.rpc('fn_reconcile_bank_movement', {
      p_movement_id: movementId,
      p_reconciled: reconciled,
    })

    if (error || !data?.success) {
      console.error('Error conciliando movimiento bancario:', error)
      throw new Error(`Error al conciliar movimiento: ${error?.message || 'Error desconocido'}`)
    }

    return data
  }

  async getBankMovements(bankAccountId?: string): Promise<BankMovement[]> {
    let query = supabaseClient
      .from('bank_movements')
      .select(`
        id,
        company_id,
        location_id,
        bank_account_id,
        movement_number,
        movement_date,
        movement_type,
        amount,
        balance_after,
        concept,
        reference,
        treasury_payment_id,
        treasury_receipt_id,
        is_reconciled,
        reconciled_at,
        created_at,
        bank_accounts (
          bank_name,
          account_number
        )
      `)
      .order('movement_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (bankAccountId && bankAccountId !== 'ALL') {
      query = query.eq('bank_account_id', bankAccountId)
    }

    const { data, error } = await query
    if (error || !data) return []

    return data.map((m: any) => ({
      id: m.id,
      companyId: m.company_id,
      locationId: m.location_id,
      bankAccountId: m.bank_account_id,
      bankAccountName: m.bank_accounts?.bank_name ? `${m.bank_accounts.bank_name} (${m.bank_accounts.account_number})` : 'Cuenta',
      movementNumber: m.movement_number,
      type: m.movement_type,
      amount: Number(m.amount || 0),
      balanceAfter: Number(m.balance_after || 0),
      date: m.movement_date,
      concept: m.concept,
      reference: m.reference || undefined,
      treasuryPaymentId: m.treasury_payment_id || undefined,
      treasuryReceiptId: m.treasury_receipt_id || undefined,
      isReconciled: !!m.is_reconciled,
      reconciledAt: m.reconciled_at || undefined,
      createdAt: m.created_at,
    }))
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

