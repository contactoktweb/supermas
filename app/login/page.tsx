import { Metadata } from 'next'
import { Suspense } from 'react'
import { LoginPageClient } from './LoginPageClient'

export const metadata: Metadata = {
  title: 'Iniciar Sesión | Super Más ERP',
  description: 'Acceso fiduciario seguro al sistema ERP/POS de Distribuidora Super Más.',
}

export default function LoginPage() {
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
          Cargando terminal de acceso...
        </div>
      }
    >
      <LoginPageClient />
    </Suspense>
  )
}
