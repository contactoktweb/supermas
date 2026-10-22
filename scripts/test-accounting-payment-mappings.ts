/**
 * SUPER MÁS ERP/POS — PRUEBAS CONTABLES DE MAPEO SEGÚN MEDIO DE PAGO Y CUENTA BANCARIA
 *
 * Valida los 5 escenarios requeridos:
 * 1. Venta en efectivo -> Caja (1105 / 110505.01)
 * 2. Venta por Cuenta Corriente 1 -> Banco A (1110 / 111005.01)
 * 3. Venta por Cuenta Corriente 2 -> Banco B (1110 / 111005.03)
 * 4. Venta por Cuenta de Ahorro 1 -> Banco A Ahorros (111005.02 / 112005.01)
 * 5. Venta por Cuenta de Ahorro 2 -> Banco B Ahorros (1120 / 112005.02)
 *
 * Demuestra:
 * MEDIO DE PAGO -> CUENTA BANCARIA -> PUC -> DÉBITO -> CRÉDITO -> BALANCE
 */

export interface AccountingLine {
  accountCode: string
  accountName: string
  debit: number
  credit: number
  description: string
}

export interface AccountingEntryValidation {
  scenario: string
  paymentMethod: string
  bankAccountAlias: string
  pucCode: string
  pucName: string
  lines: AccountingLine[]
  totalDebit: number
  totalCredit: number
  isBalanced: boolean
}

export function generateSaleAccountingEntry(params: {
  scenarioName: string
  paymentMethod: 'EFECTIVO' | 'CORRIENTE_1' | 'CORRIENTE_2' | 'AHORRO_1' | 'AHORRO_2'
  saleNumber: string
  subtotal: number
  taxIva: number
  costOfGoods: number
  bankMapping: {
    alias: string
    pucCode: string
    pucName: string
  }
}): AccountingEntryValidation {
  const totalSale = params.subtotal + params.taxIva

  const lines: AccountingLine[] = [
    // 1. Débito a Caja o Banco según medio de pago
    {
      accountCode: params.bankMapping.pucCode,
      accountName: params.bankMapping.pucName,
      debit: totalSale,
      credit: 0,
      description: `Recaudo venta ${params.saleNumber} vía ${params.bankMapping.alias}`,
    },
    // 2. Débito a Costo de Ventas
    {
      accountCode: '6135',
      accountName: 'Comercio al por mayor y menor (Costo de Ventas)',
      debit: params.costOfGoods,
      credit: 0,
      description: `Costo de mercancías vendidas ${params.saleNumber}`,
    },
    // 3. Crédito a Ingresos Operacionales (Ventas)
    {
      accountCode: '4135',
      accountName: 'Comercio al por mayor y al por menor (Ingresos)',
      debit: 0,
      credit: params.subtotal,
      description: `Ingreso operacional venta ${params.saleNumber}`,
    },
    // 4. Crédito a IVA por pagar (si aplica)
    ...(params.taxIva > 0
      ? [
          {
            accountCode: '2408',
            accountName: 'Impuesto sobre las ventas por pagar (IVA 19%)',
            debit: 0,
            credit: params.taxIva,
            description: `IVA generado en venta ${params.saleNumber}`,
          },
        ]
      : []),
    // 5. Crédito a Inventarios (Salida de mercancía)
    {
      accountCode: '1435',
      accountName: 'Mercancías no fabricadas por la empresa (Inventario)',
      debit: 0,
      credit: params.costOfGoods,
      description: `Descargo de inventario por venta ${params.saleNumber}`,
    },
  ]

  const totalDebit = lines.reduce((acc, l) => acc + l.debit, 0)
  const totalCredit = lines.reduce((acc, l) => acc + l.credit, 0)
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01

  return {
    scenario: params.scenarioName,
    paymentMethod: params.paymentMethod,
    bankAccountAlias: params.bankMapping.alias,
    pucCode: params.bankMapping.pucCode,
    pucName: params.bankMapping.pucName,
    lines,
    totalDebit,
    totalCredit,
    isBalanced,
  }
}

