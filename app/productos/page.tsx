'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { ProductsPage } from '@/features/products/components/ProductsPage'
import { AppShell } from '@/components/navigation/AppShell'

export default function ProductosRoutePage() {
  const router = useRouter()

  const handleNavigate = (targetView: string) => {
    if (targetView === 'Dashboard') router.push('/')
    else if (targetView === 'Categorías') router.push('/categorias')
    else if (targetView === 'Marcas') router.push('/marcas')
    else if (targetView === 'Bodegas') router.push('/bodegas')
    else if (targetView === 'Inventario') router.push('/inventario')
    else if (targetView === 'Kardex') router.push('/kardex')
    else router.push('/')
  }

  return (
    <AppShell>
      <ProductsPage onNavigate={handleNavigate} />
    </AppShell>
  )
}
