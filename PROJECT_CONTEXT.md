# SUPER MÁS ERP/POS — Contexto del Proyecto

## Descripción General
ERP y Punto de Venta (POS) integral para Distribuidora Super Más S.A.S. (Colombia).
Sistema multi-bodega con centro logístico (CEDI Principal) y tiendas/puntos de venta.

## Stack Tecnológico
- **Frontend / Framework**: Next.js 16 (Turbopack, App Router) + React 19 + TypeScript.
- **Estilos**: Vanilla CSS moderno con tokens de diseño, CSS variables y micro-animaciones.
- **Iconografía**: `@iconify/react` con `solar-linear` y `phosphor-light`.
- **Capa de Datos**: Centralizada en `lib/supabase/` con clientes oficiales (`client.ts`, `server.ts`, `admin.ts`) y resiliencia para base de datos Supabase limpia/vacía (cero registros de prueba). Suite completa de migraciones PostgreSQL DDL en `supabase/migrations/` y script de inicialización limpia `scripts/seed-clean-initial-data.ts`.
- **Base de Datos Destino**: Supabase PostgreSQL con RLS, Auth, Storage (6 buckets) y Kardex atómico.
- **Zona Horaria**: `America/Bogota`. Moneda: Peso Colombiano (`COP`).

## Módulos del Sistema
- **Dashboard Principal** (`/`)
- **Bodegas** (`/bodegas`, `/bodegas/[id]`)
- **Inventario** (`/inventario`)
- **Kardex** (`/kardex`)
- **Transferencias** (`/transferencias`)
- **Compras** (`/compras`)
- **Proveedores** (`/proveedores`)
- **Clientes** (`/clientes`)
- **Ventas** (`/ventas`)
- **POS** (`/pos`)
- **Facturación Electrónica** (`/facturacion`)
- **Remisiones** (`/remisiones`)
- **Contabilidad** (`/contabilidad`) — *Núcleo Financiero (PUC, partida doble, libro diario, libro mayor, libro auxiliar agrupado por cuenta y periodo, balance general, estado de resultados, parametrización de inventarios y costos por bodega)*
- **Tesorería** (`/tesoreria`) — *Módulo Financiero Operativo Independiente (Cuentas bancarias, cajas, programación y dispersión de pagos a proveedores, recaudación de cartera de clientes, movimientos bancarios y conciliación)*
- **Impuestos** (`/impuestos`) — *Tarifas DIAN, IVA generado y descontable*
- **Exógena** (`/exogena`) — *Formatos DIAN 1001, 1007, 1008, 1009*
- **Pedidos Web** (`/pedidos-web`) — *Gestión de órdenes ecommerce, validación de stock, reserva en CEDI, alistamiento, despacho, ventas y facturación DIAN*
- **Catálogo Super Más** (`/catalogo-supermas`) — *Administración de productos para venta directa B2C en la tienda web, precios públicos, fotos, disponibilidad multi-bodega y carrito*
- **Catálogo Distribuidora** (`/catalogo-distribuidora`) — *Administración de visibilidad comercial B2B, cotizaciones vía WhatsApp, vinculación con Catálogo Super Más y compra directa web*
- **Auditoría** (`/auditoria`) — *Trazabilidad e historial de eventos con `auditService.log()`*
- **Reportes y Analítica** (`/reportes`) — *Centro de inteligencia de negocios, ventas, compras, Kardex, costos CMV, benchmark de bodegas, clientes, proveedores, cajas, facturación DIAN, contabilidad y ecommerce*
- **Usuarios** (`/usuarios`)

## Arquitectura del Módulo de Contabilidad y Tesorería
```text
UI React (/contabilidad, /tesoreria)
       ↓
Hooks (useAccounting, useTreasury)
       ↓
Services (accountingService, accountingReportService, treasuryService)
       ↓
Repositories (accountingRepository, treasuryRepository)
       ↓
lib/supabase/db.ts
(accounting_accounts, accounting_entries, accounting_movements,
 bank_accounts, treasury_payments, treasury_receipts, dian_resolutions)
       ↓
Supabase PostgreSQL (Migraciones 001 - 011)
```

