/** Formatos y tamaño admitidos para el archivo de la factura del proveedor. */
export const INVOICE_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png']
export const INVOICE_MAX_BYTES = 10 * 1024 * 1024

/** Devuelve el mensaje de error del archivo o null si se puede adjuntar. */
export function validateInvoiceFile(file: File): string | null {
  if (!INVOICE_MIME_TYPES.includes(file.type)) return 'La factura debe ser PDF, JPG o PNG.'
  if (file.size > INVOICE_MAX_BYTES) return 'La factura debe pesar como máximo 10 MB.'
  return null
}
