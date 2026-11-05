import { supabaseClient } from '@/lib/supabase/client'

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabaseClient.auth.getSession()
  const token = data.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

const orderPdfUrl = (purchaseId: string) => `/api/purchases/${encodeURIComponent(purchaseId)}/order-pdf`

async function errorMessage(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => null)
  return (body && typeof body.error === 'string' && body.error) || fallback
}

/** Orden de compra en PDF (para vista previa y descarga). */
export async function fetchPurchaseOrderPdf(purchaseId: string): Promise<Blob> {
  const res = await fetch(orderPdfUrl(purchaseId), { headers: await authHeaders(), cache: 'no-store' })
  if (!res.ok) throw new Error(await errorMessage(res, 'No se pudo generar la orden de compra.'))
  return res.blob()
}

/** Envía la orden en PDF al correo del proveedor; devuelve el mensaje de confirmación. */
export async function sendPurchaseOrderPdf(purchaseId: string, recipient: string, message: string): Promise<string> {
  const res = await fetch(orderPdfUrl(purchaseId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify({ recipient, message }),
  })
  const body = await res.json().catch(() => null)
  if (!res.ok || !body?.success) throw new Error((body && body.error) || 'No se pudo enviar la orden de compra.')
  return body.data.message as string
}
