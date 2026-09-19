# CHANGELOG AI — Super Más ERP/POS

## [2026-09-19] — Unificación de Estilos de Pedidos Web, Alertas y Correcciones de Catálogos

### Fixed & Standardized
- **Módulo de Pedidos Web (`features/web-orders`)**:
  - **Barra de Filtros y Búsqueda (`WebOrderFilters.tsx`)**:
    - Se eliminaron las clases de modo oscuro (`dark:bg-slate-900`) que producían una barra completamente negra con texto casi invisible al activarse por preferencias del sistema en macOS.
    - Se migró al contenedor estándar del ERP: `<div className="toolbar inventory-toolbar products-toolbar page-enter">`.
    - Integración de `<CustomSelect>` oficial del ERP para los 4 selectores (`Estado`, `Canal Web`, `Facturación`, `Método de Pago`) dentro de `.filter-select-group` y `.filter-select-item`.
    - Input de búsqueda con buscador integrado `.search-box.wide.products-search-box` con botón de limpieza reactivo (`search-clear-btn`).
  - **Tabla de Pedidos Web (`WebOrderTable.tsx`)**:
    - Eliminación de todas las clases `dark:*`.
    - Badges de estado redefinidos con alto contraste y colores corporativos oficiales: Pendiente (`bg-amber-50 text-amber-800 border-amber-300`), Confirmado (`bg-blue-50 text-blue-800 border-blue-300`), En Preparación (`bg-purple-50 text-purple-800 border-purple-300`), Listo Despacho (`bg-indigo-50 text-indigo-800 border-indigo-300`), Enviado (`bg-sky-50 text-sky-800 border-sky-300`), Entregado (`bg-emerald-50 text-emerald-800 border-emerald-300`) y Cancelado (`bg-rose-50 text-rose-800 border-rose-300`).
    - Badges de canal de venta B2C / B2B limpios (`Super Más` en azul y `Distribuidora` en púrpura).
  - **Drawer de Detalle (`WebOrderDetailDrawer.tsx`)**:
    - Migrado a `createPortal(..., document.body)` con verificación de hidratación (`mounted`), cierre por tecla `Escape` y animación fluida `.product-drawer`.
    - Eliminación de clases `dark:*` en la línea de tiempo (timeline), verificación de inventario, tarjetas de cliente, tabla de snapshot histórico y totales.
    - **Localización 100% en español**: sustitución de textos en inglés como `CONFIRMED` por `Confirmado`, `PENDING` por `Pendiente`, `PREPARING` por `En Preparación`, `READY_TO_DISPATCH` por `Listo para Despacho`, `SHIPPED` por `Enviado`, `DELIVERED` por `Entregado` y `CANCELLED` por `Cancelado`.
    - Traducción de validaciones de inventario (`DISPONIBLE`, `POCAS UNIDADES`, `AGOTADO`, `✓ CEDI Disponible`, `⚠ Requiere traslado`) y estados DIAN (`Autorizada y Validada`, `Pendiente de emisión`).
  - **Modales de Ciclo de Vida (`WebOrderPreparationModal.tsx`, `WebOrderDispatchModal.tsx`, `WebOrderCancelModal.tsx`)**:
    - Migrados a `createPortal(..., document.body)` con `.drawer-backdrop.modal-center` y soporte para <kbd>Escape</kbd>.
  - **Skeletons y Header (`WebOrderSkeleton.tsx`, `WebOrderHeader.tsx`)**:
    - Limpieza de clases oscuras residuales para asegurar consistencia visual con el resto del ERP.

- **Módulo de Contabilidad (`features/accounting`)**:
  - **Gráfico de Evolución de Ingresos vs. Costos y Gastos (`AccountingDashboardTab.tsx`)**:
    - Se corrigió el desbordamiento vertical donde las barras del mes más reciente (Septiembre) sobrepasaban el contenedor superior y cubrían la leyenda.
    - **Causa raíz**: El valor máximo (`maxVal = 260000000`) estaba fijado estáticamente en el código, por lo que cuando los ingresos reales del mes superaban dicho monto, el cálculo superaba el 100% (hasta más de 200%).
    - **Solución**: Cálculo dinámico del techo de la escala (`Math.max(...) * 1.15`) con un 15% de holgura superior (*headroom*), límite de altura máxima estricto (`maxHeight: '100%'`, acotado con `Math.min(100, ...)`), e incorporación de líneas guía horizontales de referencia.

- **Módulo de Alertas (`features/alerts`)**:
  - `AlertRulesModal.tsx` y `AlertDetailDrawer.tsx` refactorizados con `createPortal(..., document.body)` y `.drawer-backdrop`, solucionando el problema de renderizado estático o cortado por el scroll del `.main-area`.

- **Módulos de Catálogo (`features/super-catalog`, `features/distributor-catalog`)**:
  - Eliminación de los botones "Vista Previa Tienda" y "Vista Previa Catálogo" de los encabezados.
  - Corrección de desbordamiento y sobreposición del nombre de producto en `DistributorCatalogTable.tsx` aplicando `min-w-0`, `line-clamp-2 break-words` y control de anchos de columna en `th` y `td`.

## [2026-09-19] — Corrección de Drawers Deslizantes en Contabilidad y Unificación de Navegación

### Fixed & Refactored
- **Drawers Deslizantes del Módulo de Contabilidad**:
  - `NewAccountDrawer.tsx` (Nueva Cuenta PUC): Se corrigió el problema de renderizado estático al final de la página sustituyendo `.drawer-overlay`/`.drawer-panel` por `.drawer-backdrop` y `.product-drawer.page-enter` montados directamente en `document.body` mediante `createPortal`.
  - `NewManualEntryDrawer.tsx` (Nuevo Asiento Manual): Adaptado a `.drawer-backdrop` y `.product-drawer` con portal al DOM raíz (`document.body`), asegurando que deslice fluidamente desde el lateral derecho (`animation: slide .3s ease`) y soporte cierre por tecla `Escape` o backdrop.
  - `AccountingEntryDetailDrawer.tsx` (Ficha Detallada de Asiento Contable): Migrado a `createPortal` con ancho responsivo (`min(100%, 720px)`) y modal de reversión integrado con prevención de propagación.
- **Unificación de Navegación Global y Conexión de Módulos**:
  - `components/navigation/modules.ts`: Creado como fuente única de verdad para los 21 módulos del ERP, unificando labels, iconos, rutas (`/path`) y claves de vista (`viewKey`).
  - `app/page.tsx`: Conexión de los 10 módulos que faltaban en el switch SPA (`catalogo-supermas`, `catalogo-distribuidora`, `pedidos-web`, `reportes`, `alertas`, `auditoria`, `usuarios`, `roles`, `configuracion`, `contabilidad`).
  - Actualización de los 21 archivos de ruta en `app/` para importar `APP_MODULES`, eliminando fallbacks con enlaces rotos `'/'`.
- **Módulo de Roles (`features/roles/` y `app/roles/page.tsx`)**:
  - Implementación de la vista completa de consulta de roles y matriz de permisos por sede para el rol `SUPERADMIN`.

