import type { Metadata } from 'next'
import { CustomerDisplayView } from '@/features/pos/customer-display/CustomerDisplayView'

export const metadata: Metadata = {
  title: 'Pantalla del cliente | Super Más',
  description: 'Vista para el cliente con los productos y el total de la compra en curso.',
  robots: { index: false, follow: false },
}

export default function CustomerDisplayPage() {
  return <CustomerDisplayView />
}
