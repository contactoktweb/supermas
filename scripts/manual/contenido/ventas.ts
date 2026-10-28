import type { Capitulo } from '../tipos'

const c = (archivo: string, leyenda: string) => ({ archivo: `${archivo}.jpg`, leyenda })

export const VENTAS: Capitulo = {
  id: 'cap-ventas',
  numero: 5,
  titulo: 'Ventas',
  introduccion:
    'Ventas comerciales, punto de venta (POS), cajas y arqueos, facturación electrónica DIAN con notas crédito y débito, remisiones, devoluciones y tesorería.',
  modulos: [
    {
      id: 'ventas',
      titulo: 'Ventas',
      menu: 'Ventas > Ventas',
      proposito:
        'Registrar ventas comerciales (por ejemplo a clientes con crédito o pedidos grandes) y consultar el historial de todas las ventas con sus documentos.',
      quienLoUsa: 'Vendedores, facturación y administración.',
      pantalla: [
        {
          texto: 'Muestra las ventas del período, el ticket promedio, los productos vendidos y las ventas pendientes de facturar. Las pestañas filtran por Confirmadas, Facturadas, Pendientes y Anuladas.',
          captura: c('18-ventas-01-lista', 'Historial de ventas.'),
        },
      ],
      procedimientos: [
        {
          id: 'crear-venta',
          titulo: 'Registrar una venta comercial',
          objetivo: 'Vender a un cliente eligiendo productos, medio de pago y el documento a emitir.',
          pasos: [
            {
              texto: 'Pulse [[Nueva Venta]]. En el paso **Cliente** busque al cliente por documento, nombre o teléfono, o pulse [[Consumidor Final]] para una venta de mostrador.',
              captura: c('18-ventas-02-cliente', 'Paso 1: elegir el cliente.'),
            },
            {
              texto: 'En **Productos** confirme la **bodega** de despacho y busque cada producto por nombre, SKU o código de barras. La lista muestra el precio y las unidades disponibles; haga clic para agregarlo.',
              captura: c('18-ventas-03-buscar', 'Búsqueda de productos con precio y disponibilidad.'),
            },
            {
              texto: 'Ajuste la **cantidad** con [[-]] y [[+]] y, si aplica, el descuento. Pulse [[Siguiente]].',
              captura: c('18-ventas-04-productos', 'Productos agregados a la venta.'),
            },
            {
              texto: 'En **Pago & Totales** elija el medio de pago: **Efectivo**, **Transferencia**, **Crédito Comercial** (queda en cuentas por cobrar) o **Pago Mixto**. Revise subtotal, IVA y total, y agregue observaciones si hace falta.',
              captura: c('18-ventas-05-pago', 'Medio de pago y totales.'),
            },
            {
              texto: 'En **Confirmar** elija el documento: **Factura POS** (tirilla), **Factura Electrónica DIAN**, **Guía de Remisión** o **Solo Registro de Venta** (para facturar después). Revise el resumen y pulse [[Confirmar Venta]].',
              captura: c('18-ventas-06-confirmar', 'Documento a emitir y resumen de la venta.'),
            },
          ],
          resultado: 'La venta descuenta el inventario, registra el pago (o la deuda) y genera su asiento contable.',
        },
      ],
    },
    {
      id: 'pos',
      titulo: 'Punto de venta (POS)',
      menu: 'Ventas > POS',
      proposito: 'Vender rápido en mostrador: buscar o escanear productos, cobrar en efectivo, transferencia o mixto, e imprimir la tirilla.',
      quienLoUsa: 'Cajeros y encargados de punto de venta.',
      pantalla: [
        {
          texto: 'A la izquierda está el catálogo con buscador ([[F2]]), botón [[Escanear]] y filtros por categoría. Cada producto muestra existencia, precio y precio mayorista. A la derecha está el carrito con el cliente ([[F4]] para cambiarlo) y el botón [[COBRAR / FINALIZAR (F8)]].',
          elementos: [
            'Arriba: la **bodega** del punto de venta, el estado de la **caja** (abierta o cerrada), [[Pantalla cliente]] y [[Mis ventas]] ([[F9]]).',
            '[[Panel]] (arriba a la izquierda) vuelve al resto del sistema.',
          ],
          captura: c('19-pos-01-pantalla', 'Pantalla del punto de venta.'),
        },
      ],
      procedimientos: [
        {
          id: 'vender-pos',
          titulo: 'Hacer una venta en el POS',
          objetivo: 'Registrar y cobrar una venta de mostrador.',
          pasos: [
            {
              texto: 'Verifique arriba que esté en la **bodega** correcta y que la **caja esté abierta**. Si dice "Caja cerrada", ábrala primero (vea "Abrir el turno de caja").',
            },
            {
              texto: 'Agregue productos: escanee el código de barras, búsquelos con [[F2]] o pulse [[+]] en la tarjeta. Cada clic suma una unidad. En el carrito puede cambiar la cantidad, poner un % de descuento o quitar la línea.',
              captura: c('19-pos-02-carrito', 'Carrito con productos agregados y total a pagar.'),
            },
            { texto: 'Si el cliente pide factura a su nombre, pulse [[Cambiar (F4)]] y elíjalo; si no, se queda **Consumidor Final**.' },
            {
              texto: 'Pulse [[COBRAR / FINALIZAR (F8)]]. Elija el método de pago: **Efectivo**, **Transferencia QR** o **Mixto**.',
              captura: c('19-pos-03-cobro', 'Ventana de cobro.'),
              nota: 'Sin caja abierta solo se puede cobrar por transferencia. Para recibir efectivo abra la caja en el módulo Cajas.',
            },
            {
              texto: 'Si es transferencia, elija la **cuenta bancaria** que recibe el dinero.',
              captura: c('19-pos-04-cuenta', 'Cuenta bancaria que recibe la transferencia.'),
            },
            {
              texto: 'Revise el total y pulse [[Confirmar & Cobrar]]. Luego imprima la tirilla con [[Imprimir Ticket]] o [[Imprimir para cliente (15×20)]].',
              captura: c('19-pos-05-cobro-listo', 'Cobro listo para confirmar.'),
            },
          ],
          resultado: 'La venta queda guardada con su pago, descuenta el inventario de la bodega, registra el movimiento de caja o banco y genera el asiento contable.',
        },
      ],
      consejos: [
        'Atajos de teclado: [[F2]] buscar producto, [[F4]] cambiar cliente, [[F8]] cobrar, [[F9]] ventas del turno.',
        'Cada bodega necesita su propia caja registrada para poder recibir efectivo.',
      ],
    },
    {
      id: 'cajas',
      titulo: 'Cajas y arqueos',
      menu: 'Ventas > Cajas',
      proposito: 'Crear las cajas de cada sede, abrir y cerrar turnos, registrar entradas y retiros de efectivo y hacer el arqueo.',
      quienLoUsa: 'Cajeros, supervisores y tesorería.',
      pantalla: [
        {
          texto: 'Muestra las cajas registradas, los turnos abiertos, las cajas cerradas y el historial de arqueos. La pestaña **Cajas en vivo** muestra cada caja con su estado y el botón para abrir o cerrar el turno.',
          captura: c('20-cajas-01-lista', 'Módulo Cajas y arqueos.'),
        },
      ],
      procedimientos: [
        {
          id: 'crear-caja',
          titulo: 'Crear una caja registradora',
          objetivo: 'Registrar un punto de cobro en una sede.',
          pasos: [
            {
              texto: 'Pulse [[Nueva caja]]. Elija la **bodega o sede**, escriba un **código** (por ejemplo CAJA-02) y un **nombre descriptivo**. Pulse [[Crear caja]].',
              captura: c('20-cajas-04-nueva', 'Registro de una caja nueva.'),
            },
          ],
        },
        {
          id: 'abrir-caja',
          titulo: 'Abrir el turno de caja',
          objetivo: 'Empezar a vender en efectivo con una base de cambio.',
          pasos: [
            { texto: 'En la tarjeta de la caja pulse [[Abrir turno de caja]].' },
            {
              texto: 'Escriba la **base inicial de efectivo** (el dinero para dar cambio; máximo $500.000) y, si quiere, notas de apertura. Pulse [[Confirmar apertura]].',
              captura: c('20-cajas-02-apertura', 'Apertura de caja con su base.'),
            },
          ],
          resultado: 'La caja queda **Abierta** a su nombre y el POS ya puede cobrar en efectivo.',
        },
        {
          id: 'movimiento-caja',
          titulo: 'Registrar una entrada o retiro de efectivo',
          objetivo: 'Dejar constancia de dinero que entra o sale de la caja durante el turno.',
          pasos: [
            { texto: 'En la caja abierta pulse [[Movimiento]].' },
            { texto: 'Elija **Entrada (inyección)** o **Salida (retiro)**, escriba el valor y el motivo, y pulse [[Registrar movimiento]].' },
          ],
        },
        {
          id: 'cerrar-caja',
          titulo: 'Hacer el arqueo y cerrar la caja',
          objetivo: 'Contar el efectivo al final del turno y compararlo con lo que el sistema espera.',
          pasos: [
            { texto: 'En la caja abierta pulse [[Arqueo y cierre]].' },
            {
              texto: 'El sistema muestra el **efectivo esperado en gaveta**: base inicial + ventas en efectivo + entradas − retiros. Aparte muestra lo cobrado por transferencia y a crédito.',
            },
            { texto: 'Cuente el efectivo y escriba el valor **contado**. El sistema indica si la caja está **cuadrada**, con **faltante** o con **sobrante**.' },
            { texto: 'Escriba observaciones si hay diferencia y pulse [[Confirmar cierre y arqueo]].' },
          ],
          resultado: 'El turno queda en el **Historial de arqueos y cierres** con base, esperado y contado.',
        },
        {
          id: 'historial-cajas',
          titulo: 'Consultar los arqueos anteriores',
          objetivo: 'Revisar turnos ya cerrados.',
          pasos: [
            { texto: 'Abra la pestaña **Historial de arqueos y cierres**. Verá cada turno con la caja, el cajero, la apertura, el cierre, la base, lo esperado y lo contado.', captura: c('20-cajas-03-historial', 'Historial de arqueos.') },
          ],
        },
      ],
    },
    {
      id: 'facturacion',
      titulo: 'Facturación electrónica',
      menu: 'Ventas > Facturación',
      proposito:
        'Emitir facturas electrónicas ante la DIAN a partir de las ventas, consultar su estado, enviarlas al cliente por correo y emitir notas crédito y débito.',
      quienLoUsa: 'Facturación y administración. Las notas crédito y débito requieren permiso de anulación.',
      pantalla: [
        {
          texto: 'Muestra las facturas generadas, las aceptadas por la DIAN, las pendientes, las rechazadas, el total facturado, las notas crédito y las anuladas.',
          captura: c('21-facturacion-01-resumen', 'Módulo Facturación.'),
        },
        {
          texto: 'La lista muestra cada documento con su número (por ejemplo SETP-990000001), la venta de origen, el cliente, el tipo (electrónica, nota crédito, nota débito), el total y el estado DIAN. Las pestañas filtran por Electrónicas, Facturas POS, Pendientes DIAN, Aceptadas, Rechazadas, Notas Crédito y Anuladas.',
          captura: c('21-facturacion-02-lista', 'Lista de facturas y notas.'),
        },
      ],
      procedimientos: [
        {
          id: 'facturar-venta',
          titulo: 'Emitir la factura electrónica de una venta',
          objetivo: 'Generar la factura electrónica de una venta ya registrada y enviarla a la DIAN.',
          pasos: [
            {
              texto: 'Pulse [[Facturar Venta]] y elija la **venta** en la lista. Verá el cliente, su NIT o cédula, el correo y los productos.',
              captura: c('21-facturacion-03-facturar-venta', 'Ventana para facturar una venta.'),
              nota: 'Si el cliente no tiene correo registrado, la factura se emite igual pero no le llega por correo. Conviene registrarlo antes en Clientes.',
            },
            { texto: 'Pulse [[Emitir Factura Electrónica]]. El sistema asigna el número según la resolución vigente, genera el CUFE y el código QR, firma el documento y lo envía a la DIAN.' },
            { texto: 'Cuando la DIAN la acepta, el estado cambia a **Aceptada por la DIAN** y la factura se envía sola al correo del cliente con el PDF y el XML.' },
          ],
        },
        {
          id: 'estado-dian',
          titulo: 'Consultar el estado y reenviar una factura',
          objetivo: 'Saber si la DIAN aceptó o rechazó un documento y volver a enviarlo si hizo falta.',
          pasos: [
            { texto: 'En la lista haga clic en la factura. En el panel de detalle, la sección **Datos fiscales DIAN** muestra el estado, la resolución, el CUFE, el QR y la respuesta de la DIAN.' },
            { texto: 'Si dice **Enviada**, pulse [[Consultar estado en la DIAN]] para traer el resultado.' },
            { texto: 'Si dice **Rechazada** o hubo un error de comunicación, lea el **Detalle** del error, corrija lo que indique y pulse [[Reintentar envío a la DIAN]].' },
            { texto: 'Con [[Ver XML]] descarga el archivo firmado y con [[Representación gráfica]] abre la factura para imprimirla o guardarla en PDF.' },
          ],
        },
        {
          id: 'enviar-factura-correo',
          titulo: 'Enviar la factura al cliente por correo',
          objetivo: 'Volver a enviar una factura aceptada al correo del cliente.',
          pasos: [
            { texto: 'Abra el detalle de una factura **Aceptada por la DIAN** y pulse [[Enviar al cliente por correo]].' },
            { texto: 'El cliente recibe un correo de facturacion@supermas.co con un ZIP que contiene la factura en PDF y el XML validado por la DIAN.' },
          ],
        },
        {
          id: 'nota-credito',
          titulo: 'Emitir una nota crédito',
          objetivo: 'Disminuir o anular el valor de una factura aceptada (devolución, descuento, error de precio).',
          pasos: [
            { texto: 'Abra el detalle de la factura aceptada y pulse [[Nota crédito / débito]].' },
            { texto: 'En **Tipo de nota** deje **Nota crédito (disminuye la factura)**.' },
            {
              texto: 'Elija el **concepto DIAN**: 1 Devolución parcial, 2 Anulación de la factura, 3 Rebaja o descuento, 4 Ajuste de precio, 5 Descuento por pronto pago, 6 Descuento por volumen.',
              nota: 'Para el concepto 1 (devolución) primero debe registrar la devolución de la mercancía en el módulo Devoluciones; la nota toma esas cantidades.',
            },
            { texto: 'Escriba el **motivo** (queda en la nota y en la auditoría). Para descuentos o ajustes, marque el producto y escriba el valor a acreditar antes de IVA; el sistema calcula el IVA y el total.' },
            { texto: 'Pulse [[Emitir nota crédito]]. La nota se envía a la DIAN igual que una factura y, al ser aceptada, llega al correo del cliente.' },
          ],
          resultado: 'La nota aparece en la lista con su propio número (por ejemplo NC-…), su CUDE y su asiento contable.',
        },
        {
          id: 'nota-debito',
          titulo: 'Emitir una nota débito',
          objetivo: 'Aumentar el valor de una factura aceptada (intereses, gastos, cambio de valor).',
          pasos: [
            { texto: 'Abra el detalle de la factura aceptada, pulse [[Nota crédito / débito]] y elija **Nota débito (aumenta la factura)**.' },
            { texto: 'Elija el concepto: 1 Intereses, 2 Gastos por cobrar, 3 Cambio del valor u 4 Otros. Escriba el motivo.' },
            { texto: 'En **Cargos adicionales** escriba la descripción, cantidad, valor unitario e IVA de cada cargo. Con [[+ Agregar línea]] suma más cargos.' },
            { texto: 'Pulse [[Emitir nota débito]].' },
          ],
        },
      ],
      consejos: [
        'Una factura aceptada no se puede modificar ni borrar: cualquier corrección se hace con nota crédito o débito.',
        'Las facturas de prueba (prefijo SETP) son del ambiente de habilitación de la DIAN y no tienen validez fiscal.',
      ],
    },
    {
      id: 'remisiones',
      titulo: 'Remisiones',
      menu: 'Ventas > Remisiones',
      proposito: 'Registrar el despacho y la entrega de mercancía a clientes con su guía de remisión.',
      quienLoUsa: 'Despachos, logística y ventas.',
      pantalla: [
        {
          texto: 'Muestra las remisiones totales, pendientes de despacho, en tránsito, entregadas y anuladas. Arriba están [[Exportar]], [[Crear desde Venta]] y [[Nueva Remisión]].',
          captura: c('22-remisiones-01-lista', 'Módulo Remisiones.'),
        },
      ],
      procedimientos: [
        {
          id: 'crear-remision',
          titulo: 'Crear y despachar una remisión',
          objetivo: 'Enviar mercancía a un cliente con su documento de despacho.',
          pasos: [
            {
              texto: 'Pulse [[Nueva Remisión]] (o [[Crear desde Venta]] si ya hay una venta). El asistente tiene cuatro pasos: Cliente, Bodega, Productos y Revisión.',
              captura: c('22-remisiones-02-nueva', 'Paso 1 de la remisión: elegir el cliente.'),
            },
            { texto: 'Elija el cliente (o [[Cliente Genérico]]), la bodega de origen, los productos con sus cantidades, revise y cree la remisión.' },
            { texto: 'Cuando la mercancía sale, abra la remisión y pulse [[Despachar remisión]]. Cuando el cliente la recibe, pulse [[Marcar como entregada]].' },
          ],
        },
      ],
    },
    {
      id: 'devoluciones',
      titulo: 'Devoluciones',
      menu: 'Ventas > Devoluciones',
      proposito:
        'Registrar devoluciones de clientes y devoluciones a proveedores, decidiendo qué pasa con cada producto (vuelve al inventario o va a proveedor o producción si está en mal estado).',
      quienLoUsa: 'Ventas, bodega y administración.',
      pantalla: [
        {
          texto: 'Muestra las devoluciones registradas, las de clientes, las enviadas a proveedores y las unidades devueltas. La pestaña **Mal estado por destino** lista la mercancía dañada pendiente de enviar.',
          captura: c('23-devoluciones-01-lista', 'Módulo Devoluciones.'),
        },
      ],
      procedimientos: [
        {
          id: 'devolucion-cliente',
          titulo: 'Registrar la devolución de un cliente',
          objetivo: 'Recibir mercancía devuelta por un cliente.',
          pasos: [
            { texto: 'Pulse [[Devolución de cliente]] y elija la **venta** de origen.', captura: c('23-devoluciones-02-nueva', 'Registrar devolución de cliente.') },
            {
              texto: 'Para cada producto indique la **cantidad** devuelta y su **condición**. **Buen estado** reingresa al inventario vendible de la sede.',
              captura: c('23-devoluciones-03-buen-estado', 'Producto devuelto en buen estado.'),
            },
            {
              texto: 'Si está en **Mal estado**, no vuelve al inventario vendible: elija el **destino**, **Proveedor** o **Producción**.',
              captura: c('23-devoluciones-04-mal-estado', 'Producto en mal estado con su destino.'),
            },
            { texto: 'Escriba el **motivo** y pulse [[Confirmar Devolución]]. Si la venta tenía factura electrónica, emita después la **nota crédito** por devolución (concepto 1) desde Facturación.' },
          ],
        },
        {
          id: 'devolucion-proveedor',
          titulo: 'Registrar una devolución a un proveedor',
          objetivo: 'Sacar del inventario mercancía que se le devuelve al proveedor.',
          pasos: [
            { texto: 'Pulse [[Devolución a proveedor]], elija el proveedor y la compra, las cantidades y el motivo, y confirme.' },
          ],
        },
      ],
    },
    {
      id: 'tesoreria',
      titulo: 'Tesorería',
      menu: 'Ventas > Tesorería',
      proposito: 'Ver las cuentas bancarias con sus saldos, los pagos a proveedores, los recaudos de clientes y el extracto de movimientos para conciliar.',
      quienLoUsa: 'Tesorería, contabilidad y administración.',
      pantalla: [
        {
          texto: 'Muestra la liquidez total (bancos y caja), los pagos programados, los egresos y los recaudos del mes. La pestaña **Cuentas Bancarias y Saldos** muestra cada cuenta con su saldo y su subcuenta contable.',
          captura: c('24-tesoreria-01-cuentas', 'Cuentas bancarias y saldos.'),
        },
        {
          texto: 'La pestaña **Pagos a Proveedores (Egresos)** lista los pagos con su factura, cuenta, monto y comprobante contable.',
          captura: c('24-tesoreria-02-pagos', 'Pagos a proveedores.'),
        },
        {
          texto: 'La pestaña **Extracto y Conciliación** muestra cada movimiento de la cuenta (ventas por transferencia, pagos…) con su saldo, para compararlo con el extracto del banco.',
          captura: c('24-tesoreria-03-extracto', 'Extracto de movimientos bancarios.'),
        },
      ],
      procedimientos: [
        {
          id: 'crear-cuenta-bancaria',
          titulo: 'Registrar una cuenta bancaria',
          objetivo: 'Agregar una cuenta de banco de la empresa.',
          pasos: [
            { texto: 'En **Cuentas Bancarias y Saldos** pulse [[Nueva Cuenta Bancaria]].' },
            { texto: 'Escriba el banco, el tipo (ahorros o corriente), los últimos dígitos y elija la **subcuenta contable** (1120 / 112005…) donde se registran sus movimientos. Guarde.' },
          ],
        },
      ],
    },
  ],
}
