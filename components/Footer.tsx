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
            src={isDark ? '/logo-distribuidora-blanco.png' : '/logo-distribuidora.png'}
            alt="Distribuidora Super Más"
            className="footer-logo"
            style={{ height: '36px', width: 'auto', objectFit: 'contain' }}
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
          <svg
            className={`heart-icon ${isDark ? 'heart-white' : 'heart-black'}`}
            viewBox="0 0 24 24"
            width="14"
            height="14"
            fill={isDark ? '#ffffff' : '#000000'}
            aria-hidden="true"
            focusable="false"
          >
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
        </a>
      </div>
    </footer>
  )
}
