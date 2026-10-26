/**
 * Cliente de correo transaccional (Resend). Solo servidor: la API key nunca llega al navegador.
 * Variables (.env.local / Vercel):
 *   RESEND_API_KEY                  clave de la API de Resend
 *   INVOICE_EMAIL_FROM              remitente verificado en Resend, ej. "Super Más <facturacion@dominio.com>"
 *   INVOICE_EMAIL_REPLY_TO          (opcional) correo que recibe las respuestas de los clientes
 *   INVOICE_EMAIL_TEST_RECIPIENT    (habilitación) único destinatario de los documentos de prueba
 */
import { Resend } from 'resend'

export interface InvoiceEmailConfig {
  apiKey: string
  from: string
  replyTo: string | null
  testRecipient: string | null
}

const clean = (v: string | undefined) => (v || '').trim() || null

export function getInvoiceEmailConfig(): InvoiceEmailConfig | null {
  const apiKey = clean(process.env.RESEND_API_KEY)
  const from = clean(process.env.INVOICE_EMAIL_FROM)
  if (!apiKey || !from) return null
  return {
    apiKey,
    from,
    replyTo: clean(process.env.INVOICE_EMAIL_REPLY_TO),
    testRecipient: clean(process.env.INVOICE_EMAIL_TEST_RECIPIENT),
  }
}

let client: { key: string; resend: Resend } | null = null

export function resendClient(config: InvoiceEmailConfig): Resend {
  if (!client || client.key !== config.apiKey) client = { key: config.apiKey, resend: new Resend(config.apiKey) }
  return client.resend
}

export const isValidEmail = (value: string) => /^[^\s@<>;,]+@[^\s@<>;,]+\.[^\s@<>;,]{2,}$/.test(value.trim())
