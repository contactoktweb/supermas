import type { Capitulo } from '../tipos'

const c = (archivo: string, leyenda: string) => ({ archivo: `${archivo}.jpg`, leyenda })

export const CANALES: Capitulo = {
  id: 'cap-canales',
  numero: 6,
  titulo: 'Canales y catálogos',
  introduccion: 'Pedidos que llegan de la tienda en línea y los dos catálogos web: Super Más (compra directa) y Distribuidora (consulta y contacto por WhatsApp).',
  modulos: [
    {
      id: 'pedidos-web',
      titulo: 'Pedidos Web',
      menu: 'Canales y catálogos > Pedidos Web',
      proposito: 'Atender los pedidos hechos en la tienda en línea: confirmarlos, alistarlos, despacharlos y entregarlos.',
      quienLoUsa: 'Ecommerce, despachos y ventas.',
      pantalla: [
        {
          texto: 'Muestra las ventas web y los pedidos por estado: pendientes, confirmados, en preparación, listos para despacho, enviados, entregados y cancelados. Se puede buscar por pedido, cliente, documento, guía o factura y filtrar por estado, canal, facturación y pago.',
          captura: c('25-pedidos-web-01', 'Módulo Pedidos Web.'),
        },
      ],
      procedimientos: [
        {
          id: 'atender-pedido-web',
          titulo: 'Atender un pedido web',
          objetivo: 'Llevar un pedido desde que llega hasta que se entrega.',
          pasos: [
            { texto: 'Abra el pedido **Pendiente**, revise los productos y el pago, y confírmelo: el stock queda reservado.' },
            { texto: 'Pase el pedido a **En preparación** mientras se aliste, luego a **Listo para despacho** y a **Enviado** con la guía de transporte.' },
            { texto: 'Cuando el cliente lo recibe, márquelo como **Entregado**. Si se cancela, la reserva de stock se libera.' },
          ],
        },
      ],
    },
    {
      id: 'catalogo-supermas',
      titulo: 'Catálogo Super Más',
      menu: 'Canales y catálogos > Catálogo Super Más',
      proposito: 'Controlar qué productos se venden en la tienda en línea Super Más (compra directa) y ver cuáles tienen pocas unidades o están agotados.',
      quienLoUsa: 'Ecommerce y catálogo.',
      pantalla: [
        {
          texto: 'Muestra los productos publicados, ocultos, disponibles, con pocas unidades y agotados, y las ventas web. Desde la tabla se publica u oculta cada producto.',
          captura: c('26-catalogo-sm-01', 'Catálogo Super Más.'),
        },
      ],
      procedimientos: [],
      consejos: ['La publicación también se puede cambiar desde Productos, en la pestaña **Canales Web** del producto.'],
    },
    {
      id: 'catalogo-distribuidora',
      titulo: 'Catálogo Distribuidora',
      menu: 'Canales y catálogos > Catálogo Distribuidora',
      proposito: 'Controlar el catálogo para clientes distribuidores, que consultan precios de distribuidor y cotizan por WhatsApp.',
      quienLoUsa: 'Ventas a distribuidores y catálogo.',
      pantalla: [
        {
          texto: 'Muestra los productos publicados, ocultos, disponibles y con compra web activa, con su precio distribuidor y el precio público como referencia.',
          captura: c('27-catalogo-dist-01', 'Catálogo Distribuidora.'),
        },
      ],
      procedimientos: [],
    },
  ],
}

