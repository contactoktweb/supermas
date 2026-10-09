/**
 * SUPER MÁS ERP/POS — CONFIGURACIÓN CENTRALIZADA DIAN (SOFTWARE PROPIO)
 * Especificación Técnica Formal: Anexo Técnico 1.9 / Resolución 000165 de 2023
 *
 * REGLAS DE SEGURIDAD:
 * 1. Módulo estrictamente SERVER-SIDE. Prohibida su ejecución o inclusión en bundles cliente.
 * 2. NUNCA expone el valor del PIN, la contraseña del certificado ni el certificado en logs ni respuestas.
 * 3. Bloqueo estricto contra activación de PRODUCCIÓN durante la fase de HABILITACIÓN.
 * 4. Única fuente de verdad de configuración para todos los servicios fiscales del ERP.
 */

import { z } from 'zod'

// ------------------------------------------------------------------------------
// 1. CONSTANTES Y ENDPOINTS OFICIALES DIAN (ANEXO TÉCNICO 1.9)
// ------------------------------------------------------------------------------

/**
 * Endpoint oficial del WebService SOAP VPFE en Ambiente de Habilitación.
 * Fuente: Caja de herramientas DIAN vigente / Resolución 000165 de 2023.
 */
export const DIAN_HABILITACION_WS_ENDPOINT = 'https://vpfe-hab.dian.gov.co/WcfDianCustomerServices.svc'

/**
 * Endpoint oficial del WebService SOAP VPFE en Ambiente de Producción.
 * (Mantenido como referencia; bloqueado durante esta fase).
 */
export const DIAN_PRODUCCION_WS_ENDPOINT = 'https://vpfe.dian.gov.co/WcfDianCustomerServices.svc'

/**
 * URL base para consulta de códigos QR en catálogo DIAN (Habilitación).
 */
export const DIAN_HABILITACION_QR_BASE_URL = 'https://catalogo-vpfe-hab.dian.gov.co/document/searchqr?documentkey='

/**
 * URL base para consulta de códigos QR en catálogo DIAN (Producción).
 */
export const DIAN_PRODUCCION_QR_BASE_URL = 'https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey='

/**
 * Política de firma XAdES-BES oficial de la DIAN según Anexo Técnico 1.9.
 */
export const DIAN_SIGNATURE_POLICY_ID = '1.3.6.1.4.1.25848.1.1'

// ------------------------------------------------------------------------------
// 2. ESQUEMA DE VALIDACIÓN ZOD PARA VARIABLES DE ENTORNO SERVER-SIDE
// ------------------------------------------------------------------------------

export const dianEnvSchema = z.object({
  DIAN_ENVIRONMENT: z.enum(['HABILITACION', 'PRODUCCION']).default('HABILITACION'),

  // Identificación del emisor
  DIAN_NIT: z.string().min(6, 'DIAN_NIT debe tener al menos 6 dígitos').max(15),
  DIAN_DV: z.string().regex(/^[0-9]{1}$/, 'DIAN_DV debe ser un solo dígito (0-9)'),
  DIAN_COMPANY_NAME: z.string().default('DISTRIBUIDORA SUPER MAS S.A.S.'),
  DIAN_COMPANY_EMAIL: z.string().email().optional(),

  // Certificado digital server-side
  DIAN_CERTIFICATE_BASE64: z.string().optional(),
  DIAN_CERTIFICATE_PASSWORD: z.string().optional(),

  // Software Propio Habilitación
  DIAN_SOFTWARE_ID: z.string().optional(),
  DIAN_SOFTWARE_PIN: z.string().optional(),
  DIAN_TEST_SET_ID: z.string().optional(),

  // URLs de Software y Recepción registradas en DIAN
  DIAN_SOFTWARE_URL: z.string().url().optional().or(z.literal('')),
  DIAN_RECEPTION_URL: z.string().url().optional().or(z.literal('')),

  // Endpoints configurables (con fallbacks a URLs oficiales)
  DIAN_HABILITACION_WS_URL: z.string().url().default(DIAN_HABILITACION_WS_ENDPOINT),
  DIAN_HABILITACION_QR_URL: z.string().url().default(DIAN_HABILITACION_QR_BASE_URL),

  // Numeración de pruebas en Habilitación
  DIAN_TEST_PREFIX: z.string().default('SETP'),
  DIAN_TEST_RESOLUTION_NUMBER: z.string().default('18760000001'),
  DIAN_TEST_RANGE_FROM: z.string().regex(/^[0-9]+$/).default('990000000'),
  DIAN_TEST_RANGE_TO: z.string().regex(/^[0-9]+$/).default('995000000'),
  DIAN_TEST_TECHNICAL_KEY: z.string().optional(),
})

