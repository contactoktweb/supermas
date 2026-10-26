/**
 * SUPER MÁS ERP/POS — Cliente del navegador para las rutas /api/dian (servidor).
 *
 * El navegador NUNCA calcula CUFE, firma ni transmite: solo pide al servidor que lo haga.
 * Envía el token de sesión de Supabase para que el servidor valide usuario, empresa y permisos.
 */

import { supabaseClient } from '@/lib/supabase/client'

export interface DianProcessResponse {
  invoiceId: string
  documentNumber: string
  transmissionState: string
  dianStatus: string
  cufe: string | null
  trackId: string | null
  message: string
  dianErrors: string[]
  idempotentReplay?: boolean
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabaseClient.auth.getSession()
  const token = data?.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function call<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()), ...(init.headers || {}) },
    credentials: 'same-origin',
  })
  const body = await res.json().catch(() => null)
  if (!res.ok || !body?.success) {
    throw new Error(body?.error || `Error ${res.status} en la facturación electrónica.`)
  }
  return body.data as T
}

/** Clave de idempotencia estable por venta durante la sesión (evita doble emisión por doble clic). */
function idempotencyKeyFor(saleId: string): string {
  const storageKey = `dian-idem-${saleId}`
  try {
    const existing = sessionStorage.getItem(storageKey)
    if (existing) return existing
    const key = `FE-${saleId}-${crypto.randomUUID()}`
    sessionStorage.setItem(storageKey, key)
    return key
  } catch {
    return `FE-${saleId}`
  }
}

export interface DianNoteRequest {
  originalInvoiceId: string
  documentType: 'CREDIT_NOTE' | 'DEBIT_NOTE'
  conceptCode: string
  reason: string
  /** Nota crédito: [{ sale_item_id, quantity }] o [{ sale_item_id, net_amount }]; nota débito: [{ description, quantity, unit_price, iva }] */
  lines?: Array<Record<string, unknown>>
  returnId?: string | null
}

export const dianApiClient = {
  /** La clave de idempotencia la genera quien abre el formulario (un formulario = una nota). */
  emitNote(note: DianNoteRequest, idempotencyKey: string) {
    return call<DianProcessResponse>('/api/dian/notes', {
      method: 'POST',
      body: JSON.stringify({ ...note, idempotencyKey }),
    })
  },

  emitFromSale(saleId: string) {
    return call<DianProcessResponse>('/api/dian/invoices', {
      method: 'POST',
      body: JSON.stringify({ saleId, idempotencyKey: idempotencyKeyFor(saleId) }),
    })
  },

  send(invoiceId: string) {
    return call<DianProcessResponse>(`/api/dian/invoices/${invoiceId}/send`, { method: 'POST' })
  },

  /** Envía (o reenvía) al cliente por correo el documento aceptado: XML (AttachedDocument) + PDF. */
  emailToCustomer(invoiceId: string, to?: string) {
    return call<{ outcome: string; message: string; recipient: string | null }>(`/api/dian/invoices/${invoiceId}/email`, {
      method: 'POST',
      body: JSON.stringify(to ? { to } : {}),
    })
  },

  checkStatus(invoiceId: string) {
    return call<DianProcessResponse>(`/api/dian/invoices/${invoiceId}/status`, { method: 'POST' })
  },

  async fetchXml(invoiceId: string, kind: 'signed' | 'unsigned' | 'response' = 'signed'): Promise<{ xml: string; fileName: string }> {
    const res = await fetch(`/api/dian/invoices/${invoiceId}/xml?kind=${kind}`, { headers: await authHeaders(), credentials: 'same-origin' })
    if (!res.ok) {
      const body = await res.json().catch(() => null)
      throw new Error(body?.error || 'No se pudo obtener el XML.')
    }
    const disposition = res.headers.get('Content-Disposition') || ''
    const fileName = disposition.match(/filename="([^"]+)"/)?.[1] || `${invoiceId}.xml`
    return { xml: await res.text(), fileName }
  },

  config() {
    return call<any>('/api/dian/config')
  },
}
