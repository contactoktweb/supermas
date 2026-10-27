/**
 * SUPER MÁS ERP/POS — CONFIGURACIÓN DIAN DEL SERVIDOR (SOFTWARE PROPIO)
 * Anexo Técnico Factura Electrónica de Venta v1.9 — Resolución DIAN 000165 de 2023
 *
 * Dónde vive cada dato (sin duplicar):
 *  - SECRETOS (solo variables de entorno del servidor, nunca BD ni navegador):
 *      DIAN_SOFTWARE_PIN, DIAN_TEST_TECHNICAL_KEY, DIAN_PRODUCTION_TECHNICAL_KEY,
 *      DIAN_CERTIFICATE_BASE64, DIAN_CERTIFICATE_PASSWORD
 *  - AMBIENTE: DIAN_ENVIRONMENT (HABILITACION | PRODUCCION). Producción solo transmite si la base de datos
 *    tiene activa la configuración y la resolución de PRODUCCION (fn_dian_active_environment).
 *  - DATOS FISCALES (base de datos, editables por ADMIN):
 *      emisor → public.companies; resolución/prefijo/rango/vigencia → public.dian_resolutions;
 *      Software ID y TestSetId → public.dian_software_config.
 *  - ENDPOINTS OFICIALES: constantes de este archivo (en habilitación sobrescribibles por variable de entorno;
 *    en producción siempre los oficiales).
 *
 * Reglas de seguridad:
 *  1. Módulo exclusivo de servidor: lanza error si se ejecuta en el navegador.
 *  2. Nunca expone PIN, clave técnica, certificado ni contraseña en resúmenes, logs ni errores.
 *  3. No existen valores fiscales "por defecto": si falta un dato, la emisión se detiene.
 */

import { z } from 'zod'

// ------------------------------------------------------------------------------
// 1. ENDPOINTS OFICIALES DIAN
// ------------------------------------------------------------------------------

export const DIAN_HABILITACION_WS_ENDPOINT = 'https://vpfe-hab.dian.gov.co/WcfDianCustomerServices.svc'
export const DIAN_PRODUCCION_WS_ENDPOINT = 'https://vpfe.dian.gov.co/WcfDianCustomerServices.svc'
export const DIAN_HABILITACION_QR_BASE_URL = 'https://catalogo-vpfe-hab.dian.gov.co/document/searchqr?documentkey='
export const DIAN_PRODUCCION_QR_BASE_URL = 'https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey='

/** Política de firma DIAN v2 (XAdES-BES) */
export const DIAN_SIGNATURE_POLICY_URL = 'https://facturaelectronica.dian.gov.co/politicadefirma/v2/politicadefirmav2.pdf'
/** SHA-256 (Base64) del documento de política de firma v2 publicado por la DIAN */
export const DIAN_SIGNATURE_POLICY_HASH = 'dMoMvtcG5aIzgYo0tIsSQeVJBDnUnfSOfBpxXrmor0Y='

/** NIT de la DIAN como AuthorizationProvider (sts:AuthorizationProviderID) */
export const DIAN_AUTHORIZATION_PROVIDER_NIT = '800197268'
export const DIAN_AUTHORIZATION_PROVIDER_DV = '4'

// ------------------------------------------------------------------------------
// 2. ESQUEMA DE VARIABLES DE ENTORNO
// ------------------------------------------------------------------------------

export const dianEnvSchema = z.object({
  DIAN_ENVIRONMENT: z.enum(['HABILITACION', 'PRODUCCION']),
  DIAN_SOFTWARE_PIN: z.string().optional(),
  DIAN_TEST_TECHNICAL_KEY: z.string().optional(),
  DIAN_PRODUCTION_TECHNICAL_KEY: z.string().optional(),
  DIAN_CERTIFICATE_BASE64: z.string().optional(),
  DIAN_CERTIFICATE_PASSWORD: z.string().optional(),
  DIAN_HABILITACION_WS_URL: z.string().url().optional(),
  DIAN_HABILITACION_QR_URL: z.string().url().optional(),
  DIAN_HTTP_TIMEOUT_MS: z.string().regex(/^[0-9]+$/).optional(),
})

// ------------------------------------------------------------------------------
// 3. TIPOS
// ------------------------------------------------------------------------------

export type DianEnvironment = 'HABILITACION' | 'PRODUCCION'

export interface DianSecretsConfig {
  readonly pin?: string
  readonly technicalKey?: string
  readonly certificateBase64?: string
  readonly certificatePassword?: string
}