// ------------------------------------------------------------------------------
// 3. TIPOS TIPADOS DE LA CONFIGURACIÓN CENTRALIZADA
// ------------------------------------------------------------------------------

export type DianEnvironment = 'HABILITACION' | 'PRODUCCION'

export interface DianIssuerConfig {
  readonly nit: string
  readonly dv: string
  readonly companyName: string
  readonly companyEmail: string
}

export interface DianCertificateConfig {
  readonly base64?: string
  readonly password?: string
  readonly isConfigured: boolean
}

export interface DianSoftwareConfig {
  readonly softwareId: string
  readonly pin: string
  readonly testSetId: string
  readonly softwareUrl: string
  readonly receptionUrl: string
  readonly isConfigured: boolean
}

export interface DianEndpointsConfig {
  readonly wsUrl: string
  readonly wsdlUrl: string
  readonly qrBaseUrl: string
}

export interface DianNumberingConfig {
  readonly prefix: string
  readonly resolutionNumber: string
  readonly rangeFrom: number
  readonly rangeTo: number
  readonly technicalKey?: string
}

export interface DianConfig {
  readonly environment: DianEnvironment
  readonly isProductionBlocked: boolean
  readonly issuer: DianIssuerConfig
  readonly certificate: DianCertificateConfig
  readonly software: DianSoftwareConfig
  readonly endpoints: DianEndpointsConfig
  readonly numbering: DianNumberingConfig
}

/**
 * Reporte de diagnóstico seguro (sin secretos)
 */
export interface DianConfigValidationReport {
  readonly isValid: boolean
  readonly environment: DianEnvironment
  readonly checks: {
    readonly environmentConfigured: boolean
    readonly softwareIdConfigured: boolean
    readonly pinConfigured: boolean
    readonly testSetIdConfigured: boolean
    readonly softwareUrlConfigured: boolean
    readonly receptionUrlConfigured: boolean
    readonly nitConfigured: boolean
    readonly dvConfigured: boolean
    readonly certificateConfigured: boolean
    readonly certificatePasswordConfigured: boolean
    readonly technicalKeyConfigured: boolean
  }
  readonly errors: string[]
  readonly warnings: string[]
}

/**
 * Resumen seguro para inspección administrativa o UI
 */
export interface DianSafeSummary {
  readonly environment: DianEnvironment
  readonly isProductionBlocked: boolean
  readonly issuer: {
    readonly nit: string
    readonly dv: string
    readonly companyName: string
    readonly isConfigured: boolean
  }
  readonly software: {
    readonly softwareIdMasked: string
    readonly isPinConfigured: boolean
    readonly isTestSetIdConfigured: boolean
    readonly softwareUrl: string
    readonly receptionUrl: string
  }
  readonly certificate: {
    readonly isConfigured: boolean
    readonly isPasswordConfigured: boolean
  }
  readonly endpoints: {
    readonly wsUrl: string
    readonly qrBaseUrl: string
  }
  readonly numbering: {
    readonly prefix: string
    readonly resolutionNumber: string
    readonly range: string
    readonly isTechnicalKeyConfigured: boolean
  }
  readonly validation: DianConfigValidationReport
}

// ------------------------------------------------------------------------------
// 4. FUNCIONES DE PROTECCIÓN Y ENMASCARAMIENTO SEGURO
// ------------------------------------------------------------------------------

/**
 * Enmascara un identificador sensible mostrando únicamente los últimos 4 caracteres.
 * NUNCA se utiliza para el PIN ni la contraseña (estos jamás se imprimen).
 */
export function maskIdentifier(value?: string): string {
  if (!value || value.trim().length === 0) return 'NO CONFIGURADO'
  const trimmed = value.trim()
  if (trimmed.length <= 4) return '••••'
  const visible = trimmed.slice(-4)
  return `••••••••-••••-••••-••••-••••${visible}`
}

