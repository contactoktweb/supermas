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
- **Contabilidad** (`/contabilidad`) — *Núcleo Financiero (Catálogo PUC colombiano base con saldo $0, estricta partida doble, libro diario, libro mayor, libro auxiliar dinámico, balance general, estado de resultados y costos por bodega; 100% libre de datos mock y fallbacks ficticios).*
- **Tesorería** (`/tesoreria`) — *Módulo Financiero Operativo Independiente (Cuentas bancarias, cajas, programación y dispersión de pagos a proveedores, recaudación de cartera de clientes, movimientos bancarios y conciliación).*
- **Impuestos** (`/impuestos`) — *Tarifas DIAN, IVA generado y descontable*
- **Exógena** (`/exogena`) — *Formatos DIAN 1001, 1007, 1008, 1009*
- **Pedidos Web** (`/pedidos-web`) — *Gestión de órdenes ecommerce, validación de stock, reserva en CEDI, alistamiento, despacho, ventas y facturación DIAN*
- **Catálogo Super Más** (`/catalogo-supermas`) — *Administración de productos para venta directa B2C en la tienda web, precios públicos, fotos, disponibilidad multi-bodega y carrito*
- **Catálogo Distribuidora** (`/catalogo-distribuidora`) — *Administración de visibilidad comercial B2B, cotizaciones vía WhatsApp, vinculación con Catálogo Super Más y compra directa web*
- **Auditoría** (`/auditoria`) — *Trazabilidad e historial de eventos con `auditService.log()` y persistencia inmutable; sin eventos ni contadores ficticios.*
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
8. **Validación de Seguridad Paso 0 Completada**: Migración 014 con matriz RLS granular por operación, protección contra elevación de privilegios en bootstrap (raw_app_meta_data + pg_advisory_xact_lock), inmutabilidad de Kardex y asientos contables, stock_levels de solo lectura cliente y service_role blindado fuera de los bundles del navegador. Suite de pruebas A-J 100% aprobada (`scripts/test-security-onboarding.ts`).
9. **Despliegue Staging Supabase Real (Pasos 1 a 10)**:
   - Migraciones 001 a 021 aplicadas y registradas en `supabase_migrations.schema_migrations`.
   - Hardening integral de funciones SECURITY DEFINER (015), trigger de bootstrap y app_metadata lifecycle (016).
   - Seed estructural limpio (006): tarifas DIAN, catálogo PUC de 55 cuentas, system settings.
   - Primer Superadministrador inicial fiduciario (Paso 7): `samirdurant234@gmail.com`.
   - Onboarding de primera empresa y bodega legítimas (Paso 8): `Super Más S.A.S.` y `BOD-01`.
   - **Paso 9 — Pruebas Reales de RLS, Permisos y Aislamiento Aprobadas al 100%**: Aislamiento estricto entre inquilinos (Empresa A vs B), validación de roles SUPERADMIN, ADMIN, ACCOUNTANT, WAREHOUSE_ADMIN, SELLER, CASHIER, permisos granulares (productos, inventario, ventas, compras, contabilidad, tesorería), inmutabilidad fiduciaria de Kardex y asientos contables POSTED, auditoría inviolable y rollback total sin contaminación de datos.
   - **Paso 10 — Validación Real de Kardex y Recálculo Atómico de Stock Aprobada al 100%**: Ciclo de vida integral comprobado en PostgreSQL (entradas con cálculo matemático exacto de costo promedio ponderado, salidas preservando costo unitario, devoluciones de clientes y a proveedores, ajustes positivos y negativos por conteo/merma, transiciones automáticas de salud AVAILABLE -> LOW_STOCK -> OUT_OF_STOCK, mutabilidad exclusiva de stock_levels vía trigger desde inventory_movements, separación multi-bodega y multi-tenant en Kardex y existencias, con rollback total garantizado).
   - **Paso 11 — Validación Real de Ventas / POS y Facturación Electrónica DIAN Aprobada al 100%**:
     - Migración `022_sales_invoicing_and_stock_guard.sql` aplicada y registrada en `schema_migrations`:
       - Restricción física `chk_stock_levels_non_negative CHECK (quantity >= 0)` contra existencias negativas.
       - Blindaje de motor en `process_inventory_movement()` impidiendo overselling tanto en inserciones iniciales como en movimientos subsecuentes.
       - Disparador de inmutabilidad `fn_prevent_invoice_deletion()` que bloquea el borrado físico de comprobantes electrónicos DIAN.
       - Políticas RLS completas para `electronic_invoices` (aislamiento multi-tenant por empresa y sede).
       - Asignación de permisos `invoices.create` e `invoices.read` al rol `CASHIER` para terminales POS.
     - Suite integral de pruebas reales ejecutada exitosamente con `BEGIN ... ROLLBACK` (`scripts/test-real-sales-pos-invoicing.ts`):
       1. Creación de cliente con datos fiscales y de contacto (`customers`).
       2. Creación de producto y entrada inicial en Kardex (50 unds @ $8.000 COP, costo total $400.000 COP).
       3. Bloqueo atómico de intento de overselling (intento de salida de 60 unds bloqueado por excepción del motor, stock intacto en 50 unds).
       4. Bloqueo RLS de usuario no autorizado (`ACCOUNTANT` sin `sales.create` bloqueado al intentar registrar venta).
       5. Venta POS exitosa por cajero autenticado (10 unds @ $10.000 base + 19% IVA, subtotal $100.000, IVA $19.000, total $119.000, costo $80.000, ganancia estimada $20.000 calculada automáticamente por columna STORED).
       6. Descuento automático en Kardex: existencias reducidas de 50 a 40 unds, costo promedio inalterado ($8.000 COP), valoración total $320.000 COP.
       7. Emisión de Factura Electrónica DIAN (SETP-990000001) con CUFE, código QR y desglose de IVA al 19%.
       8. Inmutabilidad física garantizada: disparadores `fn_prevent_sale_deletion` y `fn_prevent_invoice_deletion` bloquean eliminación directa.
       9. Contabilización en partida doble PUC (Asiento CC-2026-0001): 1105 Débito $119.000, 4135 Crédito $100.000, 2408 Crédito $19.000, 6135 Débito $80.000, 1435 Crédito $80.000 (Débito $199.000 == Crédito $199.000). Asiento en estado POSTED blindado contra modificación.
       10. Aislamiento multi-tenant y multi-sede: Cajero de Empresa B no puede consultar ventas ni facturas de Empresa A; vendedor de Sede A2 no puede acceder a ventas de Sede A1.
       11. Devolución de cliente (`CUSTOMER_RETURN`): 2 unds devueltas a Kardex, stock incrementa automáticamente de 40 a 42 unds.
       12. Emisión de Nota Crédito DIAN (NC-990000001) por $23.800 COP y asiento contable de reversión en partida doble (CC-2026-0002, Débito $39.800 == Crédito $39.800).
       13. Auditoría forense inmutable (`audit_logs`) con eventos de emisión, anulación y bloqueo de alteración física.
   - **Paso 12 — Validación Real de Compras, Proveedores, Kardex y Tesorería Aprobada al 100%**:
     - Migración `023_purchases_treasury_and_bank_hardening.sql` aplicada y registrada en `schema_migrations`:
       - Asignación de permiso `suppliers.read` al rol `ACCOUNTANT` para auditoría y causación de pagos.
       - Aislamiento multi-tenant RLS en `bank_accounts` y `bank_movements` cerrando fugas en registros corporativos con `location_id = NULL`.
       - Política `Tenant isolation update treasury_payments` habilitando la dispersión formal y cambio de estado a `PAID`.
       - Disparador de inmutabilidad `trg_prevent_paid_payment_deletion` que bloquea la eliminación física de pagos desembolsados.
     - Suite integral de pruebas reales ejecutada exitosamente con `BEGIN ... ROLLBACK` (`scripts/test-real-purchases-suppliers-ap.ts`):
       1. Creación de proveedor con datos fiscales y condiciones de pago (Disnalimentos S.A.S., NIT 900555444-1, 30 días de plazo).
       2. Creación de producto y stock base previo (50 unds @ $3.000 COP, valoración $150.000 COP).
       3. Bloqueo RLS de usuario no autorizado (`CASHIER` bloqueado de crear órdenes de compra).
       4. Orden de compra registrada por `WAREHOUSE_ADMIN`: 100 unds @ $3.600 COP (Subtotal $360.000 COP, IVA 19% $68.400 COP, Total Factura $428.400 COP).
       5. Recepción de mercancía (`inventory_status = 'RECEIVED'`) y recálculo matemático de Costo Promedio Ponderado: $\frac{150.000 + 360.000}{150} = \$3.400,00$ COP exactos. Total valor costo: $510.000,00 COP.
       6. Inmutabilidad física de compra recibida: Disparador `fn_prevent_received_purchase_deletion` bloquea eliminación directa.
       7. Contabilización en partida doble PUC con retenciones (Asiento CP-2026-0001): 1435 Débito $360.000, 2408 Débito $68.400 (IVA descontable), 2365 Crédito $9.000 (ReteFuente 2.5%), 2205 Crédito $419.400 (CXP neta proveedor). Total Débitos $428.400 == Total Créditos $428.400.
       8. Gestión de Tesorería y Cuentas por Pagar: Creación de cuenta bancaria institucional ($5.000.000 COP saldo) y dispersión de pago por transferencia ($419.400 COP) en `treasury_payments` (`status = 'PAID'`). Movimiento bancario egreso registrado. Inmutabilidad de pago validada (bloqueo DELETE).
       9. Contabilización del desembolso a proveedor (Asiento CP-2026-0002): 2205 Débito $419.400 vs 1110 Crédito $419.400 (Débito == Crédito).
       10. Devolución a proveedor (`SUPPLIER_RETURN`): 10 unds averiadas devueltas en Kardex, existencias reducidas automáticamente de 150 a 140 unds a costo promedio $3.400 COP.
       11. Nota Débito al proveedor y asiento de reversión contable (Asiento CP-2026-0003): 2205 Débito $41.940, 2365 Débito $900, 1435 Crédito $36.000, 2408 Crédito $6.840 (Total Débitos $42.840 == Total Créditos $42.840).
       12. Aislamiento multi-tenant y multi-sede verificado: Empresa B no puede consultar proveedores, compras, cuentas bancarias ni pagos de Empresa A.
       13. Auditoría forense inmutable (`audit_logs`) con 4 eventos registrados y blindados contra borrado.
       14. Rollback total verificado: Cero registros comerciales, transaccionales, bancarios o de compras residuales en PostgreSQL Staging.
    - **Paso 13 — Validación Integral del Módulo Contable, Periodos, Cierres y Reportes Financieros Aprobada al 100%**:
      - Migración `024_accounting_periods_puc_and_financial_reports.sql` aplicada y registrada en `schema_migrations`:
        - Centros de costo multiempresa (`cost_centers`): Columna `company_id`, unicidad `UNIQUE (company_id, code)` y activación de RLS aislado por inquilino.
        - Plan Único de Cuentas (`accounting_accounts`): Políticas RLS que permiten lectura fiduciaria a usuarios autenticados y restringen mutaciones a `SUPERADMIN` y `ACCOUNTANT`.
        - Periodos contables (`accounting_periods`): Unicidad multi-tenant `UNIQUE (company_id, period_code)` y aislamiento RLS estricto.
        - Trigger de bloqueo de meses cerrados (`fn_prevent_entries_on_closed_period`): Filtrado estricto por `company_id = NEW.company_id` que evita bloqueos cruzados entre empresas.
        - Procedimientos de cierre y reapertura (`fn_close_accounting_period`, `fn_reopen_accounting_period`) con recálculo de sumas, verificación de partida doble, bloqueo ante borradores y trazabilidad en `audit_logs`.
        - Motor de reportes financieros SQL de alto rendimiento:
          1. `fn_financial_trial_balance`: Balance de Comprobación (Sumas y Saldos).
          2. `fn_financial_daily_journal`: Libro Diario cronológico.
          3. `fn_financial_general_ledger`: Libro Mayor con saldo acumulado dinámico (`running_balance`).
          4. `fn_financial_income_statement`: Estado de Resultados / P&L (Utilidad Bruta y Operativa).
          5. `fn_financial_balance_sheet`: Balance General y Ecuación Patrimonial (`Activo = Pasivo + Patrimonio`).
          6. `fn_financial_tax_summary`: Resumen tributario con cruce de IVA Generado, IVA Descontable, Saldo Neto DIAN y Retenciones en la fuente.
      - Suite integral de pruebas reales ejecutada exitosamente con `BEGIN ... ROLLBACK` (`scripts/test-real-accounting-full-cycle.ts`):
        1. Auditoría del PUC: 55 cuentas maestras activas verificadas en sus 7 clases PUC.
        2. Centros de costo: Creación aislada multi-empresa (`CC-01`, `CC-02`) y bloqueo de duplicados.
        3. Periodos contables: Apertura simultánea de periodos en Empresa A y Empresa B sin colisión.
        4. Asiento manual de gastos: Comprobante `AS-202608-001` ($2.000.000 COP) con bloqueo de publicación ante descuadre por `fn_enforce_accounting_double_entry`.
        5. Inmutabilidad estricta de comprobantes POSTED: Bloqueo de mutación de fecha/concepto, bloqueo de borrado de asientos y bloqueo de alteración de líneas (código `23506`).
        6. Asiento automático de compras con retención: Comprobante `AS-202608-002` (Débito $11.900.000 == Crédito $11.900.000).
        7. Asiento automático de ventas POS con CMV: Comprobante `AS-202608-003` (Débito $25.850.000 == Crédito $25.850.000).
        8. Cierre contable de periodo mensual: `fn_close_accounting_period` ejecutado con éxito ($39.750.000 COP en débitos y créditos), estado `CLOSED` con auditoría.
        9. Restricción de movimientos en periodos cerrados: Bloqueo de inserciones extemporáneas en Empresa A, mientras Empresa B continúa operando en su propio periodo abierto.
        10. Reapertura controlada con justificación obligatoria y re-cierre formal.
        11. Reportes financieros:
            - Balance de comprobación 100% cuadrado ($39.750.000 COP).
            - Libro diario con 11 líneas cronológicas y libro mayor con saldo dinámico.
            - Estado de resultados: Ingresos ($15.000.000) - Costos ($8.000.000) = Utilidad Bruta ($7.000.000) - Gastos ($2.000.000) = Utilidad Operativa de $5.000.000 COP.
            - Balance general: Activos ($17.850.000 COP) == Pasivo + Patrimonio ($17.850.000 COP) $\rightarrow$ Ecuación patrimonial balanceada al céntimo.
        12. Validación tributaria DIAN: IVA Generado $2.850.000 COP, IVA Descontable $1.900.000 COP, Saldo Neto por pagar $950.000 COP, Retefuente $250.000 COP.
        13. Seguridad RLS: Rol `CASHIER` bloqueado de crear asientos; rol `ACCOUNTANT` Empresa B bloqueado de consultar asientos y periodos de Empresa A.
        14. Rollback total verificado: Cero registros residuales en todas las tablas comerciales, contables y de periodos.
     - **Estandarización UI/UX de Estados Vacíos y Errores (Transferencias, Compras, Proveedores)**:
       - Armonización de `TransferEmptyState`, `TransferErrorState`, `PurchaseEmptyState`, `PurchaseErrorState`, `SupplierEmptyState` y `SupplierErrorState`.
       - Implementación del contenedor de tarjeta SaaS (`.inventory-empty-card`), halo con brillo (`.empty-icon-halo`), tags de estado con indicadores de pulso y botones de acción primarios con microinteracciones.
       - Declaración de reglas CSS globales para `.table-empty-state` en `app/globals.css`.


     - **Navegación y Búsqueda Global del Sistema (NotificationButton y GlobalSearch)**:
       - Redirección directa del icono de campana/notificaciones con badge (3) hacia /alertas (o vista de alertas en SPA).
       - Buscador global GlobalSearch.tsx con atajo Ctrl+K / ⌘K accesible desde la barra superior en todos los módulos y rutas del App Router. Búsqueda instantánea y transversal en 8 entidades: Módulos del Sistema, Productos, Clientes, Proveedores, Facturas, Remisiones, Bodegas y Alertas con navegación por teclado y atajos rápidos por defecto.

     - **Paso 14 — Hardening de Pre-Producción y Aplicación de Migración 025 (`025_pre_production_hardening.sql`)**:
       - Auditoría completa de las 48 tablas, 75 funciones y 64 políticas RLS previas.
       - Corrección de la brecha de denegación por defecto (zero-policy) en 14 tablas heredadas y 8 tablas auxiliares.
       - RLS activado en 45 de 48 tablas con 122 políticas granulares (las 3 restantes son roles/permisos como referencia global de autenticación).
       - Blindaje de 8 funciones financieras con `SET search_path = public, pg_catalog` contra secuestro de búsqueda.
       - Optimización de rendimiento con 24 índices en claves foráneas de alto tráfico para prevenir bloqueos y Sequential Scans.
       - Verificación de aislamiento estricto de roles: SUPERADMIN (42 permisos), ADMIN (41 permisos), ACCOUNTANT (15 permisos), WAREHOUSE_ADMIN (13 permisos), CASHIER (8 permisos), SELLER (7 permisos). Cero filtración cross-área.

     - **Paso 1 (Nueva Hoja de Ruta) — Autenticación Real y Sesión de Usuario (Supabase Auth + PostgreSQL RLS)**:
       - Eliminación total de la capa mock in-memory (`db.ts`, `usr-001`, `initialAdminUser`, `users.json`).
       - Arquitectura completa fiduciaria en `features/auth/`: `AuthService`, `AuthContext`, `LoginForm`, `LoginPageClient`.
       - Cadena relacional fiduciaria: `auth.users` -> `public.users` -> `public.roles` -> `role_permissions` -> `permissions`.
       - Persistencia de sesión con Supabase Auth SDK (`persistSession: true`) sincronizada con cookies seguras (`sb-access-token`, `sb-user-role`).
       - Middleware perimetral Next.js para protección de rutas y control de acceso por roles (`SUPERADMIN`, `ADMIN`, `ACCOUNTANT`, `WAREHOUSE_MANAGER`, `CASHIER`, `SELLER`, `AUDITOR`).
       - Header y Sidebar dinámicos con `TopAvatar` y `UserMini` (`signOut()` real).
       - Verificación completa con 14 pruebas automatizadas A-N aprobadas (14/14 PASS). Cero datos comerciales generados.