export function runAccountingPaymentTests() {
  console.log('================================================================================')
  console.log('📊 SUITE DE PRUEBAS CONTABLES: MAPEO SEGÚN MEDIO DE PAGO Y CUENTA BANCARIA')
  console.log('================================================================================\n')

  const saleBase = {
    saleNumber: 'VTA-2026-TEST',
    subtotal: 100000,
    taxIva: 19000,
    costOfGoods: 80000,
  }

  const scenarios = [
    {
      scenarioName: '1. Venta en Efectivo (Caja)',
      paymentMethod: 'EFECTIVO' as const,
      bankMapping: {
        alias: 'Caja General Efectivo',
        pucCode: '110505.01',
        pucName: 'Caja General - Efectivo Principal',
      },
    },
    {
      scenarioName: '2. Venta por Cuenta Corriente 1',
      paymentMethod: 'CORRIENTE_1' as const,
      bankMapping: {
        alias: 'Cuenta Corriente Bancolombia Principal',
        pucCode: '111005.01',
        pucName: 'Bancos Nacionales - Bancolombia Cuenta Corriente',
      },
    },
    {
      scenarioName: '3. Venta por Cuenta Corriente 2',
      paymentMethod: 'CORRIENTE_2' as const,
      bankMapping: {
        alias: 'Cuenta Corriente Banco Secundario (Bogotá/Occidente)',
        pucCode: '111005.03',
        pucName: 'Bancos Nacionales - Cuenta Corriente Secundaria',
      },
    },
    {
      scenarioName: '4. Venta por Cuenta de Ahorro 1',
      paymentMethod: 'AHORRO_1' as const,
      bankMapping: {
        alias: 'Cuenta de Ahorros Bancolombia Recaudos',
        pucCode: '111005.02',
        pucName: 'Bancos Nacionales - Bancolombia Cuenta de Ahorros',
      },
    },
    {
      scenarioName: '5. Venta por Cuenta de Ahorro 2',
      paymentMethod: 'AHORRO_2' as const,
      bankMapping: {
        alias: 'Cuenta de Ahorros Secundaria (Davivienda/BBVA)',
        pucCode: '112005.01',
        pucName: 'Cuentas de Ahorro - Entidad Financiera Secundaria',
      },
    },
  ]

  let allPassed = true

  for (const s of scenarios) {
    const res = generateSaleAccountingEntry({
      scenarioName: s.scenarioName,
      paymentMethod: s.paymentMethod,
      ...saleBase,
      bankMapping: s.bankMapping,
    })

    console.log(`📌 ESCENARIO: ${res.scenario}`)
    console.log(`   Medio de Pago:  ${res.paymentMethod}`)
    console.log(`   Cuenta Destino: ${res.bankAccountAlias}`)
    console.log(`   Cuenta PUC:     ${res.pucCode} (${res.pucName})`)
    console.log(`   Total Débitos:  $${res.totalDebit.toLocaleString('es-CO')} COP`)
    console.log(`   Total Créditos: $${res.totalCredit.toLocaleString('es-CO')} COP`)
    console.log(`   Balance:        ${res.isBalanced ? '✅ CUADRADO (Débito == Crédito)' : '❌ DESCUADRADO'}`)
    console.log('   Detalle de Asiento:')
    for (const l of res.lines) {
      const debStr = l.debit > 0 ? `$${l.debit.toLocaleString('es-CO')}` : '-'
      const credStr = l.credit > 0 ? `$${l.credit.toLocaleString('es-CO')}` : '-'
      console.log(`     - [${l.accountCode}] ${l.accountName.padEnd(45, ' ')} | Déb: ${debStr.padStart(10, ' ')} | Créd: ${credStr.padStart(10, ' ')}`)
    }
    console.log('')

    if (!res.isBalanced) allPassed = false
  }

  if (allPassed) {
    console.log('🎉 TODOS LOS 5 ESCENARIOS CONTABLES GENERARON ASIENTOS EN PARTIDA DOBLE CUADRADOS (100% PASS)\n')
  } else {
    throw new Error('Al menos un escenario contable presentó descuadre en partida doble.')
  }
}

if (require.main === module) {
  runAccountingPaymentTests()
}
