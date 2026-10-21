import { supabaseClient } from '@/lib/supabase/client'
import { resolveUserCompanyId } from '@/lib/supabase/tenant'
import { invoiceRepository } from '@/features/invoices/repositories/invoice.repository'
import { Invoice } from '@/features/invoices/types'

/**
 * Acceso a datos del comprobante para el cliente. Todas las consultas usan la sesión del usuario
 * (RLS de Supabase) y el company_id real del usuario autenticado.
 */

export interface RawReceiptSale {
  id: string
  sale_number: string
  status: string
  payment_method: string
  subtotal_amount: number | string | null
  discount_amount: number | string | null
  tax_amount: number | string | null
  total_amount: number | string | null
  cash_session_id: string | null
  created_at: string
  customers: {
    first_name: string | null
    last_name: string | null
    company_name: string | null
    document_type: string | null
    document_number: string | null
    dian_tax_level_codes: string | null
  } | null
  locations: { name: string | null } | null
  users: { full_name: string | null } | null
}

export interface RawReceiptSaleItem {
  id: string
  quantity: number | string
  unit_price: number | string
  discount_percent: number | string | null
  tax_rate_percent: number | string | null
  tax_amount: number | string | null
  subtotal: number | string | null
  total: number | string | null
  iva_treatment: string | null
  products: { name: string | null; sku: string | null; iva_treatment: string | null } | null
}

export interface RawReceiptPayment {
  payment_method: string
  amount: number | string
  bank_account_id: string | null
  reference: string | null
}

export interface RawReceiptBankAccount {
  id: string
  bank_name: string
  last4: string
}

export interface RawReceiptCompany {
  business_name: string | null
  trade_name: string | null
  tax_id: string | null
  verification_digit: string | null
  address: string | null
  city: string | null
  department: string | null
  phone: string | null
  logo_url: string | null
}

export interface RawCustomerReceipt {
  sale: RawReceiptSale
  items: RawReceiptSaleItem[]
  payments: RawReceiptPayment[]
  bankAccounts: RawReceiptBankAccount[]
  company: RawReceiptCompany | null
  cashRegister: { code: string | null; name: string | null } | null
  invoice: Invoice | null
}

const SALE_SELECT = `
  id, sale_number, status, payment_method, subtotal_amount, discount_amount, tax_amount, total_amount,
  cash_session_id, created_at,
  customers ( first_name, last_name, company_name, document_type, document_number, dian_tax_level_codes ),
  locations ( name ),
  users ( full_name )
`

const COMPANY_SELECT = 'business_name, trade_name, tax_id, verification_digit, address, city, department, phone, logo_url'

export class CustomerReceiptRepository {
  /** Devuelve null si la venta no existe o el usuario no tiene acceso a ella (RLS). */
  async findBySaleId(saleId: string): Promise<RawCustomerReceipt | null> {
    const { data: sale, error } = await supabaseClient.from('sales').select(SALE_SELECT).eq('id', saleId).maybeSingle()
    if (error) throw new Error(`No se pudo consultar la venta: ${error.message}`)
    if (!sale) return null

    const companyId = await resolveUserCompanyId(supabaseClient)
    const raw = sale as unknown as RawReceiptSale

    const [items, payments, company, cashRegister, invoice] = await Promise.all([
      this.loadItems(saleId),
      this.loadPayments(saleId),
      this.loadCompany(companyId),
      this.loadCashRegister(raw.cash_session_id),
      this.loadInvoice(saleId),
    ])
    const bankAccounts = payments.some((p) => p.bank_account_id) ? await this.loadBankAccounts() : []

    return { sale: raw, items, payments, bankAccounts, company, cashRegister, invoice }
  }

  private async loadItems(saleId: string): Promise<RawReceiptSaleItem[]> {
    const { data, error } = await supabaseClient
      .from('sale_items')
      .select('id, quantity, unit_price, discount_percent, tax_rate_percent, tax_amount, subtotal, total, iva_treatment, created_at, products ( name, sku, iva_treatment )')
      .eq('sale_id', saleId)
      .order('created_at', { ascending: true })
    if (error) throw new Error(`No se pudieron consultar los productos de la venta: ${error.message}`)
    return (data || []) as unknown as RawReceiptSaleItem[]
  }

  private async loadPayments(saleId: string): Promise<RawReceiptPayment[]> {
    const { data, error } = await supabaseClient
      .from('sale_payments')
      .select('payment_method, amount, bank_account_id, reference, created_at')
      .eq('sale_id', saleId)
      .order('created_at', { ascending: true })
    if (error) throw new Error(`No se pudieron consultar los pagos de la venta: ${error.message}`)
    return (data || []) as RawReceiptPayment[]
  }

  /** Solo banco y últimos 4 dígitos (función SQL que no expone el número completo ni saldos). */
  private async loadBankAccounts(): Promise<RawReceiptBankAccount[]> {
    const { data, error } = await supabaseClient.rpc('fn_list_payment_bank_accounts')
    if (error || !data) return []
    return (data as RawReceiptBankAccount[]).map((b) => ({ id: b.id, bank_name: b.bank_name, last4: b.last4 }))
  }

  private async loadCompany(companyId: string): Promise<RawReceiptCompany | null> {
    const { data, error } = await supabaseClient.from('companies').select(COMPANY_SELECT).eq('id', companyId).maybeSingle()
    if (error) throw new Error(`No se pudieron consultar los datos de la empresa: ${error.message}`)
    return (data as RawReceiptCompany | null) || null
  }

  private async loadCashRegister(cashSessionId: string | null): Promise<{ code: string | null; name: string | null } | null> {
    if (!cashSessionId) return null
    const { data } = await supabaseClient
      .from('cash_sessions')
      .select('cash_registers ( code, name )')
      .eq('id', cashSessionId)
      .maybeSingle()
    const register = (data as { cash_registers?: { code: string | null; name: string | null } | null } | null)?.cash_registers
    return register || null
  }

  /** Factura electrónica de la venta (mismos datos que la representación gráfica DIAN). */
  private async loadInvoice(saleId: string): Promise<Invoice | null> {
    const summary = await invoiceRepository.findBySaleId(saleId)
    if (!summary) return null
    return invoiceRepository.findById(summary.id)
  }
}

export const customerReceiptRepository = new CustomerReceiptRepository()
