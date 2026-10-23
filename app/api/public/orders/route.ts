import { NextRequest } from 'next/server'
import {
  createPublicWebOrder,
  isValidOrdersToken,
  publicWebOrderSchema,
  PublicWebOrderError,
} from '@/features/web-orders/services/public-web-order.service'

/**
 * Recepción de pedidos de la tienda web. Solo servidor a servidor: exige
 * `Authorization: Bearer <PUBLIC_ORDERS_API_TOKEN>` y no expone CORS al navegador.
 */
function json(body: unknown, status: number) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: NextRequest) {
  const auth = request.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : null
  if (!isValidOrdersToken(token)) {
    return json({ success: false, error: 'No autorizado.' }, 401)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ success: false, error: 'Cuerpo de la petición inválido.' }, 400)
  }

  const parsed = publicWebOrderSchema.safeParse(body)
  if (!parsed.success) {
    return json({ success: false, error: 'Datos del pedido inválidos.' }, 400)
  }

  try {
    const result = await createPublicWebOrder(parsed.data, request.headers.get('x-company-id') || undefined)
    return json({ success: true, data: result }, result.idempotentReplay ? 200 : 201)
  } catch (error) {
    if (error instanceof PublicWebOrderError) {
      return json({ success: false, error: error.message }, error.status)
    }
    console.error('[API Pública] Pedidos web:', error instanceof Error ? error.message : String(error))
    return json({ success: false, error: 'Error interno al registrar el pedido.' }, 500)
  }
}
