import type { GrupoNomenclatura } from '../tipos'

type T = [termino: string, significado: string]
const grupo = (titulo: string, terminos: T[]): GrupoNomenclatura => ({
  titulo,
  terminos: terminos.map(([termino, significado]) => ({ termino, significado })),
})

const SALUD_STOCK = grupo('Estados del stock (color de la cantidad)', [
  ['Verde', 'Stock en niveles óptimos: hay más unidades que el mínimo del producto.'],
  ['Ámbar', 'Stock bajo: quedan unidades, pero igual o menos que el **mínimo**.'],
  ['Rojo', 'Stock crítico: igual o menos que el **crítico**; hay que reabastecer ya.'],
  ['Agotado', 'Cero unidades disponibles.'],
  ['uds / UND', 'Unidades. UND es la unidad de medida por defecto del producto.'],
])

/** Columnas, abreviaturas y estados de las tablas de cada módulo, por id de módulo. */
export const NOMENCLATURA: Record<string, GrupoNomenclatura[]> = {
  productos: [
    grupo('Columnas de la tabla', [
      ['Img', 'Foto principal del producto.'],
      ['SKU', 'Código interno único del producto (Stock Keeping Unit).'],
      ['Código barras', 'Código EAN/UPC que lee el escáner del POS.'],
      ['Stock total', 'Suma de las unidades del producto en todas las bodegas.'],
      ['Costo prom.', 'Costo unitario registrado del producto. Solo lo ven los roles con permiso de costos; los demás ven ••••.'],
      ['Precio normal', 'Precio de la lista NORMAL (venta al público).'],
      ['Mayorista', 'Precio de la lista MAYORISTA.'],
      ['Margen', 'Ganancia sobre el precio sin IVA: (precio sin IVA − costo) ÷ precio sin IVA. Verde: 25 % o más; azul: 15 % a 25 %; ámbar: menos de 15 %.'],
      ['Web SM', 'Catálogo **Super Más** (compra directa por la web). La marca **SM** indica que el producto está publicado ahí; "—" que no.'],
      ['Cat. Dist.', 'Catálogo **Distribuidora** (pedidos por WhatsApp). La marca **Dist** indica que está publicado ahí; "—" que no.'],
    ]),
    grupo('Etiquetas en la vista de cuadrícula', [
      ['Web + WA', 'Publicado en los dos catálogos: compra web y contacto por WhatsApp.'],
      ['Web SM', 'Solo en el catálogo Super Más (compra directa web).'],
      ['Cat. WA', 'Solo en el catálogo Distribuidora (contacto por WhatsApp).'],
      ['Sin web', 'No está publicado en ningún catálogo.'],
    ]),
    SALUD_STOCK,
    grupo('Indicadores superiores', [
      ['Productos agotados', 'Productos activos con cero unidades en total.'],
      ['Stock bajo', 'Productos activos en estado bajo o crítico.'],
      ['Publicados en web', 'Productos visibles en Super Más o en Distribuidora.'],
    ]),
  ],
  categorias: [
    grupo('Columnas de la tabla', [
      ['Categoría / Jerarquía', 'Nombre. Las subcategorías aparecen con ↳ y el texto "en" seguido de la categoría padre.'],
      ['Slug', 'Nombre en formato de dirección web, usado en los catálogos públicos.'],
      ['Productos', 'Cantidad de productos asociados (prod. = productos).'],
      ['Subcategorías', 'Cantidad de categorías hijas (subcat.).'],
      ['Estado', 'Activa o Inactiva. Las inactivas se ven atenuadas.'],
    ]),
  ],
  marcas: [
    grupo('Columnas de la tabla', [
      ['Marca', 'Logo de la marca; si no tiene, su inicial.'],
      ['Slug', 'Nombre en formato de dirección web.'],
      ['Productos Asociados', 'Cantidad de productos de la marca.'],
      ['Estado', 'Activa (verde) o Inactiva (rojo).'],
    ]),
  ],
  bodegas: [
    grupo('Columnas y tarjetas', [
      ['Tipo', 'Bodega, Punto de venta o CEDI (centro de distribución).'],
      ['Productos', 'Cantidad de productos con existencias registradas en la bodega.'],
      ['Inventario costo', 'Unidades × costo promedio de cada producto en esa bodega.'],
      ['Stock bajo / Agotados', 'Productos de la bodega en mínimo o por debajo, y productos en cero.'],
      ['Usuarios', 'Personas asignadas a la bodega.'],
      ['Última actividad', 'Fecha y hora del último movimiento de inventario en la bodega.'],
      ['Ecommerce', 'La bodega despacha los pedidos web.'],
    ]),
    grupo('Pestaña Inventario de la bodega', [
      ['Existencia', 'Unidades del producto en esa bodega.'],
      ['Stock Mín.', 'Mínimo configurado para el producto en la bodega.'],
      ['Estado', 'Normal, Stock bajo, Crítico o Agotado, con los mismos colores del resto del sistema.'],
      ['Acciones rápidas', 'Lápiz: ajustar inventario; flechas: transferir; reloj: ver el Kardex.'],
    ]),
    grupo('Pestaña Movimientos', [
      ['Entrada / Salida', 'Unidades que ingresaron (+, verde) o salieron (−, rojo).'],
      ['Saldo resultante', 'Unidades que quedaron en la bodega después del movimiento.'],
      ['Tipo', 'Entrada por compra, Salida por venta, Traslado, Ajuste de entrada o salida, Inventario inicial, Devolución.'],
    ]),
  ],
  inventario: [
    grupo('Columnas de la tabla', [
      ['#', 'Botón para desplegar el detalle por bodega (vista Consolidado).'],
      ['Stock Total / Existencia', 'Unidades en todas las bodegas (Consolidado) o en una bodega (Por bodega).'],
      ['Mínimo', 'Por debajo de este número el producto pasa a stock bajo.'],
      ['Crítico', 'Por debajo de este número el producto pasa a crítico.'],
      ['Costo Unit.', 'Costo promedio por unidad. Solo con permiso de costos.'],
      ['Valor a costo', 'Unidades × costo unitario.'],
      ['Último mov.', 'Documento y fecha del último movimiento ("Sin registro" si no tiene).'],
    ]),
    SALUD_STOCK,
    grupo('Desglose por bodega', [
      ['Mín / Crít', 'Mínimo y crítico de esa bodega.'],
      ['Barra', 'Parte del stock total que está en esa bodega. Roja: crítico o agotado; ámbar: bajo; azul: normal.'],
    ]),
    grupo('Indicadores superiores', [
      ['SKUs', 'Productos con al menos una unidad.'],
      ['prods', 'Productos.'],
    ]),
  ],
  kardex: [
    grupo('Columnas de la tabla', [
      ['Saldo Ant.', 'Unidades que había antes del movimiento.'],
      ['Entrada / Salida', 'Unidades que entraron (+, verde) o salieron (−, rojo).'],
      ['Saldo Resultante', 'Unidades después del movimiento; debajo se ve el cálculo "anterior → ± cantidad → resultante".'],
      ['Costo Unit. / Costo Prom.', 'Costo por unidad con que se registró el movimiento.'],
      ['Valor Movimiento', 'Cantidad × costo unitario.'],
      ['Documento', 'Documento que originó el movimiento: compra, venta (VTA-…), ajuste (AJ-…), traslado o inventario inicial (INV-INI-…).'],
    ]),
    grupo('Tipos de movimiento', [
      ['(+) / (−)', 'Entrada o salida de unidades.'],
      ['Compra (+)', 'Ingreso por recepción de una compra.'],
      ['Venta (−)', 'Salida por una venta o el POS.'],
      ['Transf. Entrada / Salida', 'Traslado entre bodegas: entra a la de destino y sale de la de origen.'],
      ['Ajuste Entrada / Salida', 'Corrección manual por conteo, merma, vencimiento o error.'],
      ['Devolución', 'Mercancía devuelta por un cliente o enviada al proveedor.'],
      ['↻ Revertido', 'El movimiento fue anulado con un movimiento de reversión.'],
    ]),
  ],
  transferencias: [
    grupo('Columnas de la tabla', [
      ['Bodega Origen → Destino', 'De dónde sale y a dónde llega la mercancía.'],
      ['Unidades', 'Recibidas si ya llegó; despachadas si va en camino; solicitadas si aún no sale.'],
      ['Responsable', 'Quien despachó la transferencia o, si no ha salido, quien la creó.'],
    ]),
    grupo('Estados', [
      ['Pendiente', 'Creada, esperando despacho.'],
      ['En tránsito', 'Despachada, esperando recepción en la bodega destino.'],
      ['Recibida', 'Llegó y sumó al inventario de destino.'],
      ['Rechazada', 'La bodega destino no la aceptó.'],
      ['Con Novedad', 'Llegó con diferencias o daños.'],
    ]),
  ],
  'aprobacion-precios': [
    grupo('Etiquetas de cada solicitud', [
      ['Precio tachado → precio nuevo', 'Precio actual de la lista y precio propuesto.'],
      ['+X % / −X %', 'Variación del precio: verde si sube o se mantiene, rojo si baja.'],
      ['Lista nueva', 'El producto no tenía precio en esa lista.'],
      ['Pendiente / Aprobada / Rechazada', 'Estado de la solicitud; el precio solo cambia al aprobarse.'],
    ]),
  ],
  proveedores: [
    grupo('Columnas de la tabla', [
      ['Documento / NIT', 'Número de identificación tributaria del proveedor.'],
      ['Compras', 'Compras con mercancía ya recibida (total o parcial).'],
      ['Saldo Pendiente', 'Lo que se le debe en compras confirmadas o recibidas sin pagar. "Al día ($0)" si no hay deuda.'],
    ]),
  ],
  'ordenes-compra': [
    grupo('Columnas de la tabla', [
      ['N° Compra', 'Consecutivo interno. El ícono de documento indica factura del proveedor adjunta.'],
      ['Factura Prov.', 'Número de la factura del proveedor.'],
      ['Tipo Pago', 'Contado (se paga al recibir) o Crédito (se paga después, con fecha de vencimiento).'],
      ['Saldo Pendiente', 'Total − lo pagado. Debajo, "Vence:" con la fecha límite.'],
    ]),
    grupo('Estados', [
      ['Borrador', 'Aún editable; no afecta inventario ni cuentas.'],
      ['Confirmada', 'Aprobada y esperando la mercancía.'],
      ['Recibida Parcial', 'Llegó solo una parte.'],
      ['Recibida', 'Llegó todo; aún sin pagos.'],
      ['Pendiente pago', 'Recibida con pagos parciales.'],
      ['Pagada', 'Sin saldo pendiente.'],
      ['Anulada', 'Cancelada.'],
    ]),
  ],
  recepciones: [
    grupo('Columnas de la tabla', [
      ['N° Acta', 'Número del acta de recepción.'],
      ['Remisión Proveedor', 'Número de la remisión que trajo el proveedor.'],
      ['Ingreso Físico', 'Ítems y unidades recibidas ("u." = unidades).'],
    ]),
  ],
  'cuentas-por-pagar': [
    grupo('Columnas y siglas', [
      ['CxP', 'Cuentas por pagar: lo que la empresa debe a sus proveedores.'],
      ['Vencimiento', 'Fecha límite de pago. Debajo: "Vence en N d", "Vence hoy", "Vencida hace N d" o "Liquidada" (d = días).'],
      ['Abonado', 'Lo ya pagado.'],
      ['Saldo Pendiente', 'Total − abonado. Rojo si está vencido.'],
      ['(N) con reloj', 'Historial de los N pagos hechos a esa factura.'],
    ]),
    grupo('Estados', [
      ['Pendiente', 'Sin abonos.'],
      ['Abonada', 'Con abonos y saldo por pagar.'],
      ['Vencida', 'Pasó la fecha límite y aún hay saldo.'],
      ['Pagada', 'Sin saldo.'],
    ]),
  ],
  clientes: [
    grupo('Columnas y siglas', [
      ['Documento', 'CC (cédula de ciudadanía), NIT, CE (cédula de extranjería), TI (tarjeta de identidad), PPT/PEP (permisos para extranjeros), RC (registro civil), PP/PA (pasaporte).'],
      ['222222222222', 'Documento del cliente genérico **Consumidor Final** (ventas sin identificar al comprador).'],
      ['Total Comprado', 'Suma de sus compras; debajo, cuántas compras.'],
      ['Saldo Cartera', 'Lo que el cliente debe. Ámbar si tiene deuda; "Al día ($0)" si no.'],
      ['Categoría', 'Mayorista, Cliente Frecuente, Empresa Institucional o Consumidor Final.'],
    ]),
  ],
  'cuentas-por-cobrar': [
    grupo('Columnas y siglas', [
      ['CxC', 'Cuentas por cobrar: lo que los clientes le deben a la empresa.'],
      ['Vencimiento', 'Fecha límite y "N días plazo" que se le dieron al cliente.'],
      ['Antigüedad', 'Días de mora: Corriente (al día), 1-30, 31-60, 61-90 y más de 90 días ("d. mora" = días de mora).'],
      ['Abonado / Saldo Pendiente', 'Lo ya pagado y lo que falta.'],
    ]),
    grupo('Estados', [
      ['Pendiente', 'Sin abonos y dentro del plazo.'],
      ['Abono Parcial', 'Con abonos y saldo por cobrar.'],
      ['Vencida', 'Pasó el plazo con saldo.'],
      ['Pagada', 'Sin saldo.'],
      ['Anulada', 'La venta fue anulada.'],
    ]),
  ],
  'pagos-recibidos': [
    grupo('Columnas de la tabla', [
      ['Comprobante', 'Número del recibo del pago.'],
      ['Venta Asociada', 'Venta a la que se abonó.'],
      ['Medio de Pago', 'Efectivo, Transferencia, Consignación, Cheque, etc.'],
      ['Valor Recaudado', 'Valor recibido.'],
    ]),
  ],
  ventas: [
    grupo('Columnas de la tabla', [
      ['N° Venta', 'Consecutivo VTA-año-número.'],
      ['Productos', '"N prod (Xu)": N productos distintos y X unidades en total.'],
      ['Documento', 'Documento emitido: **FE** factura electrónica, **POS** comprobante de punto de venta, **REM** remisión, "—" ninguno.'],
    ]),
    grupo('Estados', [
      ['Confirmada', 'Registrada; descontó inventario.'],
      ['Facturada', 'Ya tiene factura.'],
      ['Pendiente', 'Por completar.'],
      ['Devuelta', 'Tuvo devolución.'],
      ['Anulada', 'Cancelada; la fila se ve atenuada.'],
    ]),
  ],
  pos: [
    grupo('Etiquetas de la pantalla', [
      ['N un.', 'Unidades disponibles en la bodega del POS: verde si hay más de 10, ámbar si hay 10 o menos.'],
      ['Agotado', 'Sin unidades; la tarjeta no se puede agregar.'],
      ['May:', 'Precio mayorista del producto.'],
      ['c/u', 'Precio de cada unidad en el carrito.'],
      ['% Dcto', 'Descuento aplicado a la línea.'],
      ['F2 / F4 / F8 / F9', 'Atajos: buscar producto, cambiar cliente, cobrar y ver ventas del turno.'],
      ['Caja cerrada', 'No hay turno abierto: solo se aceptan transferencias hasta abrir la caja.'],
    ]),
  ],
  cajas: [
    grupo('Columnas y estados', [
      ['Base', 'Dinero con que se abrió la caja.'],
      ['Esperado', 'Lo que debería haber según ventas y movimientos.'],
      ['Contado', 'Lo que contó el cajero al cerrar.'],
      ['Diferencia', 'Contado − esperado. Verde: cuadrada; azul: sobrante; rojo: faltante.'],
      ['Turno abierto / Cerrada / Mantenimiento', 'Estado de la caja registradora.'],
    ]),
  ],
  facturacion: [
    grupo('Columnas y siglas', [
      ['N° Factura', 'Prefijo + consecutivo autorizado por la DIAN. **SETP** es el prefijo del ambiente de pruebas (habilitación); en producción se usa el prefijo de su resolución.'],
      ['NCT / NDT', 'Prefijos de prueba de nota crédito y nota débito.'],
      ['Tipo', 'Electrónica, Nota Crédito (resta, se muestra en negativo) o Nota Débito (suma).'],
      ['Venta Ref.', 'Venta que originó el documento.'],
      ['CUFE', 'Código único de la factura electrónica, generado y validado con la DIAN.'],
      ['CUDE', 'Código único de una nota crédito o débito.'],
    ]),
    grupo('Estado DIAN', [
      ['Aceptada DIAN', 'La DIAN validó el documento; tiene plena validez fiscal.'],
      ['Pendiente DIAN', 'Generado o enviado, esperando respuesta.'],
      ['Rechazada DIAN', 'La DIAN lo rechazó; ver el detalle del error y corregir.'],
    ]),
    grupo('Datos fiscales DIAN (detalle)', [
      ['Numerada', 'Ya tiene consecutivo, falta generar el XML.'],
      ['Firmada / Enviada', 'Firmada con el certificado digital y transmitida.'],
      ['Error de comunicación', 'No hubo respuesta; se puede reintentar sin gastar otro consecutivo.'],
      ['Conceptos nota crédito', '1 Devolución parcial, 2 Anulación, 3 Rebaja o descuento, 4 Ajuste de precio, 5 Pronto pago, 6 Descuento por volumen.'],
      ['Conceptos nota débito', '1 Intereses, 2 Gastos por cobrar, 3 Cambio del valor, 4 Otros.'],
    ]),
  ],
  remisiones: [
    grupo('Columnas y estados', [
      ['Productos', '"N ítems / X unids": productos distintos y unidades.'],
      ['Conductor / Placa', 'Quien transporta y la placa del vehículo.'],
      ['Pendiente Despacho', 'Creada, sin salir.'],
      ['En tránsito', 'Despachada.'],
      ['Entregada / Anulada', 'Recibida por el cliente o cancelada.'],
    ]),
  ],
  devoluciones: [
    grupo('Columnas y etiquetas', [
      ['Tipo', 'Cliente (mercancía que entra) o Proveedor (mercancía que sale).'],
      ['Doc. Origen', 'Venta o compra de la que se devuelve.'],
      ['N en mal estado', 'Unidades que no vuelven al inventario vendible.'],
      ['Buen estado / Mal estado', 'Si la unidad vuelve a la venta o queda apartada.'],
      ['Destino', 'Para mal estado: Proveedor o Producción.'],
      ['Pendiente de enviar / Enviado', 'Si la mercancía en mal estado ya salió a su destino.'],
    ]),
  ],
  tesoreria: [
    grupo('Columnas y siglas', [
      ['CE', 'Comprobante de egreso (pago a proveedor).'],
      ['RC / CI', 'Recibo de caja (recaudo en efectivo) y comprobante de ingreso (recaudo en banco).'],
      ['CRÉDITO (+) / DÉBITO (−)', 'Entrada o salida de dinero en la cuenta bancaria.'],
      ['Saldo Posterior', 'Saldo de la cuenta después del movimiento.'],
      ['Conciliado / Pendiente', 'Si el movimiento ya se cotejó con el extracto del banco.'],
      ['Subcuenta PUC', 'Cuenta contable enlazada a la cuenta bancaria.'],
    ]),
  ],
  'pedidos-web': [
    grupo('Columnas y estados', [
      ['Canal', 'Super Más (compra web) o Distribuidora (WhatsApp).'],
      ['Pago', 'Medio de pago y si está PAGADO o PENDIENTE.'],
      ['Pendiente → Confirmado → En Preparación → Listo Despacho → Enviado → Entregado', 'Recorrido del pedido. Al confirmar se reservan las unidades; al despachar se genera la venta.'],
      ['Cancelado', 'Pedido cancelado; las unidades reservadas se liberan.'],
    ]),
  ],
  'catalogo-supermas': [
    grupo('Columnas', [
      ['Disponibilidad', 'Disponible, Pocas unidades (en el mínimo o por debajo) o Agotado.'],
      ['Catálogo Web', 'Publicado (visible) u Oculto.'],
      ['Compra Directa', 'Permitida: el cliente puede comprar en línea.'],
    ]),
  ],
  'catalogo-distribuidora': [
    grupo('Columnas', [
      ['Precio Distribuidor', 'Precio para distribuidores; debajo, el precio al público si es mayor.'],
      ['Modalidad Venta', 'WhatsApp + Compra Web, Solo WhatsApp o Sin Contacto.'],
    ]),
  ],
  contabilidad: [
    grupo('Tipos de comprobante', [
      ['FV', 'Factura de venta.'],
      ['FP', 'Factura POS / documento equivalente (ventas en caja).'],
      ['FC', 'Factura de compra.'],
      ['NC / ND', 'Nota crédito y nota débito en venta.'],
      ['DV / DC', 'Devolución en venta y en compra.'],
      ['RC / CI / CE', 'Recibo de caja, comprobante de ingreso y comprobante de egreso.'],
      ['CC', 'Comprobante de contabilidad (asiento manual). No confundir con cédula de ciudadanía.'],
      ['AI / AJ / RV / TR / CM / CIE', 'Ajuste de inventario, ajuste contable, reversión, traslado de fondos, caja menor y cierre de ejercicio.'],
    ]),
    grupo('Columnas y siglas', [
      ['PUC', 'Plan Único de Cuentas: el catálogo de cuentas contables.'],
      ['Partida Doble', 'Marca verde si el asiento cuadra (débitos = créditos).'],
      ['Debe / Haber', 'Débitos y créditos del asiento.'],
      ['Naturaleza', 'Débito o Crédito: lado en que aumenta la cuenta.'],
      ['Imputable', 'Cuenta auxiliar o subcuenta que se puede usar en asientos.'],
      ['DV', 'En terceros: dígito de verificación del NIT.'],
      ['PEPS', 'Primeras en entrar, primeras en salir (método de costeo).'],
      ['Confirmado / Anulado-Reversado / Borrador', 'Estado del asiento.'],
    ]),
  ],
  impuestos: [
    grupo('Siglas', [
      ['IVA', 'Impuesto al valor agregado.'],
      ['INC', 'Impuesto nacional al consumo.'],
      ['ICA / ReteICA', 'Impuesto de industria y comercio, y su retención.'],
      ['ReteIVA / ReteFuente', 'Retención de IVA y retención en la fuente.'],
      ['Vta / Cpr', 'Cuenta de IVA generado en ventas (240805) y de IVA descontable en compras (240810).'],
    ]),
  ],
  exogena: [
    grupo('Formatos y estados', [
      ['1001', 'Pagos o abonos en cuenta a proveedores.'],
      ['1005 / 1006', 'IVA descontable / IVA generado.'],
      ['1007', 'Ingresos recibidos de clientes.'],
      ['1008 / 1009', 'Cuentas por cobrar / por pagar al 31 de diciembre.'],
      ['N err / N adv', 'Registros con error (bloquean la generación) o con advertencia.'],
      ['CONCILIADO / DESCUADRE', 'Si contabilidad y exógena coinciden en ese rubro.'],
    ]),
  ],
  'rrhh-empleados': [
    grupo('Etiquetas', [
      ['Contrato', 'Término indefinido, término fijo, obra o labor, aprendizaje o prestación de servicios.'],
      ['Estado', 'Activo, En vacaciones, Incapacitado o Retirado.'],
      ['Riesgo ARL', 'Clase de riesgo laboral del cargo (1 a 5).'],
    ]),
  ],
  'rrhh-vacaciones': [
    grupo('Etiquetas', [
      ['Periodo vencido', 'Un año de vacaciones causado y sin disfrutar.'],
      ['Crítica', 'Dos o más periodos sin disfrutar, o uno con el siguiente por vencer en 90 días o menos.'],
      ['Causados / Disfrutados / Compensados / Saldo', 'Días ganados, tomados, pagados en dinero y pendientes.'],
    ]),
  ],
  reportes: [
    grupo('Siglas', [
      ['CMV', 'Costo de la mercancía vendida.'],
      ['Ticket Prom.', 'Valor promedio por venta.'],
      ['Utilidad Bruta', 'Ventas netas − CMV.'],
    ]),
  ],
  alertas: [
    grupo('Prioridad y estado', [
      ['Crítica / Alta / Media / Baja', 'Urgencia de la alerta.'],
      ['Nueva / Leída / En atención / Resuelta / Cerrada', 'Seguimiento de la alerta.'],
      ['ALT-…', 'Código de la alerta. Las reglas que las generan tienen códigos R-INV, R-PUR, R-CASH, etc.'],
      ['Consolidado General', 'La alerta aplica a toda la empresa, no a una bodega.'],
    ]),
  ],
  auditoria: [
    grupo('Nivel y resultado', [
      ['Info', 'Evento normal (consultas, creaciones).'],
      ['Aviso', 'Modificación o ajuste de datos.'],
      ['Crítico', 'Eliminación, anulación o rechazo.'],
      ['Exitoso / Fallido / Rechazado', 'Resultado de la operación.'],
      ['Global', 'El evento no corresponde a una bodega específica.'],
    ]),
  ],
  usuarios: [
    grupo('Roles del sistema', [
      ['Superadministrador / Administrador General', 'Acceso total / administración completa.'],
      ['Jefe de Ingresos y Salidas Operativa / Jefe de Bodega', 'Operación de inventario, compras y despachos.'],
      ['Facturación POS / Encargada de Venta / Vendedores', 'Ventas en caja y comerciales.'],
      ['Recursos Humanos', 'Módulo de personal.'],
      ['Cajero / Administrador de Punto / Administrador de Bodega / Asesor Comercial / Contabilidad y Revisoría', 'Roles adicionales disponibles.'],
    ]),
  ],
}
