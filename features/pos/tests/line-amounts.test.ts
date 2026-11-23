import { computePOSLineAmounts } from '../utils/line-amounts'

let failed = 0
const check = (name: string, actual: unknown, expected: unknown) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  console.log(`  ${ok ? '✅' : '❌'} ${name}${ok ? '' : ` -> ${JSON.stringify(actual)} (esperado ${JSON.stringify(expected)})`}`)
  if (!ok) failed++
}

// Precio con IVA incluido: $3.000 al 19% se cobra $3.000 (base 2.521,01 + IVA 478,99), no $3.570.
check('3.000 al 19%', computePOSLineAmounts(1, 3000, 0, 19), { subtotal: 2521.01, discountAmount: 0, taxAmount: 478.99, total: 3000 })
check('2 x 3.000 al 19%', computePOSLineAmounts(2, 3000, 0, 19), { subtotal: 5042.02, discountAmount: 0, taxAmount: 957.98, total: 6000 })
check('IVA 5%', computePOSLineAmounts(1, 10500, 0, 5), { subtotal: 10000, discountAmount: 0, taxAmount: 500, total: 10500 })
check('Exento', computePOSLineAmounts(3, 2000, 0, 0), { subtotal: 6000, discountAmount: 0, taxAmount: 0, total: 6000 })
// 10% sobre $3.000 → paga $2.700; subtotal - descuento + IVA = total.
const d = computePOSLineAmounts(1, 3000, 10, 19)
check('Descuento 10%: total', d.total, 2700)
check('Descuento 10%: cuadra', Math.round((d.subtotal - d.discountAmount + d.taxAmount) * 100) / 100, d.total)
check('Cantidad fraccionada', computePOSLineAmounts(1.5, 4990, 0, 19).total, 7485)

if (failed) process.exit(1)
console.log('Montos de línea POS: OK')
