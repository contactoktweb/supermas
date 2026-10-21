/**
 * SUPER MÁS ERP/POS — Lectura del certificado digital (.p12 / .pfx) para firma DIAN
 *
 * - El certificado llega en Base64 desde DIAN_CERTIFICATE_BASE64 y la contraseña desde
 *   DIAN_CERTIFICATE_PASSWORD (variables del servidor). Nunca desde el navegador ni la BD.
 * - Se usa node-forge solo para abrir el contenedor PKCS#12; la firma RSA-SHA256 la hace node:crypto.
 * - Ningún mensaje de error incluye la contraseña ni material de la llave.
 */

import { createHash, createPrivateKey, KeyObject } from 'crypto'

// node-forge no trae tipos propios; se usa sin tipado estricto.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const forge: any = require('node-forge')

export interface DianSigningCertificate {
  privateKey: KeyObject
  /** Certificado X.509 del firmante en DER Base64 (para ds:X509Certificate y BinarySecurityToken) */
  certificateBase64: string
  /** SHA-256 Base64 del DER del certificado (xades:CertDigest) */
  certificateDigestSha256: string
  /** Emisor en formato RFC 2253 (ds:X509IssuerName) */
  issuerName: string
  /** Serial en decimal (ds:X509SerialNumber) */
  serialNumber: string
  subjectCommonName: string
  /** Sujeto completo (RFC 2253): sirve para verificar que el certificado es de la empresa (NIT) */
  subjectName: string
  notBefore: Date
  notAfter: Date
}

export class DianCertificateError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DianCertificateError'
  }
}

const SHORT_NAMES: Record<string, string> = {
  commonName: 'CN',
  countryName: 'C',
  localityName: 'L',
  stateOrProvinceName: 'ST',
  organizationName: 'O',
  organizationalUnitName: 'OU',
  streetAddress: 'STREET',
  serialNumber: 'SERIALNUMBER',
  emailAddress: 'E',
}

function escapeRdnValue(v: string): string {
  return String(v).replace(/([,+"\\<>;])/g, '\\$1').replace(/^([ #])/, '\\$1').replace(/ $/, '\\ ')
}

/** Nombre distinguido en formato RFC 2253 (orden inverso al de la estructura ASN.1). */
function toRfc2253(attributes: Array<{ shortName?: string; name?: string; type: string; value: string }>): string {
  return attributes
    .slice()
    .reverse()
    .map((a) => {
      const key = a.shortName && a.shortName !== 'E' ? a.shortName : (a.name && SHORT_NAMES[a.name]) || a.type
      return `${key}=${escapeRdnValue(a.value)}`
    })
    .join(',')
}

export function loadSigningCertificate(base64: string | undefined, password: string | undefined, now = new Date()): DianSigningCertificate {
  if (!base64) throw new DianCertificateError('Certificado digital no configurado (DIAN_CERTIFICATE_BASE64).')
  if (password === undefined) throw new DianCertificateError('Contraseña del certificado no configurada (DIAN_CERTIFICATE_PASSWORD).')

  let p12: any
  try {
    const der = forge.util.decode64(base64.replace(/\s+/g, ''))
    const asn1 = forge.asn1.fromDer(der)
    p12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, password)
  } catch {
    throw new DianCertificateError('No se pudo abrir el certificado: archivo .p12/.pfx inválido o contraseña incorrecta.')
  }

  const keyBags = [
    ...(p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] || []),
    ...(p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] || []),
  ]
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || []

  const keyBag = keyBags.find((b: any) => b.key)
  if (!keyBag) throw new DianCertificateError('El certificado no contiene la llave privada.')
  const forgeKey = keyBag.key

  // Certificado del firmante: el que corresponde a la llave privada (el .p12 puede traer la cadena).
  const signerBag = certBags.find((b: any) => b.cert && b.cert.publicKey && b.cert.publicKey.n && b.cert.publicKey.n.equals(forgeKey.n))
  if (!signerBag) throw new DianCertificateError('No se encontró el certificado que corresponde a la llave privada.')
  const cert = signerBag.cert

  const certDer = Buffer.from(forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes(), 'binary')
  const privateKey = createPrivateKey({ key: forge.pki.privateKeyToPem(forgeKey), format: 'pem' })

  const notBefore: Date = cert.validity.notBefore
  const notAfter: Date = cert.validity.notAfter
  if (now < notBefore) throw new DianCertificateError(`El certificado aún no es válido (desde ${notBefore.toISOString().slice(0, 10)}).`)
  if (now > notAfter) throw new DianCertificateError(`El certificado venció el ${notAfter.toISOString().slice(0, 10)}.`)

  const cn = cert.subject.getField('CN')
  return {
    privateKey,
    certificateBase64: certDer.toString('base64'),
    certificateDigestSha256: createHash('sha256').update(certDer).digest('base64'),
    issuerName: toRfc2253(cert.issuer.attributes),
    serialNumber: BigInt('0x' + cert.serialNumber).toString(10),
    subjectCommonName: cn ? String(cn.value) : '',
    subjectName: toRfc2253(cert.subject.attributes),
    notBefore,
    notAfter,
  }
}

/** Metadatos públicos del certificado (sin llave) para mostrar al ADMIN. */
export function describeCertificate(c: DianSigningCertificate) {
  return {
    subject: c.subjectCommonName,
    subjectName: c.subjectName,
    issuer: c.issuerName,
    serialNumber: c.serialNumber,
    validFrom: c.notBefore.toISOString().slice(0, 10),
    validTo: c.notAfter.toISOString().slice(0, 10),
  }
}
