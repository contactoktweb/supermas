import type { Capitulo } from '../tipos'

export const PRIMEROS_PASOS: Capitulo = {
  id: 'primeros-pasos',
  numero: 1,
  titulo: 'Primeros pasos',
  introduccion:
    'Cómo entrar al sistema, recuperar la contraseña, moverse por el menú y el tablero de inicio, y qué hacer si la sesión se cierra.',
  modulos: [
    {
      id: 'acceso',
      titulo: 'Entrar al sistema',
      menu: 'Pantalla de inicio de sesión',
      proposito:
        'Identificar a cada persona con su correo y contraseña. Según su **rol**, el sistema le muestra solo los módulos que puede usar.',
      quienLoUsa: 'Todos los usuarios.',
      pantalla: [
        {
          texto: 'Al abrir el sistema aparece la pantalla de inicio de sesión. A la derecha está el formulario de acceso.',
          captura: { archivo: '01-acceso-01-login.jpg', leyenda: 'Pantalla de inicio de sesión.' },
        },
      ],
      procedimientos: [
        {
          id: 'iniciar-sesion',
          titulo: 'Iniciar sesión',
          objetivo: 'Entrar al sistema con su usuario.',
          pasos: [
            { texto: 'Escriba su **correo electrónico** en el campo [[Correo electrónico]].' },
            { texto: 'Escriba su **contraseña** en [[Contraseña]]. Con el ícono del ojo puede verla mientras la escribe.' },
            {
              texto: 'Pulse [[Ingresar al sistema]]. Si los datos son correctos, entra al tablero de inicio.',
              nota: 'Si es la primera vez que entra, el sistema le pide cambiar la contraseña inicial por una personal antes de continuar.',
            },
          ],
        },
        {
          id: 'primer-ingreso',
          titulo: 'Definir la contraseña en el primer ingreso',
          objetivo: 'Cambiar la contraseña inicial que entregó el administrador por una propia.',
          pasos: [
            { texto: 'Inicie sesión con la contraseña inicial. El sistema abre la pantalla **Define tu contraseña**.' },
            {
              texto: 'Escriba la nueva contraseña dos veces. Debe tener **mínimo 10 caracteres**, una **mayúscula**, una **minúscula**, un **número** y un **símbolo** (! # $ % * ?). Debajo del campo verá qué reglas ya cumple.',
            },
            { texto: 'Confirme. Desde ese momento debe entrar siempre con la nueva contraseña.' },
          ],
          resultado: 'La contraseña inicial deja de funcionar y queda registrado en auditoría que usted la cambió.',
        },
        {
          id: 'recuperar-contrasena',
          titulo: 'Recuperar o cambiar la contraseña',
          objetivo: 'Recibir por correo un enlace para crear una contraseña nueva. Sirve tanto si la olvidó como si quiere cambiarla.',
          pasos: [
            {
              texto: 'En la pantalla de inicio de sesión haga clic en [[¿Olvidaste tu contraseña?]], escriba su correo y pulse [[Enviar enlace de recuperación]].',
              captura: { archivo: '01-acceso-03-recuperar.jpg', leyenda: 'Solicitud del enlace de recuperación.' },
            },
            {
              texto: 'Abra el correo que le llega y haga clic en el enlace. Escriba la contraseña nueva dos veces con las mismas reglas del primer ingreso y pulse [[Guardar Contraseña]].',
              captura: { archivo: '01-acceso-03b-nueva-contrasena.jpg', leyenda: 'Pantalla para escribir la contraseña nueva.' },
            },
            {
              texto: 'El enlace vence en poco tiempo. Si ya venció, el sistema lo indica: vuelva a la pantalla de inicio y pida uno nuevo.',
              captura: { archivo: '01-acceso-04-enlace-vencido.jpg', leyenda: 'Aviso de enlace vencido o inválido.' },
            },
          ],
        },
        {
          id: 'cierre-inactividad',
          titulo: 'Qué pasa si la sesión se cierra sola',
          objetivo: 'Entender el cierre automático por inactividad.',
          pasos: [
            {
              texto: 'Si no usa el sistema durante un tiempo, la sesión se cierra en todas las pestañas por seguridad y vuelve a la pantalla de inicio.',
            },
            { texto: 'Vuelva a iniciar sesión. Lo que no había guardado antes del cierre se pierde.' },
            {
              texto: 'El tiempo lo define el administrador en [[Configuración]] (campo **Cierre por inactividad**, entre 5 y 720 minutos).',
            },
          ],
        },
      ],
    },
    {
      id: 'tablero',
      titulo: 'El tablero y el menú',
      menu: 'Dashboard',
      proposito:
        'Ver de un vistazo cómo va el negocio (ventas, inventario, alertas) y moverse entre los módulos con el menú lateral, el buscador y las notificaciones.',
      quienLoUsa: 'Todos los usuarios; cada uno ve los indicadores de las sedes que tiene asignadas.',
      pantalla: [
        {
          texto: 'Después de iniciar sesión aparece el **Dashboard**. Arriba ve su nombre, su rol, su sede y la fecha de su último ingreso.',
          elementos: [
            '**Menú lateral (izquierda):** agrupa los módulos en Inventario, Compras, Clientes y cartera, Ventas, Canales, Contabilidad, Recursos humanos, Gestión y control y Administración. Cada grupo se abre o se cierra con la flecha.',
            '**Período:** botones [[Hoy]], [[7 días]], [[30 días]], [[Este mes]], [[Año]] y [[Personalizado]] para cambiar las fechas de los indicadores.',
            '**Indicadores:** ventas del día, ventas del período, utilidad, inventario a costo, productos en catálogo, stock bajo, transferencias y pedidos web.',
            '**Su usuario (abajo a la izquierda):** el botón con la flecha cierra la sesión.',
          ],
          captura: { archivo: '01-inicio-01-dashboard.jpg', leyenda: 'Tablero de inicio con los indicadores principales.' },
        },
        {
          texto: 'Más abajo están la evolución de ventas y compras, la **distribución del inventario** por bodega (qué parte del valor a costo está en cada una) y el estado de cada bodega: valor del inventario, productos, stock bajo y agotados.',
          captura: { archivo: '01-inicio-02-dashboard-bodegas.jpg', leyenda: 'Distribución del inventario y estado de las bodegas en el tablero.' },
        },
      ],
      procedimientos: [
        {
          id: 'buscar-sistema',
          titulo: 'Buscar un módulo rápidamente',
          objetivo: 'Ir a cualquier módulo sin recorrer el menú.',
          pasos: [
            {
              texto: 'Haga clic en [[Buscar en el sistema...]] (arriba a la derecha) o pulse **Ctrl + K**. Escriba el nombre de un módulo (por ejemplo "kardex"), de un producto, cliente, proveedor o bodega, o el número de una factura, y haga clic en el resultado.',
              captura: { archivo: '01-inicio-03-buscador.jpg', leyenda: 'Buscador global del sistema.' },
            },
          ],
        },
        {
          id: 'ver-notificaciones',
          titulo: 'Ver las notificaciones',
          objetivo: 'Revisar avisos pendientes, como cambios de precio por aprobar.',
          pasos: [
            {
              texto: 'Haga clic en la **campana** de la esquina superior derecha. Ahí aparecen las aprobaciones de precio pendientes y los avisos recientes; [[Ir a la bandeja de aprobaciones]] lleva al módulo Aprobación de precios.',
              captura: { archivo: '01-inicio-04-notificaciones.jpg', leyenda: 'Panel de notificaciones.' },
            },
          ],
        },
      ],
      consejos: ['Los indicadores se actualizan solos al cambiar el período. Si cree que un dato no está al día, recargue la página.'],
    },
  ],
}
