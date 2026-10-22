import type { ReactNode } from 'react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Recursos Humanos | Super Más ERP',
  description:
    'Gestión de empleados, áreas y cargos, novedades, vacaciones, documentos y reportes de personal de Distribuidora Super Más.',
  robots: { index: false, follow: false },
}

export default function RecursosHumanosLayout({ children }: { children: ReactNode }) {
  return children
}
