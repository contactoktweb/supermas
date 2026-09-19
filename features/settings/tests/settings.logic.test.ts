/**
 * SUPER MÁS ERP/POS - Suite de Pruebas Automatizadas de Lógica del Módulo Configuración
 *
 * Valida:
 * 1. Validación Zod de esquemas (empresa, inventario, POS, ecommerce, dynamic settings).
 * 2. Cálculo de métricas del dashboard de configuración (settingsService.getStats()).
 * 3. Consulta de información corporativa e institucional de la empresa.
 * 4. Actualización de datos de empresa con registro en auditoría.
 * 5. Consulta y actualización de políticas de inventario y método de valoración.
 * 6. Consulta y actualización de reglas de punto de venta (POS) y medios de pago.
 * 7. Configuración de canales web, nodo de despacho CEDI y WhatsApp comercial.
 * 8. Consulta y mutación de variables dinámicas del sistema (key-value extensible).
 * 9. Detección y clasificación de modificaciones críticas (isCritical).
 * 10. Consulta de matriz de roles predefinidos (inmutabilidad y solo lectura).
 * 11. Seguridad y control de acceso basado en roles (RBAC).
 * 12. Trazabilidad inmutable en auditService y db.auditLogs (campos previousValue y newValue).
 *
 * Ejecutable vía: npx tsx features/settings/tests/settings.logic.test.ts
 */