export interface DianEndpointsConfig {
  readonly wsUrl: string
  readonly wsdlUrl: string
  readonly qrBaseUrl: string
}

export interface DianConfig {
  readonly environment: DianEnvironment
  /** '2' = pruebas/habilitación, '1' = producción (ProfileExecutionID y TipoAmb del CUFE) */
  readonly environmentCode: '1' | '2'
  readonly secrets: DianSecretsConfig
  readonly endpoints: DianEndpointsConfig
  readonly httpTimeoutMs: number
}

export interface DianConfigValidationReport {
  readonly isValid: boolean
  readonly canBuildXml: boolean
  readonly canSign: boolean
  readonly environment: DianEnvironment
  readonly checks: {
    readonly environmentConfigured: boolean
    readonly pinConfigured: boolean
    readonly technicalKeyConfigured: boolean
    readonly certificateConfigured: boolean
    readonly certificatePasswordConfigured: boolean
  }
  readonly errors: string[]
  readonly warnings: string[]
}

export interface DianSafeSummary {
  readonly environment: DianEnvironment
  readonly endpoints: { readonly wsUrl: string; readonly qrBaseUrl: string }
  readonly secrets: {
    readonly isPinConfigured: boolean
    readonly isTechnicalKeyConfigured: boolean
    readonly isCertificateConfigured: boolean
    readonly isCertificatePasswordConfigured: boolean
  }
  readonly validation: DianConfigValidationReport
}

// ------------------------------------------------------------------------------
// 4. UTILIDADES DE SEGURIDAD
// ------------------------------------------------------------------------------

/** Enmascara un identificador NO secreto (ej. Software ID) mostrando los últimos 4 caracteres. */
export function maskIdentifier(value?: string): string {
  if (!value || value.trim().length === 0) return 'NO CONFIGURADO'
  const trimmed = value.trim()
  if (trimmed.length <= 4) return '••••'
  return `••••••••-••••${trimmed.slice(-4)}`
}

function assertServerSideContext(): void {
  if (typeof window !== 'undefined') {
    throw new Error('VIOLACIÓN DE SEGURIDAD: la configuración DIAN solo puede usarse en el servidor.')
  }
}

const clean = (v?: string) => (v && v.trim().length > 0 ? v.trim() : undefined)

// ------------------------------------------------------------------------------
// 5. CARGA DE CONFIGURACIÓN
// ------------------------------------------------------------------------------

/**
 * Carga la configuración DIAN desde variables de entorno.
 * @param envOverrides Variables para pruebas, sin tocar process.env.
 */
export function loadDianConfig(envOverrides?: Record<string, string | undefined>): DianConfig {
  assertServerSideContext()
  const source = envOverrides || process.env

  const parsed = dianEnvSchema.parse({
    DIAN_ENVIRONMENT: source.DIAN_ENVIRONMENT || 'HABILITACION',
    DIAN_SOFTWARE_PIN: clean(source.DIAN_SOFTWARE_PIN),
    DIAN_TEST_TECHNICAL_KEY: clean(source.DIAN_TEST_TECHNICAL_KEY),
    DIAN_PRODUCTION_TECHNICAL_KEY: clean(source.DIAN_PRODUCTION_TECHNICAL_KEY),
    DIAN_CERTIFICATE_BASE64: clean(source.DIAN_CERTIFICATE_BASE64),
    DIAN_CERTIFICATE_PASSWORD: source.DIAN_CERTIFICATE_PASSWORD || undefined,
    DIAN_HABILITACION_WS_URL: clean(source.DIAN_HABILITACION_WS_URL),
    DIAN_HABILITACION_QR_URL: clean(source.DIAN_HABILITACION_QR_URL),
    DIAN_HTTP_TIMEOUT_MS: clean(source.DIAN_HTTP_TIMEOUT_MS),
  })

  const secretsBase = {
    pin: parsed.DIAN_SOFTWARE_PIN,
    certificateBase64: parsed.DIAN_CERTIFICATE_BASE64,
    certificatePassword: parsed.DIAN_CERTIFICATE_PASSWORD,
  }
  const httpTimeoutMs = parsed.DIAN_HTTP_TIMEOUT_MS ? parseInt(parsed.DIAN_HTTP_TIMEOUT_MS, 10) : 60000

  // Producción: endpoints oficiales fijos (sin sobrescritura) y clave técnica de la resolución real.
  if (parsed.DIAN_ENVIRONMENT === 'PRODUCCION') {
    return {
      environment: 'PRODUCCION',
      environmentCode: '1',
      secrets: { ...secretsBase, technicalKey: parsed.DIAN_PRODUCTION_TECHNICAL_KEY },
      endpoints: {
        wsUrl: DIAN_PRODUCCION_WS_ENDPOINT,
        wsdlUrl: `${DIAN_PRODUCCION_WS_ENDPOINT}?wsdl`,
        qrBaseUrl: DIAN_PRODUCCION_QR_BASE_URL,
      },
      httpTimeoutMs,
    }
  }

  const wsUrl = parsed.DIAN_HABILITACION_WS_URL || DIAN_HABILITACION_WS_ENDPOINT
  if (!/^https:\/\/vpfe-hab\.dian\.gov\.co\//.test(wsUrl)) {
    throw new Error('BLOQUEO FISCAL DE SEGURIDAD: en habilitación el WebService debe ser https://vpfe-hab.dian.gov.co/.')
  }

  return {
    environment: 'HABILITACION',
    environmentCode: '2',
    secrets: { ...secretsBase, technicalKey: parsed.DIAN_TEST_TECHNICAL_KEY },
    endpoints: {
      wsUrl,
      wsdlUrl: `${wsUrl}?wsdl`,
      qrBaseUrl: parsed.DIAN_HABILITACION_QR_URL || DIAN_HABILITACION_QR_BASE_URL,
    },
    httpTimeoutMs,
  }
}