## Reglas Maestras de Contabilidad y Tesorería
1. **Separación de Responsabilidades (Tesorería vs. Contabilidad)**:
   - *Tesorería* gestiona la liquidez, cuentas bancarias, programación y dispersión de egresos a proveedores (CXP), así como el recaudo de clientes (CXC).
   - *Contabilidad* es el sistema de registro fiduciario: genera inmutablemente asientos con partida doble balanceada (`SUM(debit) === SUM(credit)`), libros contables y estados financieros.
   - *Flujo canónico de egreso*: Factura de compra proveedor → Tesorería programa desembolso → Pago ejecutado en banco → Contabilidad genera asiento automático (`Débito: 220505 Proveedores, Crédito: 111005 Bancos`).
2. **Libro Auxiliar Agrupado por Cuenta y Periodo**:
   - Permite consultar cuentas individuales o globales (Caja, Bancos, Clientes, Inventarios, Proveedores, Ventas, Costos) durante un mes específico, año o rango de fechas.
   - Presenta un panel resumen financiero con: **Saldo Inicial** (calculado rigurosamente sumando movimientos históricos anteriores a la fecha de corte), **Movimientos Débito (+)**, **Movimientos Crédito (-)** y **Saldo Final**.
   - Admite filtros cruzados por tercero, centro de costo/bodega y exportación a CSV. Permite drill-down con un clic ("Ver Asiento") para inspeccionar el comprobante en su respectivo Drawer.
3. **Catálogo PUC Multiclase de Inventarios**:
   - Soporte nativo para 4 clases de inventario:
     - *Materias Primas* (`1405` / `140501`) → Consumo / Costo (`7105` / `710501`).
     - *Productos en Proceso* (`1410` / `141001`) → Costo (`6120` / `612001`).
     - *Productos Terminados* (`1430` / `143001`) → Costo (`6120` / `612001`).
     - *Mercancías para la Venta* (`1435` / `143501`) → Costo (`6135` / `613501`).
   - Relación arquitectónica estricta: `Productos` → `Categoría Contable Inventario` → `Cuenta Contable (PUC)`. Sin datos quemados en componentes.
4. **Separación Estricta de Prefijos y Numeración (ERP vs. DIAN)**:
   - Toda factura electrónica (`Invoice`) almacena de forma independiente:
     - `internalNumber` (`internal_number`): Consecutivo interno de control del ERP (ej: `FAC-00025`, `VENTA-000001`).
     - `dianPrefix`: Prefijo autorizado en la resolución fiscal DIAN (ej: `FE`, `POS`, `NC`).
     - `dianNumber`: Número consecutivo oficial autorizado por la DIAN (ej: `1250`).
     - `dianResolution`: Número de resolución DIAN vigente (ej: `18764000001`).
     - `dianRange`: Rango autorizado oficial (ej: `1000 - 50000`).
   - El sistema valida rangos vigentes desde `dian_resolutions.json` / tabla `dian_resolutions`.
5. **Periodos Contables y Cierres Mensuales (`accounting_periods` / Migración 012)**:
   - Cada mes contable (`YYYY-MM`) se gestiona con estado `OPEN` o `CLOSED`.
   - **Bloqueo estricto de meses cerrados**: Si un periodo está cerrado (ej: Enero a Agosto 2026 cerrados), el sistema en TypeScript (`assertPeriodOpen`) y el trigger PostgreSQL (`fn_prevent_entries_on_closed_period`) bloquean tajantemente la inserción, modificación, causación automática o reversión de comprobantes en dicho periodo.
   - **Reapertura Autorizada**: Solo usuarios con rol `SUPERADMIN` o `ACCOUNTANT` pueden autorizar la reapertura de un mes cerrado, requiriendo un motivo formal justificado registrado inmutablemente en `auditService.log()`.
6. **Notas Contables y Ajustes Formales**:
   - Soporte tipado para notas crédito (`CREDIT_NOTE`), notas débito (`DEBIT_NOTE`), ajustes por depreciación / provisión / reclasificación (`ACCOUNTING_ADJUSTMENT`), reversiones oficiales (`REVERSAL`) y comprobante de cierre de ejercicio anual (`CLOSING_ENTRY`).
   - Todos los comprobantes cumplen con partida doble estricta y trazabilidad a terceros y bodegas.