import { settingsService, DEFAULT_SETTINGS_USER } from '../services/settings.service'
import { settingsRepository } from '../repositories/settings.repository'
import {
  companySettingsSchema,
  inventorySettingsSchema,
  posSettingsSchema,
  ecommerceSettingsSchema,
  updateDynamicSettingSchema,
} from '../schemas/settings.schema'
import { UserSettingsContext } from '../types'
import { db } from '@/lib/supabase/db'

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`)
    throw new Error(message)
  }
  console.log(`✓ ${message}`)
}

const SUPERADMIN_USER: UserSettingsContext = {
  userId: 'usr-admin-01',
  name: 'Admin Mauricio',
  role: 'SUPERADMIN',
  permissions: [
    'settings.read',
    'settings.update',
    'settings.company',
    'settings.inventory',
    'settings.ecommerce',
    'settings.billing',
    'settings.tax',
    'settings.accounting',
    'settings.alerts',
    'settings.security',
  ],
}

const CAJERO_USER: UserSettingsContext = {
  userId: 'usr-cajero-02',
  name: 'Pedro Cajero',
  role: 'CASHIER',
  permissions: ['settings.read'],
}

const UNAUTHORIZED_USER: UserSettingsContext = {
  userId: 'usr-anon-03',
  name: 'Visitante',
  role: 'GUEST',
  permissions: [],
}

async function runTests() {
  console.log('--- INICIANDO PRUEBAS DE LÓGICA DEL MÓDULO CONFIGURACIÓN (ERP SUPER MÁS) ---\n')

  // TEST 1: Validación Zod de Esquemas
  console.log('[Test 1] Validación de esquemas Zod')
  const validCompany = companySettingsSchema.parse({
    companyName: 'Super Más S.A.S.',
    legalName: 'Distribuidora Super Más S.A.S.',
    nit: '900.842.109-4',
    dv: '4',
    fiscalRegime: 'RESPONSABLE_DE_IVA',
    economicActivityCode: '4711',
    legalRepresentative: 'Mauricio Andrade',
    legalRepresentativeDoc: 'CC 79.442.890',
    address: 'Calle 50 # 45-28, Zona Industrial',
    city: 'Medellín',
    department: 'Antioquia',
    postalCode: '050015',
    phone: '+57 604 444 8920',
    mobile: '+57 310 445 8821',
    email: 'contacto@supermas.com.co',
    billingEmail: 'facturacion@supermas.com.co',
    website: 'https://www.supermas.com.co',
    logoUrl: '/super-mas-logo.svg',
    currency: 'COP',
    timezone: 'America/Bogota',
  })
  assert(validCompany.currency === 'COP', 'Esquema de empresa validado')

  const validInv = inventorySettingsSchema.parse({
    defaultMinStockThreshold: 10,
    criticalLowStockThreshold: 5,
    valuationMethod: 'WEIGHTED_AVERAGE',
    allowNegativeStock: false,
    requireReasonForManualAdjustments: true,
    autoGenerateKardexMovement: true,
    stockCheckFrequencyHours: 24,
    webAvailability: {
      showAvailableBadge: true,
      showLowStockBadge: true,
      showOutOfStockBadge: true,
      lowStockWarningThreshold: 10,
      hideOutOfStockAfterDays: 0,
    },
    transferRules: {
      requireDualApproval: false,
      autoBlockTransitAfterHours: 24,
      defaultOriginLocationId: 'loc-001',
    },
  })
  assert(validInv.valuationMethod === 'WEIGHTED_AVERAGE', 'Esquema de inventario validado')

  const validPOS = posSettingsSchema.parse({
    defaultLocationId: 'loc-002',
    defaultLocationName: 'Punto Centro',
    defaultCashRegisterId: 'cash-reg-001',
    genericCustomerId: 'cust-004',
    genericCustomerName: 'Consumidor Final',
    genericCustomerDoc: '222222222222',
    autoPrintReceipt: true,
    allowQuickSaleWithoutCustomer: true,
    defaultReceiptTemplate: 'TICKET_58MM',
    enableSoundFeedback: true,
    enabledPaymentMethods: ['CASH', 'CARD', 'TRANSFER'],
    cashRegisterRules: {
      recommendedInitialFloat: 200000,
      maxAllowedInitialFloat: 500000,
      requireDailyClose: true,
      maxOpenHoursBeforeAlert: 14,
      maxDifferenceToleranceAmount: 0,
      requireDualSignatureOnDiscrepancy: true,
    },
    salesPriceList: 'PRICE_NORMAL',
  })
  assert(validPOS.enabledPaymentMethods.length === 3, 'Esquema de POS validado')

  const validDyn = updateDynamicSettingSchema.parse({
    key: 'security.session.timeout_minutes',
    value: 45,
    notes: 'Ajuste de política de seguridad por inactividad',
  })
  assert(validDyn.value === 45, 'Esquema de variable dinámica validado')

  // TEST 2: Consulta de Métricas de Dashboard
  console.log('\n[Test 2] Métricas consolidadas en settingsService.getStats()')
  const stats = await settingsService.getStats(SUPERADMIN_USER)
  assert(stats.totalActiveSettings > 0, `Total configuraciones activas calculadas: ${stats.totalActiveSettings}`)
  assert(stats.totalCriticalSettings > 0, `Configuraciones críticas detectadas: ${stats.totalCriticalSettings}`)
  assert(stats.categoriesCount === 16, `Total de categorías correcto: ${stats.categoriesCount}`)
  assert(typeof stats.lastModifiedBy === 'string', `Último usuario responsable obtenido: ${stats.lastModifiedBy}`)

  // TEST 3: Consulta de Información Empresarial
  console.log('\n[Test 3] Consulta de información corporativa (getCompanySettings)')
  const company = await settingsService.getCompanySettings(SUPERADMIN_USER)
  assert(company.companyName.includes('Super Más'), `Nombre de empresa verificado: ${company.companyName}`)
  assert(company.nit === '900.842.109-4', `NIT institucional verificado: ${company.nit}`)
  assert(company.currency === 'COP', 'Moneda institucional es COP')

  // TEST 4: Actualización de Configuración de Empresa con Auditoría
  console.log('\n[Test 4] Actualización de datos de empresa y registro de auditoría')
  const updatedCompany = await settingsService.updateCompanySettings(
    {
      phone: '+57 604 444 8925',
      address: 'Calle 50 # 45-30, Zona Industrial Medellín',
    },
    SUPERADMIN_USER
  )
  assert(updatedCompany.phone === '+57 604 444 8925', 'Teléfono actualizado correctamente')
  assert(updatedCompany.address.includes('45-30'), 'Dirección actualizada correctamente')

  // TEST 5: Políticas de Inventario y Método de Valoración
  console.log('\n[Test 5] Consulta y actualización de políticas de inventario')
  const inv = await settingsService.getInventorySettings(SUPERADMIN_USER)
  assert(inv.defaultMinStockThreshold > 0, `Stock mínimo obtenido: ${inv.defaultMinStockThreshold}`)

  const updatedInv = await settingsService.updateInventorySettings(
    { defaultMinStockThreshold: 12 },
    SUPERADMIN_USER
  )
  assert(updatedInv.defaultMinStockThreshold === 12, 'Stock mínimo actualizado a 12')

  // TEST 6: Configuración de POS y Terminales
  console.log('\n[Test 6] Consulta y actualización de configuración POS')
  const pos = await settingsService.getPOSSettings(SUPERADMIN_USER)
  assert(pos.genericCustomerName === 'Consumidor Final', 'Cliente genérico es Consumidor Final')

  const updatedPOS = await settingsService.updatePOSSettings(
    { defaultReceiptTemplate: 'TICKET_80MM' },
    SUPERADMIN_USER
  )
  assert(updatedPOS.defaultReceiptTemplate === 'TICKET_80MM', 'Plantilla de tirilla actualizada a 80mm')

  // TEST 7: Canales Web, Bodega de Despacho y WhatsApp
  console.log('\n[Test 7] Configuración de Ecommerce y Canales Web')
  const ecom = await settingsService.getEcommerceSettings(SUPERADMIN_USER)
  assert(ecom.dispatchWarehouseId === 'loc-001', 'Bodega de despacho web inicial es CEDI loc-001')
  assert(ecom.whatsapp.phoneNumber.startsWith('+57'), 'Línea de WhatsApp con código de país +57')

  const updatedEcom = await settingsService.updateEcommerceSettings(
    { defaultLowStockThreshold: 8 },
    SUPERADMIN_USER
  )
  assert(updatedEcom.defaultLowStockThreshold === 8, 'Umbral de stock bajo web actualizado a 8')

  // TEST 8: Variables Dinámicas del Sistema
  console.log('\n[Test 8] Consulta y mutación de variables dinámicas (key-value extensible)')
  const allDynamic = await settingsService.getSystemSettings(undefined, SUPERADMIN_USER)
  assert(allDynamic.length >= 10, `Variables dinámicas cargadas: ${allDynamic.length}`)

  const updatedSetting = await settingsService.updateSystemSetting(
    {
      key: 'products.sku.prefix',
      value: 'SM-',
      notes: 'Nuevo prefijo institucional para SKU',
    },
    SUPERADMIN_USER
  )
  assert(updatedSetting.value === 'SM-', 'Prefijo de SKU actualizado dinámicamente a SM-')

  // Revertir para mantener consistencia
  await settingsService.updateSystemSetting(
    { key: 'products.sku.prefix', value: 'SKU-' },
    SUPERADMIN_USER
  )

  // TEST 9: Detección y Marcado de Cambios Críticos
  console.log('\n[Test 9] Clasificación y verificación de parámetros críticos')
  const criticalItems = allDynamic.filter((s) => s.isCritical)
  assert(criticalItems.length >= 5, `Parámetros marcados como críticos: ${criticalItems.length}`)
  const billingPrefix = criticalItems.find((s) => s.key === 'billing.invoice.prefix')
  assert(!!billingPrefix && billingPrefix.isCritical === true, 'Prefijo de facturación clasificado como crítico')

  // TEST 10: Consulta de Roles Predefinidos (Solo Lectura)
  console.log('\n[Test 10] Matriz de roles predefinidos (Solo Lectura e Inmutabilidad)')
  const roles = await settingsService.getPredefinedRoles(SUPERADMIN_USER)
  assert(roles.length === 6, `Total de roles predefinidos en el sistema: ${roles.length}`)
  const superAdminRole = roles.find((r) => r.code === 'SUPERADMIN')
  assert(!!superAdminRole && superAdminRole.permissions.length > 20, 'Rol SUPERADMIN cuenta con permisos globales')
  const cashierRole = roles.find((r) => r.code === 'CASHIER')
  assert(!!cashierRole && cashierRole.scope === 'ASSIGNED_LOCATION', 'Rol CASHIER restringido a su sede asignada')

  // TEST 11: Control de Acceso Basado en Roles (RBAC)
  console.log('\n[Test 11] Validación de permisos y denegación de acceso no autorizado')
  // Usuario no autorizado es bloqueado en lectura
  try {
    await settingsService.getStats(UNAUTHORIZED_USER)
    assert(false, 'Usuario sin permisos debió ser rechazado')
  } catch (err: any) {
    assert(err.message.includes('Acceso denegado'), 'Bloqueo exitoso para usuario sin permisos')
  }

  // Cajero puede leer pero no modificar empresa
  try {
    await settingsService.updateCompanySettings({ companyName: 'Hacked' }, CAJERO_USER)
    assert(false, 'Cajero debió ser rechazado al intentar modificar empresa')
  } catch (err: any) {
    assert(err.message.includes('Acceso denegado'), 'Bloqueo exitoso para usuario sin permiso de empresa')
  }

  // TEST 12: Trazabilidad Inmutable en Auditoría
  console.log('\n[Test 12] Registro inmutable de auditoría (auditService.log)')
  const auditLogs = db.auditLogs.filter(
    (log: any) => log.module === 'SETTINGS' || log.action?.startsWith('SETTING_') || log.action === 'CRITICAL_CONFIG_CHANGED'
  )
  assert(auditLogs.length > 0, `Registros de auditoría generados en auditLogs (${auditLogs.length} eventos)`)
  const lastAudit = auditLogs[auditLogs.length - 1]
  assert(
    lastAudit.action === 'SETTING_UPDATED' || lastAudit.action === 'CRITICAL_CONFIG_CHANGED',
    `Acción registrada en auditoría coherente: ${lastAudit.action}`
  )
  assert(Array.isArray(lastAudit.changes) && lastAudit.changes.length > 0, 'Detalle de cambios (previousValue / newValue) almacenado')

  console.log('\n🎉 ¡TODAS LAS 12 PRUEBAS DEL MÓDULO CONFIGURACIÓN PASARON SATISFACTORIAMENTE!\n')
}

runTests().catch((err) => {
  console.error('\n❌ ERROR EJECUTANDO PRUEBAS:', err)
  process.exit(1)
})
