'use client'

import React from 'react'

interface FooterProps {
  isDark?: boolean
}

export function Footer({ isDark = false }: FooterProps) {
  const currentYear = new Date().getFullYear()

  return (
    <footer className={`app-footer ${isDark ? 'footer-dark' : 'footer-light'}`}>
      <div className="footer-content">
        <span className="copyright-text">
          © {currentYear} Super Más S.A.S. Todos los derechos reservados.
        </span>

        <a
          href="https://www.kytcode.lat"
          target="_blank"
          rel="noopener noreferrer"
          className="kyt-attribution"
          title="Desarrollado por K&T"
        >
          <span>Desarrollado por K&T</span>
          <span
            className={`heart-icon ${isDark ? 'heart-white' : 'heart-black'}`}
            aria-hidden="true"
          >
            {isDark ? '🤍' : '🖤'}
          </span>
        </a>
      </div>
    </footer>
  )
}