## Arquitectura del Módulo Pedidos Web
```text
UI React (/pedidos-web)
       ↓
useWebOrders Hook
       ↓
webOrderService
       ↓
webOrderStatusService & auditService
       ↓
webOrderRepository
       ↓
lib/supabase/db.ts (web_orders.json, customers.json, products.json, stock_levels.json, sales.json, invoices.json)
```

## Reglas Maestras de Pedidos Web
1. **Flujo de Estados Controlado**: `Pendiente -> Confirmado -> Preparación -> Listo para despacho -> Enviado -> Entregado`. No se permiten saltos arbitrarios.
2. **Reserva de Inventario**: Al confirmar administrativamente un pedido, se reserva el stock en Bodega CEDI (`isEcommerceProcessingSource`) sin salida física. La salida real ocurre al despachar con transportadora.
3. **Consulta de Disponibilidad**: Se consulta contra `stock_levels` de todas las bodegas pero solo se expone públicamente `AVAILABLE`, `LOW_STOCK`, `OUT_OF_STOCK` (nunca cantidades exactas ni costos).
4. **Venta y Facturación**: El despacho genera el registro oficial de venta (`sales.json`) y la factura electrónica ante la DIAN (`invoices.json`), vinculando `webOrderId <-> saleId <-> invoiceId` sin duplicaciones.
5. **Cancelación Segura**: Requiere motivo obligatorio registrado en auditoría y libera inmediatamente las reservas de inventario. Nunca elimina pedidos físicos.


## Arquitectura del Módulo Contabilidad
```text
UI React (/contabilidad)
       ↓
useAccounting Hook
       ↓
accountingService
       ↓
accountingRulesService & accountingReportService
       ↓
accountingRepository
       ↓
lib/supabase/db.ts (accounting_accounts.json, accounting_entries.json, accounting_movements.json)
```

## Reglas Maestras Contables
1. **Partida Doble**: `Total Débito == Total Crédito` obligatorio en todo asiento.
2. **Inmutabilidad y Trazabilidad**: Los asientos confirmados (`POSTED`) nunca se eliminan ni modifican físicamente; las anulaciones se procesan mediante **reversiones contables**.
3. **Kardex Contable**: El inventario no se edita directamente; todo cambio proviene de movimientos operativos con su causación contable.
4. **Contabilidad por Bodega**: Cada movimiento y estado financiero desglosa el rendimiento por ubicación física.

## Arquitectura del Módulo Catálogo Distribuidora
```text
UI React (/catalogo-distribuidora)
       ↓
useDistributorCatalog Hook
       ↓
distributorCatalogService
       ↓
auditService & permissions
       ↓
distributorCatalogRepository
       ↓
lib/supabase/db.ts (products.json, stock_levels.json, categories.json, brands.json, audit_logs.json)
```

## Reglas Maestras de Catálogo Distribuidora
1. **Producto Maestro Único**: No duplica registros en la base de datos; administra la proyección comercial (`webDistribuidora`, `webSuperMas`, `webDirectPurchaseEnabled`, `webWhatsAppInquiryEnabled`) sobre el producto maestro.
2. **Disponibilidad Comercial Multi-Bodega**: Consulta agregada sobre todas las bodegas activas en `stock_levels.json`. Solo expone al público etiquetas discretas: `Disponible`, `Pocas unidades` o `Agotado`.
3. **Privacidad Comercial Absoluta**: El catálogo público o cliente B2B NUNCA recibe costos, márgenes, compras, proveedores ni inventarios exactos.
4. **Matriz de Interacción**:
   - *Distribuidora Activa + Super Más Inactiva*: Botón Cotizar por WhatsApp.
   - *Distribuidora Activa + Super Más Activa + Compra Directa Habilitada + Con Stock*: Botón WhatsApp + Botón Comprar Online (agrega al carrito del ecommerce).
5. **Auditoría Centralizada**: Toda publicación, ocultamiento, cambio de configuración o actualización masiva queda registrada de forma inmutable mediante `auditService.log()`.

## Arquitectura del Módulo Catálogo Super Más
```text
UI React (/catalogo-supermas)
       ↓
useSuperCatalog Hook
       ↓
superCatalogService
       ↓
auditService & permissions
       ↓
superCatalogRepository
       ↓
lib/supabase/db.ts (products.json, stock_levels.json, categories.json, brands.json, tax_configs.json, locations.json, web_orders.json, audit_logs.json)
```

