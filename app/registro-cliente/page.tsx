import type { Metadata } from 'next'
import { Footer } from '@/components/Footer'
import { CustomerSelfRegistrationForm } from '@/features/customer-self-registration/components/CustomerSelfRegistrationForm'

export const metadata: Metadata = {
  title: 'Datos para factura electrónica | Super Más',
  description: 'Registra tus datos de facturación electrónica en Super Más para recibir tu factura en tu correo.',
  robots: { index: false, follow: false },
}

export default function CustomerSelfRegistrationPage() {
  return (
    <div className="self-registration-page">
      <header className="self-registration-header">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-distribuidora-blanco.png" alt="Distribuidora Super Más" width={150} height={48} />
      </header>
      <main className="self-registration-main">
        <section className="self-registration-card" aria-labelledby="self-registration-title">
          <h1 id="self-registration-title">Datos para tu factura electrónica</h1>
          <p className="self-registration-intro">
            Llena este formulario una sola vez. Con tu documento, el cajero emitirá tu factura electrónica y te llegará al correo.
          </p>
          <CustomerSelfRegistrationForm />
        </section>
      </main>
      <Footer isDark={false} />
    </div>
  )
}