### Added & Tested
- **Suite de Pruebas Automatizadas de Contabilidad (`features/accounting/tests/accounting.test.ts`)**:
  - 21 pruebas automatizadas ejecutadas con `npx tsx` cubriendo:
    1. Matriz de permisos por rol (`SUPERADMIN`, `ACCOUNTANT`, `CASHIER`).
    2. Creación y validación de cuentas contables PUC.
    3. Validación estricta de partida doble (`SUM(debit) == SUM(credit)`).
    4. Creación exitosa de comprobantes de diario (`POSTED`).
    5. Reversión contable con inmutabilidad y generación de comprobante inverso (`REVERSED`).
    6. Reportes financieros (Balance de prueba y Estado de Resultados integral).
  - Resultado: 21 pasaron exitosamente (0 errores). Verificación completa de tipos con `npx tsc --noEmit` limpia.


### Changed & Improved
- **Encabezado Unificado (`ReportHeader.tsx`)**:
  - Migración a la estructura canónica del ERP: `<header className="page-heading page-enter">` con eyebrow corporativo rojo (`.eyebrow`), título semántico `<h1>`, subtítulo descriptivo (`.welcome-subtitle`) y contenedor de controles `.heading-actions`.
  - Reemplazo de botones genéricos por `.outline-button` de 42px y dropdown de exportación con sombra estándar.
- **Tarjetas KPI Estadísticas (`ReportStatsCard.tsx`)**:
  - Migración a la estructura global: `<article className="stat-card">` dentro de `<section className="stats-grid products-stats">`.
  - Iconos con tonos corporativos del ERP (`stat-icon` con `tone="teal"`, `tone="blue"`, `tone="amber"`, `tone="red"`).
  - Integración de `<svg className="sparkline">` y conteo ascendente fluido (`useCountUp`).
- **Navegación por Pestañas Canónicas (`ReportsHubPage.tsx`)**:
  - Se implementó la barra horizontal `<div className="tabs">` para alternar rápidamente entre los 13 submódulos analíticos (Resumen, Ventas, Compras, Inventario, Kardex, Costos, Bodegas, Clientes, Proveedores, Cajas, Facturación, Contabilidad y Ecommerce).
- **Paneles y Gráficas (`ReportCharts.tsx` y `ReportDashboardView.tsx`)**:
  - Adaptación de `TrendLineChart`, `DistributionBarList` y `ComparisonBarChart` a `<section className="panel chart-panel">` dentro de `<div className="dashboard-grid">` con encabezados `.panel-heading` e identidades cromáticas de Super Más (`#fe110c` y `#001b5c`).
- **Drawer de Detalle y Footer (`ReportItemDetailDrawer.tsx`)**:
  - Adaptado a la estructura oficial con backdrop oscuro translúcido `.drawer-backdrop` y panel `.product-drawer`.
  - Footer oficial reutilizable `<Footer isDark={false} />` con atribución "Desarrollado por K&T 🖤" y año dinámico.

## [2026-09-19] — Migración Completa de Arquitectura a Supabase PostgreSQL (ERP Super Más)

### Added
- **Auditoría Exhaustiva de Fuentes de Datos**:
  - `supabase/AUDIT_MOCK_DB.md`: Mapeo formal y relacional de los 42 archivos JSON de `lib/supabase/mock-db/` con especificación de tablas destino, tipos de datos PostgreSQL, llaves primarias, relaciones y campos marcados como "PENDIENTE DE DEFINICIÓN".
- **Scripts Modulares de Migración SQL (`supabase/migrations/`)**:
  - `001_extensions_and_types.sql`: Extensiones (`uuid-ossp`, `pgcrypto`, `citext`) y ENUMs controlados.
  - `002_core_and_companies.sql`: Empresas multi-sede (`companies`), sedes logísticas (`locations`), roles y permisos inmutables (`roles`, `permissions`, `role_permissions`), perfiles de usuario (`users`) y sedes autorizadas (`user_locations`).
  - `003_products_and_inventory.sql`: Catálogo maestro único (`products`, `categories`, `brands`), existencias por sede (`stock_levels`), Kardex histórico inmutable (`inventory_movements`) y logística de transferencias (`transfers`, `transfer_items`).
  - `004_sales_pos_remissions.sql`: Clientes (`customers`), terminales POS y arqueos (`cash_registers`, `cash_sessions`, `cash_movements`), ventas mercantiles (`sales`, `sale_items`), remisiones de despacho (`remissions`) y pedidos online (`web_orders`).
  - `005_purchases_and_suppliers.sql`: Proveedores (`suppliers`), órdenes de compra y recepción (`purchases`, `purchase_items`) y abonos (`supplier_payments`).
  - `006_accounting_taxes_dian.sql`: Facturación electrónica DIAN (`electronic_invoices`, `dian_events`), tasas tributarias (`tax_rates`), plan de cuentas PUC (`accounting_accounts`), asientos de partida doble (`accounting_entries`, `accounting_entry_lines`) y medios magnéticos (`exogena_formats`, `exogena_records`).
  - `007_alerts_and_audit.sql`: Configuración del sistema (`system_settings`), supervisión proactiva (`alert_rules`, `system_alerts`) y auditoría inmutable (`audit_logs`) con reglas anti-eliminación.
  - `008_triggers_and_functions.sql`: Triggers de `updated_at`, actualización atómica de Kardex y función de validación de balance contable.
  - `009_rls_policies.sql`: Políticas de Row Level Security (RLS) para administrador, cajeros, vendedores y personal de bodega.
  - `010_auth_and_storage_setup.sql`: Trigger de enlace entre `auth.users` y `public.users` más la configuración y políticas de los 6 buckets de Supabase Storage (`products`, `company`, `invoices`, `suppliers`, `documents`, `users`).
- **Capa de Conexión en Next.js (`lib/supabase/`)**:
  - `lib/supabase/client.ts`: Cliente de navegador mediante `@supabase/supabase-js` con clave anónima.
  - `lib/supabase/server.ts`: Cliente de servidor para Server Actions y Server Components.
  - `lib/supabase/admin.ts`: Cliente administrativo con privilegios elevados (`service_role`).
  - `.env.local.example`: Documentación de variables requeridas para Supabase.
- **Script de Migración de Datos**:
  - `scripts/migrate-mock-data.ts`: Semillero transaccional TypeScript para migrar datos de `mock-db` a Supabase en orden estricto de integridad referencial.
- **Checklist Normativo**:
  - `supabase/CHECKLIST_DEFINITIONS.md`: Documento de definiciones pendientes para completar con la administración, contador y la DIAN.

## [2026-09-19] — Corrección y Gráfica Interactiva de Bodegas (Evolución de Ventas y Rendimiento)

### Fixed & Improved
- **Gráfica de Rendimiento Comercial en Bodegas (`WarehouseOverviewTab.tsx`)**:
  - Se eliminó el trazado estático simulado por CSS (`line-chart:after` sesgado con puntos fijos flotantes).
  - Se implementó un **gráfico vectorial SVG interactivo** con curva suave Bézier, área con gradiente sombreado, línea de promedio semanal dinámico y selector reactivo de métrica (**Ventas** vs **Utilidad**).
  - Conexión dinámica con el historial de ventas del ERP (`WarehouseSaleRecord` y `sales.json`) agrupado por días de la semana y cálculo de promedios ponderados.
  - Tooltips interactivos con valores formateados en pesos colombianos (`COP`), cantidad de facturas por día y fecha correspondiente al pasar el cursor sobre cada nodo.
