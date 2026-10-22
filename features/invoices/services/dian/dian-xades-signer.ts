/**
 * SUPER MÁS ERP/POS — Firma XAdES-BES enveloped de documentos UBL (Política de firma DIAN v2)
 *
 * - Canonicalización: C14N 1.0 inclusiva. Digest: SHA-256. Firma: RSA-SHA256.
 * - Referencias: documento completo (enveloped-signature), KeyInfo y SignedProperties.
 * - La firma se inserta en el segundo ext:UBLExtension/ext:ExtensionContent.
 */

import { createHash, createSign, randomUUID } from 'crypto'
import { canonicalize, el, findFirst, linkParents, serialize, XmlElement } from './xml/xml-tree'
import { DianSigningCertificate } from './dian-certificate'
import { DIAN_SIGNATURE_POLICY_HASH, DIAN_SIGNATURE_POLICY_URL } from './dian.config'

const ALG = {
  c14n: 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
  rsaSha256: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256',
  sha256: 'http://www.w3.org/2001/04/xmlenc#sha256',
  enveloped: 'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
  signedProps: 'http://uri.etsi.org/01903#SignedProperties',
}

const sha256b64 = (s: string) => createHash('sha256').update(s, 'utf8').digest('base64')

/** Hora de firma en Colombia con offset explícito: 2026-10-21T10:15:00-05:00 */
export function bogotaTimestamp(d = new Date()): string {
  const local = new Date(d.getTime() - 5 * 3600 * 1000)
  return local.toISOString().slice(0, 19) + '-05:00'
}

export interface XadesSignResult {
  signatureId: string
  /** Primeros 32 caracteres del SignatureValue (traza; no es secreto) */
  signatureValuePreview: string
}

export function signUblDocument(root: XmlElement, cert: DianSigningCertificate, signingTime = new Date()): XadesSignResult {
  linkParents(root)

  const exts = findFirst(root, (e) => e.name === 'ext:UBLExtensions')
  const slots = exts ? exts.children.filter((c): c is XmlElement => c.kind === 'element' && c.name === 'ext:UBLExtension') : []
  const slot = slots[1] && slots[1].children.find((c): c is XmlElement => c.kind === 'element' && c.name === 'ext:ExtensionContent')
  if (!slot) throw new Error('El XML no tiene el contenedor de firma (segundo ext:UBLExtension).')
  if (slot.children.length > 0) throw new Error('El documento ya está firmado.')

  const id = `xmldsig-${randomUUID()}`
  const keyInfoId = `${id}-keyinfo`
  const signedPropsId = `${id}-signedprops`

  const digestValue = (ref: string) => el('ds:DigestValue', { 'data-ref': ref })
  const signedInfo = el('ds:SignedInfo', null,
    el('ds:CanonicalizationMethod', { Algorithm: ALG.c14n }),
    el('ds:SignatureMethod', { Algorithm: ALG.rsaSha256 }),
    el('ds:Reference', { Id: `${id}-ref0`, URI: '' },
      el('ds:Transforms', null, el('ds:Transform', { Algorithm: ALG.enveloped })),
      el('ds:DigestMethod', { Algorithm: ALG.sha256 }),
      digestValue('doc')
    ),
    el('ds:Reference', { URI: `#${keyInfoId}` },
      el('ds:DigestMethod', { Algorithm: ALG.sha256 }),
      digestValue('keyinfo')
    ),
    el('ds:Reference', { Type: ALG.signedProps, URI: `#${signedPropsId}` },
      el('ds:DigestMethod', { Algorithm: ALG.sha256 }),
      digestValue('signedprops')
    )
  )

  const signatureValue = el('ds:SignatureValue', { Id: `${id}-sigvalue` })
  const keyInfo = el('ds:KeyInfo', { Id: keyInfoId },
    el('ds:X509Data', null, el('ds:X509Certificate', null, cert.certificateBase64))
  )
  const signedProperties = el('xades:SignedProperties', { Id: signedPropsId },
    el('xades:SignedSignatureProperties', null,
      el('xades:SigningTime', null, bogotaTimestamp(signingTime)),
      el('xades:SigningCertificate', null,
        el('xades:Cert', null,
          el('xades:CertDigest', null,
            el('ds:DigestMethod', { Algorithm: ALG.sha256 }),
            el('ds:DigestValue', null, cert.certificateDigestSha256)
          ),
          el('xades:IssuerSerial', null,
            el('ds:X509IssuerName', null, cert.issuerName),
            el('ds:X509SerialNumber', null, cert.serialNumber)
          )
        )
      ),
      el('xades:SignaturePolicyIdentifier', null,
        el('xades:SignaturePolicyId', null,
          el('xades:SigPolicyId', null, el('xades:Identifier', null, DIAN_SIGNATURE_POLICY_URL)),
          el('xades:SigPolicyHash', null,
            el('ds:DigestMethod', { Algorithm: ALG.sha256 }),
            el('ds:DigestValue', null, DIAN_SIGNATURE_POLICY_HASH)
          )
        )
      ),
      el('xades:SignerRole', null, el('xades:ClaimedRoles', null, el('xades:ClaimedRole', null, 'supplier')))
    )
  )

  const signature = el('ds:Signature', { Id: id },
    signedInfo,
    signatureValue,
    keyInfo,
    el('ds:Object', null, el('xades:QualifyingProperties', { Target: `#${id}` }, signedProperties))
  )

  slot.children.push(signature)
  signature.parent = slot
  linkParents(root)

  const setDigest = (ref: string, value: string) => {
    const node = findFirst(signedInfo, (e) => e.name === 'ds:DigestValue' && e.attrs.some(([k, v]) => k === 'data-ref' && v === ref))!
    node.attrs = node.attrs.filter(([k]) => k !== 'data-ref')
    node.children = [{ kind: 'text', value }]
  }

  // 1. Documento completo sin la firma (transformación enveloped-signature)
  setDigest('doc', sha256b64(canonicalize(root, new Set([signature]))))
  // 2. KeyInfo y 3. SignedProperties (canonicalizados con los namespaces heredados)
  setDigest('keyinfo', sha256b64(canonicalize(keyInfo)))
  setDigest('signedprops', sha256b64(canonicalize(signedProperties)))

  // 4. Firma RSA-SHA256 sobre SignedInfo canonicalizado
  const signer = createSign('RSA-SHA256')
  signer.update(canonicalize(signedInfo), 'utf8')
  const value = signer.sign(cert.privateKey, 'base64')
  signatureValue.children = [{ kind: 'text', value }]

  return { signatureId: id, signatureValuePreview: value.slice(0, 32) }
}

/** Firma el árbol y devuelve el XML serializado con declaración. */
export function signUblToString(root: XmlElement, cert: DianSigningCertificate, signingTime?: Date): string {
  signUblDocument(root, cert, signingTime)
  return serialize(root, true)
}
