'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * Renderiza modales y paneles laterales directamente en document.body.
 * Evita que `position: fixed` quede atrapado dentro de un contenedor con
 * `transform` (por ejemplo la animación de entrada de página), que desplaza
 * y recorta el panel.
 */
export function ModalPortal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return mounted ? createPortal(children, document.body) : null
}