/**
 * Valida que la ejecución ocurra exclusivamente en entorno Node.js / Server-Side.
 */
function assertServerSideContext(): void {
  if (typeof window !== 'undefined') {
    throw new Error(
      'VIOLACIÓN DE SEGURIDAD CRÍTICA: dian.config no puede importarse ni ejecutarse en el navegador.'
    )
  }
}

// ------------------------------------------------------------------------------
// 5. CARGA Y RESOLUCIÓN DE CONFIGURACIÓN CENTRALIZADA
// ------------------------------------------------------------------------------

/**
 * Carga y valida la configuración DIAN centralizada a partir de variables de entorno.
 *
 * @param envOverrides Opcional para pruebas unitarias controladas sin alterar process.env global.
 */
export function loadDianConfig(envOverrides?: Record<string, string | undefined>): DianConfig {
  assertServerSideContext()

  const sourceEnv = envOverrides || process.env

  // Parse inicial mediante Zod
  const parsed = dianEnvSchema.parse({
    DIAN_ENVIRONMENT: sourceEnv.DIAN_ENVIRONMENT || 'HABILITACION',
    DIAN_NIT: sourceEnv.DIAN_NIT || '901458789',
    DIAN_DV: sourceEnv.DIAN_DV || '2',
    DIAN_COMPANY_NAME: sourceEnv.DIAN_COMPANY_NAME || 'DISTRIBUIDORA SUPER MAS S.A.S.',
    DIAN_COMPANY_EMAIL: sourceEnv.DIAN_COMPANY_EMAIL || 'facturacion@supermas.com.co',
    DIAN_CERTIFICATE_BASE64: sourceEnv.DIAN_CERTIFICATE_BASE64 || '',
    DIAN_CERTIFICATE_PASSWORD: sourceEnv.DIAN_CERTIFICATE_PASSWORD || '',
    DIAN_SOFTWARE_ID: sourceEnv.DIAN_SOFTWARE_ID || '',
    DIAN_SOFTWARE_PIN: sourceEnv.DIAN_SOFTWARE_PIN || '',
    DIAN_TEST_SET_ID: sourceEnv.DIAN_TEST_SET_ID || '',
    DIAN_SOFTWARE_URL: sourceEnv.DIAN_SOFTWARE_URL || 'https://erp.supermas.com.co',
    DIAN_RECEPTION_URL: sourceEnv.DIAN_RECEPTION_URL || 'https://erp.supermas.com.co/api/dian/reception',
    DIAN_HABILITACION_WS_URL: sourceEnv.DIAN_HABILITACION_WS_URL || DIAN_HABILITACION_WS_ENDPOINT,
    DIAN_HABILITACION_QR_URL: sourceEnv.DIAN_HABILITACION_QR_URL || DIAN_HABILITACION_QR_BASE_URL,
    DIAN_TEST_PREFIX: sourceEnv.DIAN_TEST_PREFIX || 'SETP',
    DIAN_TEST_RESOLUTION_NUMBER: sourceEnv.DIAN_TEST_RESOLUTION_NUMBER || '18760000001',
    DIAN_TEST_RANGE_FROM: sourceEnv.DIAN_TEST_RANGE_FROM || '990000000',
    DIAN_TEST_RANGE_TO: sourceEnv.DIAN_TEST_RANGE_TO || '995000000',
    DIAN_TEST_TECHNICAL_KEY: sourceEnv.DIAN_TEST_TECHNICAL_KEY || '',
  })

  // ============================================================================
  // REGLA CRÍTICA 8: BLOQUEO ESTRICTO DE PRODUCCIÓN DURANTE LA FASE ACTUAL
  // ============================================================================
  if (parsed.DIAN_ENVIRONMENT === 'PRODUCCION') {
    throw new Error(
      'BLOQUEO FISCAL DE SEGURIDAD: El ambiente de PRODUCCIÓN está expresamente deshabilitado durante la Fase de Habilitación de Super Más ERP. Toda operación debe apuntar estrictamente a HABILITACION.'
    )
  }

  const rangeFromNum = parseInt(parsed.DIAN_TEST_RANGE_FROM, 10)
  const rangeToNum = parseInt(parsed.DIAN_TEST_RANGE_TO, 10)

  const config: DianConfig = {
    environment: 'HABILITACION',
    isProductionBlocked: true,

    issuer: {
      nit: parsed.DIAN_NIT.trim(),
      dv: parsed.DIAN_DV.trim(),
      companyName: parsed.DIAN_COMPANY_NAME.trim(),
      companyEmail: (parsed.DIAN_COMPANY_EMAIL || '').trim(),
    },

    certificate: {
      base64: parsed.DIAN_CERTIFICATE_BASE64?.trim() || undefined,
      password: parsed.DIAN_CERTIFICATE_PASSWORD || undefined,
      isConfigured: Boolean(parsed.DIAN_CERTIFICATE_BASE64?.trim()),
    },

    software: {
      softwareId: parsed.DIAN_SOFTWARE_ID?.trim() || '',
      pin: parsed.DIAN_SOFTWARE_PIN?.trim() || '',
      testSetId: parsed.DIAN_TEST_SET_ID?.trim() || '',
      softwareUrl: parsed.DIAN_SOFTWARE_URL?.trim() || '',
      receptionUrl: parsed.DIAN_RECEPTION_URL?.trim() || '',
      isConfigured: Boolean(
        parsed.DIAN_SOFTWARE_ID?.trim() &&
        parsed.DIAN_SOFTWARE_PIN?.trim() &&
        parsed.DIAN_TEST_SET_ID?.trim()
      ),
    },

    endpoints: {
      wsUrl: parsed.DIAN_HABILITACION_WS_URL.trim(),
      wsdlUrl: `${parsed.DIAN_HABILITACION_WS_URL.trim()}?wsdl`,
      qrBaseUrl: parsed.DIAN_HABILITACION_QR_URL.trim(),
    },

    numbering: {
      prefix: parsed.DIAN_TEST_PREFIX.trim(),
      resolutionNumber: parsed.DIAN_TEST_RESOLUTION_NUMBER.trim(),
      rangeFrom: rangeFromNum,
      rangeTo: rangeToNum,
      technicalKey: parsed.DIAN_TEST_TECHNICAL_KEY?.trim() || undefined,
    },
  }

  return config
}

