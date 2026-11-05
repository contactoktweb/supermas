/**
 * GET  /api/purchases/:purchaseId/order-pdf — Descarga la orden de compra en PDF.
 * POST /api/purchases/:purchaseId/order-pdf — Envía la orden en PDF al correo del proveedor.
 *
 * La orden muestra costos, así que además de ver compras se exige cost.read. Los datos se leen con
 * el cliente del usuario: RLS limita la consulta a su empresa y a sus sedes.
 */
import { NextRequest, NextResponse } from 'next/server'
import { AuthError, requireServerUser, requireAnyPermission, ServerUser } from '@/lib/auth/server-auth'
import { getInvoiceEmailConfig, isValidEmail, resendClient } from '@/lib/email/resend-client'
import { buildPurchaseOrderPdf, purchaseOrderFileName } from '@/features/purchases/services/purchase-order-pdf.builder'
import {
  loadPurchaseOrderDocument,
  PurchaseOrderDocumentError,
} from '@/features/purchases/services/purchase-order-document.service'

export const runtime = 'nodejs'

const READ_PERMISSIONS = ['purchases.read', 'purchase.read']
const COST_PERMISSIONS = ['cost.read']
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_MESSAGE_LENGTH = 1000

async function authorize(req: NextRequest, params: Promise<{ purchaseId: string }>): Promise<{ user: ServerUser; purchaseId: string }> {
  const user = await requireServerUser(req)
  await requireAnyPermission(user, READ_PERMISSIONS)
  await requireAnyPermission(user, COST_PERMISSIONS)
  const { purchaseId } = await params
  if (!UUID_PATTERN.test(purchaseId)) throw new PurchaseOrderDocumentError('Orden de compra inválida.', 400)
  return { user, purchaseId }
}

function errorResponse(e: unknown) {
  if (e instanceof AuthError || e instanceof PurchaseOrderDocumentError) {
    return NextResponse.json({ success: false, error: e.message }, { status: e.status })
  }
  console.error('[Compras] Error con la orden de compra en PDF:', e instanceof Error ? e.message : String(e))
  return NextResponse.json({ success: false, error: 'No se pudo generar la orden de compra.' }, { status: 500 })
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] as string)

export async function GET(req: NextRequest, { params }: { params: Promise<{ purchaseId: string }> }) {
  try {
    const { user, purchaseId } = await authorize(req, params)
    const data = await loadPurchaseOrderDocument(user.userClient, purchaseId)
    const pdf = buildPurchaseOrderPdf(data)
    const disposition = req.nextUrl.searchParams.get('download') === '1' ? 'attachment' : 'inline'
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${disposition}; filename="${purchaseOrderFileName(data.purchase)}"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (e) {
    return errorResponse(e)
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ purchaseId: string }> }) {
  try {
    const { user, purchaseId } = await authorize(req, params)
    const body = (await req.json().catch(() => ({}))) as { recipient?: unknown; message?: unknown }

    const emailConfig = getInvoiceEmailConfig()
    if (!emailConfig) {
      return NextResponse.json({ success: false, error: 'El envío de correos aún no está habilitado.' }, { status: 503 })
    }

    const data = await loadPurchaseOrderDocument(user.userClient, purchaseId)
    const requested = typeof body.recipient === 'string' ? body.recipient.trim() : ''
    const recipient = requested || (data.purchase.supplierEmail || '').trim()
    if (!recipient) throw new PurchaseOrderDocumentError('El proveedor no tiene correo registrado. Escriba uno.', 400)
    if (!isValidEmail(recipient)) throw new PurchaseOrderDocumentError('El correo de destino no es válido.', 400)

    const message = typeof body.message === 'string' ? body.message.trim().slice(0, MAX_MESSAGE_LENGTH) : ''
    const pdf = buildPurchaseOrderPdf(data)
    const { purchase, issuer } = data
    const subject = `Orden de compra ${purchase.purchaseNumber} — ${issuer.legalName}`
    const intro = `Adjuntamos la orden de compra ${purchase.purchaseNumber} para entregar en ${purchase.destinationLocationName}.`
    const replyTo = emailConfig.replyTo || (isValidEmail(issuer.email) ? issuer.email : undefined)

    const { error } = await resendClient(emailConfig).emails.send({
      from: emailConfig.from,
      to: [recipient],
      replyTo,
      subject,
      text: [`Señores ${purchase.supplierName}:`, '', intro, message, '', `Cordialmente,`, issuer.legalName]
        .filter((line, i, all) => line !== '' || all[i - 1] !== '')
        .join('\n'),
      html:
        `<p>Señores <strong>${escapeHtml(purchase.supplierName)}</strong>:</p>` +
        `<p>${escapeHtml(intro)}</p>` +
        (message ? `<p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>` : '') +
        `<p>Cordialmente,<br><strong>${escapeHtml(issuer.legalName)}</strong></p>`,
      attachments: [{ filename: purchaseOrderFileName(purchase), content: pdf }],
    })
    if (error) {
      console.error('[Compras] Error enviando la orden de compra:', error.message)
      return NextResponse.json({ success: false, error: 'El servicio de correo rechazó el envío. Intente de nuevo.' }, { status: 502 })
    }

    return NextResponse.json({ success: true, data: { recipient, message: `Orden enviada a ${recipient}.` } })
  } catch (e) {
    return errorResponse(e)
  }
}
