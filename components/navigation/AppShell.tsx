'use client'

import React, { useState } from 'react'
import { Sidebar } from '@/components/navigation/Sidebar'
import { Header, BreadcrumbItem } from '@/components/navigation/Header'
import { Footer } from '@/components/Footer'

interface AppShellProps {
  children: React.ReactNode
  breadcrumbs?: BreadcrumbItem[]
  hideFooter?: boolean
  mainClassName?: string
}

export function AppShell({
  children,
  breadcrumbs,
  hideFooter = false,
  mainClassName = 'dashboard-content',
}: AppShellProps) {
  const [menu, setMenu] = useState(false)

  return (
    <div className="app-shell">
      <Sidebar open={menu} onClose={() => setMenu(false)} />

      <div className="main-area">
        <Header onOpenMenu={() => setMenu(true)} breadcrumbs={breadcrumbs} />

        <main className={mainClassName}>
          {children}
          {!hideFooter && <Footer isDark={false} />}
        </main>
      </div>
    </div>
  )
}
