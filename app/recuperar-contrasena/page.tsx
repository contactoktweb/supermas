import { Metadata } from 'next'
import { Suspense } from 'react'
import { RecuperarContrasenaClient } from './RecuperarContrasenaClient'

export const metadata: Metadata = {
  title: 'Restablecer Contraseña | Super Más ERP',
  description: 'Establecimiento seguro de nueva contraseña para el sistema ERP/POS de Distribuidora Super Más.',
}

export default function RecuperarContrasenaPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            display: 'flex',
            height: '100vh',
            width: '100vw',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#001b5c',
            color: '#ffffff',
          }}
        >
          Cargando terminal de recuperación...
        </div>
      }
    >
      <RecuperarContrasenaClient />
    </Suspense>
  )
}
