import type { ProblemaComun } from '../tipos'

export const PROBLEMAS: ProblemaComun[] = [
  {
    id: 'problema-costo-cero',
    problema: 'No me deja crear un producto: dice que ingrese el costo unitario',
    causa: 'El costo unitario de compra es obligatorio y debe ser mayor a $0. Sin costo, el inventario y la utilidad saldrían mal.',
    solucion: 'En la pestaña **Precios** del producto escriba el **Costo unitario de compra** (lo que le cuesta cada unidad al proveedor). En la importación por archivo, llene la columna **Costo Unitario** de cada fila.',
  },
  {
    id: 'problema-caja-cerrada',
    problema: 'En el POS dice "Caja cerrada" y no puedo cobrar en efectivo',
    causa: 'No hay un turno de caja abierto en la bodega donde está el POS, o esa bodega no tiene caja registrada.',
    solucion: 'Vaya a Ventas > Cajas. Si la bodega no tiene caja, créela con [[Nueva caja]]; luego pulse [[Abrir turno de caja]] con la base de efectivo. Mientras tanto, el POS puede cobrar por transferencia.',
  },
  {
    id: 'problema-saldo-insuficiente',
    problema: 'Al hacer una salida o una venta dice que no hay saldo suficiente',
    causa: 'La bodega elegida no tiene las unidades que intenta sacar. El sistema no permite dejar existencias negativas.',
    solucion: 'Revise en Inventario o en el Kardex cuántas unidades hay en esa bodega. Si la mercancía está en otra bodega, haga una transferencia; si el sistema está mal, haga primero un ajuste de entrada por conteo físico.',
  },
  {
    id: 'problema-factura-rechazada',
    problema: 'La DIAN rechazó una factura',
    causa: 'La DIAN encontró un dato que no cumple sus reglas (por ejemplo, datos del cliente, de la empresa o del producto).',
    solucion: 'Abra la factura en Facturación y lea el **Detalle** del rechazo en Datos fiscales DIAN. Corrija el dato (en Clientes, Productos o Configuración) y pulse [[Reintentar envío a la DIAN]].',
  },
  {
    id: 'problema-correo-factura',
    problema: 'El cliente no recibió la factura por correo',
    causa: 'El cliente no tiene correo registrado, el correo está mal escrito o el mensaje llegó a correo no deseado.',
    solucion: 'Revise el correo del cliente en Clientes y corríjalo. Luego abra la factura aceptada y pulse [[Enviar al cliente por correo]]. Pida al cliente revisar la carpeta de correo no deseado.',
  },
  {
    id: 'problema-no-veo-modulo',
    problema: 'No veo un módulo en el menú',
    causa: 'Su rol no tiene permiso para ese módulo.',
    solucion: 'Pida al administrador que revise su rol en Administración > Usuarios. En Administración > Roles puede ver qué permite cada rol.',
  },
  {
    id: 'problema-sesion-cerrada',
    problema: 'El sistema me sacó y me pide iniciar sesión de nuevo',
    causa: 'La sesión se cierra sola después de un tiempo sin actividad, por seguridad.',
    solucion: 'Inicie sesión otra vez. El tiempo de inactividad lo configura el administrador en Configuración.',
  },
  {
    id: 'problema-precio-no-cambia',
    problema: 'Cambié el precio de un producto pero sigue el precio anterior',
    causa: 'Su rol puede proponer precios pero no aprobarlos: el cambio quedó como solicitud.',
    solucion: 'Pida a un aprobador que lo acepte en Inventario > Aprobación de precios. Puede ver el estado en la pestaña **Mis solicitudes**.',
  },
]
