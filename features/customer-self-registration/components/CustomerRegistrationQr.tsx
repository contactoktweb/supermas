'use client'

import React, { useMemo } from 'react'
import { qrSvg } from '@/lib/qr/qr-svg'
import { CUSTOMER_SELF_REGISTRATION_PATH } from '../routes'

/**
 * QR que el cajero muestra al cliente para que registre sus datos de facturación electrónica
 * desde su celular. El SVG se genera localmente con la URL del propio sistema.
 */
export function CustomerRegistrationQr() {
  const url = typeof window === 'undefined' ? '' : `${window.location.origin}${CUSTOMER_SELF_REGISTRATION_PATH}`
  const svg = useMemo(() => (url ? qrSvg(url, { ecc: 'M' }) : ''), [url])

  return (
    <figure className="customer-registration-qr">
      <div className="customer-registration-qr-code" role="img" aria-label="Código QR para registrar los datos de facturación" dangerouslySetInnerHTML={{ __html: svg }} />
      <figcaption>
        <strong>Pide al cliente que escanee el código</strong>
        <span>Registra sus datos para la factura electrónica. Luego búscalo por su documento.</span>
      </figcaption>
    </figure>
  )
}
