/**
 * Catálogos DIAN sin dependencias de servidor (se usan también en el navegador).
 */

/** Conceptos de corrección (Anexo 1.9): notas crédito 1–6, notas débito 1–4 */
export const CREDIT_NOTE_CONCEPTS: Record<string, string> = {
  '1': 'Devolución parcial de los bienes y/o no aceptación parcial del servicio',
  '2': 'Anulación de factura electrónica',
  '3': 'Rebaja o descuento parcial o total',
  '4': 'Ajuste de precio',
  '5': 'Descuento comercial por pronto pago',
  '6': 'Descuento comercial por volumen de ventas',
}
export const DEBIT_NOTE_CONCEPTS: Record<string, string> = {
  '1': 'Intereses',
  '2': 'Gastos por cobrar',
  '3': 'Cambio del valor',
  '4': 'Otros',
}
