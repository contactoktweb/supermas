'use client'

import React from 'react'

interface PageHeaderProps {
  eyebrow: string
  title: string
  subtitle: string
  actions?: React.ReactNode
}

/** Encabezado estándar del ERP: eyebrow rojo, único H1 de la página, subtítulo y acciones. */
export function PageHeader({ eyebrow, title, subtitle, actions }: PageHeaderProps) {
  return (
    <header className="page-heading page-enter flex-wrap">
      <div className="min-w-0">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="welcome-subtitle">{subtitle}</p>
      </div>
      {actions && <div className="heading-actions flex-wrap">{actions}</div>}
    </header>
  )
}
