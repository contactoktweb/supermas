import type { Metadata } from 'next'
import { CustomerReceiptView } from '@/features/customer-receipt/components/CustomerReceiptView'
import { CUSTOMER_RECEIPT_CASH_PARAM } from '@/features/customer-receipt/routes'

export const metadata: Metadata = {
  title: 'Comprobante para el cliente (15 × 20 cm) | Super Más',
  description: 'Vista de impresión de la venta POS o factura electrónica entregada al cliente.',
  robots: { index: false, follow: false },
}

interface PageProps {
  params: Promise<{ saleId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/** Efectivo entregado por el cliente: solo se usa para mostrar el cambio, nunca para totales o impuestos. */
function parseCashReceived(value: string | string[] | undefined): number | undefined {
  const raw = Array.isArray(value) ? value[0] : value
  if (!raw) return undefined
  const amount = Number(raw)
  return Number.isFinite(amount) && amount > 0 ? amount : undefined
}

export default async function CustomerReceiptPage({ params, searchParams }: PageProps) {
  const [{ saleId }, query] = await Promise.all([params, searchParams])
  return <CustomerReceiptView saleId={saleId} cashReceived={parseCashReceived(query[CUSTOMER_RECEIPT_CASH_PARAM])} />
}
