import { Metadata } from 'next'
import { POSPageClient } from './POSPageClient'

export const metadata: Metadata = {
  title: 'Punto de Venta (POS) | Super Más ERP',
  description: 'Terminal de punto de venta rápido y seguro para facturación y cobro en Distribuidora Super Más.',
}

export default function POSPage() {
  return <POSPageClient />
}
