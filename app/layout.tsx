import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import './globals.css'
import { AuthProvider } from '@/features/auth'

export const metadata: Metadata = {
  title: 'Super Más | ERP / POS',
  description: 'Centro de operaciones empresarial de Super Más.',
  generator: 'Super Más',
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#001b5c',
  userScalable: false,
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className="bg-background">
      <body className="antialiased">
        <AuthProvider>
          {children}
        </AuthProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
