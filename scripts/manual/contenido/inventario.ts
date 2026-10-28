import type { Capitulo } from '../tipos'

const c = (archivo: string, leyenda: string) => ({ archivo: `${archivo}.jpg`, leyenda })

export const INVENTARIO: Capitulo = {
  id: 'cap-inventario',
  numero: 2,
  titulo: 'Inventario',
  introduccion:
    'Catálogo de productos, categorías y marcas, bodegas, existencias, Kardex, transferencias entre bodegas y aprobación de cambios de precio.',
  modulos: [
    {
      id: 'productos',
      titulo: 'Productos',
      menu: 'Inventario > Productos',
      proposito:
        'Crear y mantener el catálogo: nombre, códigos, categoría, marca, precios, costo, impuestos, inventario inicial y publicación en los catálogos web.',
      quienLoUsa: 'Administración, compras y quien maneje el catálogo. Ver costos y márgenes requiere permiso de costos.',
      pantalla: [
        {
          texto: 'Arriba están los botones [[Tabla]] / [[Cuadrícula]] para cambiar la vista, [[Importar]], [[Exportar]] y [[Nuevo producto]], y los indicadores del catálogo.',
          elementos: [
            '**Total de productos** y **Productos activos**.',
            '**Productos agotados** y **Stock bajo**: requieren compra o reposición.',
            '**Valor inventario a costo** de todas las bodegas.',
            '**Publicados en web**: visibles en los catálogos Super Más o Distribuidora.',
          ],
          captura: c('02-productos-01-lista', 'Módulo Productos con sus indicadores.'),
        },
        {
          texto: 'Debajo está la tabla. Puede buscar por nombre, SKU o código de barras y filtrar por categoría, marca, estado, existencias y canal web. [[Columnas]] permite ocultar o mostrar columnas.',
          captura: c('02-productos-02-tabla', 'Tabla de productos: imagen, SKU, código de barras, nombre, categoría y marca.'),
        },
        {
          texto: 'Desplazando la tabla a la derecha se ven el stock total, el estado, el costo promedio, los precios normal y mayorista, el margen, la publicación web y el menú de acciones (tres puntos).',
          captura: c('02-productos-03-tabla-derecha', 'Columnas de existencias, precios, margen y canales.'),
        },
        {
          texto: 'El menú de acciones de cada producto (tres puntos) permite [[Ver detalle]], [[Editar producto]], [[Ver Kardex]], [[Transferir]], [[Ajustar inventario]], [[Desactivar]] y [[Eliminar producto]].',
          captura: c('02-productos-04-acciones', 'Menú de acciones de un producto.'),
        },
      ],
      procedimientos: [
        {
          id: 'crear-producto',
          titulo: 'Subir (crear) un producto nuevo',
          objetivo: 'Registrar un producto en el catálogo con sus precios, costo, impuesto e inventario inicial.',
          pasos: [
            { texto: 'En Productos pulse [[Nuevo producto]]. Se abre el formulario con seis pestañas: Información, Precios, Inventario Inicial, Tributación, Canales Web y Gobernanza.', captura: c('02-productos-08-nuevo-vacio', 'Formulario de producto nuevo, pestaña Información.') },
            {
              texto: 'En **Información** escriba el **nombre**, el **SKU** (código interno único) y, si lo tiene, el **código de barras**. Elija **categoría**, **marca** y **unidad de medida**. Opcionalmente suba una foto y escriba una descripción.',
              captura: c('02-productos-10-info-llena', 'Pestaña Información diligenciada.'),
            },
            {
              texto: 'Elija la **Cuenta Contable PUC**: es la cuenta de inventario a la que se lleva el producto. Para mercancía comprada para revender use las cuentas **1435 — Mercancías no fabricadas** según el tipo de producto. Si tiene dudas, pregunte al contador.',
              captura: c('02-productos-09-cuenta-puc', 'Selección de la cuenta auxiliar de inventario.'),
              advertencia: 'La cuenta contable es obligatoria para crear el producto: define cómo se contabilizan su inventario, su costo y sus ventas.',
            },
            {
              texto: 'En **Precios** escriba el **precio normal (público)** con IVA incluido. Si vende al por mayor, deje activo el **precio mayorista** con su **cantidad mínima**. El precio distribuidor y las listas personalizadas son opcionales.',
              captura: c('02-productos-11-precios', 'Pestaña Precios: precio normal y mayorista.'),
            },
            {
              texto: 'Al final de la pestaña Precios escriba el **Costo unitario de compra**. Debajo verá en vivo el precio antes de IVA, la utilidad por unidad y el margen.',
              captura: c('02-productos-12-costo-margen', 'Costo unitario y análisis de margen en vivo.'),
              advertencia: 'El costo es obligatorio y debe ser mayor a $0. Sin costo, el inventario quedaría valorizado en $0 y la utilidad saldría mal.',
            },
            {
              texto: 'En **Inventario Inicial** escriba cuántas unidades hay hoy en cada bodega. El costo de entrada se toma del costo unitario. Si el producto llega después por una compra, deje las cantidades en 0.',
              captura: c('02-productos-13-inventario-inicial', 'Inventario inicial por bodega con su valor.'),
              nota: 'Cada cantidad mayor a 0 se registra en el Kardex como entrada de inventario inicial.',
            },
            {
              texto: 'En **Tributación** elija el **perfil de IVA**: Gravado 19 %, Gravado 5 %, Exento (0 %) o Excluido. Un producto al 0 % debe quedar como Exento o Excluido; si no, no se puede facturar electrónicamente.',
              captura: c('02-productos-14-tributacion', 'Perfiles tributarios disponibles.'),
            },
            { texto: 'En **Canales Web** marque si el producto se muestra en el **Catálogo Super Más** (compra directa) y/o en el **Catálogo Distribuidora** (contacto por WhatsApp).', captura: c('02-productos-15-canales', 'Publicación en catálogos web.') },
            {
              texto: 'En **Gobernanza** deje el estado **Activo para la venta** y ajuste los umbrales de **stock mínimo** (alerta preventiva) y **stock crítico** (alerta urgente).',
              captura: c('02-productos-16-gobernanza', 'Estado y umbrales de stock.'),
            },
            { texto: 'Pulse [[Crear producto]]. Si falta un dato obligatorio, el sistema lo marca en rojo y lo lleva a la pestaña donde está.' },
          ],
          resultado: 'El producto aparece en la tabla, en el POS y en Ventas. Si cargó inventario inicial, sus unidades quedan en las bodegas y en el Kardex.',
        },
        {
          id: 'editar-producto',
          titulo: 'Editar un producto o cambiar su precio',
          objetivo: 'Corregir datos, cambiar precios o desactivar un producto.',
          pasos: [
            { texto: 'En la tabla abra el menú de acciones (tres puntos) del producto y elija [[Editar producto]]. El formulario se abre con los datos actuales.', captura: c('02-productos-18-editar', 'Edición de un producto existente.') },
            { texto: 'En **Precios** cambie el valor que necesite.', captura: c('02-productos-20-editar-precios', 'Edición de precios.') },
            {
              texto: 'En **Gobernanza** escriba el **Motivo del cambio**: queda en la auditoría. Ahí también puede pasar el producto a **Inactivo / Pausado** para que no se venda.',
              captura: c('02-productos-19-editar-gobernanza', 'Motivo del cambio y estado del producto.'),
            },
            {
              texto: 'Pulse [[Guardar cambios]].',
              nota: 'Si su rol no puede aprobar precios, el cambio de precio no se aplica de inmediato: queda como solicitud en Aprobación de precios hasta que un aprobador lo acepte.',
            },
          ],
        },
        {
          id: 'ver-detalle-producto',
          titulo: 'Consultar el detalle de un producto',
          objetivo: 'Ver existencias, precios, costo, margen y canales de un producto sin editarlo.',
          pasos: [
            { texto: 'En el menú de acciones elija [[Ver detalle]]. La pestaña **Resumen** muestra stock total, precio, costo promedio, margen y la ficha técnica.', captura: c('02-productos-05-detalle', 'Detalle del producto, pestaña Resumen.') },
            { texto: 'La pestaña **Precios** muestra las listas vigentes y el desglose de IVA y margen.', captura: c('02-productos-06-detalle-precios', 'Detalle del producto, pestaña Precios.') },
            { texto: 'La pestaña **Web** indica si el producto está disponible en las vitrinas públicas.', captura: c('02-productos-07-detalle-web', 'Detalle del producto, pestaña Web.') },
            { texto: 'Desde el pie del panel puede ir al [[Kardex]] del producto, [[Eliminar]] o [[Editar producto]].' },
          ],
        },
        {
          id: 'importar-productos',
          titulo: 'Importar productos desde un archivo',
          objetivo: 'Crear muchos productos de una vez con un archivo CSV.',
          pasos: [
            { texto: 'En Productos pulse [[Importar]] y luego [[Descargar Plantilla CSV]].', captura: c('02-productos-17-importar', 'Ventana de importación masiva.') },
            {
              texto: 'Abra la plantilla en Excel y llene una fila por producto con las columnas: SKU, Nombre, Código de Barras, Categoría, Marca, Unidad de Medida, Precio Venta Normal, Precio Mayorista, Cantidad Mínima Mayorista, **Costo Unitario**, Tarifa IVA (%), Exento de IVA, Stock Inicial, Código Bodega, Stock Mínimo, Stock Crítico, Catálogo Super Más, Catálogo Distribuidora y Descripción.',
              advertencia: 'Cada fila debe tener costo unitario mayor a $0; las filas sin costo se rechazan.',
            },
            { texto: 'Guarde el archivo como **CSV** (separado por comas o punto y coma), arrástrelo a la ventana y pulse [[Iniciar importación]].' },
            { texto: 'El sistema valida todo el archivo antes de guardar: si algo falla, no guarda nada y le muestra qué filas corregir.' },
          ],
        },
      ],
    },
    {
      id: 'categorias',
      titulo: 'Categorías',
      menu: 'Inventario > Categorías',
      proposito: 'Organizar los productos en grupos (Víveres, Aseo y limpieza, Ferretería, etc.) para filtrar, reportar y mostrar en los catálogos.',
      quienLoUsa: 'Administración del catálogo.',
      pantalla: [
        {
          texto: 'Muestra el total de categorías, las principales, las subcategorías y las inactivas, y la tabla con el código, la cantidad de productos y el estado de cada una.',
          captura: c('03-categorias-01-lista', 'Módulo Categorías.'),
        },
      ],
      procedimientos: [
        {
          id: 'crear-categoria',
          titulo: 'Crear una categoría',
          objetivo: 'Agregar un grupo nuevo de productos.',
          pasos: [
            {
              texto: 'Pulse [[Nueva categoría]]. Escriba el **nombre**; la dirección web (slug) se genera sola. Opcionalmente ponga un código interno, una categoría padre (para crear una subcategoría) y una descripción.',
              captura: c('03-categorias-02-nueva', 'Formulario de categoría nueva.'),
            },
            { texto: 'Deje marcada **Categoría activa** y pulse [[Crear categoría]].' },
          ],
          resultado: 'La categoría queda disponible al crear o editar productos.',
        },
      ],
      consejos: ['Para dejar de usar una categoría use [[Desactivar]] en vez de borrarla: los productos que ya la tienen no se afectan.'],
    },
    {
      id: 'marcas',
      titulo: 'Marcas',
      menu: 'Inventario > Marcas',
      proposito: 'Registrar las marcas o fabricantes de los productos.',
      quienLoUsa: 'Administración del catálogo.',
      pantalla: [{ texto: 'Muestra el total de marcas, cuántas tienen productos, y la tabla con el estado de cada marca.', captura: c('04-marcas-01-lista', 'Módulo Marcas.') }],
      procedimientos: [
        {
          id: 'crear-marca',
          titulo: 'Crear una marca',
          objetivo: 'Agregar una marca para asignarla a productos.',
          pasos: [
            { texto: 'Pulse [[Nueva marca]], escriba el **nombre** (la dirección web se genera sola) y, si tiene, la dirección del logo.', captura: c('04-marcas-02-nueva', 'Formulario de marca nueva.') },
            { texto: 'Deje marcada **Marca activa** y pulse [[Crear marca]].' },
          ],
        },
      ],
    },
    {
      id: 'bodegas',
      titulo: 'Bodegas',
      menu: 'Inventario > Bodegas',
      proposito:
        'Administrar las bodegas y puntos de venta, ver el inventario de cada una con su valor, y hacer ajustes de entrada o salida de mercancía.',
      quienLoUsa: 'Administración, jefes de bodega e inventario.',
      pantalla: [
        {
          texto: 'Arriba están el valor total del inventario, las ventas del día, el stock bajo, las transferencias activas y las alertas. Con [[Cards]] / [[Tabla]] cambia la vista.',
          captura: c('05-bodegas-01-lista', 'Módulo Bodegas.'),
        },
        {
          texto: 'Cada bodega muestra su código, su inventario a costo, la cantidad de productos, el stock bajo y agotado, y el enlace [[Ver bodega]].',
          captura: c('05-bodegas-02-tarjetas', 'Tarjetas de las bodegas.'),
        },
        {
          texto: 'Dentro de una bodega hay pestañas: Resumen, Inventario, Movimientos, Ventas, Compras, Clientes, Proveedores y Transferencias. Arriba están [[Editar]], [[Transferencia]] y [[Ver Kardex]].',
          captura: c('05-bodegas-03-detalle', 'Detalle de una bodega.'),
        },
      ],
      procedimientos: [
        {
          id: 'ajuste-bodega',
          titulo: 'Agregar o retirar unidades de un producto en una bodega (ajuste)',
          objetivo: 'Corregir las existencias de un producto por conteo físico, sobrante, merma, vencimiento o daño.',
          pasos: [
            { texto: 'Entre a la bodega con [[Ver bodega]] y abra la pestaña **Inventario**. Verá cada producto con su existencia, estado, costo promedio, valor y último movimiento.', captura: c('05-bodegas-05-inventario', 'Inventario de la bodega.') },
            {
              texto: 'Desplace la tabla a la derecha y, en **Acciones rápidas**, pulse el **lápiz** del producto que va a ajustar.',
              captura: c('05-bodegas-10-acciones-rapidas', 'Acciones rápidas: ajustar, transferir y ver Kardex.'),
              advertencia: 'Use el lápiz de la fila del producto. El botón rojo superior [[Ajustar inventario]] abre el ajuste con el primer producto de la lista ya elegido.',
            },
            { texto: 'Se abre la ventana del ajuste con el producto, su **existencia actual** y el **saldo resultante**.', captura: c('05-bodegas-06-ajuste-vacio', 'Ventana de ajuste de inventario.') },
            {
              texto: 'Elija el **tipo de movimiento**: [[+ Entrada]] si hay más unidades de las registradas, o [[- Salida]] si hay menos. Escriba la **cantidad**.',
            },
            {
              texto: 'Elija el **motivo**: conteo físico, merma o producto averiado, producto vencido, corrección de digitación, devolución interna u otro.',
              captura: c('05-bodegas-07-ajuste-motivos', 'Motivos del ajuste.'),
            },
            {
              texto: 'Opcionalmente escriba el número del **documento soporte o acta**. En **Detalle y justificación** explique qué pasó: queda en el Kardex y en la auditoría.',
              captura: c('05-bodegas-08-ajuste-entrada', 'Ajuste de entrada diligenciado: el saldo pasa de 214 a 238 unidades.'),
            },
            {
              texto: 'Si es una salida, el saldo resultante baja. El sistema no permite sacar más unidades de las que hay.',
              captura: c('05-bodegas-09-ajuste-salida', 'Ajuste de salida: el saldo pasa de 214 a 190 unidades.'),
            },
            { texto: 'Revise y pulse [[Confirmar ajuste en Kardex]].' },
          ],
          resultado:
            'La existencia de la bodega cambia y el movimiento queda en el Kardex con su documento (AJ-…), usuario y motivo. Si es la primera entrada del producto en esa bodega, se valora al costo del producto.',
        },
        {
          id: 'movimientos-bodega',
          titulo: 'Ver los movimientos de una bodega',
          objetivo: 'Consultar las entradas y salidas de mercancía de una bodega.',
          pasos: [
            {
              texto: 'Dentro de la bodega abra la pestaña **Movimientos**. Puede buscar por producto, SKU, documento o usuario, filtrar por tipo y usar [[Exportar Kardex]].',
              captura: c('05-bodegas-11-movimientos', 'Movimientos de la bodega.'),
            },
          ],
        },
        {
          id: 'crear-bodega',
          titulo: 'Crear una bodega o punto de venta',
          objetivo: 'Registrar una nueva ubicación física.',
          pasos: [
            {
              texto: 'En Bodegas pulse [[Nueva bodega]]. En **Información general** escriba nombre, código único, tipo, dirección, ciudad, estado, contacto y responsable.',
              captura: c('05-bodegas-12-nueva', 'Registro de bodega, información general.'),
            },
            {
              texto: 'En **Configuración y permisos** marque lo que puede hacer la ubicación: inventario, ventas, compras y transferencias. Si es la bodega que despacha los pedidos web, márquela como **bodega de procesamiento ecommerce**.',
              captura: c('05-bodegas-13-nueva-permisos', 'Permisos de operación de la bodega.'),
            },
            { texto: 'Guarde. Luego, en **Usuarios**, asigne la bodega a las personas que trabajarán en ella.' },
          ],
        },
      ],
      consejos: ['La actividad reciente de cada bodega aparece al final de su Resumen, con los últimos movimientos del Kardex.'],
    },
    {
      id: 'inventario',
      titulo: 'Inventario',
      menu: 'Inventario > Inventario',
      proposito:
        'Ver las existencias de todos los productos en todas las bodegas (o por bodega), con su valor, y hacer ajustes, transferencias y conteos físicos.',
      quienLoUsa: 'Inventario, bodega y administración.',
      pantalla: [
        {
          texto: 'Arriba están [[Consolidado]] / [[Por bodega]], [[Exportar]], [[Ver Kardex]], [[Transferencia]], [[Conteo físico]] y [[Ajustar inventario]]. Los indicadores muestran el valor total, las unidades, los productos con existencia, el stock bajo, el crítico y los agotados.',
          elementos: [
            'Las pestañas [[Todo el catálogo]], [[Stock bajo]], [[Nivel crítico]] y [[Agotados]] filtran la tabla rápidamente.',
            'Los filtros permiten elegir bodega, categoría, marca, estado y saldo.',
          ],
          captura: c('06-inventario-01-resumen', 'Módulo Inventario consolidado.'),
        },
      ],
      procedimientos: [
        {
          id: 'ajuste-inventario',
          titulo: 'Hacer un ajuste eligiendo bodega y producto',
          objetivo: 'Registrar una entrada o salida de mercancía eligiendo la bodega y el producto en la misma ventana.',
          pasos: [
            { texto: 'Pulse [[Ajustar inventario]]. Elija la **bodega** donde se aplica el ajuste.', captura: c('06-inventario-02-ajuste-vacio', 'Ventana de ajuste de existencias.') },
            { texto: 'En **Producto a ajustar** abra la lista y escriba parte del nombre o el SKU para buscarlo.', captura: c('06-inventario-03-ajuste-buscar', 'Búsqueda del producto dentro del ajuste.') },
            {
              texto: 'Elija [[Entrada (+)]] o [[Salida (-)]], escriba la **cantidad**, el **motivo** y las **observaciones** para la auditoría.',
              captura: c('06-inventario-04-ajuste-lleno', 'Ajuste de entrada de 12 unidades diligenciado.'),
            },
            { texto: 'Pulse [[Confirmar ajuste]].' },
          ],
          resultado: 'Igual que el ajuste desde Bodegas: cambia la existencia y queda el movimiento en el Kardex.',
        },
        {
          id: 'conteo-fisico',
          titulo: 'Hacer un conteo físico de una bodega',
          objetivo: 'Comparar lo que hay en la estantería con lo que dice el sistema y ajustar las diferencias de una vez.',
          pasos: [
            { texto: 'Pulse [[Conteo físico]] y elija la **bodega a auditar**. El sistema abre una sesión de conteo con todos los productos.', captura: c('06-inventario-05-conteo', 'Sesión de conteo físico.') },
            {
              texto: 'Desplace la tabla a la derecha hasta ver las columnas **Sistema**, **Físico** y **Diferencia**. En **Físico** escriba lo que contó de cada producto; la diferencia se calcula sola.',
              captura: c('06-inventario-06-conteo-columnas', 'Columnas de existencia en sistema, conteo físico y diferencia.'),
            },
            { texto: 'Escriba las **observaciones** de la sesión (quién contó y cuándo) y pulse [[Ajustar discrepancias]]. Solo se ajustan los productos con diferencia.' },
          ],
        },
      ],
    },
    {
      id: 'kardex',
      titulo: 'Kardex',
      menu: 'Inventario > Kardex',
      proposito:
        'Consultar el historial completo e inalterable de entradas y salidas de cada producto en cada bodega, con saldos y costos. Ningún movimiento se puede modificar ni borrar.',
      quienLoUsa: 'Inventario, contabilidad, auditoría y administración.',
      pantalla: [
        {
          texto: 'Arriba están los indicadores del período: movimientos, unidades que entraron y salieron, valor de entradas y salidas, y productos movidos. Con [[Tabla]] / [[Línea de tiempo]] cambia la vista y con [[Exportar]] descarga el listado.',
          captura: c('07-kardex-01-resumen', 'Módulo Kardex.'),
        },
        {
          texto: 'La tabla muestra fecha y hora, producto, SKU, bodega, tipo de movimiento y documento.',
          captura: c('07-kardex-02-tabla', 'Tabla de movimientos del Kardex.'),
        },
        {
          texto: 'Desplazando a la derecha se ven el **saldo anterior**, la **entrada**, la **salida**, el **saldo resultante**, el costo unitario, el costo promedio, el valor del movimiento y el usuario.',
          captura: c('07-kardex-03-tabla-saldos', 'Saldos y costos de cada movimiento.'),
        },
      ],
      procedimientos: [
        {
          id: 'kardex-producto',
          titulo: 'Ver el Kardex de un producto',
          objetivo: 'Seguir todos los movimientos de un producto: compras, ventas, ajustes, transferencias y devoluciones.',
          pasos: [
            {
              texto: 'Escriba el nombre, SKU o código de barras en el buscador. Si quiere, filtre por **bodega**, **tipo de movimiento**, **responsable**, **número de documento** o **rango de fechas**.',
              captura: c('07-kardex-04-buscar', 'Kardex filtrado por un producto.'),
            },
            {
              texto: 'Haga clic en la acción de un movimiento para ver su detalle: tipo, fecha exacta, bodega, usuario, saldo anterior, entrada o salida y saldo resultante.',
              captura: c('07-kardex-05-detalle', 'Detalle de un movimiento del Kardex.'),
            },
            {
              texto: 'Al final del detalle aparecen los costos y el **documento origen** (por ejemplo AJ-645384 para un ajuste), con su justificación.',
              captura: c('07-kardex-06-detalle-documento', 'Documento origen y justificación del movimiento.'),
            },
            { texto: 'La vista [[Línea de tiempo]] muestra los mismos movimientos agrupados por día.', captura: c('07-kardex-07-linea-tiempo', 'Kardex en vista de línea de tiempo.') },
          ],
        },
        {
          id: 'corregir-movimiento',
          titulo: 'Corregir un movimiento equivocado',
          objetivo: 'Deshacer el efecto de un movimiento mal registrado sin borrarlo.',
          pasos: [
            { texto: 'Abra el detalle del movimiento y pulse [[Revertir movimiento]].' },
            { texto: 'El sistema crea un movimiento contrario que compensa el error. Los dos quedan en el Kardex para la auditoría.' },
          ],
        },
      ],
      consejos: [
        'Desde Productos, Bodegas o Inventario también puede ir al Kardex de un producto con la opción [[Ver Kardex]].',
      ],
    },
    {
      id: 'transferencias',
      titulo: 'Transferencias',
      menu: 'Inventario > Transferencias',
      proposito: 'Mover mercancía de una bodega a otra dejando trazabilidad de la salida, el tránsito y la recepción.',
      quienLoUsa: 'Jefes de bodega, logística e inventario.',
      pantalla: [
        {
          texto: 'Muestra las transferencias pendientes, en tránsito, completadas, rechazadas y con novedad. Con [[Todas]] / [[Entrantes]] / [[Salientes]] filtra por dirección.',
          captura: c('08-transferencias-01-lista', 'Módulo Transferencias.'),
        },
      ],
      procedimientos: [
        {
          id: 'crear-transferencia',
          titulo: 'Crear una transferencia entre bodegas',
          objetivo: 'Enviar productos de una bodega a otra.',
          pasos: [
            { texto: 'Pulse [[Nueva transferencia]]. El asistente tiene cuatro pasos.', captura: c('08-transferencias-02-paso1-vacio', 'Paso 1: origen y destino.') },
            {
              texto: 'Elija la **bodega origen** (de donde sale) y la **bodega destino** (la que recibe). Pulse [[Continuar]].',
              captura: c('08-transferencias-03-paso1', 'Bodegas de origen y destino elegidas.'),
            },
            {
              texto: 'Busque los productos y pulse [[+ Agregar]] en cada uno. Al lado verá la existencia disponible en el origen y en el destino.',
              captura: c('08-transferencias-04-paso2', 'Paso 2: catálogo de productos con existencias.'),
            },
            {
              texto: 'En la **tabla de proyección** ajuste la **cantidad a transferir** con [[-]] y [[+]]; verá cómo queda el stock del origen.',
              captura: c('08-transferencias-05-paso2-cantidad', 'Cantidad a transferir y proyección del stock.'),
            },
            {
              texto: 'En **Revisión** elija el **motivo**, opcionalmente una referencia y las instrucciones de transporte, y pulse [[Crear transferencia]].',
              captura: c('08-transferencias-06-paso3', 'Paso 3: revisión de la transferencia.'),
              nota: 'La transferencia queda **PENDIENTE**. El stock sale del origen solo cuando el despachador confirma la salida, y entra al destino cuando la bodega destino confirma la recepción.',
            },
          ],
        },
        {
          id: 'despachar-recibir-transferencia',
          titulo: 'Despachar y recibir una transferencia',
          objetivo: 'Completar el traslado: sacar la mercancía del origen y recibirla en el destino.',
          pasos: [
            { texto: 'En la lista de Transferencias abra la transferencia **Pendiente** y pulse [[Despachar transferencia]] cuando la mercancía salga. Las unidades se descuentan de la bodega origen y la transferencia pasa a **En tránsito**.' },
            { texto: 'Cuando llegue la mercancía, en la bodega destino abra la transferencia y pulse [[Recibir transferencia]]. Revise las cantidades recibidas y pulse [[Confirmar recepción de mercancía]].' },
            { texto: 'Si llegó menos mercancía o algo dañado, regístrelo en la recepción: la transferencia queda **Con novedad** para revisarla.' },
          ],
          resultado: 'Las unidades quedan en la bodega destino y los dos movimientos (salida y entrada) se ven en el Kardex.',
        },
      ],
    },
    {
      id: 'aprobacion-precios',
      titulo: 'Aprobación de precios',
      menu: 'Inventario > Aprobación de precios',
      proposito:
        'Revisar y aprobar o rechazar los cambios de precio que propone el equipo operativo. Al aprobar, el precio nuevo se aplica de inmediato y queda en auditoría.',
      quienLoUsa: 'Quien tiene el permiso de aprobar precios (normalmente administración).',
      pantalla: [
        {
          texto: 'La pestaña **Por aprobar** lista las solicitudes pendientes con el producto, el precio anterior, el propuesto y quién lo pidió. **Mis solicitudes** muestra las que usted envió.',
          captura: c('09-precios-01-por-aprobar', 'Solicitudes de cambio de precio por aprobar.'),
        },
      ],
      procedimientos: [
        {
          id: 'aprobar-precio',
          titulo: 'Aprobar o rechazar un cambio de precio',
          objetivo: 'Decidir sobre una solicitud de cambio de precio.',
          pasos: [
            { texto: 'Abra **Por aprobar** (o la campana de notificaciones). Revise el precio anterior, el propuesto y el motivo.' },
            { texto: 'Pulse **Aprobar** para aplicar el precio nuevo o **Rechazar** para dejar el actual.' },
            { texto: 'En **Historial** puede consultar todas las solicitudes aprobadas y rechazadas.', captura: c('09-precios-02-historial', 'Historial de solicitudes de precio.') },
          ],
        },
      ],
    },
  ],
}
