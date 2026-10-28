import type { Capitulo } from '../tipos'

const c = (archivo: string, leyenda: string) => ({ archivo: `${archivo}.jpg`, leyenda })

export const CLIENTES: Capitulo = {
  id: 'cap-clientes',
  numero: 4,
  titulo: 'Clientes y cartera',
  introduccion: 'Directorio de clientes, cuentas por cobrar de las ventas a crédito, pagos recibidos y estado de cuenta de cada cliente.',
  modulos: [
    {
      id: 'clientes',
      titulo: 'Clientes',
      menu: 'Clientes y cartera > Clientes',
      proposito: 'Registrar los clientes con sus datos de facturación, contacto, lista de precios y condiciones de crédito.',
      quienLoUsa: 'Ventas, caja, cartera y administración.',
      pantalla: [
        {
          texto: 'Muestra el total de clientes, los nuevos del período, los que compraron y el total vendido. La tabla se puede buscar por nombre, NIT, cédula, correo o teléfono y filtrar por tipo, categoría, lista de precios, ciudad y actividad.',
          captura: c('14-clientes-01-lista', 'Módulo Clientes.'),
        },
      ],
      procedimientos: [
        {
          id: 'crear-cliente',
          titulo: 'Registrar un cliente',
          objetivo: 'Crear un cliente para venderle con factura a su nombre, a crédito o con lista de precios especial.',
          pasos: [
            { texto: 'Pulse [[Nuevo cliente]]. El formulario tiene tres pestañas.', captura: c('14-clientes-02-nuevo-vacio', 'Formulario de cliente nuevo.') },
            {
              texto: 'En **Información Básica** elija **Persona Natural** o **Empresa / Jurídica**, el tipo y número de documento, y los nombres y apellidos (o la razón social).',
              captura: c('14-clientes-03-nuevo-basica', 'Información básica del cliente.'),
            },
            {
              texto: 'En **Contacto & Ubicación** escriba el teléfono, el **correo para facturación** (ahí llega la factura electrónica), la dirección, la ciudad y el departamento.',
              captura: c('14-clientes-04-nuevo-contacto', 'Contacto y ubicación.'),
              advertencia: 'Revise la ciudad y el departamento: vienen con un valor de ejemplo. Deben ser los del cliente porque salen en la factura electrónica.',
            },
            {
              texto: 'En **Comercial & Crédito** elija la **categoría** del cliente y la **lista de precios** (normal, mayorista…). Si le vende a crédito, escriba el **cupo** y los **días de crédito**; con cupo 0 solo puede comprar de contado.',
              captura: c('14-clientes-05-nuevo-comercial', 'Condiciones comerciales del cliente.'),
            },
            { texto: 'Pulse [[Crear Cliente]].' },
          ],
        },
      ],
      consejos: [
        'Para ventas de mostrador sin datos del comprador se usa el cliente **Consumidor Final** (CC 222222222222), que ya existe.',
      ],
    },
    {
      id: 'cuentas-por-cobrar',
      titulo: 'Cuentas por cobrar',
      menu: 'Clientes y cartera > Cuentas por cobrar',
      proposito: 'Controlar lo que deben los clientes por ventas a crédito, por antigüedad de la deuda, y registrar sus abonos.',
      quienLoUsa: 'Cartera, tesorería y administración.',
      pantalla: [
        {
          texto: 'Arriba están la cartera total, la corriente, la vencida y lo recaudado en el mes. La **clasificación por antigüedad** separa la deuda en corriente, 1-30, 31-60, 61-90 y más de 90 días. Debajo está cada venta con su total, lo abonado, el saldo y el estado.',
          captura: c('15-cxc-01-lista', 'Módulo Cuentas por cobrar.'),
        },
      ],
      procedimientos: [
        {
          id: 'registrar-abono-cliente',
          titulo: 'Registrar el abono o pago de un cliente',
          objetivo: 'Descontar de la deuda del cliente lo que pagó.',
          pasos: [
            { texto: 'Busque la venta del cliente y pulse [[Abonar]].' },
            { texto: 'Escriba el valor recibido, la fecha y el medio de pago (efectivo, transferencia a la cuenta bancaria…).' },
            { texto: 'Confirme. Se genera un comprobante de recaudo que queda en **Pagos recibidos**.' },
          ],
          resultado: 'El saldo de la venta baja; si se paga completa queda en estado **Pagada**.',
        },
      ],
    },
    {
      id: 'pagos-recibidos',
      titulo: 'Pagos recibidos',
      menu: 'Clientes y cartera > Pagos recibidos',
      proposito: 'Consultar todos los comprobantes de recaudo y abonos aplicados a la cartera.',
      quienLoUsa: 'Cartera, tesorería y contabilidad.',
      pantalla: [
        {
          texto: 'Muestra el total recaudado y la lista de comprobantes. Puede buscar por comprobante, cliente, documento o venta.',
          captura: c('16-pagos-01-lista', 'Módulo Pagos recibidos.'),
        },
      ],
      procedimientos: [],
    },
    {
      id: 'estado-cuenta',
      titulo: 'Estado de cuenta',
      menu: 'Clientes y cartera > Estado de cuenta',
      proposito: 'Ver la ficha financiera de un cliente: cupo, deuda, crédito disponible, antigüedad, ventas y abonos.',
      quienLoUsa: 'Cartera, ventas y administración.',
      pantalla: [
        {
          texto: 'Elija el **cliente** arriba a la derecha. Verá su ficha, el control de crédito (límite, plazo, deuda y disponible), la antigüedad de la deuda y dos pestañas: **Ventas y cuentas por cobrar** y **Comprobantes de abono / pago**. Desde aquí también puede pulsar [[Registrar Abono]].',
          captura: c('17-estado-cuenta-01', 'Estado de cuenta de un cliente.'),
        },
      ],
      procedimientos: [],
    },
  ],
}
