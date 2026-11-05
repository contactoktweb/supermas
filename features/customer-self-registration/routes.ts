/** Página pública a la que lleva el QR del POS. */
export const CUSTOMER_SELF_REGISTRATION_PATH = '/registro-cliente'

/**
 * Nota con la que se crean los clientes que se registran por el QR. El POS la usa para pedir al
 * cajero que verifique el documento antes de facturar; se quita al editar la nota del cliente.
 */
export const SELF_REGISTERED_CUSTOMER_NOTE = 'Autorregistrado por QR: verificar documento antes de facturar.'
