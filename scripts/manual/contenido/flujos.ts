import type { Capitulo } from '../tipos'

export const FLUJOS: Capitulo = {
  id: 'cap-flujos',
  numero: 11,
  titulo: 'Flujos completos',
  introduccion: 'Cómo se encadenan los módulos en las operaciones del día a día, de principio a fin.',
  modulos: [
    {
      id: 'flujo-compra-venta',
      titulo: 'De la compra al cobro',
      menu: 'Compras > Inventario > Ventas > Cartera',
      proposito: 'Ver el recorrido completo de la mercancía y del dinero: comprar, recibir, vender, facturar y cobrar.',
      quienLoUsa: 'Compras, bodega, ventas, facturación y cartera.',
      pantalla: [],
      procedimientos: [
        {
          id: 'flujo-completo',
          titulo: 'Recorrido completo de una operación',
          objetivo: 'Seguir una mercancía desde el proveedor hasta el pago del cliente.',
          pasos: [
            { texto: '**Proveedor y producto.** Si es la primera vez, cree el proveedor (Compras > Proveedores) y el producto con su costo (Inventario > Productos).' },
            { texto: '**Compra.** Registre la orden de compra con la factura del proveedor (Compras > Órdenes de compra). Si es a crédito, queda en Cuentas por Pagar.' },
            { texto: '**Recepción.** Cuando llega la mercancía, reciba la compra: las unidades entran a la bodega, se recalcula el costo promedio y queda en el Kardex.' },
            { texto: '**Venta.** Venda en el POS o en Ventas. El inventario se descuenta y se registra el pago o la deuda.' },
            { texto: '**Factura electrónica.** Si el cliente la necesita, emita la factura electrónica (Ventas > Facturación). Al ser aceptada por la DIAN, le llega por correo.' },
            { texto: '**Cobro.** Si fue a crédito, registre los abonos en Cuentas por cobrar hasta que quede pagada.' },
            { texto: '**Pago al proveedor.** Registre el pago de la compra en Cuentas por Pagar.' },
            { texto: '**Cierre del día.** Cada cajero hace el arqueo y cierre de su caja (Ventas > Cajas).' },
          ],
          resultado: 'Inventario, caja, bancos, cartera y contabilidad quedan actualizados sin pasos manuales adicionales.',
        },
      ],
    },
    {
      id: 'flujo-devolucion',
      titulo: 'Devolución de un cliente con factura electrónica',
      menu: 'Ventas > Devoluciones > Facturación',
      proposito: 'Recibir mercancía devuelta y corregir la factura electrónica ante la DIAN.',
      quienLoUsa: 'Ventas, bodega y facturación.',
      pantalla: [],
      procedimientos: [
        {
          id: 'flujo-devolucion-nc',
          titulo: 'Devolución con nota crédito',
          objetivo: 'Cerrar correctamente una devolución cuando la venta tenía factura electrónica.',
          pasos: [
            { texto: 'Registre la devolución en Ventas > Devoluciones, eligiendo la venta, las cantidades y si cada producto vuelve en buen o mal estado.' },
            { texto: 'En Ventas > Facturación abra la factura de esa venta y emita una **nota crédito** con concepto **1 Devolución parcial**, eligiendo la devolución registrada.' },
            { texto: 'Cuando la DIAN acepte la nota, le llega al cliente por correo y la contabilidad queda ajustada.' },
          ],
        },
      ],
    },
    {
      id: 'flujo-traslado',
      titulo: 'Traslado de mercancía entre bodegas',
      menu: 'Inventario > Transferencias',
      proposito: 'Mover mercancía de una sede a otra con control de salida y llegada.',
      quienLoUsa: 'Bodegas y logística.',
      pantalla: [],
      procedimientos: [
        {
          id: 'flujo-transferencia',
          titulo: 'Traslado completo',
          objetivo: 'Enviar y recibir mercancía entre bodegas.',
          pasos: [
            { texto: 'La bodega que necesita mercancía o la que la envía crea la transferencia (Inventario > Transferencias > Nueva transferencia). Queda Pendiente.' },
            { texto: 'La bodega origen alista y pulsa [[Despachar transferencia]]: las unidades salen de su inventario.' },
            { texto: 'La bodega destino revisa lo que llegó y pulsa [[Recibir transferencia]]: las unidades entran a su inventario. Cualquier diferencia queda como novedad.' },
          ],
        },
      ],
    },
  ],
}
