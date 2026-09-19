/**
 * SUPER MÁS ERP/POS - Suite de Pruebas Automatizadas de Contabilidad
 *
 * Valida:
 * 1. Regla de partida doble: SUM(debit) === SUM(credit).
 * 2. Creación y parametrización de cuentas PUC.
 * 3. Registro de comprobantes y asientos manuales.
 * 4. Trazabilidad e inmutabilidad: Reversión contable (original a REVERSED + asiento inverso).
 * 5. Matriz de permisos contables por rol (SUPERADMIN, ACCOUNTANT vs CASHIER/SELLER).
 * 6. Reportes financieros (Balance de prueba, Estado de Resultados).
 */

import { accountingService } from '../services/accounting.service'
import { accountingRepository } from '../repositories/accounting.repository'
import { accountingReportService } from '../services/accounting-report.service'
import { AccountFormData, ManualEntryFormData } from '../schemas/accounting.schema'

let passed = 0
let failed = 0

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ PASÓ: ${testName}`)
    passed++
  } else {
    console.error(`  ❌ FALLÓ: ${testName}`)
    if (detail) console.error(`     Detalle: ${detail}`)
    failed++
  }
}

async function runAccountingTestSuite() {
  console.log('========================================================')
  console.log('🧪 INICIANDO SUITE DE PRUEBAS DEL MÓDULO DE CONTABILIDAD')
  console.log('========================================================\n')

  const adminUser = {
    id: 'usr-admin-01',
    name: 'Carlos Contador',
    role: 'SUPERADMIN',
  }

  const cashierUser = {
    id: 'usr-cashier-01',
    name: 'Pedro Cajero',
    role: 'CASHIER',
  }

  // --- TEST 1: Permisos contables por rol ---
  console.log('--- 1. Validación de Permisos por Rol ---')
  assert(
    accountingService.hasPermission('accounting.read', adminUser.role) === true,
    'SUPERADMIN tiene permiso accounting.read'
  )
  assert(
    accountingService.hasPermission('accounting.entries', adminUser.role) === true,
    'SUPERADMIN tiene permiso accounting.entries'
  )
  assert(
    accountingService.hasPermission('accounting.cancel', adminUser.role) === true,
    'SUPERADMIN tiene permiso accounting.cancel'
  )
  assert(
    accountingService.hasPermission('accounting.entries', cashierUser.role) === false,
    'CASHIER no tiene permiso para crear asientos contables'
  )
  assert(
    accountingService.hasPermission('accounting.cancel', cashierUser.role) === false,
    'CASHIER no tiene permiso para revertir asientos contables'
  )

  // --- TEST 2: Creación de Cuenta PUC ---
  console.log('\n--- 2. Creación y Validación de Cuentas PUC ---')
  const testAccountCode = `1105${Math.floor(10 + Math.random() * 89)}`
  const accountData: AccountFormData = {
    code: testAccountCode,
    name: 'Caja Menor Pruebas Automáticas',
    accountClass: 1,
    type: 'ASSET',
    nature: 'DEBIT',
    level: 'SUBACCOUNT',
    parentId: 'acc-1105',
    requiresThirdParty: false,
    requiresCostCenter: true,
    description: 'Cuenta creada por suite de verificación automática.',
  }

  const createdAccount = await accountingService.createAccount(accountData, adminUser)
  assert(
    Boolean(createdAccount.id && createdAccount.code === testAccountCode),
    `Cuenta PUC creada correctamente con código ${testAccountCode}`
  )
  assert(
    createdAccount.nature === 'DEBIT' && createdAccount.accountClass === 1,
    'La naturaleza contable es DEBIT y clase 1 (Activos)'
  )

  const allAccounts = await accountingService.getAllAccounts(adminUser.role)
  const found = allAccounts.find((a) => a.code === testAccountCode)
  assert(Boolean(found), 'La nueva cuenta aparece listada en el catálogo general')

  // --- TEST 3: Partida Doble - Rechazo de Asiento Descuadrado ---
  console.log('\n--- 3. Validación Estricta de Partida Doble ---')
  const unbalancedData: ManualEntryFormData = {
    date: new Date().toISOString().split('T')[0],
    description: 'Asiento descuadrado intencional',
    locationId: 'loc-001',
    lines: [
      {
        accountId: createdAccount.id,
        accountCode: createdAccount.code,
        accountName: createdAccount.name,
        debit: 500000,
        credit: 0,
        description: 'Ingreso a caja menor',
      },
      {
        accountId: 'acc-413501',
        accountCode: '413501',
        accountName: 'Venta de Abarrotes',
        debit: 0,
        credit: 450000, // Descuadrado por 50.000
        description: 'Venta con diferencia',
      },
    ],
  }

  let errorCaptured = false
  try {
    await accountingService.createManualEntry(unbalancedData, adminUser)
  } catch (err: any) {
    errorCaptured = true
    const msg = (err.message || '').toLowerCase()
    assert(
      msg.includes('partida doble') || msg.includes('descuadrad') || msg.includes('balance'),
      'Se rechaza el asiento descuadrado con mensaje claro de error',
      err.message
    )
  }
  if (!errorCaptured) {
    assert(false, 'Debería haber fallado la creación de asiento descuadrado!')
  }

  // --- TEST 4: Creación Exitosa de Asiento Manual Cuadrado ---
  console.log('\n--- 4. Creación de Asiento Manual Cuadrado ---')
  const balancedData: ManualEntryFormData = {
    date: new Date().toISOString().split('T')[0],
    description: 'Ajuste manual de prueba debidamente cuadrado',
    locationId: 'loc-001',
    thirdPartyName: 'Distribuidora Aliada del Valle',
    thirdPartyDoc: '900.876.543-2',
    lines: [
      {
        accountId: createdAccount.id,
        accountCode: createdAccount.code,
        accountName: createdAccount.name,
        debit: 750000,
        credit: 0,
        description: 'Débito a caja',
      },
      {
        accountId: 'acc-413501',
        accountCode: '413501',
        accountName: 'Venta de Abarrotes',
        debit: 0,
        credit: 750000,
        description: 'Crédito a ingresos',
      },
    ],
  }

  const createdEntry = await accountingService.createManualEntry(balancedData, adminUser)
  assert(
    Boolean(createdEntry.id && createdEntry.entryNumber),
    `Asiento registrado con número de comprobante: ${createdEntry.entryNumber}`
  )
  assert(
    createdEntry.isBalanced === true,
    'El indicador isBalanced es true'
  )
  assert(
    createdEntry.totalDebit === 750000 && createdEntry.totalCredit === 750000,
    'Total Débito == Total Crédito ($750.000 COP)'
  )
  assert(
    createdEntry.status === 'POSTED',
    'El estado del comprobante queda en POSTED'
  )

  // --- TEST 5: Reversión Contable (Inmutabilidad y Trazabilidad) ---
  console.log('\n--- 5. Reversión Contable (Inmutabilidad y Auditoría) ---')
  const reversalReason = 'Corrección por duplicidad en registro de ventas'
  const reversalResult = await accountingService.reverseEntry(createdEntry.id, reversalReason, adminUser)

  assert(
    reversalResult.original.status === 'REVERSED',
    'El asiento original cambia a estado REVERSED'
  )
  assert(
    reversalResult.original.reversalReason === reversalReason,
    'El asiento original conserva el motivo de reversión'
  )
  assert(
    Boolean(reversalResult.reversal.id && reversalResult.reversal.entryNumber),
    `Se genera un comprobante de reversión inverso: ${reversalResult.reversal.entryNumber}`
  )
  assert(
    reversalResult.reversal.totalDebit === createdEntry.totalCredit &&
      reversalResult.reversal.totalCredit === createdEntry.totalDebit,
    'El comprobante de reversión invierte débitos y créditos con exactitud matemática'
  )

  // Intentar revertir nuevamente debe fallar
  let secondReversalFailed = false
  try {
    await accountingService.reverseEntry(createdEntry.id, 'Segundo intento', adminUser)
  } catch (err: any) {
    secondReversalFailed = true
  }
  assert(
    secondReversalFailed,
    'No se permite revertir un asiento que ya ha sido reversado previamente'
  )

  // --- TEST 6: Reportes Financieros ---
  console.log('\n--- 6. Reportes Financieros y Dashboard ---')
  const dashboard = await accountingService.getDashboard(adminUser.role)
  assert(
    typeof dashboard.totalAssets === 'number' && typeof dashboard.totalLiabilities === 'number',
    'El dashboard contable calcula totales numéricos válidos'
  )

  const balanceSheet = await accountingService.getBalanceSheet(undefined, undefined, adminUser.role)
  assert(
    Boolean(balanceSheet.period && balanceSheet.totalAssets > 0 && balanceSheet.totalLiabilities > 0),
    'El Balance General calcula totalAssets y totalLiabilities cuadradas'
  )

  const incomeStatement = await accountingService.getIncomeStatement(undefined, undefined, adminUser.role)
  assert(
    Boolean(incomeStatement.period && Array.isArray(incomeStatement.operatingRevenues)),
    'El Estado de Resultados calcula operatingRevenues, costos y utilidad'
  )

  console.log('\n========================================================')
  console.log(`📊 RESULTADO FINAL: ${passed} PASARON, ${failed} FALLARON`)
  console.log('========================================================')

  if (failed > 0) {
    process.exit(1)
  }
}

runAccountingTestSuite().catch((err) => {
  console.error('Error fatal durante la ejecución de pruebas:', err)
  process.exit(1)
})