## Reglas Maestras de Catálogo Super Más
1. **Producto Maestro Único Compartido**: Utiliza `products.json`. No duplica productos ni crea bases paralelas; administra la proyección web B2C (`webSuperMas`, `webDirectPurchaseEnabled`, `webShowPrice`, `webPrice`, `webLowStockThreshold`, `webImages`, `taxConfigId`).
2. **Disponibilidad Comercial Multi-Bodega**: La disponibilidad pública consulta la suma de inventario de todas las bodegas activas en `stock_levels.json`. Solo se exponen etiquetas discretas: `Disponible`, `Pocas unidades` (según `webLowStockThreshold`) o `Agotado`.
3. **No Eliminación de Productos Agotados**: Si un producto se queda sin stock físico, se mantiene publicado y visible con el badge `Agotado`. La administración decide si lo oculta o lo mantiene en vitrina. Los productos agotados desactivan automáticamente la acción de compra directa en el carrito.
4. **Despacho y Salida Física de Inventario**: Aunque la disponibilidad consulta todas las bodegas, la preparación y salida física de pedidos web se descuenta estrictamente de la bodega configurada para ecommerce (`isEcommerceProcessingSource: true`, CEDI Principal).
5. **Precios e Impuestos Públicos**: El catálogo web muestra el precio de venta al público y calcula el IVA histórico asociado según `tax_configs.json`. Jamás expone costos de compra, márgenes de ganancia ni proveedores.
6. **Flujo Transaccional E2E**: `Catálogo Super Más -> Carrito -> Pedido Web -> Validación Stock CEDI -> Preparación -> Salida Inventario -> Venta ERP -> Factura DIAN`.
7. **Auditoría Inmutable**: Todo cambio de publicación, precio, imágenes, threshold de stock o actualización masiva se audita con `auditService.log()`.

## Arquitectura del Módulo Reportes
```text
UI React (/reportes, /reportes/*)
       ↓
useReports Hook
       ↓
reportService
       ↓
reportBuilder & reportExportService & auditService
       ↓
reportRepository & accountingReportService
       ↓
lib/supabase/db.ts (sales.json, purchases.json, products.json, stock_levels.json, inventory_movements.json, customers.json, suppliers.json, invoices.json, remissions.json, web_orders.json, cash_registers.json, cash_movements.json, accounting_entries.json, accounting_movements.json, tax_configs.json, locations.json, users.json, audit_logs.json)
```

## Reglas Maestras de Reportes y Analítica
1. **Solo Lectura Estricta**: Los reportes únicamente consultan e interpretan datos históricos y agregados; bajo ninguna circunstancia modifican ventas, compras, inventario, costos, cajas, comprobantes contables ni facturas.
2. **Cero Lógica de Negocio en Componentes JSX**: Todo cálculo analítico, consolidación matemática, agrupación temporal y sanitización de datos se realiza en `reportService`, `reportBuilder` y `reportRepository`.
3. **Privacidad Financiera y Sanitización RBAC**: Los costos, CMV, utilidades brutas y márgenes porcentuales están protegidos por los permisos `reports.costs` y `reports.financial`. Roles no autorizados (como `CAJERO` o `VENDEDOR`) reciben estos campos en `null` o sanitizados a nivel de servicio.
4. **Análisis Multi-Módulo Consolidado**: Integra de forma unificada 12 dimensiones clave:
   - *Ventas*: Total ventas, documentos, ticket promedio, desglose por bodega, categoría, usuario y temporal.
   - *Compras*: Volúmenes de abastecimiento, compras de contado vs crédito y comportamiento por proveedor.
   - *Inventario*: Valorización a costo/venta, disponibilidad, stock crítico y distribución por categoría/marca/bodega.
   - *Kardex*: Entradas, salidas, transferencias y saldo final por movimiento.
   - *Costos y Margen*: Ecuación económica `Ingresos - CMV = Utilidad Bruta` con margen porcentual.
   - *Bodegas*: Rendimiento por ubicación y comparativa directa Bodega A vs Bodega B.
   - *Clientes*: Clientes activos, nuevos, frecuencia y ticket promedio.
   - *Proveedores*: Abastecimiento, saldos pendientes y facturas vencidas.
   - *Cajas*: Aperturas, cierres, ingresos, egresos, arqueos y diferencias en efectivo.
   - *Facturación*: Validación DIAN, estados de emisión y notas crédito.
   - *Contabilidad*: Consumo de `accountingReportService` con balance general, estado de resultados y estricta partida doble (`SUM(debit) == SUM(credit)`).
   - *Ecommerce*: Rendimiento de pedidos web frente a ventas físicas en tienda/POS.
