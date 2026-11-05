import { AppIcon } from '@/components/ui/Icon'

export const PURCHASE_ACCOUNTING_PENDING_MESSAGE =
  'La compra se registra en contabilidad cuando llegue lo que falta o al cerrar la orden con faltante.'

/** Aviso para órdenes recibidas a medias: el inventario ya entró, pero la compra aún no está causada. */
export function PurchaseAccountingPendingNote() {
  return (
    <div className="purchase-invoice-pending-note" role="note">
      <AppIcon name="warning" size={16} />
      <p>
        <strong>Pendiente en contabilidad</strong>
        Lo recibido ya está en el inventario. {PURCHASE_ACCOUNTING_PENDING_MESSAGE}
      </p>
    </div>
  )
}
