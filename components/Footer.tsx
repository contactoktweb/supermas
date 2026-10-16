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
        <div className="footer-brand-wrap" style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={isDark ? '/logo-super-white.webp' : '/logo-super.webp'}
            alt="Super Más"
            className="footer-logo"
            style={{ height: '28px', width: 'auto', objectFit: 'contain' }}
          />
          <span className="copyright-text">
            © {currentYear} Super Más S.A.S. Todos los derechos reservados.
          </span>
        </div>

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
