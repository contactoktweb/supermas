import type { Capitulo } from '../tipos'

const c = (archivo: string, leyenda: string) => ({ archivo: `${archivo}.jpg`, leyenda })

export const RRHH: Capitulo = {
  id: 'cap-rrhh',
  numero: 8,
  titulo: 'Recursos humanos',
  introduccion: 'Empleados, áreas y cargos, novedades de personal, vacaciones y reportes para nómina.',
  modulos: [
    {
      id: 'rrhh-panel',
      titulo: 'Panel de RRHH',
      menu: 'Recursos humanos > Panel de RRHH',
      proposito: 'Ver de un vistazo la planta de personal: empleados activos, ingresos y retiros del mes, novedades, vacaciones y documentos por vencer.',
      quienLoUsa: 'Recursos humanos y administración.',
      pantalla: [
        {
          texto: 'Muestra empleados activos, ingresos y retiros del mes, novedades de hoy, vacaciones vencidas y críticas (cerca de acumular 2 períodos, Art. 190 CST), solicitudes y documentos por vencer.',
          captura: c('31-rrhh-01-panel', 'Panel de Recursos Humanos.'),
        },
      ],
      procedimientos: [],
    },
    {
      id: 'rrhh-estructura',
      titulo: 'Áreas y cargos',
      menu: 'Recursos humanos > Áreas y cargos',
      proposito: 'Definir la estructura de la empresa: áreas y cargos a los que se asignan los empleados.',
      quienLoUsa: 'Recursos humanos.',
      pantalla: [
        {
          texto: 'Las pestañas **Áreas** y **Cargos** listan cada uno con su código, empleados y estado. Arriba están [[Nueva área]] y [[Nuevo cargo]].',
          captura: c('31-rrhh-04-estructura', 'Áreas y cargos.'),
        },
      ],
      procedimientos: [
        {
          id: 'crear-area-cargo',
          titulo: 'Crear áreas y cargos',
          objetivo: 'Preparar la estructura antes de registrar empleados.',
          pasos: [
            { texto: 'Pulse [[Nueva área]], escriba el nombre y el código (por ejemplo Bodega, Ventas, Administración) y guarde.' },
            { texto: 'Pulse [[Nuevo cargo]], escriba el nombre del cargo, elija su área y guarde.' },
          ],
          resultado: 'Las áreas y cargos quedan disponibles al registrar empleados.',
        },
      ],
    },
    {
      id: 'rrhh-empleados',
      titulo: 'Empleados',
      menu: 'Recursos humanos > Empleados',
      proposito: 'Registrar y consultar la información personal y laboral de cada empleado.',
      quienLoUsa: 'Recursos humanos.',
      pantalla: [
        {
          texto: 'Lista los empleados con documento, cargo y área, sede, contrato, fecha de ingreso y estado. Se puede filtrar por estado, área, cargo, sede y contrato.',
          captura: c('31-rrhh-02-empleados', 'Lista de empleados.'),
        },
      ],
      procedimientos: [
        {
          id: 'registrar-empleado',
          titulo: 'Registrar un empleado',
          objetivo: 'Crear la ficha de un empleado nuevo.',
          pasos: [
            {
              texto: 'Pulse [[Registrar empleado]]. En **Identificación** escriba el tipo y número de documento, nombres, apellidos y fecha de nacimiento.',
              captura: c('31-rrhh-03-registrar', 'Formulario de registro de empleado.'),
            },
            { texto: 'En **Contacto** escriba correo, teléfono, dirección, ciudad y un contacto de emergencia.' },
            { texto: 'Más abajo complete los datos laborales: área, cargo, sede, tipo de contrato, fecha de ingreso, salario y seguridad social. Guarde.' },
          ],
        },
      ],
    },
    {
      id: 'rrhh-novedades',
      titulo: 'Novedades',
      menu: 'Recursos humanos > Novedades',
      proposito: 'Registrar permisos, licencias, incapacidades, calamidades, suspensiones y ausencias, y aprobarlos.',
      quienLoUsa: 'Recursos humanos y jefes de área.',
      pantalla: [
        {
          texto: 'Muestra las novedades pendientes de aprobación, las vigentes hoy, las incapacidades y las no remuneradas. La tabla tiene empleado, tipo, fechas, duración, si es remunerada y estado.',
          captura: c('31-rrhh-05-novedades', 'Novedades de personal.'),
        },
      ],
      procedimientos: [
        {
          id: 'registrar-novedad',
          titulo: 'Registrar una novedad de personal',
          objetivo: 'Dejar constancia de una ausencia o permiso.',
          pasos: [
            { texto: 'Pulse [[Registrar novedad]]. Elija el empleado, el tipo (permiso, incapacidad, licencia…), las fechas y si es remunerada.' },
            { texto: 'Adjunte el soporte si lo hay (por ejemplo la incapacidad) y guarde. La novedad queda pendiente hasta que se apruebe.' },
          ],
        },
      ],
    },
    {
      id: 'rrhh-vacaciones',
      titulo: 'Vacaciones',
      menu: 'Recursos humanos > Vacaciones',
      proposito: 'Controlar los períodos de vacaciones causados y pendientes, con alertas por acumulación, y programar las vacaciones.',
      quienLoUsa: 'Recursos humanos.',
      pantalla: [
        {
          texto: 'Muestra empleados con período vencido, alertas críticas, empleados al día y días vencidos sin disfrutar. Las pestañas **Control por empleado** y **Solicitudes** detallan cada caso.',
          captura: c('31-rrhh-06-vacaciones', 'Control de vacaciones.'),
        },
      ],
      procedimientos: [
        {
          id: 'programar-vacaciones',
          titulo: 'Programar vacaciones',
          objetivo: 'Registrar el disfrute de vacaciones de un empleado.',
          pasos: [{ texto: 'Pulse [[Programar vacaciones]], elija el empleado y las fechas, revise los días que se descuentan del saldo y guarde.' }],
        },
      ],
    },
    {
      id: 'rrhh-reportes',
      titulo: 'Reportes de personal',
      menu: 'Recursos humanos > Reportes de personal',
      proposito: 'Consultar y exportar la planta de personal, ingresos y retiros, ausentismo, vacaciones pendientes y los datos para nómina.',
      quienLoUsa: 'Recursos humanos y contabilidad.',
      pantalla: [
        {
          texto: 'Elija el reporte en las tarjetas superiores: Planta de personal, Ingresos y retiros, Ausentismo, Vacaciones pendientes o Datos para nómina. Descárguelo con [[CSV]] o [[Excel]].',
          captura: c('31-rrhh-07-reportes', 'Reportes de personal.'),
        },
      ],
      procedimientos: [],
    },
  ],
}