5. **Exportación Universal**: Exportación nativa a Excel XML (`.xls`), CSV con codificación UTF-8 BOM y PDF/Impresión ejecutada fuera de los componentes React por `reportExportService`.
6. **Trazabilidad Inmutable**: Toda generación de reporte, consulta de datos confidenciales y exportación de archivos queda auditada en tiempo real con `auditService.log()`.

## Arquitectura del Módulo Alertas
```text
UI React (/alertas & Header NotificationBell)
       ↓
useAlerts Hook & useAlertPermissions
       ↓
alertService & alertNotificationService
       ↓
alertRulesService & auditService
       ↓
alertRepository
       ↓
lib/supabase/db.ts (alerts.json, alert_rules.json, products.json, stock_levels.json, purchases.json, suppliers.json, sales.json, invoices.json, web_orders.json, transfers.json, cash_registers.json, accounting_entries.json, users.json, locations.json, audit_logs.json)
```

## Reglas Maestras del Módulo Alertas
1. **Motor de Monitoreo Proactivo**: El módulo no es un simple centro de mensajes, sino un motor centralizado de supervisión y detección automática conectado con todos los módulos operativos del ERP.
2. **Cero Lógica de Negocio en JSX**: Ningún componente React calcula reglas, umbrales ni estadísticas directamente. Todo pasa por `alertService -> alertRulesService -> alertRepository -> lib/supabase/db.ts`.
3. **Garantía Estricta de No Duplicación**: Al escanear reglas, el motor verifica si ya existe una alerta activa (`NEW`, `READ` o `IN_PROGRESS`) para la misma regla, entidad (`entityId`) y bodega (`locationId`). Nunca se crean alertas duplicadas mientras una situación no haya sido resuelta o cerrada.
4. **Inmutabilidad e Integridad Histórica**: Las alertas NUNCA se eliminan físicamente de la base de datos. Su ciclo de vida es estrictamente secuencial y auditable: `NEW (Nueva) -> READ (Leída) -> IN_PROGRESS (En atención) -> RESOLVED (Resuelta) -> CLOSED (Cerrada)`.
5. **Cobertura Multi-Módulo Especializada**:
   - *Inventario*: Producto agotado (`stock = 0`, prioridad `CRITICA`), Stock bajo / crítico (`stock <= minStock`, prioridad `ALTA`/`MEDIA`).
   - *Compras / Proveedores*: Facturas de proveedor vencidas (`today > dueDate` con saldo pendiente, prioridad `ALTA`), Facturas próximas a vencer (`<= 10 días`, prioridad `MEDIA`).
   - *Facturación DIAN*: Facturas rechazadas por el validador fiscal DIAN o con errores de envío (prioridad `CRITICA`).
   - *Cajas Registradoras*: Diferencias de arqueo (faltante o sobrante, prioridad `CRITICA`), Cajas abiertas prolongadamente (> 14 horas continuas sin cierre de arqueo, prioridad `ALTA`).
   - *Pedidos Web*: Pedidos sin confirmación administrativa (> 2 horas, prioridad `ALTA`).
   - *Transferencias*: Mercancía en tránsito retrasada sin recepción en bodega de destino (> 24 horas, prioridad `MEDIA`).
   - *Contabilidad*: Asientos descuadrados que violan la partida doble (`SUM(debits) !== SUM(credits)`, prioridad `CRITICA`).
6. **Control de Acceso y Visibilidad por Rol (RBAC)**:
   - `SUPERADMIN`: Acceso total y supervisión global del sistema.
   - `CASHIER` (Cajero): Únicamente visualiza alertas de cajas propias y su sede.
   - `WAREHOUSE_ADMIN`: Solo visualiza alertas de inventario y transferencias correspondientes a su bodega asignada.
   - `ACCOUNTANT`: Acceso a facturación, compras, cuentas por pagar y descuadres contables.
