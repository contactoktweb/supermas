/**
 * Parámetros de Configuración General que consumen los demás módulos (inventario, cajas, POS,
 * exógena, seguridad y catálogos). Una sola lectura de system_settings con valores por defecto
 * seguros si una clave no existe. En el navegador se cachea brevemente para no repetir consultas.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabaseClient } from '@/lib/supabase/client'

export const RUNTIME_SETTING_KEYS = {
  inventory: 'inventory.policies',
  pos: 'pos.terminal_rules',
  ecommerce: 'ecommerce.dispatch_node',
  exogenaYear: 'exogena.reporting.default_year',
  sessionTimeout: 'security.session.timeout_minutes',
} as const

export interface RuntimeSettings {
  inventory: {
    defaultMinStockThreshold: number
    criticalLowStockThreshold: number
  }
  pos: {
    defaultLocationId: string
    autoPrintReceipt: boolean
  }
  cash: {
    recommendedInitialFloat: number
    maxAllowedInitialFloat: number
    maxDifferenceToleranceAmount: number
  }
  storefront: {
    superCatalogEnabled: boolean
    distributorCatalogEnabled: boolean
    whatsappPhone: string
    whatsappQuoteTemplate: string
  }
  exogenaDefaultYear: number
  sessionTimeoutMinutes: number
}

export const DEFAULT_RUNTIME_SETTINGS: RuntimeSettings = {
  inventory: { defaultMinStockThreshold: 10, criticalLowStockThreshold: 3 },
  pos: { defaultLocationId: '', autoPrintReceipt: false },
  cash: { recommendedInitialFloat: 100000, maxAllowedInitialFloat: 0, maxDifferenceToleranceAmount: 0 },
  storefront: {
    superCatalogEnabled: true,
    distributorCatalogEnabled: true,
    whatsappPhone: '',
    whatsappQuoteTemplate: 'Hola, estoy interesado en cotizar el producto "{{product}}" (SKU: {{sku}}).',
  },
  exogenaDefaultYear: new Date().getFullYear() - 1,
  sessionTimeoutMinutes: 60,
}

const CACHE_MS = 60_000
let cache: { at: number; value: RuntimeSettings } | null = null

type JsonRecord = Record<string, unknown>
const asRecord = (value: unknown): JsonRecord => {
  if (typeof value === 'string') {
    try {
      return asRecord(JSON.parse(value))
    } catch {
      return {}
    }
  }
  return value && typeof value === 'object' ? (value as JsonRecord) : {}
}
const num = (value: unknown, fallback: number) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}
const bool = (value: unknown, fallback: boolean) => (typeof value === 'boolean' ? value : fallback)
const str = (value: unknown, fallback: string) => (typeof value === 'string' ? value : fallback)

export function parseRuntimeSettings(rows: Array<{ key: string; value: unknown }>): RuntimeSettings {
  const byKey = new Map(rows.map((row) => [row.key, row.value]))
  const d = DEFAULT_RUNTIME_SETTINGS
  const inventory = asRecord(byKey.get(RUNTIME_SETTING_KEYS.inventory))
  const pos = asRecord(byKey.get(RUNTIME_SETTING_KEYS.pos))
  const cash = asRecord(pos.cashRegisterRules)
  const ecommerce = asRecord(byKey.get(RUNTIME_SETTING_KEYS.ecommerce))
  const whatsapp = asRecord(ecommerce.whatsapp)

  return {
    inventory: {
      defaultMinStockThreshold: num(inventory.defaultMinStockThreshold, d.inventory.defaultMinStockThreshold),
      criticalLowStockThreshold: num(inventory.criticalLowStockThreshold, d.inventory.criticalLowStockThreshold),
    },
    pos: {
      defaultLocationId: str(pos.defaultLocationId, d.pos.defaultLocationId),
      autoPrintReceipt: bool(pos.autoPrintReceipt, d.pos.autoPrintReceipt),
    },
    cash: {
      recommendedInitialFloat: num(cash.recommendedInitialFloat, d.cash.recommendedInitialFloat),
      maxAllowedInitialFloat: num(cash.maxAllowedInitialFloat, d.cash.maxAllowedInitialFloat),
      maxDifferenceToleranceAmount: num(cash.maxDifferenceToleranceAmount, d.cash.maxDifferenceToleranceAmount),
    },
    storefront: {
      superCatalogEnabled: bool(ecommerce.superCatalogEnabled, d.storefront.superCatalogEnabled),
      distributorCatalogEnabled: bool(ecommerce.distributorCatalogEnabled, d.storefront.distributorCatalogEnabled),
      whatsappPhone: str(whatsapp.phoneNumber, d.storefront.whatsappPhone).replace(/[^\d]/g, ''),
      whatsappQuoteTemplate: str(whatsapp.defaultQuoteTemplate, '') || d.storefront.whatsappQuoteTemplate,
    },
    exogenaDefaultYear: num(byKey.get(RUNTIME_SETTING_KEYS.exogenaYear), d.exogenaDefaultYear),
    sessionTimeoutMinutes: num(byKey.get(RUNTIME_SETTING_KEYS.sessionTimeout), d.sessionTimeoutMinutes),
  }
}

/** Lee los parámetros vigentes. `client` permite usarlo en el servidor con el cliente de servicio. */
export async function getRuntimeSettings(client: SupabaseClient = supabaseClient): Promise<RuntimeSettings> {
  const isBrowser = typeof window !== 'undefined'
  if (isBrowser && cache && Date.now() - cache.at < CACHE_MS) return cache.value

  const { data, error } = await client
    .from('system_settings')
    .select('key, value')
    .in('key', Object.values(RUNTIME_SETTING_KEYS))
  if (error) return DEFAULT_RUNTIME_SETTINGS

  const value = parseRuntimeSettings((data ?? []) as Array<{ key: string; value: unknown }>)
  if (isBrowser) cache = { at: Date.now(), value }
  return value
}

/** Descarta la caché tras guardar cambios en Configuración. */
export function invalidateRuntimeSettings(): void {
  cache = null
}

/** Arma el mensaje de cotización por WhatsApp a partir de la plantilla configurada. */
export function buildWhatsAppQuoteMessage(template: string, product: { name: string; sku: string }): string {
  return template.replace(/\{\{\s*product\s*\}\}/g, product.name).replace(/\{\{\s*sku\s*\}\}/g, product.sku)
}