export const CONTABILIDAD: Capitulo = {
  id: 'cap-contabilidad',
  numero: 7,
  titulo: 'Contabilidad',
  introduccion: 'Plan de cuentas, asientos contables, terceros, libros, configuración de impuestos e información exógena para la DIAN.',
  modulos: [
    {
      id: 'contabilidad',
      titulo: 'Contabilidad',
      menu: 'Contabilidad > Contabilidad',
      proposito:
        'Ver el estado financiero, administrar el plan de cuentas (PUC), registrar asientos manuales y consultar los asientos que el sistema genera solo con cada venta, compra, pago y nota.',
      quienLoUsa: 'Contador y administración.',
      pantalla: [
        {
          texto: 'La pestaña **Dashboard Contable** muestra activos, pasivos, patrimonio, ingresos, costos, gastos, utilidad, inventario, cuentas por cobrar y por pagar. Arriba están [[Exportar]], [[Nuevo Tercero]], [[Nueva Cuenta]] y [[Nuevo Asiento]].',
          captura: c('28-contabilidad-01-dashboard', 'Dashboard contable.'),
        },
        {
          texto: 'La pestaña **Plan de Cuentas (PUC)** lista las cuentas por clase (Activos, Pasivos, Patrimonio, Ingresos, Gastos, Costos), con su naturaleza, nivel y si se pueden usar en asientos (imputable).',
          captura: c('28-contabilidad-02-puc', 'Plan de cuentas.'),
        },
        {
          texto: 'La pestaña **Asientos Contables** lista todos los comprobantes: los automáticos (FV de ventas, NC y ND de notas, compras, pagos) y los manuales, con su fecha, origen y documento.',
          captura: c('28-contabilidad-03-asientos', 'Asientos contables.'),
        },
      ],
      procedimientos: [
        {
          id: 'asiento-manual',
          titulo: 'Registrar un asiento manual',
          objetivo: 'Registrar un movimiento contable que no sale de otro módulo (ajustes, provisiones, causaciones).',
          pasos: [
            {
              texto: 'Pulse [[Nuevo Asiento]]. Elija el **tipo de comprobante**, la fecha, la bodega o centro de costos y, si aplica, el **tercero**.',
              captura: c('28-contabilidad-04-nuevo-asiento', 'Formulario de asiento manual.'),
            },
            { texto: 'Escriba la **descripción** general del asiento.' },
            { texto: 'En las líneas elija cada **cuenta** (solo subcuentas de nivel 4 o auxiliares de nivel 5) y escriba el valor en **Debe** o **Haber**. Con [[Agregar Línea]] suma más líneas.' },
            { texto: 'Las sumas de Debe y Haber deben ser iguales. Pulse [[Confirmar Asiento Contable]].' },
          ],
        },
      ],
      consejos: [
        'Las ventas, compras, pagos, devoluciones y notas generan su asiento solas: no las registre a mano otra vez.',
        'Las pestañas **Terceros (DIAN)**, **Libro Auxiliar** y **Libro Diario** permiten consultar los terceros y los movimientos por cuenta.',
      ],
    },
    {
      id: 'impuestos',
      titulo: 'Impuestos',
      menu: 'Contabilidad > Impuestos',
      proposito: 'Administrar las tarifas de impuestos (IVA 19 %, 5 %, exento, excluido, retenciones) y ver lo generado y descontable.',
      quienLoUsa: 'Contador y administración.',
      pantalla: [
        {
          texto: 'Muestra las configuraciones activas, los productos gravados y excluidos, las ventas y compras con impuesto, el IVA generado y el descontable. La tabla lista cada tarifa con su código, tipo, porcentaje y vigencia. [[Reportes tributarios]] abre los informes.',
          captura: c('29-impuestos-01', 'Módulo Impuestos.'),
        },
      ],
      procedimientos: [],
    },
    {
      id: 'exogena',
      titulo: 'Exógena',
      menu: 'Contabilidad > Exógena',
      proposito: 'Preparar, validar y generar los archivos de información exógena (medios magnéticos) que se reportan a la DIAN cada año.',
      quienLoUsa: 'Contador.',
      pantalla: [
        {
          texto: 'Se elige el **año fiscal** (2024, 2025, 2026) y se trabaja con [[Configuración]], [[Conciliación]], [[Historial]], [[Validar información]] y [[Generar archivos]]. Los indicadores muestran los registros a reportar, los terceros, los formatos y los errores.',
          captura: c('30-exogena-01', 'Módulo Exógena.'),
        },
        {
          texto: 'La pestaña [[Conciliación]] compara los saldos contables del año (ventas, IVA, compras, cartera y cuentas por pagar) con lo que se va a reportar en cada formato, para detectar diferencias antes de generar los archivos.',
          captura: c('30-exogena-02-conciliacion', 'Conciliación contable de exógena.'),
        },
      ],
      procedimientos: [],
    },
  ],
}