- **Distribución de Stock e Inventario por Categoría**:
  - Se corrigió el contador central del gráfico de dona (`0 Líneas activas`) para reflejar dinámicamente las líneas registradas en la bodega (`inventory.length` / `warehouse.productsCount`).
  - Fallback automático en `warehouse.repository.ts` para mapear el catálogo global de productos cuando una sede recién consultada no tiene filas locales en `warehouse_inventory.json`.

### Changed
- **Estilos de Tarjetas de Configuración**:
  - `features/settings/components/SettingsCategoryCard.tsx`: Rediseño completo reemplazando el tema oscuro (`bg-slate-900`, `border-slate-800`, textos blancos) por el diseño claro estándar del ERP Super Más (fondo blanco `#ffffff`, bordes `#e2e8f0`, hover `#b9c8df`, textos `--navy` y `--muted`).
  - `features/settings/components/SettingsPage.tsx`: Encabezados de sección y contenedores vacíos adaptados a la paleta clara oficial.
- **Drawer Lateral de Configuración (`SettingsDetailDrawer.tsx`)**:
  - Implementación con `createPortal(..., document.body)` y verificación de montaje (`mounted`) para evitar que quede atrapado bajo el sticky topbar o sufra cortes por scroll en `.main-area`.
  - Fondo blanco `#ffffff` con cabecera sticky con blur suave, sombra lateral `boxShadow: -10px 0 30px rgba(0, 27, 92, 0.15)`.
  - Formularios (Empresa, Inventario, POS, Ecommerce y Variables Dinámicas) adaptados con inputs blancos, bordes `#cbd5e1`, foco azul marino `[var(--navy)]` y etiquetas contrastadas.
- **Vistas y Modales de Configuración**:
  - `features/settings/components/views/RolesConsultationView.tsx`: Actualizado a paleta clara con badges suaves y bordes limpios.
  - `features/settings/components/modals/CriticalChangeModal.tsx`: Renderizado con `createPortal(..., document.body)` y fondo blanco `#ffffff` con advertencias en rojo corporativo.

## [2026-09-19] — Módulo Configuración y Parámetros Globales (ERP Super Más)

### Added
- **Base de Datos Simulada Supabase**:
  - `lib/supabase/mock-db/company_settings.json`: Datos institucionales y comerciales de Super Más S.A.S. (NIT, razón social, actividad económica CIIU, representante legal, dirección, telefonía PBX, emails y logo).
  - `lib/supabase/mock-db/inventory_settings.json`: Políticas globales de existencias (stock mínimo general de alerta, umbrales críticos, método de valoración de inventarios `WEIGHTED_AVERAGE`, bloqueo de inventario negativo y reglas de transferencias).
  - `lib/supabase/mock-db/pos_settings.json`: Parámetros de terminales de punto de venta (sede por defecto, caja inicial, consumidor final genérico, auto-impresión de tirilla, flotante inicial permitido y tolerancia de arqueo).
  - `lib/supabase/mock-db/ecommerce_settings.json`: Configuración de canales online (bodega de despacho CEDI, switches de Catálogo Super Más y Distribuidora, enlace oficial de WhatsApp comercial con plantillas de cotización y soporte).
  - `lib/supabase/mock-db/settings.json`: Almacén dinámico y extensible de variables del sistema (`key-value`) con tipado, categorización, criticidad y metadatos de auditoría.
  - `lib/supabase/db.ts`: Inclusión de `company_settings`, `inventory_settings`, `pos_settings`, `ecommerce_settings` y `settings` en `SupabaseMockTableMap`, exportaciones `db.*` y mapeo en `supabaseMock.from(...)`.
- **Tipos de Auditoría Transversal (`features/audit/`)**:
  - Incorporación de `'SETTINGS'` a `AuditModule`.
  - Incorporación de `'SETTING_UPDATED' | 'SETTING_BATCH_UPDATED' | 'CRITICAL_CONFIG_CHANGED'` a `AuditActionType`.
- **Capa de Dominio y Lógica (`features/settings/`)**:
  - `types/index.ts`: Definición estricta de interfaces para las 16 categorías operativas, variables dinámicas, estadísticas de configuración, historial de cambios y permisos RBAC (`settings.*`).
  - `schemas/settings.schema.ts`: Esquemas Zod para validación de datos corporativos, inventario, POS, ecommerce y variables dinámicas.
  - `repositories/settings.repository.ts`: Repositorio desacoplado con lectura indexada, actualización transaccional, historial interno de cambios, consulta de roles predefinidos (`SYSTEM_ROLES`) y cálculo de estadísticas agregadas.
  - `services/settings.service.ts`: Fachada de negocio central con verificación de permisos RBAC, detección y clasificación de cambios críticos (bodega ecommerce, valoración de inventarios), validación Zod y registro inmutable en auditoría (`auditService.log()`).
- **Hooks React**:
  - `hooks/useSettings.ts`: Estado reactivo unificado, carga paralela, guardado con feedback toast, control de categoría activa para drawer y modal interactivo para cambios críticos.
  - `hooks/useSettingsPermissions.ts`: Helper de permisos RBAC para control de acceso y renderizado condicional.
- **Componentes de Interfaz de Usuario**:
  - `components/SettingsPage.tsx`: Vista orquestadora principal `/configuracion` con filtrado en vivo de áreas.
  - `components/SettingsHeader.tsx`: Encabezado con `<h1>Configuración</h1>`, buscador en tiempo real y acción de recarga.
  - `components/SettingsStats.tsx`: 4 tarjetas animadas con contador dinámico `useCountUp` (configuraciones activas, última modificación, usuario responsable y parámetros críticos).
  - `components/SettingsCategoryCard.tsx`: Tarjetas de categorías con badges de estado, iconografía y microinteracciones de hover.
  - `components/drawers/SettingsDetailDrawer.tsx`: Drawer deslizante para editar formularios específicos (Empresa, Inventario, POS, Ecommerce) o variables dinámicas asociadas a cada módulo.
  - `components/modals/CriticalChangeModal.tsx`: Modal de advertencia para confirmación obligatoria de modificaciones de alto impacto (*"Este cambio puede afectar operaciones futuras. ¿Deseas continuar?"*).
  - `components/views/RolesConsultationView.tsx`: Vista de consulta (solo lectura) de la matriz de los 6 roles inmutables del sistema (`SUPERADMIN`, `WAREHOUSE_ADMIN`, `POINT_ADMIN`, `ACCOUNTANT`, `SELLER`, `CASHIER`) y sus permisos asignados.
  - `components/SettingsSkeleton.tsx` & `components/SettingsToast.tsx`: Estados de carga pulidos y notificaciones toast flotantes.
- **Rutas Next.js App Router**:
  - `app/configuracion/page.tsx`: Ruta standalone `/configuracion` con sidebar interactivo, breadcrumbs semánticos y footer reglamentario K&T.
  - Integración en `app/page.tsx` para renderizar `<SettingsPage />` cuando la vista activa es "Configuración".
  - Actualización de sidebars en 20 páginas secundarias enlazando el ítem "Configuración" a `/configuracion`.