// ------------------------------------------------------------------------------
// 6. VALIDACIÓN (sin revelar secretos)
// ------------------------------------------------------------------------------

export function validateDianConfiguration(config: DianConfig): DianConfigValidationReport {
  const errors: string[] = []
  const warnings: string[] = []

  const environmentConfigured = true
  const pinConfigured = Boolean(config.secrets.pin)
  const technicalKeyConfigured = Boolean(config.secrets.technicalKey)
  const certificateConfigured = Boolean(config.secrets.certificateBase64)
  const certificatePasswordConfigured = Boolean(config.secrets.certificatePassword)

  if (!pinConfigured) errors.push('DIAN_SOFTWARE_PIN no está configurado (requerido para el SoftwareSecurityCode).')
  if (!technicalKeyConfigured) {
    const keyVar = config.environment === 'PRODUCCION' ? 'DIAN_PRODUCTION_TECHNICAL_KEY' : 'DIAN_TEST_TECHNICAL_KEY'
    errors.push(`${keyVar} no está configurada (requerida para calcular el CUFE).`)
  } else if (!/^[0-9a-fA-F]{20,}$/.test(config.secrets.technicalKey!)) {
    warnings.push('La clave técnica no parece hexadecimal; verifique que la copió completa del portal DIAN.')
  }
  if (!certificateConfigured) warnings.push('Certificado digital pendiente: sin él no se puede firmar ni transmitir.')
  if (certificateConfigured && !certificatePasswordConfigured) {
    errors.push('DIAN_CERTIFICATE_PASSWORD no está configurada y el certificado la requiere.')
  }

  const canBuildXml = pinConfigured && technicalKeyConfigured
  const canSign = canBuildXml && certificateConfigured && certificatePasswordConfigured

  return {
    isValid: errors.length === 0,
    canBuildXml,
    canSign,
    environment: config.environment,
    checks: {
      environmentConfigured,
      pinConfigured,
      technicalKeyConfigured,
      certificateConfigured,
      certificatePasswordConfigured,
    },
    errors,
    warnings,
  }
}

export function getDianSafeSummary(config?: DianConfig): DianSafeSummary {
  const active = config || loadDianConfig()
  return {
    environment: active.environment,
    endpoints: { wsUrl: active.endpoints.wsUrl, qrBaseUrl: active.endpoints.qrBaseUrl },
    secrets: {
      isPinConfigured: Boolean(active.secrets.pin),
      isTechnicalKeyConfigured: Boolean(active.secrets.technicalKey),
      isCertificateConfigured: Boolean(active.secrets.certificateBase64),
      isCertificatePasswordConfigured: Boolean(active.secrets.certificatePassword),
    },
    validation: validateDianConfiguration(active),
  }
}

// ------------------------------------------------------------------------------
// 7. SINGLETON DEL SERVIDOR
// ------------------------------------------------------------------------------

let _cached: DianConfig | null = null

export function getDianConfig(): DianConfig {
  if (!_cached) _cached = loadDianConfig()
  return _cached
}

export function resetDianConfigCache(): void {
  _cached = null
}