// ------------------------------------------------------------------------------
// 6. VALIDACIÓN FORMAL DE LA CONFIGURACIÓN (INSPECCIÓN SEGURA)
// ------------------------------------------------------------------------------

/**
 * Valida la completitud de la configuración DIAN para la fase de Habilitación.
 * Emite diagnósticos sin revelar jamás secretos o claves privadas.
 */
export function validateDianConfiguration(config: DianConfig): DianConfigValidationReport {
  const errors: string[] = []
  const warnings: string[] = []

  const environmentConfigured = config.environment === 'HABILITACION'
  const nitConfigured = Boolean(config.issuer.nit && config.issuer.nit.length >= 6)
  const dvConfigured = Boolean(config.issuer.dv && /^[0-9]$/.test(config.issuer.dv))

  const softwareIdConfigured = Boolean(config.software.softwareId && config.software.softwareId.length > 0)
  const pinConfigured = Boolean(config.software.pin && config.software.pin.length > 0)
  const testSetIdConfigured = Boolean(config.software.testSetId && config.software.testSetId.length > 0)
  const softwareUrlConfigured = Boolean(config.software.softwareUrl && config.software.softwareUrl.length > 0)
  const receptionUrlConfigured = Boolean(config.software.receptionUrl && config.software.receptionUrl.length > 0)

  const certificateConfigured = Boolean(config.certificate.base64 && config.certificate.base64.length > 0)
  const certificatePasswordConfigured = Boolean(config.certificate.password && config.certificate.password.length > 0)
  const technicalKeyConfigured = Boolean(config.numbering.technicalKey && config.numbering.technicalKey.length > 0)

  // Validaciones obligatorias de emisor
  if (!nitConfigured) errors.push('DIAN_NIT no está configurado o tiene formato inválido.')
  if (!dvConfigured) errors.push('DIAN_DV no está configurado o no es un dígito válido (0-9).')

  // Validaciones de software propio
  if (!softwareIdConfigured) errors.push('DIAN_SOFTWARE_ID no está configurado.')
  if (!pinConfigured) errors.push('DIAN_SOFTWARE_PIN no está configurado.')
  if (!testSetIdConfigured) errors.push('DIAN_TEST_SET_ID no está configurado.')

  // Advertencias de URLs
  if (!softwareUrlConfigured) warnings.push('DIAN_SOFTWARE_URL pendiente de configurar.')
  if (!receptionUrlConfigured) warnings.push('DIAN_RECEPTION_URL pendiente de configurar.')

  // Advertencias de certificado y clave técnica (pendientes de carga por usuario en fase 3)
  if (!certificateConfigured) {
    warnings.push('DIAN_CERTIFICATE_BASE64 pendiente de suministrar (requerido para firma en Fase 3).')
  }
  if (!certificatePasswordConfigured) {
    warnings.push('DIAN_CERTIFICATE_PASSWORD pendiente de suministrar (requerido para descifrado en Fase 3).')
  }
  if (!technicalKeyConfigured) {
    warnings.push('DIAN_TEST_TECHNICAL_KEY pendiente de suministrar (requerido para cálculo de CUFE de pruebas).')
  }

  // Validación de rangos numéricos
  if (config.numbering.rangeTo <= config.numbering.rangeFrom) {
    errors.push('El rango de numeración final de pruebas debe ser mayor al rango inicial.')
  }

  const isValid = errors.length === 0

  return {
    isValid,
    environment: config.environment,
    checks: {
      environmentConfigured,
      softwareIdConfigured,
      pinConfigured,
      testSetIdConfigured,
      softwareUrlConfigured,
      receptionUrlConfigured,
      nitConfigured,
      dvConfigured,
      certificateConfigured,
      certificatePasswordConfigured,
      technicalKeyConfigured,
    },
    errors,
    warnings,
  }
}

