import type { Capitulo } from '../tipos'

const c = (archivo: string, leyenda: string) => ({ archivo: `${archivo}.jpg`, leyenda })

export const COMPRAS: Capitulo = {
  id: 'cap-compras',
  numero: 3,
  titulo: 'Compras',
  introduccion:
    'Proveedores, órdenes de compra, recepción de mercancía en bodega y las cuentas por pagar que generan las compras a crédito.',
  modulos: [
    {
      id: 'proveedores',
      titulo: 'Proveedores',
      menu: 'Compras > Proveedores',
      proposito: 'Registrar a quién se le compra: datos legales, contacto, condiciones de crédito y saldo pendiente.',
      quienLoUsa: 'Compras y administración.',
      pantalla: [
        {
          texto: 'Muestra el total de proveedores, los activos, los que tienen compras recientes, las cuentas pendientes, las facturas vencidas y lo comprado en el período.',
          captura: c('10-proveedores-01-lista', 'Módulo Proveedores.'),
        },
      ],
      procedimientos: [
        {
          id: 'crear-proveedor',
          titulo: 'Registrar un proveedor',
          objetivo: 'Dejar listo un proveedor para hacerle órdenes de compra.',
          pasos: [
            { texto: 'Pulse [[Nuevo proveedor]]. El formulario tiene dos pestañas.', captura: c('10-proveedores-02-nuevo-vacio', 'Formulario de proveedor nuevo.') },
            {
              texto: 'En **Información General** elija si es **persona jurídica** (empresa con NIT) o **natural**, el tipo y número de documento con su **DV**, la razón social, el contacto principal, teléfono, correo, dirección, ciudad y departamento.',
              captura: c('10-proveedores-03-nuevo-general', 'Información general del proveedor.'),
            },
            {
              texto: 'En **Información Comercial & Crédito** indique el estado, los **días de crédito** que le dan y el **cupo autorizado**. Agregue acuerdos de entrega o descuentos en observaciones.',
              captura: c('10-proveedores-04-nuevo-comercial', 'Condiciones comerciales y de crédito.'),
              advertencia: 'El cupo viene con un valor de ejemplo: cámbielo por el cupo real que tiene con ese proveedor.',
            },
            { texto: 'Pulse [[Crear Proveedor]].' },
          ],
        },
      ],
    },
    {
      id: 'ordenes-compra',
      titulo: 'Órdenes de compra',
      menu: 'Compras > Órdenes de compra',
      proposito:
        'Registrar las compras a proveedores, recibir la mercancía en bodega y controlar lo pendiente por pagar. Al recibir la compra, el inventario y el costo promedio se actualizan solos.',
      quienLoUsa: 'Compras, bodega y administración.',
      pantalla: [
        {
          texto: 'Muestra lo comprado en el período, lo pendiente por recibir, las compras a crédito y de contado, las facturas por pagar y vencidas, y el saldo por pagar. Arriba están [[Exportar]], [[Registrar recepción]] y [[Nueva compra]].',
          captura: c('11-compras-01-lista', 'Módulo Órdenes de compra.'),
        },
      ],
      procedimientos: [
        {
          id: 'crear-compra',
          titulo: 'Registrar una compra a un proveedor',
          objetivo: 'Crear la orden de compra con los productos, cantidades, costos e impuestos de la factura del proveedor.',
          pasos: [
            {
              texto: 'Pulse [[Nueva compra]]. En el **Paso 1** elija el **proveedor**, la **bodega destino** donde entra la mercancía, la fecha y el **número de factura o remisión del proveedor**.',
              captura: c('11-compras-02-nueva', 'Paso 1: información general de la compra.'),
              nota: 'Si la lista de proveedores sale vacía, primero cree el proveedor en Compras > Proveedores.',
            },
            {
              texto: 'Elija la **condición de pago**: **Contado** (se paga al momento) o **Crédito** (crea una cuenta por pagar).',
              captura: c('11-compras-03-condicion', 'Condición de pago: contado o crédito.'),
            },
            {
              texto: 'Si es a crédito, indique la **fecha de vencimiento**. Pulse [[Siguiente]].',
              captura: c('11-compras-04-credito', 'Compra a crédito con fecha de vencimiento.'),
            },
            { texto: 'En el **Paso 2** busque cada producto por nombre, SKU o código de barras y escriba la **cantidad** y el **costo unitario** de la factura.' },
            { texto: 'En el **Paso 3** revise la liquidación de impuestos (IVA discriminado) y adjunte la factura del proveedor en PDF o imagen (hasta 10 MB).' },
            {
              texto: 'En el **Paso 4** verifique todo y pulse [[Aprobar y Emitir]], o [[Guardar Borrador]] si aún le falta información.',
              nota: 'Una compra emitida queda **Pendiente de recepción**: el inventario todavía no cambia hasta que la bodega reciba la mercancía.',
            },
          ],
        },
        {
          id: 'recibir-compra',
          titulo: 'Recibir en bodega la mercancía de una compra',
          objetivo: 'Ingresar al inventario lo que llegó del proveedor.',
          pasos: [
            { texto: 'En Órdenes de compra busque la compra pendiente y pulse [[Recibir compra]] (también desde su detalle).' },
            { texto: 'Revise lo que llegó: confirme las cantidades recibidas de cada producto. Si llegó menos, escriba la cantidad real.' },
            { texto: 'Confirme la recepción. Se genera un **acta de recepción**.' },
          ],
          resultado: 'Las unidades entran a la bodega, el costo promedio del producto se recalcula y el movimiento queda en el Kardex.',
        },
      ],
    },
    {
      id: 'recepciones',
      titulo: 'Recepciones',
      menu: 'Compras > Recepciones',
      proposito: 'Consultar las actas de recepción de mercancía: qué entró, cuándo, a qué bodega y de qué proveedor.',
      quienLoUsa: 'Bodega, compras y auditoría.',
      pantalla: [
        {
          texto: 'Muestra las actas generadas, las unidades ingresadas, las bodegas y proveedores. Las actas se crean solas al recibir una compra. [[Recibir una orden]] lo lleva a Órdenes de compra para recibir una.',
          captura: c('12-recepciones-01-lista', 'Módulo Recepciones.'),
        },
      ],
      procedimientos: [],
    },
    {
      id: 'cuentas-por-pagar',
      titulo: 'Cuentas por Pagar',
      menu: 'Compras > Cuentas por Pagar',
      proposito: 'Controlar lo que se les debe a los proveedores por compras a crédito, sus vencimientos y los abonos.',
      quienLoUsa: 'Tesorería, contabilidad y administración.',
      pantalla: [
        {
          texto: 'Muestra la deuda total pendiente, la cartera vencida, lo pagado en el mes y la cartera corriente. Las pestañas filtran por Pendientes, Abonadas, Vencidas y Liquidadas.',
          captura: c('13-cxp-01-lista', 'Módulo Cuentas por Pagar.'),
        },
      ],
      procedimientos: [
        {
          id: 'pagar-proveedor',
          titulo: 'Registrar un abono o pago a un proveedor',
          objetivo: 'Descontar de la deuda lo que se le pagó al proveedor.',
          pasos: [
            { texto: 'Busque la cuenta por pagar (por compra, factura o proveedor) y pulse [[Abonar]].' },
            { texto: 'Escriba el valor pagado, la fecha, el medio de pago y la cuenta bancaria o caja de donde salió el dinero.' },
            { texto: 'Confirme. Si paga todo, la cuenta pasa a **Liquidada**; si paga una parte, queda **Abonada** con el saldo pendiente.' },
          ],
          resultado: 'El pago queda en Tesorería y en la contabilidad.',
        },
      ],
    },
  ],
}