export const GESTION: Capitulo = {
  id: 'cap-gestion',
  numero: 9,
  titulo: 'Gestión y control',
  introduccion: 'Reportes y analítica del negocio, alertas del sistema y pista de auditoría.',
  modulos: [
    {
      id: 'reportes',
      titulo: 'Reportes',
      menu: 'Gestión y control > Reportes',
      proposito: 'Analizar ventas, compras, inventario, Kardex, costos, bodegas, clientes, proveedores y cajas por período y por bodega.',
      quienLoUsa: 'Administración y gerencia.',
      pantalla: [
        {
          texto: 'Elija el **período** y la **bodega** arriba. Las pestañas (Resumen General, Ventas, Compras, Inventario, Kardex, Costos & CMV, Bodegas, Clientes, Proveedores, Cajas…) abren cada reporte. [[Exportar]] descarga el reporte activo.',
          captura: c('32-reportes-01', 'Reportes y analítica, resumen general.'),
        },
      ],
      procedimientos: [],
    },
    {
      id: 'alertas',
      titulo: 'Alertas',
      menu: 'Gestión y control > Alertas',
      proposito: 'Supervisar eventos que requieren atención: stock, compras, ventas, facturación, cajas y pedidos web.',
      quienLoUsa: 'Administración y supervisores.',
      pantalla: [
        {
          texto: 'Muestra alertas nuevas, críticas, pendientes y solucionadas, con filtros por módulo, prioridad, estado y sede. [[Escanear Sistema]] revisa de nuevo y [[Configurar Reglas]] define cuándo se crea una alerta.',
          captura: c('33-alertas-01', 'Módulo Alertas.'),
        },
      ],
      procedimientos: [],
    },
    {
      id: 'auditoria',
      titulo: 'Auditoría',
      menu: 'Gestión y control > Auditoría',
      proposito: 'Consultar quién hizo qué y cuándo: inicios de sesión, cambios de precio, anulaciones, ajustes y modificaciones de registros.',
      quienLoUsa: 'Administración y control interno.',
      pantalla: [
        {
          texto: 'Muestra los eventos del día y del período, usuarios activos y acciones críticas. Se puede buscar por usuario, documento, factura o producto y filtrar por severidad, módulo, bodega y usuario; [[Exportar CSV]] descarga la pista.',
          captura: c('34-auditoria-01', 'Pista de auditoría.'),
        },
      ],
      procedimientos: [
        {
          id: 'ver-evento-auditoria',
          titulo: 'Ver el detalle de un evento',
          objetivo: 'Saber exactamente qué cambió en un registro, quién lo hizo y desde dónde.',
          pasos: [
            { texto: 'Busque el evento por usuario, documento o producto. Los eventos que modificaron datos muestran debajo de la acción la marca **campos modificados**.' },
            {
              texto: 'Haga clic en el evento. El panel muestra el usuario, el rol, la bodega, la fecha y, en **Cambios**, el valor anterior y el nuevo de cada campo.',
              captura: c('34-auditoria-02-detalle', 'Detalle de un evento de auditoría.'),
            },
          ],
        },
      ],
      consejos: ['Marque **Solo cambios con antes y después** para ver exactamente qué valor cambió en cada registro.'],
    },
  ],
}