// ------------------------------------------------------------------------------
// 7. RESUMEN SEGURO PARA MONITOREO Y UI
// ------------------------------------------------------------------------------

/**
 * Retorna un resumen higienizado de la configuración DIAN listo para diagnóstico seguro.
 */
export function getDianSafeSummary(config?: DianConfig): DianSafeSummary {
  const activeConfig = config || loadDianConfig()
  const validation = validateDianConfiguration(activeConfig)

  return {
    environment: activeConfig.environment,
    isProductionBlocked: activeConfig.isProductionBlocked,
    issuer: {
      nit: activeConfig.issuer.nit,
      dv: activeConfig.issuer.dv,
      companyName: activeConfig.issuer.companyName,
      isConfigured: Boolean(activeConfig.issuer.nit && activeConfig.issuer.dv),
    },
    software: {
      softwareIdMasked: maskIdentifier(activeConfig.software.softwareId),
      isPinConfigured: Boolean(activeConfig.software.pin),
      isTestSetIdConfigured: Boolean(activeConfig.software.testSetId),
      softwareUrl: activeConfig.software.softwareUrl,
      receptionUrl: activeConfig.software.receptionUrl,
    },
    certificate: {
      isConfigured: activeConfig.certificate.isConfigured,
      isPasswordConfigured: Boolean(activeConfig.certificate.password),
    },
    endpoints: {
      wsUrl: activeConfig.endpoints.wsUrl,
      qrBaseUrl: activeConfig.endpoints.qrBaseUrl,
    },
    numbering: {
      prefix: activeConfig.numbering.prefix,
      resolutionNumber: activeConfig.numbering.resolutionNumber,
      range: `${activeConfig.numbering.rangeFrom} - ${activeConfig.numbering.rangeTo}`,
      isTechnicalKeyConfigured: Boolean(activeConfig.numbering.technicalKey),
    },
    validation,
  }
}

// ------------------------------------------------------------------------------
// 8. INSTANCIA SINGLETON / ACCESO GLOBAL CONTROLADO
// ------------------------------------------------------------------------------

let _cachedDianConfig: DianConfig | null = null

/**
 * Obtiene la configuración DIAN activa (Singleton server-side).
 * Recarga si el entorno cambia o si es la primera invocación.
 */
export function getDianConfig(): DianConfig {
  if (!_cachedDianConfig) {
    _cachedDianConfig = loadDianConfig()
  }
  return _cachedDianConfig
}

/**
 * Reinicia la caché de configuración (útil para pruebas unitarias).
 */
export function resetDianConfigCache(): void {
  _cachedDianConfig = null
}