- **Pruebas Automatizadas y Calidad**:
  - `features/settings/tests/settings.logic.test.ts`: Suite de 12 pruebas automatizadas con `npx tsx`, validando esquemas Zod, cálculo de estadísticas, lectura y actualización de empresa, inventario, POS, ecommerce y variables dinámicas, marcado de criticidad, inmutabilidad de roles, seguridad RBAC y auditoría inmutable.
  - Ejecución exitosa de regresión con las suites de Alertas, Reportes, Catálogo Super Más y Catálogo Distribuidora.
  - Typecheck limpio con `npx tsc --noEmit` (0 errores).
  - Compilación exitosa de Next.js en producción (`npm run build`, 37/37 páginas estáticas generadas).

## [2026-09-19] — Módulo Alertas y Supervisión Proactiva (ERP Super Más)

### Added
- **Base de Datos Simulada Supabase**:
  - `lib/supabase/mock-db/alert_rules.json`: Definición y configuración persistente de 10 reglas del sistema (Producto agotado, Stock bajo, Facturas de compra vencidas y próximas a vencer, Facturas electrónicas rechazadas DIAN, Descuadres de caja, Cajas abiertas prolongadamente, Pedidos web pendientes de confirmación, Transferencias retrasadas en tránsito y Asientos contables descuadrados).
  - `lib/supabase/mock-db/alerts.json`: Registro histórico de alertas del ERP con metadatos completos, estados (`NEW`, `READ`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`), entidades vinculadas, responsables y timeline secuencial de auditoría.
  - `lib/supabase/db.ts`: Inclusión de tablas `alerts` y `alert_rules` en el tipado `SupabaseMockTableMap`, exportaciones `db.alerts` y `db.alertRules` y mapeo en `supabaseMock.from(...)`.
- **Tipos de Auditoría Transversal (`features/audit/`)**:
  - Incorporación de `'ALERTS'` a `AuditModule`.
  - Incorporación de `'ALERT_CREATED' | 'ALERT_READ' | 'ALERT_ATTENDED' | 'ALERT_RESOLVED' | 'ALERT_RULE_MODIFIED'` a `AuditActionType`.
- **Capa de Dominio y Lógica (`features/alerts/`)**:
  - `types/index.ts`: Tipado estricto para prioridades (`CRITICA`, `ALTA`, `MEDIA`, `BAJA`), estados, módulos, entidades asociadas (`PRODUCT`, `PURCHASE_INVOICE`, `INVOICE`, `CASH_REGISTER`, `WEB_ORDER`, `TRANSFER`, `ACCOUNTING_ENTRY`), permisos RBAC (`alerts.*`) y contexto de usuario.
  - `schemas/alert.schema.ts`: Esquemas Zod para filtrado de alertas, puesta en atención (`attendAlertSchema`), resolución (`resolveAlertSchema`), cierre (`closeAlertSchema`) y configuración dinámica de reglas y umbrales (`alertRuleConfigSchema`).
  - `repositories/alert.repository.ts`: Repositorio desacoplado con consultas indexadas, filtros combinados (prioridad, módulo, estado, bodega, criticidad, no leídas, responsable), ordenamiento ponderado por urgencia y fecha, paginación, transiciones de estado, cálculo de estadísticas agregadas y persistencia append-only (no eliminación física).
  - `rules/alert-definitions.ts`: Motor de evaluación analítica pura para detectar anomalías operativas de inventario, compras, facturación DIAN, arqueos de caja, pedidos web, transferencias y contabilidad.
  - `services/alert-rules.service.ts`: Orquestador de escaneo automático con garantía estricta de deduplicación (evita alertas redundantes sobre la misma entidad y regla si ya existe una alerta activa).
  - `services/alert-notification.service.ts`: Servicio optimizado para alimentar el centro de notificaciones superior con conteo de no leídas, detección de alertas críticas y las 5 más recientes.
  - `services/alert.service.ts`: Fachada de negocio central con validación RBAC de permisos, visibilidad acotada según rol y bodega (Cajero solo ve sus cajas; Bodeguero solo su sede), transiciones de ciclo de vida y registro inmutable en auditoría (`auditService.log()`).
- **Hooks React**:
  - `hooks/useAlerts.ts`: Manejo reactivo de alertas, filtros dinámicos, selección de ítem para drawer, modal de configuración de reglas, ejecución de escaneo y feedback toast.
  - `hooks/useAlertPermissions.ts`: Helper de permisos RBAC para control de acceso y renderizado condicional.
- **Componentes de Interfaz de Usuario**:
  - `components/AlertsPage.tsx`: Vista orquestadora principal `/alertas`.
  - `components/AlertsHeader.tsx`: Encabezado con `<h1>` semántico único, badge dinámico de pendientes, escaneo de sistema bajo demanda, marcado masivo de leídas y modal de configuración.
  - `components/AlertsStats.tsx`: 4 tarjetas KPI con animación `useCountUp`, microinteracciones y barra de filtrado rápido por módulo.
  - `components/AlertsFilters.tsx`: Barra de filtros con búsqueda en tiempo real, toggles rápidos ("Solo críticas", "Solo no leídas"), selectores de prioridad, estado, bodega y módulo.
  - `components/AlertsTable.tsx`: Tabla de alta densidad con badges de prioridad, módulo, estado, usuario responsable, accesos rápidos y paginación fluida.
  - `components/drawers/AlertDetailDrawer.tsx`: Drawer deslizante de detalle profundo con acceso directo al registro relacionado ("Ver Producto", "Ver Factura", "Ver Caja", "Ver Pedido"), timeline histórico, formulario interactivo de atención y formulario de solución y cierre.
  - `components/modals/AlertRulesModal.tsx`: Modal para habilitar/deshabilitar reglas, cambiar prioridades por defecto y ajustar umbrales numéricos de detección sin alterar código fuente.
  - `components/NotificationBell.tsx`: Componente de campana de notificaciones para el topbar del layout con conteo de no leídas, animación pulsante/rebote en alertas críticas y popover con alertas recientes y navegación rápida a `/alertas`.
  - `components/AlertSkeleton.tsx` & `components/AlertToast.tsx`: Estados de carga pulidos y notificaciones toast.
- **Rutas Next.js App Router**:
  - `app/alertas/page.tsx`: Ruta principal `/alertas` con sidebar interactivo, breadcrumbs y footer reglamentario K&T.
  - Integración en `app/page.tsx` para navegación en vista "Alertas" y reemplazo del botón estático de campana en el header por `<NotificationBell />`.
  - Actualización de sidebars en 19 páginas secundarias enlazando el ítem "Alertas" a `/alertas`.
- **Pruebas Automatizadas y Calidad**:
  - `features/alerts/tests/alert.logic.test.ts`: Suite de 12 pruebas automatizadas con `npx tsx`, validando esquemas Zod, evaluación de reglas del sistema, deduplicación en re-escaneo, detección en compras, DIAN, cajas, pedidos web, transferencias y contabilidad, ciclo de vida completo (`NEW -> READ -> IN_PROGRESS -> RESOLVED -> CLOSED`), inmutabilidad histórica, seguridad RBAC por rol/bodega, modificación de umbrales y registro inmutable en auditoría.
  - Ejecución exitosa de regresión con las suites de Reportes, Catálogo Super Más y Catálogo Distribuidora.
  - Typecheck limpio con `npx tsc --noEmit` (0 errores).
  - Compilación exitosa de Next.js en producción (`npm run build`, 36/36 páginas estáticas generadas).

## [2026-09-19] — Módulo Reportes y Analítica (ERP Super Más)

### Added
- **Base de Datos Simulada Supabase**:
  - `lib/supabase/mock-db/cash_registers.json`: Modelo relacional de 4 cajas registradoras (CEDI Principal, Norte, Centro, Calle 80) con estados `OPEN`/`CLOSED`, saldos de apertura, ventas en efectivo y arqueos.
  - `lib/supabase/mock-db/cash_movements.json`: Movimientos transaccionales de caja (aperturas, ingresos, ventas en efectivo y egresos).
  - `lib/supabase/db.ts`: Mapeo y tipado de `cashRegisters` y `cashMovements` en `supabaseMock.from(...)` y exportación centralizada.
- **Tipos de Auditoría Transversal (`features/audit/`)**:
  - Incorporación de `REPORT_GENERATED`, `REPORT_EXPORTED` y `REPORT_SENSITIVE_ACCESSED` a `AuditActionType` para trazabilidad inmutable de consultas y descargas.
- **Capa de Dominio y Lógica (`features/reports/`)**:
  - `types/index.ts`: Modelos TypeScript exhaustivos para las 12 dimensiones analíticas (Ventas, Compras, Inventario, Kardex, Costos y Utilidad/CMV, Bodegas con benchmark comparativo Bodega A vs B, Clientes, Proveedores, Cajas, Facturación Electrónica DIAN, Contabilidad PUC con partida doble, y Ecommerce Web vs POS), series temporales, distribuciones, filtros y permisos RBAC (`reports.*`).
  - `schemas/report.schema.ts`: Validación Zod para criterios de filtrado (`reportFilterCriteriaSchema`), exportación (`exportOptionsSchema`) y configuración de reportes personalizados (`customReportConfigSchema`).
  - `repositories/report.repository.ts`: Repositorio desacoplado de solo lectura que consulta de forma indexada y eficiente sobre `sales.json`, `purchases.json`, `products.json`, `stock_levels.json`, `inventory_movements.json`, `customers.json`, `suppliers.json`, `invoices.json`, `web_orders.json`, `cash_registers.json`, `cash_movements.json` y `locations.json`.
  - `builders/report.builder.ts`: Motor analítico puro encargado de construir agregaciones, series temporales continuas, distribuciones porcentuales, cálculo de CMV/utilidad económica (`Ingresos - Costo Mercancía Vendida = Utilidad Bruta`), benchmark entre dos bodegas y normalización de atributos.
  - `services/report-export.service.ts`: Servicio desacoplado de exportación universal para hojas de cálculo Excel XML (`.xls`), texto plano CSV delimitado con BOM UTF-8 y formateo para impresión/PDF.
  - `services/report.service.ts`: Fachada centralizada de analítica gerencial con verificación granular de permisos RBAC, sanitización estricta de costos y márgenes para roles operativos (como cajeros), consumo desacoplado de `accountingReportService` para libros contables y balance general, registro inmutable de auditoría vía `auditService.log()`.
- **Hooks React**:
  - `hooks/useReports.ts`: Estado reactivo analítico, filtros interactivos de fecha/bodega/categoría/cliente/proveedor/vendedor, carga asíncrona, control de drawer de detalle (drill-down), exportación y feedback visual.
  - `hooks/useReportPermissions.ts`: Helper de permisos RBAC para control de acceso y renderizado condicional.
- **Componentes de Interfaz de Usuario**:
  - `components/ReportsHubPage.tsx`: Vista orquestadora central con navegación dinámica entre las 12 dimensiones analíticas y el dashboard principal.
  - `components/ReportRouteShell.tsx`: Shell global para sub-rutas directas con sidebar activo, breadcrumb semántico, switch de periodos y footer reglamentario K&T.
  - `components/ReportHeader.tsx`: Encabezado analítico con `<h1>` semántico único, selector de periodos preestablecidos, selector de bodega, acciones rápidas de recarga y menú desplegable de exportación (Excel, CSV, Imprimir).
  - `components/ReportFilterBar.tsx`: Barra contextual de filtros avanzados (búsqueda textual, categoría, rango de fechas personalizado y selectores dinámicos).
  - `components/ReportStatsCard.tsx`: Tarjeta KPI animada con `useCountUp`, formateo de moneda/porcentajes, badge de tendencia y estado visual.
  - `components/ReportCharts.tsx`: Componentes de visualización nativos en SVG (gráfico de línea interactivo `TrendLineChart` con curvas Bézier cúbicas y tooltips dinámicos, barras de distribución `DistributionBarList` y comparativa lado a lado `ComparisonBarChart`).
  - `components/drawers/ReportItemDetailDrawer.tsx`: Drawer de auditoría y drill-down para inspeccionar a fondo documentos, facturas, clientes, proveedores o productos sin abandonar la vista analítica.
  - `components/ReportSkeleton.tsx` & `components/ReportToast.tsx`: Estados de carga pulidos y notificaciones de éxito/error.
  - `components/views/`: 13 vistas especializadas:
    - `ReportDashboardView.tsx`: Tablero general con 12 tarjetas de acceso escalonadas, métricas consolidadas, gráfico temporal y distribución por categoría.
    - `SalesReportView.tsx`: Análisis de ventas con desglose por bodega, categoría, vendedor, método de pago y tabla detallada.
    - `PurchasesReportView.tsx`: Volúmenes de compras, contado vs crédito, vencimientos y comportamiento de proveedores.
    - `InventoryReportView.tsx`: Valorización de stock a precio venta y al costo (restringido), clasificación de stock crítico y por bodega.
    - `KardexReportView.tsx`: Movimientos físicos de inventario (entradas, salidas, ajustes, transferencias) con saldos resultantes.
    - `CostsReportView.tsx`: Módulo gerencial de CMV y margen bruto por producto, categoría y bodega.
    - `WarehousesReportView.tsx`: Comparativa cuantitativa Bodega A vs Bodega B con gráfico comparativo de ventas, compras, inventario y utilidad.
    - `CustomersReportView.tsx`: Top clientes, frecuencia de compra, ticket promedio y análisis de cartera.
    - `SuppliersReportView.tsx`: Desempeño de proveedores, compras acumuladas, saldos pendientes y facturas vencidas.
    - `CashRegistersReportView.tsx`: Arqueo de cajas registradoras, aperturas, cierres, efectivo esperado vs real y diferencias.
    - `BillingReportView.tsx`: Estado de facturación electrónica ante la DIAN (validadas, rechazadas, notas crédito).
    - `AccountingReportView.tsx`: Integración con PUC, balance general, estado de resultados y comprobantes con estricta partida doble.
    - `EcommerceReportView.tsx`: Rendimiento de pedidos web frente a ventas en puntos físicos POS.
- **Rutas Next.js App Router**:
  - `app/reportes/page.tsx`: Ruta principal del centro de reportes.
  - 12 sub-rutas directas: `/reportes/ventas`, `/reportes/compras`, `/reportes/inventario`, `/reportes/kardex`, `/reportes/costos`, `/reportes/bodegas`, `/reportes/clientes`, `/reportes/proveedores`, `/reportes/cajas`, `/reportes/facturacion`, `/reportes/contabilidad`, `/reportes/ecommerce`.
  - Actualización de `app/page.tsx` para integrar el hub cuando la vista activa es "Reportes".
  - Actualización de los 19 sidebars en todo el ERP enlazando el ítem "Reportes" a `/reportes`.
- **Pruebas Automatizadas y Calidad**:
  - `features/reports/tests/report.logic.test.ts`: Suite de 12 pruebas de negocio ejecutables con `npx tsx`, validando esquemas, integridad matemática de ventas/compras, ecuación de costos `Ventas - CMV = Utilidad`, clasificación de inventario, benchmark de bodegas, control de cajas, partida doble contable, cuotas multicanal, sanitización RBAC para cajero y auditoría inmutable.
  - Validación completa con `npx tsc --noEmit` (0 errores) y `npm run build` (35/35 páginas estáticas generadas exitosamente).

## [2026-09-19] — Módulo Catálogo Super Más (Ecommerce B2C ↔ ERP)

### Added
- **Base de Datos Simulada Supabase**:
  - `lib/supabase/mock-db/products.json`: Enriquecimiento del modelo maestro con atributos para ecommerce B2C (`webShowPrice`, `webLowStockThreshold`, `webViewsCount`).
  - Mantenimiento estricto del principio de producto maestro único compartido entre Catálogo Super Más y Catálogo Distribuidora sin duplicación de ítems.
- **Tipos de Auditoría Transversal (`features/audit/`)**:
  - Incorporación de `SUPER_CATALOG_PRODUCT_UPDATED` y `SUPER_CATALOG_BULK_UPDATED` a `AuditActionType` para trazabilidad inmutable de publicaciones, precios, imágenes y umbrales de stock.
- **Capa de Dominio y Lógica (`features/super-catalog/`)**:
  - `types/index.ts`: Tipos TypeScript rigurosos para productos de catálogo, estados de disponibilidad (`AVAILABLE`, `LOW_STOCK`, `OUT_OF_STOCK`), estadísticas y métricas B2C, filtros, acciones masivas, simulación de carrito (`simulateAddToCart`) y permisos RBAC (`super_catalog.*`).
  - `schemas/super-catalog.schema.ts`: Validación Zod para filtros reactivos, configuración web (regla `.refine()` que exige estar publicado en Super Más para habilitar compra directa), actualización de precios/impuestos, administración de imágenes y acciones masivas.
  - `repositories/super-catalog.repository.ts`: Repositorio desacoplado que consulta `db.products`, `db.stockLevels`, `db.categories`, `db.brands`, `db.taxConfigs`, `db.locations` y `db.webOrders`. Calcula disponibilidad comercial multi-bodega con umbral configurable (`webLowStockThreshold`), almacena histórico tributario, extrae métricas de ventas y sanitiza datos sensibles (costos, márgenes y proveedores nunca expuestos).
  - `services/super-catalog.service.ts`: Fachada de negocio con verificación de permisos por rol (`assertPermission`), cálculo de KPIs de catálogo y ventas web (`getStats`), simulación de adición al carrito con IVA y disponibilidad en bodega ecommerce CEDI, actualización con diffs estructurados en `auditService.log()` y exportación a CSV.
- **Hooks React**:
  - `hooks/useSuperCatalog.ts`: Gestión de estado reactivo, búsqueda con debounce de 300ms, paginación, filtros de categoría/marca/disponibilidad/estados, selección múltiple para acciones masivas, KPIs animados y mutaciones asíncronas con feedback sonoro y visual.
  - `hooks/useSuperCatalogPermissions.ts`: Control de permisos operativos según rol de usuario (`canRead`, `canUpdate`, `canPublish`, `canPrice`, `canImages`, `canBulkUpdate`, `canExport`).
- **Componentes de Interfaz de Usuario**:
  - `components/SuperCatalogPage.tsx`: Vista orquestadora principal con diseño SaaS moderno y micro-animaciones fluidas.
  - `components/SuperCatalogHeader.tsx`: Encabezado semántico con título `<h1>`, descripción oficial y acciones rápidas (Vista Previa, Exportar CSV, Recargar).
  - `components/SuperCatalogStats.tsx`: 6 tarjetas KPI con animación `useCountUp`, skeleton loaders e íconos temáticos (Publicados, Ocultos, Disponibles, Pocas Unidades, Agotados, Compra Activa) + 2 banners analíticos de insights (Más Vendido y Más Visto).
  - `components/SuperCatalogFilters.tsx`: Barra de filtros completos con búsqueda por nombre/SKU/código de barras, categoría, marca, disponibilidad, estado en catálogo y estado de compra directa.
  - `components/SuperCatalogTable.tsx`: Tabla de alta densidad con selección múltiple con checkboxes, badges de disponibilidad multi-bodega, precios con desglose tributario, acciones contextuales (Ver Detalle, Editar Configuración, Publicar/Ocultar, Vista Previa) y barra flotante de acciones masivas.
  - `components/drawers/SuperProductDetailDrawer.tsx`: Drawer lateral deslizable con ficha técnica, switches comerciales (Publicar, Compra Directa, Mostrar Precio), editor de precio web e IVA, selector de umbral de pocas unidades y resumen interno confidencial de existencias por bodega.
  - `components/drawers/SuperProductPreviewModal.tsx`: Modal interactivo de alta fidelidad que simula la tarjeta de producto y ficha ecommerce B2C real para el cliente final, con selector de imágenes, badge comercial (Disponible/Pocas unidades/Agotado), precio formateado en COP, selector de cantidad y botón interactivo "Comprar Ahora" conectado a la simulación de carrito.
  - `components/modals/SuperBulkActionModal.tsx`: Modal de confirmación para acciones masivas de publicación, ocultamiento, activación o desactivación de compra directa.
  - `components/modals/SuperProductPriceModal.tsx`: Modal rápido para ajustar precio web y perfil tributario DIAN con recálculo automático.
  - `components/modals/SuperProductImagesModal.tsx`: Modal para administrar URLs de imágenes de producto y galería para Supabase Storage.
  - `components/SuperCatalogSkeleton.tsx` & `components/SuperCatalogToast.tsx`: Estados de carga pulidos y sistema de toasts reactivos.
- **Pruebas Automatizadas**:
  - `features/super-catalog/tests/super-catalog.logic.test.ts`: Suite de pruebas unitarias y de negocio ejecutables con `npx tsx`, validando esquemas Zod, cálculo de KPIs, agregación de stock multi-bodega, regla de pocas unidades configurable, no-eliminación de agotados, simulación de carrito hacia pedidos web, RBAC y auditoría inmutable.
- **Ruta y Navegación**:
  - `app/catalogo-supermas/page.tsx`: Ruta oficial Next.js con sidebar activo en "Catálogo Super Más", breadcrumb semántico y footer reglamentario con atribución K&T y año dinámico `new Date().getFullYear()`.
  - Integración en `app/page.tsx` para soporte en el switch de vistas del dashboard.
  - Actualización de los enlaces de navegación en las 18 páginas del sistema (`app/**/page.tsx`) enlazando a `/catalogo-supermas`.

## [2026-09-18] — Módulo Catálogo Distribuidora (Catálogo B2B ↔ ERP)

### Added
- **Base de Datos Simulada Supabase**:
  - `lib/supabase/mock-db/products.json`: Enriquecimiento del modelo maestro de productos con atributos comerciales de canal (`webDistribuidora`, `webSuperMas`, `webDirectPurchaseEnabled`, `webWhatsAppInquiryEnabled`, `webWhatsAppPhone`, `distributorPrice`).
  - Mantenimiento del principio de producto maestro único compartido entre Catálogo Super Más y Catálogo Distribuidora sin duplicación de inventario.
- **Tipos de Auditoría Transversal (`features/audit/`)**:
  - Incorporación de `CATALOG_PRODUCT_UPDATED` y `CATALOG_BULK_UPDATED` a `AuditActionType` para trazabilidad inmutable de publicaciones y cambios de configuración.
- **Capa de Dominio y Lógica (`features/distributor-catalog/`)**:
  - `types/index.ts`: Tipos TypeScript rigurosos para productos de catálogo, estados de disponibilidad comercial (`AVAILABLE`, `LOW_STOCK`, `OUT_OF_STOCK`), estadísticas, filtros, acciones masivas y permisos (`distributor_catalog.*`).
  - `schemas/distributor-catalog.schema.ts`: Validación con Zod para configuración individual de canales (con regla `.refine()` que exige activación en Catálogo Super Más para compra directa), filtros de búsqueda y acciones masivas.
  - `repositories/distributor-catalog.repository.ts`: Repositorio desacoplado que consulta `db.products`, `db.stockLevels`, `db.categories` y `db.brands`. Calcula disponibilidad comercial agregando existencias multi-bodega y sanitiza datos sensibles (costos, márgenes, compras y proveedores nunca expuestos).
  - `services/distributor-catalog.service.ts`: Fachada de negocio con verificación de permisos por rol (`hasPermission`, `assertPermission`), actualización individual y masiva con registro en `auditService.log()`, generación dinámica de enlaces a WhatsApp y exportación a formato CSV.
- **Hooks React**:
  - `hooks/useDistributorCatalog.ts`: Gestión de estado reactivo, búsqueda con debounce, paginación, filtros de categoría/marca/disponibilidad/estados, selección múltiple para acciones masivas, KPIs animados y mutaciones.
  - `hooks/useDistributorCatalogPermissions.ts`: Control de permisos operativos (`canRead`, `canUpdate`, `canPublish`, `canBulkUpdate`, `canPreview`, `canExport`).
- **Componentes de Interfaz de Usuario**:
  - `components/DistributorCatalogPage.tsx`: Vista orquestadora principal con diseño SaaS moderno y micro-animaciones.
  - `components/DistributorCatalogHeader.tsx`: Encabezado semántico con título `<h1>`, descripción y botones de acción (Vista Previa, Exportar CSV, Recargar).
  - `components/DistributorCatalogStats.tsx`: 6 tarjetas KPI con animación `useCountUp`, skeleton loaders e íconos temáticos (Publicados, Ocultos, Disponibles, Agotados, Pocas Unidades, Compra Directa).
  - `components/DistributorCatalogFilters.tsx`: Barra de filtros completos con búsqueda por nombre/SKU/código de barras, categoría, marca, disponibilidad, estado en Distribuidora, estado en Super Más y compra web.
  - `components/DistributorCatalogTable.tsx`: Tabla de alta densidad con badges visuales de canales, disponibilidad multi-bodega con badges temáticos, acciones contextuales (Ver Detalle, Publicar/Ocultar, Configurar Compra, Vista Previa) y barra flotante de acciones masivas.
  - `components/drawers/DistributorProductDetailDrawer.tsx`: Drawer lateral deslizable con ficha técnica del producto, switches de activación de canales, configuración de compra directa, teléfono de WhatsApp y acceso rápido a previsualización cliente.
  - `components/drawers/DistributorProductPreviewModal.tsx`: Modal interactivo que emula la vista real del cliente distribuidor, con galería de imágenes, badges públicos (Disponible/Pocas unidades/Agotado), botón interactivo de WhatsApp con mensaje parametrizado y botón de compra online directa.
  - `components/modals/DistributorBulkActionModal.tsx`: Modal de confirmación para publicaciones u ocultamientos masivos y activación/desactivación masiva de WhatsApp.
  - `components/modals/DistributorDirectPurchaseConfigModal.tsx`: Modal específico para configurar la compra directa y su vinculación con Catálogo Super Más.
  - `components/DistributorCatalogSkeleton.tsx` & `components/DistributorCatalogToast.tsx`: Estados de carga pulidos y sistema de toasts para feedback de operaciones.
- **Pruebas Automatizadas**:
  - `features/distributor-catalog/tests/distributor-catalog.logic.test.ts`: Suite de pruebas unitarias y de negocio ejecutables con `npx tsx`, validando esquemas Zod, cálculo de KPIs, agregación de stock multi-bodega, sanitización de datos sensibles de costo, links de WhatsApp, lógica de compra directa, RBAC y auditoría.
- **Ruta y Navegación**:
  - `app/catalogo-distribuidora/page.tsx`: Ruta oficial Next.js con sidebar activo en "Catálogo Distribuidora", breadcrumb semántico y footer reglamentario con atribución K&T y año dinámico `new Date().getFullYear()`.
  - Integración en `app/page.tsx` para soporte en el switch de vistas del dashboard.
  - Actualización de los enlaces de navegación en las 17 páginas del sistema (`app/**/page.tsx`) enlazando a `/catalogo-distribuidora`.

### Added
- **Base de Datos Simulada Supabase**:
  - `lib/supabase/mock-db/web_orders.json`: Almacén con pedidos representativos en todos los estados (`PENDING`, `CONFIRMED`, `PREPARING`, `READY_TO_DISPATCH`, `SHIPPED`, `DELIVERED`, `CANCELLED`), snapshots históricos de precios, datos de clientes, checklists y eventos de timeline.
  - Integración en `lib/supabase/db.ts` con mapeo de tabla `web_orders` y exportación de `webOrders`.
- **Capa de Dominio y Lógica (`features/web-orders/`)**:
  - `types/index.ts`: Tipos estrictos para pedidos web, estados de entrega, canales (`CATALOGO_SUPERMAS`, `CATALOGO_DISTRIBUIDORA`), checklist de alistamiento, timeline, disponibilidad, métricas y permisos.
  - `schemas/web-order.schema.ts`: Validación Zod para filtros reactivos, checklist de preparación (5/5 puntos obligatorios), despacho a transportadora y motivos de cancelación.
  - `repositories/web-order.repository.ts`: Repositorio con consultas multi-bodega para stock_levels, validación de bodega ecommerce CEDI (`isEcommerceProcessingSource`), creación de ventas (`sales.json`) y facturación electrónica DIAN (`invoices.json`).
  - `services/web-order-status.service.ts`: Máquina de estados con transiciones legales estrictas y control de reserva/liberación de inventario.
  - `services/web-order.service.ts`: Fachada de negocio completa con control de permisos (`web_orders.*`), registro en auditoría transversal (`auditService.log()`) y exportación a CSV.
- **Hooks React**:
  - `hooks/useWebOrders.ts`: Hook con estado reactivo, búsqueda con debounce, paginación, métricas del dashboard y mutaciones del ciclo de vida.
  - `hooks/useWebOrderPermissions.ts`: Hook para control de permisos según rol de usuario.
- **Componentes de Interfaz de Usuario**:
  - `components/WebOrdersPage.tsx`: Contenedor principal orquestador del módulo.
  - `components/WebOrderHeader.tsx`: Header semántico con título `<h1>`, descripción y acciones.
  - `components/WebOrderStats.tsx`: 8 tarjetas KPI con animación `useCountUp`, hover e íconos del sistema.
  - `components/WebOrderFilters.tsx`: Barra de filtros por búsqueda, estado, canal, facturación, método de pago y rango de fechas.
  - `components/WebOrderTable.tsx`: Tabla de pedidos con badges dinámicos de estado, canal, bodega de despacho, facturación y acciones rápidas.
  - `components/drawers/WebOrderDetailDrawer.tsx`: Drawer lateral con timeline interactivo animado, chequeo de disponibilidad en bodega ecommerce, datos de cliente, snapshot histórico de ítems, totales, pagos y facturación.
  - `components/modals/WebOrderPreparationModal.tsx`: Modal con checklist de 5 pasos para alistamiento físico en bodega.
  - `components/modals/WebOrderDispatchModal.tsx`: Modal para asignar transportadora, número de guía, registrar salida de inventario y generar venta oficial en ERP.
  - `components/modals/WebOrderCancelModal.tsx`: Modal de cancelación con motivo obligatorio y liberación inmediata de reserva de stock.
  - `components/WebOrderSkeleton.tsx` & `components/WebOrderToast.tsx`: Skeletons de carga y notificaciones flotantes.
- **Ruta y Navegación**:
  - `app/pedidos-web/page.tsx`: Ruta oficial Next.js con sidebar activo en "Pedidos Web", breadcrumb y footer reglamentario con atribución K&T y año dinámico `new Date().getFullYear()`.
  - Actualización de los enlaces de navegación en todas las páginas de la aplicación (`app/**/page.tsx` y `app/page.tsx`) apuntando a `/pedidos-web`.

## [2026-09-18] — Módulo de Contabilidad Integral

### Added
- **Base de Datos Simulada Supabase**:
  - `lib/supabase/mock-db/accounting_accounts.json`: Plan Único de Cuentas (PUC) colombiano estructurado con clases 1 a 7 (Activos, Pasivos, Patrimonio, Ingresos, Gastos, Costos de Venta, Costos de Producción).
  - `lib/supabase/mock-db/accounting_movements.json`: Libro auxiliar de movimientos contables con fecha, documento origen, cuenta, débito, crédito y bodega.
  - Actualización de `lib/supabase/mock-db/accounting_entries.json` con ciclo transaccional completo (ventas, compras, costo de ventas, recaudos y pagos a proveedores).
  - Integración en `lib/supabase/db.ts` con exportación de `accountingAccounts` y `accountingMovements`.
- **Capa de Dominio y Lógica Contable (`features/accounting/`)**:
  - `types/index.ts`: Tipos completos para PUC, Asientos, Movimientos, Balances, P&L, Costos, Cartera y Permisos.
  - `schemas/accounting.schema.ts`: Validación Zod para cuentas PUC, asientos manuales con verificación de partida doble estricta y reversiones.
  - `repositories/accounting.repository.ts`: Acceso centralizado a datos y operaciones CRUD seguras.
  - `services/accounting-rules.service.ts`: Motor de contabilización automática para compras, ventas, costo de ventas, pagos a proveedores y recaudos de clientes.
  - `services/accounting-report.service.ts`: Generación calculada de Balance General (Ecuación Patrimonial), Estado de Resultados, Libro Diario, Libro Mayor, Cartera CxC/CxP, Costos por producto y bodega, y alimentación para Exógena DIAN.
  - `services/accounting.service.ts`: Fachada de negocio con validación de roles y permisos y registro de auditoría (`auditService.log()`).
- **Hooks React**:
  - `hooks/useAccounting.ts`: Manejo de estado reactivo, filtros, modales, llamadas de servicio y exportación a CSV.
  - `hooks/useAccountingPermissions.ts`: Control de permisos por rol (`accounting.read`, `accounting.accounts`, `accounting.entries`, `accounting.confirm`, `accounting.cancel`, `accounting.reports`, `accounting.costs`, `accounting.config`).
- **Componentes de Interfaz de Usuario**:
  - `components/AccountingPage.tsx`: Shell principal con `ScrollableTabs` para las 10 secciones.
  - `components/AccountingHeader.tsx`: Acciones rápidas (Nuevo asiento, Nueva cuenta, Exportar, Refrescar).
  - `components/tabs/AccountingDashboardTab.tsx`: 9 KPIs animados con `useCountUp`, gráfico comparativo mensual de ingresos vs costos y desglose por bodega.
  - `components/tabs/AccountingAccountsTab.tsx`: Explorador del PUC filtrable por clases 1 a 7, búsqueda y naturalezas.
  - `components/tabs/AccountingEntriesTab.tsx`: Tabla de comprobantes contables con verificación de balance y estados.
  - `components/tabs/AccountingMovementsTab.tsx`: Libro auxiliar con filtros por fecha, cuenta, módulo origen y bodega.
  - `components/tabs/AccountingGeneralJournalTab.tsx`: Libro Diario cronológico con exportación a CSV.
  - `components/tabs/AccountingGeneralLedgerTab.tsx`: Libro Mayor por cuenta contable (saldo inicial, débitos, créditos, saldo final).
  - `components/tabs/AccountingBalanceSheetTab.tsx`: Balance General con comprobación matemática de la ecuación fundamental.
  - `components/tabs/AccountingIncomeStatementTab.tsx`: Estado de Resultados Integral (P&L) con filtro por periodo y bodega.
  - `components/tabs/AccountingCostsTab.tsx`: Sistema analítico de costos (Compra vs Venta, márgenes, promedio ponderado y FIFO).
  - `components/tabs/AccountingReceivablesPayablesTab.tsx`: Control de cartera de clientes (CxC) y proveedores (CxP) con días de vencimiento.
  - `components/tabs/AccountingConfigTab.tsx`: Mapeo contable de inventarios (1435, 6135, 4135), tarifas tributarias y exógena.
  - `components/drawers/AccountingEntryDetailDrawer.tsx`: Vista detallada DEBE vs HABER y reversión contable.
  - `components/drawers/NewManualEntryDrawer.tsx`: Creador de asientos manuales con validador dinámico de partida doble.
  - `components/drawers/NewAccountDrawer.tsx`: Formulario de creación de cuentas PUC.
  - `components/AccountingSkeleton.tsx` & `components/AccountingToast.tsx`: Estados de carga y notificaciones.
- **Ruta de Aplicación**:
  - `app/contabilidad/page.tsx`: Página Next.js con sidebar activo en "Contabilidad", breadcrumb y footer con atribución K&T.
  - Actualización de navegación en las rutas principales del ERP para enlazar directamente a `/contabilidad`.
