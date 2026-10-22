import type { Metadata } from 'next'
import { CambiarContrasenaClient } from './CambiarContrasenaClient'

export const metadata: Metadata = {
  title: 'Cambiar Contraseña | Super Más ERP',
  description:
    'Definición segura de la contraseña personal en el primer ingreso al sistema ERP/POS de Distribuidora Super Más.',
  robots: { index: false, follow: false },
}

export default function CambiarContrasenaPage() {
  return <CambiarContrasenaClient />
}