7. **Configuración Dinámica de Reglas**: Los administradores pueden activar/desactivar reglas, ajustar niveles de prioridad y modificar umbrales (ej. días de vencimiento, horas de caja, stock mínimo por defecto) desde el modal de configuración sin alterar código fuente.
8. **Centro de Notificaciones en Tiempo Real**: Componente `<NotificationBell />` integrado en el header de la aplicación con contador de no leídas, pulso dinámico en situaciones críticas y popover con alertas recientes y accesos rápidos.
9. **Auditoría Transaccional**: Toda acción (`ALERT_CREATED`, `ALERT_READ`, `ALERT_ATTENDED`, `ALERT_RESOLVED`, `ALERT_RULE_MODIFIED`) queda registrada inmutablemente en `auditService.log()` y `db.auditLogs`.

## Arquitectura del Módulo Configuración
```text
UI React (/configuracion)
       ↓
useSettings Hook & useSettingsPermissions
       ↓
settingsService & auditService
       ↓
settingsRepository
       ↓
lib/supabase/db.ts (company_settings.json, inventory_settings.json, pos_settings.json, ecommerce_settings.json, settings.json, audit_logs.json, locations.json, users.json)
```

## Reglas Maestras del Módulo Configuración
1. **No Duplicación de Módulos Operativos**: Configuración administra exclusivamente parámetros globales, reglas y variables del ERP. Los productos se administran en Productos, impuestos en Impuestos, usuarios en Usuarios y sedes en Bodegas.
2. **Último Módulo del Sidebar**: No se crean accesos dispersos en el menú; todos los parámetros del ERP residen bajo la ruta unificada `/configuracion`.
3. **Roles Predefinidos (Solo Lectura)**: Los roles son inmutables desde la UI y están definidos en código (`SYSTEM_ROLES`). Desde Configuración únicamente se consulta la matriz de permisos asociados; no se permite crear, editar ni eliminar roles.
4. **Advertencia y Confirmación en Cambios Críticos**: Modificaciones que afecten el costeo contable (método de valoración), logística web (bodega de despacho) o facturación despliegan un modal obligatorio de confirmación (*"Este cambio puede afectar operaciones futuras. ¿Deseas continuar?"*).
5. **Cero Secretos en Almacén**: Contraseñas, claves de factura electrónica, tokens y llaves privadas residen estrictamente en variables de entorno seguras (`.env.local`), jamás en `settings.json` ni en código cliente.
6. **Capa Desacoplada y Extensible**: Todo parámetro viaja a través de `settingsService -> settingsRepository -> lib/supabase/db.ts`, permitiendo la migración transparente a PostgreSQL sin alterar componentes visuales.
7. **Trazabilidad Inmutable**: Toda modificación registra usuario, fecha, valor anterior y nuevo valor en `auditService.log()` y `db.auditLogs`.

## Normalización de Datos y Estado de Preparación Pre-Supabase
El modelo de datos ha completado la fase integral de auditoría, corrección y normalización relacional:
1. **Tablas Hijas Normalizadas**: `sale_items`, `purchase_items`, `transfer_items`, `remission_items`, `cash_sessions`, `product_prices`, `accounting_entry_lines`.
2. **Multiempresa y Multibodega**: Todas las entidades operativas y maestras cuentan con `company_id` (preparado para RLS por inquilino) y `location_id` donde aplica.
3. **Kardex Atómico e Inmutable**: `inventory_movements` es la fuente única de verdad para el cálculo de existencias en `stock_levels` (`product_id + location_id`). El stock nunca se edita manualmente.
4. **Partida Doble Estricta**: Cada comprobante contable cumple `SUM(debits) === SUM(credits)` con trigger de bloqueo en PostgreSQL (`fn_enforce_accounting_double_entry`) y bloqueo de meses clausurados (`fn_prevent_entries_on_closed_period`).
5. **Separación DIAN**: Distinción estricta entre número interno ERP (`internal_number`) y consecutivo oficial DIAN (`dian_number`, `dian_prefix`, `dian_resolution`).
6. **Migración DDL 013**: Archivo `013_pre_supabase_audit_and_model_fixes.sql` consolida todas las foreign keys, restricciones e índices.
7. **Integridad Validada**: 39 pruebas de integridad, JOINs relacionales y simulación de ciclo de vida empresarial aprobadas al 100% (`scripts/test-model-integrity.ts`).