export const ADMINISTRACION: Capitulo = {
  id: 'cap-administracion',
  numero: 10,
  titulo: 'Administración',
  introduccion: 'Usuarios y accesos, roles y permisos, y configuración general de la empresa y del sistema.',
  modulos: [
    {
      id: 'usuarios',
      titulo: 'Usuarios',
      menu: 'Administración > Usuarios',
      proposito: 'Crear las cuentas de las personas que usan el sistema, asignarles rol y sedes, y bloquear accesos.',
      quienLoUsa: 'Administradores.',
      pantalla: [
        {
          texto: 'Muestra el total de colaboradores, activos, inactivos y con conexión reciente. La tabla lista cada usuario con su correo, rol, sede y estado.',
          captura: c('35-usuarios-01-lista', 'Módulo Usuarios.'),
        },
      ],
      procedimientos: [
        {
          id: 'crear-usuario',
          titulo: 'Crear un usuario',
          objetivo: 'Dar acceso al sistema a una persona.',
          pasos: [
            {
              texto: 'Pulse [[Nuevo usuario]]. Escriba nombres, apellidos, correo, nombre de usuario y teléfono, y deje el estado **Activo**.',
              captura: c('35-usuarios-02-nuevo', 'Formulario de usuario nuevo.'),
            },
            {
              texto: 'En **Contraseña inicial** escriba una o déjela en blanco para que el sistema genere una segura. Se muestra una sola vez al guardar: entréguesela a la persona.',
              nota: 'En su primer ingreso, la persona debe cambiar esa contraseña por una propia.',
            },
            { texto: 'Elija el **rol**: el recuadro de abajo explica qué puede hacer y su alcance (todas las sedes o solo la suya).' },
            { texto: 'Marque las **sedes o puntos de venta** donde trabajará y guarde.' },
          ],
        },
      ],
      consejos: ['Cuando alguien deje la empresa, cambie su estado a inactivo en lugar de borrarlo: su historial queda en la auditoría.'],
    },
    {
      id: 'roles',
      titulo: 'Roles',
      menu: 'Administración > Roles',
      proposito: 'Consultar qué puede hacer cada rol del sistema y en qué sedes.',
      quienLoUsa: 'Administradores.',
      pantalla: [
        {
          texto: 'Cada tarjeta muestra un rol, su descripción, si opera en todas las sedes o solo en la suya, y las áreas a las que tiene acceso. Las áreas marcadas "solo consulta" se pueden ver pero no modificar. Los roles se asignan a cada persona en Usuarios.',
          captura: c('36-roles-01', 'Roles y permisos.'),
        },
      ],
      procedimientos: [],
    },
    {
      id: 'configuracion',
      titulo: 'Configuración',
      menu: 'Administración > Configuración',
      proposito: 'Administrar los datos de la empresa y los parámetros de cada área del sistema (inventario, punto de venta, cajas, seguridad…).',
      quienLoUsa: 'Administradores.',
      pantalla: [
        {
          texto: 'Muestra la empresa activa con su NIT y las **áreas de configuración**: Empresa, Inventario, Punto de venta, Cajas y otras. Cada tarjeta tiene [[Gestionar parámetros]].',
          captura: c('37-configuracion-01', 'Configuración general.'),
        },
      ],
      procedimientos: [
        {
          id: 'datos-empresa',
          titulo: 'Actualizar los datos de la empresa',
          objetivo: 'Mantener al día la razón social, NIT, representante legal, dirección, teléfonos y correos que salen en las facturas.',
          pasos: [
            {
              texto: 'Pulse [[Editar empresa]]. Revise **Identificación** (nombre comercial, razón social, NIT y DV, actividad CIIU, representante legal) y **Ubicación y contacto** (dirección, ciudad, departamento, teléfono, correo general y correo de facturación).',
              captura: c('37-configuracion-02-empresa', 'Información de la empresa.'),
              advertencia: 'Estos datos salen en la factura electrónica y deben coincidir con el RUT.',
            },
            { texto: 'Guarde los cambios.' },
          ],
        },
        {
          id: 'parametros',
          titulo: 'Cambiar un parámetro del sistema',
          objetivo: 'Ajustar reglas como el cierre por inactividad, umbrales de stock o la base de caja.',
          pasos: [
            { texto: 'En la tarjeta del área correspondiente pulse [[Gestionar parámetros]], cambie el valor y guarde. El cambio queda registrado con su usuario y fecha.' },
          ],
        },
      ],
    },
  ],
}
