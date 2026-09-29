# CHANGELOG AI — Super Más ERP/POS

## [2026-09-29] — PASO 13: Validación Integral del Módulo Contable, Periodos, Cierres y Reportes Financieros en PostgreSQL (Staging)

### Migración Técnica de Hardening Aplicada
- **`024_accounting_periods_puc_and_financial_reports.sql`**:
  - **Centros de Costo Multiempresa (`cost_centers`)**: Adición de columna `company_id UUID REFERENCES companies(id)`, migración de unicidad a `UNIQUE (company_id, code)` y activación de RLS con aislamiento multi-tenant estricto.
  - **Plan Único de Cuentas (`accounting_accounts`)**: Creación de políticas RLS permitiendo consulta para lectura de cuentas maestras activas a usuarios autenticados y restringiendo mutaciones a roles `SUPERADMIN` y `ACCOUNTANT`.
  - **Periodos Contables Multiempresa (`accounting_periods`)**: Reemplazo de restricción global de periodo por unicidad multi-tenant `UNIQUE (company_id, period_code)` y políticas RLS aisladas por empresa.
  - **Protección de Periodos Cerrados (`fn_prevent_entries_on_closed_period`)**: Actualización de la función trigger para validar el estado cerrado estrictamente contra el `company_id` del comprobante contable.
  - **Procedimientos de Cierre y Reapertura de Periodos**:
    - `fn_close_accounting_period(p_company_id, p_period_code, p_closed_by)`: Valida ausencia de comprobantes en borrador (`DRAFT`), audita y totaliza débitos y créditos posted (`total_debits == total_credits`), clausura el periodo e inserta trazabilidad en `public.audit_logs`.
    - `fn_reopen_accounting_period(p_company_id, p_period_code, p_reopened_by, p_reason)`: Exige motivo de reapertura obligatorio, reactiva el periodo a `OPEN` y registra auditoría forense en `public.audit_logs`.
  - **Motor de Reportes Financieros en Base de Datos**:
    - `fn_financial_trial_balance`: Balance de Comprobación (Sumas y Saldos) por cuenta, clase, nivel y naturaleza contable.
    - `fn_financial_daily_journal`: Libro Diario con orden cronológico de comprobantes, terceros y centros de costo.
    - `fn_financial_general_ledger`: Libro Mayor con cálculo acumulativo dinámico de saldo móvil (`running_balance`).
    - `fn_financial_income_statement`: Estado de Resultados / P&L (Ingresos Clase 4, Costos Clases 6 y 7, Gastos Clase 5 y Utilidad Operativa).
    - `fn_financial_balance_sheet`: Balance General y validación matemática de la Ecuación Patrimonial (`Activo = Pasivo + Patrimonio`).
    - `fn_financial_tax_summary`: Reporte tributario integrado de IVA Generado, IVA Descontable, Saldo Neto DIAN y Retenciones en la fuente.

### Validaciones Ejecutadas (100% de Éxito dentro de Transacción con ROLLBACK)
- **1. Estructura y Categorización del PUC (55 Cuentas)**:
  - Clase 1 (Activos): 21 cuentas Débito.
  - Clase 2 (Pasivos): 11 cuentas (9 Crédito, 2 Débito para IVA descontable).
  - Clase 3 (Patrimonio): 4 cuentas Crédito.
  - Clase 4 (Ingresos): 6 cuentas Crédito.
  - Clase 5 (Gastos): 4 cuentas Débito.
  - Clase 6 (Costos de Venta): 7 cuentas Débito.
  - Clase 7 (Costos de Producción): 2 cuentas Débito.
  - Total verificado: 55 cuentas maestras activas.
- **2. Centros de Costo Multiempresa (`cost_centers`)**:
  - Creación de `CC-01` (Ventas Mostrador) y `CC-02` (Administración) en Empresa A.
  - Creación de `CC-01` en Empresa B: admitido sin conflicto gracias a la clave compuesta `(company_id, code)`.
  - Intento de duplicar `CC-01` dentro de Empresa A: Bloqueado por restricción de integridad.
- **3. Periodos Contables y Aislamiento Multiempresa (`accounting_periods`)**:
  - Creación de periodos `2026-08` y `2026-09` en Empresa A (`OPEN`).
  - Creación simultánea de periodo `2026-08` en Empresa B (`OPEN`): comprobado aislamiento sin colisión.
- **4. Asiento Contable Manual y Control de Partida Doble**:
  - Comprobante `AS-202608-001` (Gasto Arrendamiento): Débito 5120 ($2.000.000 COP) vs Crédito 111005 ($2.000.000 COP).
  - Intento de publicación en `POSTED` con descuadre: Bloqueado por `fn_enforce_accounting_double_entry`.
  - Publicación balanceada exitosa: Estado `POSTED`.
- **5. Inmutabilidad de Asientos POSTED**:
  - Intento de alterar fecha o concepto de asiento publicado: Bloqueado con error `23506` por `fn_prevent_posted_accounting_mutation`.
  - Intento de eliminar asiento publicado: Bloqueado con error `23506` por `fn_prevent_posted_accounting_mutation`.
  - Intento de eliminar o modificar líneas de asiento publicado: Bloqueado con error `23506` por `fn_prevent_posted_entry_lines_mutation`.
- **6. Asiento Automático de Compra Comercial con Retención e IVA**:
  - Comprobante `AS-202608-002`:
    - Débito 143501 (Inventario Harinas): $10.000.000 COP
    - Débito 240810 (IVA Descontable 19%): $1.900.000 COP
    - Crédito 236540 (Retención en la fuente compras 2.5%): $250.000 COP
    - Crédito 220505 (Proveedores Nacionales): $11.650.000 COP
    - Total Débito: $11.900.000 COP == Total Crédito: $11.900.000 COP (`POSTED`).
- **7. Asiento Automático de Venta Comercial POS con Costo de Ventas**:
  - Comprobante `AS-202608-003`:
    - Débito 110505 (Recaudo Efectivo Caja General): $17.850.000 COP
    - Crédito 413501 (Ingresos Operacionales Víveres): $15.000.000 COP
    - Crédito 240805 (IVA Generado 19%): $2.850.000 COP
    - Débito 613501 (Costo de Ventas): $8.000.000 COP
    - Crédito 143501 (Salida de Inventario al Costo): $8.000.000 COP
    - Total Débito: $25.850.000 COP == Total Crédito: $25.850.000 COP (`POSTED`).
- **8. Cierre Contable de Periodo 2026-08**:
  - Ejecución de `fn_close_accounting_period` para Empresa A:
    - Comprobantes procesados: 3 (`POSTED`).
    - Total débitos: $39.750.000,00 COP | Total créditos: $39.750.000,00 COP.
    - Estado actualizado a `CLOSED`, sellado con fecha, usuario y auditoría.
- **9. Bloqueo de Movimientos Extemporáneos en Periodo Cerrado**:
  - Intento de insertar nuevo comprobante con fecha en `2026-08` para Empresa A: Bloqueado por `fn_prevent_entries_on_closed_period` con error `23506`.
  - Verificación de Empresa B operando en su propio `2026-08`: Inserción permitida porque su periodo permanece `OPEN`.
- **10. Reapertura de Periodo con Motivo**:
  - Intento de reapertura sin justificación: Rechazado con excepción.
  - Reapertura justificada exitosa: Estado `OPEN` con registro en `public.audit_logs`.
  - Re-cierre formal ejecutado para completar auditoría de reportes.
- **11. Verificación de Reportes Financieros**:
  - **Balance de Comprobación**: Total Débitos = $39.750.000 COP == Total Créditos = $39.750.000 COP (Cuadre 100%).
  - **Libro Diario**: 11 líneas cronológicas debidamente estructuradas con documentos de soporte.
  - **Libro Mayor**: Cuenta 143501 (Inventario) con saldo inicial $0, débito $10.000.000, crédito $8.000.000 y saldo acumulado final $2.000.000 COP.
  - **Estado de Resultados**: Ingresos ($15.000.000) - Costos ($8.000.000) = Utilidad Bruta ($7.000.000) - Gastos ($2.000.000) = Utilidad Operativa neta de $5.000.000 COP.
  - **Balance General**: Activos ($17.850.000 COP) == Pasivo + Patrimonio ($17.850.000 COP) $\rightarrow$ Diferencia: $0,00 COP (`esta_balanceado = true`).
- **12. Verificación Tributaria y Cruce DIAN**:
  - IVA Generado (19% ventas): $2.850.000 COP.
  - IVA Descontable (19% compras): $1.900.000 COP.
  - Saldo Neto IVA a Pagar a DIAN: $950.000 COP.
  - Retención en la fuente practicada en compras: $250.000 COP.
- **13. Seguridad y Permisos RLS**:
  - Rol `CASHIER`: Bloqueado por RLS al intentar registrar comprobantes contables.
  - Rol `ACCOUNTANT` Empresa B: 0 filas visibles al consultar `accounting_entries` y `accounting_periods` de Empresa A.
- **14. Confirmación de Rollback y Cero Residuos**:
  - Rollback completado limpiamente: Todas las tablas comerciales, contables y de auditoría retornaron a 0 registros.

---

## [2026-09-29] — PASO 12: Validación Real de Compras, Proveedores, Kardex y Tesorería en PostgreSQL (Staging)

### Migración Técnica de Hardening Aplicada
- **`023_purchases_treasury_and_bank_hardening.sql`**:
  - Asignación del permiso `suppliers.read` al rol `ACCOUNTANT` en `public.role_permissions` para permitir auditoría y causación de pagos a terceros.
  - Aislamiento multi-tenant RLS en `public.bank_accounts` y `public.bank_movements`, reemplazando directivas legacy que permitían fugas en cuentas con `location_id = NULL`.
  - Creación de política RLS `Tenant isolation update treasury_payments` permitiendo el cambio formal a `PAID` y dispersión de recursos por tesorería.
  - Creación del disparador de inmutabilidad `trg_prevent_paid_payment_deletion` / `fn_prevent_paid_payment_deletion()` que bloquea la eliminación física de pagos ya desembolsados en `public.treasury_payments`.

### Validaciones Ejecutadas (100% de Éxito dentro de Transacción con ROLLBACK)
- **1. Creación de Proveedor (`suppliers`)**:
  - Registro de proveedor comercial `Disnalimentos S.A.S.` (NIT: 900555444-1, contacto: Mauricio Restrepo, plazo comercial: 30 días) con aislamiento estricto de `company_id`.
- **2. Creación de Producto y Stock Base Previo**:
  - Producto `Leche Entera Colanta 1L` (SKU `SKU-LECHE-1L`, código de barras `7709876543210`, umbral mínimo: 20 unds).
  - Stock previo inicial: 50 unds @ $3.000 COP $\rightarrow$ Stock: 50.00 unds, Costo Promedio: $3.000,00 COP, Valoración: $150.000,00 COP.
- **3. Bloqueo de Usuario no Autorizado (CASHIER) en Compras**:
  - Simulación RLS de usuario con rol `CASHIER` intentando registrar orden de compra.
  - Bloqueo RLS estricto: `new row violates row-level security policy for table "purchases"`.
- **4. Orden de Compra Registrada por WAREHOUSE_ADMIN**:
  - Orden `COM-2026-0001` (Factura Proveedor: `FAC-DISNAL-88990`): 100 unds @ $3.600 COP.
  - Subtotal: $360.000 COP, IVA 19%: $68.400 COP, Total Factura: $428.400 COP, Estado: `PENDING`.
- **5. Recepción de Mercancía y Recálculo Matemático de Costo Promedio Ponderado**:
  - Recepción confirmada (`inventory_status = 'RECEIVED'`) e ingreso al Kardex (`PURCHASE_ENTRY`).
  - Ponderación matemática automática: $\frac{150.000 + 360.000}{150} = \frac{510.000}{150} = \$3.400,00$ COP exactos.
  - Existencias resultantes verificadas: 150.00 unds, Costo Promedio: $3.400,00 COP, Valoración total: $510.000,00 COP, Estado: `AVAILABLE`.
- **6. Inmutabilidad de Compras Recibidas**:
  - Intento de eliminación física en `purchases`: Bloqueado por trigger `fn_prevent_received_purchase_deletion`.
- **7. Contabilización en Partida Doble PUC con Retenciones**:
  - Asiento de causación de compra `CP-2026-0001` publicado (`POSTED`):
    - Débito 1435 (Inventario Mercancías): $360.000 COP
    - Débito 2408 (IVA Descontable 19%): $68.400 COP
    - Crédito 2365 (Retención en la Fuente 2.5% compras): $9.000 COP
    - Crédito 2205 (Proveedores Nacionales - Cuenta por pagar neta): $419.400 COP
    - Total Débito: $428.400 COP == Total Crédito: $428.400 COP (Partida doble exacta).
- **8. Cuentas por Pagar y Dispersión de Pago en Tesorería**:
  - Creación de cuenta bancaria institucional `Bancolombia S.A.` (Saldo: $5.000.000 COP).
  - Comprobante `PAG-2026-0001` por $419.400 COP registrado en `treasury_payments` (`status = 'PAID'`).
  - Estado de compra actualizado a `payment_status = 'PAID'`.
  - Saldo bancario actualizado a $4.580.600 COP y movimiento bancario de egreso (`CREDIT`) registrado.
  - Intento de eliminación física del pago desembolsado: Bloqueado por trigger `trg_prevent_paid_payment_deletion`.
- **9. Contabilización del Desembolso en Partida Doble PUC**:
  - Asiento de egreso de tesorería `CP-2026-0002` publicado (`POSTED`):
    - Débito 2205 (Proveedores Nacionales - Cancelación de pasivo): $419.400 COP
    - Crédito 1110 (Bancos - Salida de fondos): $419.400 COP
    - Total Débito: $419.400 COP == Total Crédito: $419.400 COP.
- **10. Devolución a Proveedor (`SUPPLIER_RETURN`) en Kardex**:
  - Devolución de 10 unds por fecha corta de vencimiento.
  - Movimiento `SUPPLIER_RETURN`: 10 unds descontadas a costo promedio $3.400 COP.
  - Existencias verificadas: 140.00 unds restantes, Valoración: $476.000,00 COP.
- **11. Nota Débito al Proveedor y Reversión Contable**:
  - Asiento de Nota Débito `CP-2026-0003` publicado (`POSTED`):
    - Débito 2205 (Saldo a favor / Menor pasivo con proveedor): $41.940 COP
    - Débito 2365 (Reversión retención en la fuente): $900 COP
    - Crédito 1435 (Salida de inventario devuelto a costo de compra): $36.000 COP
    - Crédito 2408 (Reversión proporcional de IVA descontable 19%): $6.840 COP
    - Total Débito: $42.840 COP == Total Crédito: $42.840 COP (Partida doble exacta).
- **12. Aislamiento Multi-Tenant y Multi-Sede**:
  - Usuario de Empresa B consultando proveedores, compras, cuentas bancarias y pagos de Empresa A: 0 registros visibles en todas las consultas.
- **13. Auditoría Forense Inmutable (`audit_logs`)**:
  - 4 eventos registrados (creación de proveedor, recepción de compra, desembolso de pago, devolución a proveedor).
  - Intento de alteración o borrado físico: Bloqueado por trigger `trg_prevent_audit_log_mutation`.
- **14. Rollback Estricto y Verificación Post-Test**:
  - `ROLLBACK;` ejecutado con éxito total.
  - Conteo final en PostgreSQL Staging:
    `suppliers = 0`, `purchases = 0`, `purchase_items = 0`, `treasury_payments = 0`, `bank_accounts = 0`, `bank_movements = 0`, `stock_levels = 0`, `inventory_movements = 0`, `accounting_entries = 0`, `accounting_entry_lines = 0`, `audit_logs = 0`, `products = 0`.
    Preservadas intactas las 3 entidades legítimas: `companies = 1`, `locations = 1`, `users = 1`.

## [2026-09-29] — PASO 11: Validación Real de Ventas / POS y Facturación Electrónica DIAN en PostgreSQL (Staging)

### Migración Técnica de Hardening Aplicada
- **`022_sales_invoicing_and_stock_guard.sql`**:
  - Restricción física `chk_stock_levels_non_negative CHECK (quantity >= 0)` en `public.stock_levels` para evitar a nivel de motor existencias negativas.
  - Hardening en trigger `process_inventory_movement()`: valida stock disponible y bloquea con excepción `55000` (`Stock insuficiente...`) cualquier intento de overselling en inserción inicial y salidas acumuladas.
  - Función y trigger de inmutabilidad `trg_prevent_invoice_deletion` / `fn_prevent_invoice_deletion()` sobre `public.electronic_invoices` impidiendo la eliminación física de facturas DIAN emitidas.
  - Políticas RLS completas para `public.electronic_invoices` (aislamiento multi-tenant estricto por `company_id` y por sede autorizada vía `has_location_access`).
  - Asignación de permisos de facturación POS (`invoices.create`, `invoices.read`) al rol `CASHIER`.

### Validaciones Ejecutadas (100% de Éxito dentro de Transacción con ROLLBACK)
- **1. Creación de Cliente (`customers`)**:
  - Registro de cliente fiscal `Juan David Pérez Restrepo` (CC: 1020304050, tipo: INDIVIDUAL, categoría: RETAIL) con asignación estricta de `company_id`.
- **2. Creación de Producto y Entrada Inicial en Kardex**:
  - Producto `Aceite Vegetal Premier 1L` (SKU `SKU-ACEITE-1L`, código de barras `7701234567890`, umbral mínimo: 5 unds).
  - Entrada inicial `PURCHASE_ENTRY`: 50 unds @ $8.000 COP $\rightarrow$ Stock: 50.00 unds, Costo Promedio: $8.000,00 COP, Valor Total Costo: $400.000,00 COP, Estado: `AVAILABLE`.
- **3. Prevención de Venta sin Stock Suficiente (Overselling Blocking)**:
  - Intento de salida por 60 unds cuando solo existían 50 unds en bodega.
  - Bloqueo inmediato por excepción del motor: `"Stock insuficiente para el producto ... en la bodega ... Stock disponible: 50.00, Solicitado: 60.00 unidades."`
  - Stock intacto verificado en 50.00 unds.
- **4. Bloqueo de Usuario no Autorizado intentando Vender**:
  - Usuario con rol `ACCOUNTANT` intentó insertar registro en `sales`.
  - Bloqueo RLS estricto: `new row violates row-level security policy for table "sales"`.
- **5. Venta POS Exitosa por Cajero Autorizado**:
  - Cajero autorizado operando en Sede Principal registró venta POS de 10 unds @ $10.000 COP base.
  - Subtotal: $100.000 COP, IVA 19%: $19.000 COP, Total Venta: $119.000 COP.
  - Costo de venta: 10 x $8.000 = $80.000 COP.
  - Utilidad estimada: $20.000 COP calculada automáticamente por columna generada STORED (`estimated_profit_amount`).
- **6. Descuento Automático en Kardex y Recálculo de Stock**:
  - Movimiento `SALE_OUT` procesado atómicamente por trigger.
  - Stock actualizado: 40.00 unds restantes, Costo Promedio inalterado ($8.000,00 COP), Valoración total: $320.000,00 COP, Estado: `AVAILABLE`.
- **7. Generación de Factura Electrónica DIAN e Impuestos**:
  - Factura `SETP-990000001` emitida y vinculada a la venta.
  - Base Gravable: $100.000 COP, IVA 19%: $19.000 COP, Total: $119.000 COP.
  - Generación de CUFE hash y enlace QR oficial catálogo DIAN, estado `ACCEPTED`.
- **8. Inmutabilidad de Ventas y Facturas Electrónicas**:
  - Intento de eliminación física en `sales`: Denegado por trigger `fn_prevent_sale_deletion`.
  - Intento de eliminación física en `electronic_invoices`: Denegado por trigger `fn_prevent_invoice_deletion`.
- **9. Contabilización en Partida Doble PUC**:
  - Asiento `CC-2026-0001` registrado y publicado (`POSTED`):
    - Débito 1105 (Caja General): $119.000 COP
    - Crédito 4135 (Comercio al por Mayor y Menor): $100.000 COP
    - Crédito 2408 (Impuesto IVA generado 19%): $19.000 COP
    - Débito 6135 (Costo de Ventas): $80.000 COP
    - Crédito 1435 (Mercancías no fabricadas / Inventario): $80.000 COP
    - Total Débito: $199.000 COP == Total Crédito: $199.000 COP.
  - Intento de modificación sobre asiento POSTED: Bloqueado por trigger `trg_prevent_posted_accounting_mutation`.
- **10. Aislamiento Multi-Tenant y Multi-Sede**:
  - Cajero de Empresa B consultando `sales` y `electronic_invoices`: 0 registros de Empresa A.
  - Vendedor asignado a Sede Envigado consultando ventas de Sede Principal: 0 registros visibles.
- **11. Devolución de Venta (`CUSTOMER_RETURN`) y Reingreso en Kardex**:
  - Cliente devolvió 2 unds por inconformidad de empaque.
  - Movimiento `CUSTOMER_RETURN`: +2 unds reingresadas a costo unitario $8.000 COP.
  - Stock resultante verificado: 42.00 unds, Valoración total: $336.000,00 COP.
- **12. Emisión de Nota Crédito DIAN y Reversión Contable**:
  - Nota Crédito `NC-990000001` emitida por $23.800 COP (Subtotal: $20.000, IVA 19%: $3.800).
  - Asiento de reversión `CC-2026-0002` publicado (`POSTED`):
    - Débito 4135 (Menor ingreso por devolución): $20.000 COP
    - Débito 2408 (IVA devuelto): $3.800 COP
    - Crédito 1105 (Reembolso efectivo al cliente): $23.800 COP
    - Débito 1435 (Reingreso de mercancía a costo): $16.000 COP
    - Crédito 6135 (Reversión costo de venta): $16.000 COP
    - Total Débito: $39.800 COP == Total Crédito: $39.800 COP.
- **13. Auditoría Forense Inmutable (`audit_logs`)**:
  - 4 eventos registrados (creación cliente, emisión factura, devolución, nota crédito).
  - Intento de alteración o borrado físico: Bloqueado por trigger `trg_prevent_audit_log_mutation`.
- **14. Rollback Estricto y Verificación Post-Test**:
  - `ROLLBACK;` ejecutado con éxito total.
  - Verificación final en PostgreSQL Staging:
    `customers = 0`, `sales = 0`, `sale_items = 0`, `electronic_invoices = 0`, `stock_levels = 0`, `inventory_movements = 0`, `accounting_entries = 0`, `accounting_entry_lines = 0`, `audit_logs = 0`, `products = 0`.
    Preservadas intactas las 3 entidades legítimas: `companies = 1`, `locations = 1`, `users = 1`.

## [2026-09-29] — PASO 10: Validación Real de Kardex y Recálculo Atómico de Stock en PostgreSQL (Staging)

### Validaciones Ejecutadas (100% de Éxito dentro de Transacción con ROLLBACK)
- **Entradas y Costo Promedio Ponderado Matemático**:
  - Entrada Inicial (`PURCHASE_ENTRY`): 100 unds @ $2.000 COP $\rightarrow$ Stock: 100.00 unds, Costo Promedio: $2.000,00 COP, Valor Total Costo: $200.000,00 COP.
  - Segunda Entrada (`PURCHASE_ENTRY`): 50 unds @ $2.600 COP $\rightarrow$ Ponderación matemática automática: $\frac{(100 \times 2000) + (50 \times 2600)}{150} = \frac{330.000}{150} = \$2.200,00$ COP exactos. Total valor: $330.000,00 COP.
- **Salidas de Inventario (Ventas)**:
  - Salida comercial (`SALE_OUT`): 60 unds deducidas del stock $\rightarrow$ Saldo: 90.00 unds, Costo Unitario preservado inmutablemente en $2.200,00 COP, Valor Total Costo: $198.000,00 COP.
- **Devoluciones (Cliente y Proveedor)**:
  - Devolución de Cliente (`CUSTOMER_RETURN`): +10 unds reingresadas al stock $\rightarrow$ Saldo: 100.00 unds, Costo: $2.200,00 COP.
  - Devolución a Proveedor (`SUPPLIER_RETURN`): -15 unds por garantía $\rightarrow$ Saldo: 85.00 unds, Costo: $2.200,00 COP.
- **Ajustes de Inventario y Transiciones de Salud (`health_status`)**:
  - Ajuste Positivo (`POSITIVE_ADJUSTMENT`): +5 unds por conteo físico $\rightarrow$ Saldo: 90.00 unds.
  - Ajuste Negativo (`NEGATIVE_ADJUSTMENT`): -82 unds por merma $\rightarrow$ Saldo: 8.00 unds. Al ser $\le$ al umbral `min_stock` (10), el trigger transicionó automáticamente el estado a `LOW_STOCK`.
  - Agotamiento Total (`SALE_OUT`): Venta de las últimas 8 unds $\rightarrow$ Saldo: 0.00 unds. El trigger transicionó automáticamente el estado a `OUT_OF_STOCK` preservando el último costo promedio histórico ($2.200,00 COP).
- **Inmutabilidad de `stock_levels`**:
  - Intentos de `UPDATE` directo e `INSERT` directo desde cliente autenticado: Denegados por RLS (`new row violates row-level security policy`).
  - Confirmado: `stock_levels` muta exclusivamente a través de `inventory_movements` mediante el trigger `process_inventory_movement()`.
- **Aislamiento Multi-Bodega y Multi-Tenant**:
  - Multi-Bodega (Misma Empresa A, Bodega 1 Medellín vs Bodega 2 Envigado): Entrada de 40 unds @ $2.500 en Bodega 2 mantuvo intacto el saldo en 0.00 unds de Bodega 1 y generó existencia independiente de 40.00 unds en Bodega 2.
  - Multi-Tenant (Empresa A vs Empresa B): Entrada de 75 unds @ $3.200 en Bodega de Empresa B. Usuario de Empresa A únicamente visualizó sus 2 registros propios (cero visibilidad de Empresa B). Usuario de Empresa B únicamente visualizó su registro propio en Kardex (cero visibilidad de Empresa A).
- **Rollback Transaccional y Comprobación Post-Test**:
  - `ROLLBACK;` ejecutado con éxito. Verificación en PostgreSQL Staging:
    `companies = 1`, `locations = 1`, `users = 1`, `products = 0`, `stock_levels = 0`, `inventory_movements = 0`, `sales = 0`, `purchases = 0`, `accounting_entries = 0`, `audit_logs = 0`. Cero datos residuales.

## [2026-09-29] — PASO 9: Pruebas Reales de RLS, Permisos y Aislamiento en PostgreSQL (Staging)

### Validaciones Ejecutadas (100% de Éxito dentro de Transacción con ROLLBACK)
- **Multiempresa (Aislamiento Estricto entre Tenants)**:
  - Usuario de Empresa B consultando `public.products`, `public.companies` y `public.locations`: Recibe 0 registros de Empresa A.
  - Inserción cruzada de Empresa B asignando `company_id` de Empresa A: Denegada por RLS `WITH CHECK`.
- **Roles y Permisos Atómicos**:
  - `products.read/create/update/delete`: WAREHOUSE_ADMIN crea productos; CASHIER y SELLER bloqueados de creación y edición; WAREHOUSE_ADMIN bloqueado de eliminación; ADMIN autorizado a eliminar.
  - `inventory.read/adjust`: CASHIER bloqueado de realizar ajustes de inventario; WAREHOUSE_ADMIN autorizado (+20 unds); trigger `process_inventory_movement()` actualizó atómicamente `stock_levels` a 20.00 unds con estado `AVAILABLE`.
  - `sales.create`: ACCOUNTANT bloqueado; SELLER autorizado; CASHIER autorizado en terminal POS.
  - `purchases.create`: CASHIER bloqueado; WAREHOUSE_ADMIN autorizado.
  - `accounting.read/create`: SELLER bloqueado; ACCOUNTANT autorizado para comprobantes en `DRAFT`.
  - `treasury.read/create`: CASHIER bloqueado; ACCOUNTANT autorizado para dispersión de pagos.
- **Inventario e Inmutabilidad de Kardex**:
  - Intento de `UPDATE` directo sobre `stock_levels`: Denegado por ausencia de directiva UPDATE en RLS.
  - Intento de `DELETE` sobre `inventory_movements` desde cliente: Denegado por RLS (0 filas).
  - Intento de `DELETE` sobre `inventory_movements` en motor PostgreSQL: Denegado por trigger `trg_prevent_kardex_mutation` (`Kardex inmutable`).
- **Contabilidad e Inmutabilidad de Asientos POSTED**:
  - Comprobante con partida doble formal publicado a `POSTED`.
  - Intento de `UPDATE` sobre asiento `POSTED`: Denegado por trigger `trg_prevent_posted_accounting_mutation`.
  - Intento de `DELETE` sobre asiento `POSTED`: Denegado por trigger `trg_prevent_posted_accounting_mutation`.
  - Intento de `DELETE` sobre líneas contables de asiento `POSTED`: Denegado por trigger `trg_prevent_posted_entry_lines_mutation`.
- **Auditoría (`audit_logs`)**:
  - Intento de `INSERT` directo desde cliente autenticado: Denegado por RLS.
  - Inserción fiduciaria vía backend (`service_role`): Autorizada.
  - Consulta por ACCOUNTANT con permiso `audit.read`: Autorizada dentro de su empresa.
  - Consulta por Empresa B: Denegada (0 filas de Empresa A).
  - Intento de `UPDATE` y `DELETE` sobre `audit_logs`: Denegados por trigger `trg_prevent_audit_log_mutation`.
- **Rollback Garantizado y Comprobación Post-Test**:
  - Ejecutado `ROLLBACK;`. Conteo verificado en PostgreSQL Staging:
    `companies = 1`, `locations = 1`, `users = 1`, `products = 0`, `stock_levels = 0`, `inventory_movements = 0`, `sales = 0`, `purchases = 0`, `accounting_entries = 0`, `accounting_entry_lines = 0`, `treasury_payments = 0`, `treasury_receipts = 0`, `audit_logs = 0`. Cero contaminación de datos.

### Migraciones Técnicas de Hardening Aplicadas
- `017_fix_inventory_movement_trigger_cast.sql`: Casteo explícito a `::stock_health_status` y propagación de `company_id` en `stock_levels` dentro de `process_inventory_movement()`.
- `018_drop_legacy_audit_policies.sql`: Eliminación de directivas legacy de migración 009 en `audit_logs` para forzar inserción exclusiva server-side.
- `019_treasury_rls_and_permissions.sql`: Registro de permisos `treasury.read`/`treasury.create` y blindaje multi-tenant de `treasury_payments` y `treasury_receipts`.
- `020_granular_inventory_movement_rls.sql`: Política granular en `inventory_movements` por tipo de movimiento (`inventory.adjust` requerido para ajustes manuales).
- `021_cashier_sales_read_permission.sql`: Otorgamiento de permiso `sales.read` al rol `CASHIER` para terminal POS y operaciones con `RETURNING`.

## [2026-09-26] — Validación de Seguridad Paso 0: RLS Estricto, Bootstrap Inexpugnable e Inmutabilidad Fiduciaria

### Blindaje de Seguridad y Eliminación de Brechas
- **Reestructuración de Bootstrap del SUPERADMIN (supabase/migrations/014_system_roles_and_first_admin_flow.sql, scripts/bootstrap-first-admin.ts)**:
  - Eliminada la dependencia de raw_user_meta_data para autorización de superadministrador. Se utiliza exclusivamente raw_app_meta_data administrada server-side mediante service_role.
  - Implementado bloqueo transaccional con advisory lock de PostgreSQL (pg_advisory_xact_lock) para serializar peticiones de creación y neutralizar condiciones de carrera en registros concurrentes (solo 1 SUPERADMIN puede ser creado).
  - El registro público abierto permanece estrictamente deshabilitado.
- **Matriz RLS Definitiva por Operación (Tenant + Location + Rol + Permisos)**:
  - Desacopladas todas las políticas FOR ALL en directivas granulares por operación (SELECT, INSERT, UPDATE, DELETE).
  - products: SELLER y CASHIER solo poseen permiso de lectura (products.read). Se les deniega INSERT/UPDATE/DELETE.
  - stock_levels: Prohibido INSERT, UPDATE y DELETE para clientes normales (solo SELECT autorizado). La modificación de stock reside exclusivamente en el trigger process_inventory_movement() con privilegios SECURITY DEFINER originado desde Kardex.
  - inventory_movements: Inmutable. Permitido SELECT e INSERT autorizado. Triggers bloqueadores para UPDATE y DELETE (fn_prevent_kardex_mutation).
  - sales y purchases: Ventas emitidas y compras recibidas inmutables contra DELETE (fn_prevent_sale_deletion, fn_prevent_received_purchase_deletion). Las anulaciones requieren flujo de negocio y notas contables.
  - accounting_entries y accounting_entry_lines: Asientos en DRAFT editables por usuarios autorizados; asientos en POSTED inmutables contra edición y eliminación (fn_prevent_posted_accounting_mutation).
  - audit_logs: Solo lectura para roles autorizados (audit.read). UPDATE y DELETE prohibidos con trigger de inmutabilidad (fn_prevent_audit_log_mutation).
- **Aislamiento de Service Role en Frontend (lib/supabase/index.ts)**:
  - Eliminado export * from "./admin" del barrel central @/lib/supabase para garantizar que SUPABASE_SERVICE_ROLE_KEY jamás sea importada ni empaquetada en bundles cliente.
- **Suite de Pruebas de Seguridad A-J (scripts/test-security-onboarding.ts)**:
  - 10 pruebas obligatorias (A a J) implementadas y ejecutadas con 100% de éxito: CASHIER no edita productos, SELLER no edita stock_levels, WAREHOUSE_ADMIN opera Kardex y actualiza stock vía trigger, aislamiento multi-tenant, inmutabilidad de Kardex, asientos POSTED, neutralización de metadata maliciosa y control de concurrencia en bootstrap.

## [2026-09-25] — Auditoría Profunda: Módulos de Contabilidad y Auditoría Sin Datos Mock

### Desacoplamiento Total de Datos Ficticios y Purificación
- **Limpieza de Catálogos y Registros Ficticios (`lib/supabase/mock-db/`)**:
  - `accounting_accounts.json`: 55 cuentas del catálogo PUC colombiano purificadas a `balance: 0`. Se preservan códigos, nombres, clases, naturalezas y niveles; se elimina cualquier saldo monetario previo.
  - `accounting_periods.json`: 12 periodos contables reiniciados con `entriesCount: 0`, `totalDebits: 0`, `totalCredits: 0` y `status: OPEN`.
  - `audit_logs.json`: Reiniciado a colección vacía `[]`. Se eliminan logs falsos, usuarios simulados e IPs de prueba.
  - `accounting_entries.json`, `accounting_entry_lines.json`, `accounting_movements.json`: Reiniciados a colecciones vacías `[]`.
- **Servicio de Reportes Contables (`accounting-report.service.ts`)**:
  - `getDashboard()`: Eliminado arreglo de puntos mensuales hardcodeados (`198M`, `215M`, `232M`, `242M`). Implementado cálculo dinámico agrupando movimientos contables reales por mes. Si no hay movimientos, retorna ceros reales.
  - `getIncomeStatement()`: Eliminado fallback hardcodeado `1250000` de ingresos no operacionales; se utiliza `0`.
  - `getGeneralLedger()`: Eliminado `Math.max(finalBalance, account.balance)`. El saldo final se calcula estrictamente como `Saldo Inicial + Débitos - Créditos` (o viceversa según naturaleza).
  - `getAuxiliaryLedgerReport()`: Eliminado factor ficticio de apertura `* 0.75`. El saldo inicial se deriva exclusivamente de movimientos anteriores al corte.
  - `getWarehouseFinancials()`: Eliminados fallbacks hardcodeados (`84200000`, `62500000`, `25.8%`, `124500000`, `18450000`, `24200000`, `18`). Ahora calcula ventas, costos, inventario valorizado y carteras reales desde las entidades correspondientes.
  - `getCostAnalysis()`: Eliminado fallback de stock `|| 120` y sobrecosto artificial `* 1.02`.
- **Repositorio Contable (`accounting.repository.ts`)**:
  - Implementado método `withDynamicBalances()`: Calcula el saldo de cada cuenta en tiempo real desde `db.accountingMovements`. Si no hay movimientos, todas las cuentas reportan $0.
  - `getPeriods()`: Calcula dinámicamente `entriesCount`, `totalDebits` y `totalCredits` agrupando los comprobantes reales de cada periodo.
- **Estados Vacíos Formales en la Interfaz UI**:
  - `AccountingGeneralJournalTab.tsx` (Libro Diario): Si `entries.length === 0`, muestra *"No existen movimientos contables"* y oculta contadores, fechas y totales en cero.
  - `AccountingGeneralLedgerTab.tsx` (Libro Mayor): Si una cuenta no tiene movimientos, muestra *"Sin movimientos para el periodo seleccionado"* y oculta tarjetas de saldos generadas manualmente.
  - `AccountingBalanceSheetTab.tsx` (Balance General): Si los saldos son 0, muestra *"Sin información financiera disponible"* y oculta tablas y tarjetas vacías.
  - `AccountingIncomeStatementTab.tsx` (Estado de Resultados): Si ingresos, costos y gastos son 0, muestra *"Sin información financiera disponible"*.
  - `AccountingDashboardTab.tsx`: Banner informativo cuando no existen comprobantes, empty state para gráfica mensual y mensaje de sin bodegas.
  - `AuditStats.tsx` & `AuditTable.tsx`: Muestra *"Sin actividad"* en lugar de *"Consolidado"*, y *"No existen eventos de auditoría"* cuando no hay registros.
- **Validación Fases 8 y 9**:
  - Fase 8: Verificada base vacía (0 asientos, 0 líneas, 0 movimientos, 0 auditorías, 0 ventas, 0 compras).
  - Fase 9: Prueba transitoria con 1 asiento ($100.000 Débito / $100.000 Crédito), 1 venta ($100.000) y 1 log de auditoría. Los reportes calcularon exactamente $100.000 y se revirtieron completamente a estado limpio.

---

## [2026-09-24] — Verificación Final de Seguridad: Onboarding, Guardas de Empresa y Aislamiento RLS

### Security & Multi-Tenant Enforcement
- **Prueba 1: Asignación de Roles en Primer Arranque**:
  - Validada regla del trigger `handle_new_auth_user()`:
    - Primer usuario en Supabase Auth (`count = 0`) -> `SUPERADMIN` automático.
    - Segundo usuario y subsiguientes -> Reciben `SELLER` por defecto o el rol explícito asignado.
    - Bloqueo de auto-asignación de privilegios de superadministrador en registros abiertos.
- **Prueba 2: Guardas Operativas sin Empresa Configurada**:
  - `sales.service.ts`: Bloqueo a nivel de backend al crear ventas si la empresa no cuenta con NIT y Razón Social configurados, arrojando el mensaje: *"Configure la empresa antes de operar."*.
  - `SalesPage.tsx`: Renderizado de banner informativo de alerta y deshabilitación del botón *"Nueva Venta"* hasta completar la configuración legal.
  - `POSView.tsx`: Banner de advertencia en caja registradora y bloqueo de cobro/checkout ante empresa no configurada con enlace directo a `/configuracion`.
- **Prueba 3: Aislamiento Multiempresa Row Level Security (RLS)**:
  - Migración 014 enriquecida con la función `public.get_auth_company_id()`.
  - Políticas RLS aplicadas sobre `sales`, `products`, `customers`, `suppliers`, `purchases` y `stock_levels` condicionadas a `company_id = public.get_auth_company_id()`.
  - Verificado aislamiento total: El Usuario A (Empresa A) no puede acceder ni visualizar ningún registro perteneciente al Usuario B (Empresa B).
- **Suite de Pruebas Automatizadas (`scripts/test-security-onboarding.ts`)**:
  - Ejecutada con 100% de éxito cubriendo las 3 pruebas de seguridad solicitadas.
- **Corrección en Renderizado de Gráficas de Dashboard (`DashboardChartsSection.tsx`)**:
  - Solucionado error `TypeError: undefined is not an object (evaluating 'salesPoints[salesPoints.length - 1].x')` al iniciar con base de datos limpia con 0 ventas.
  - Implementadas guardas `hasSalesPoints`, `hasPurchasesPoints` y `hasProfitPoints` para que los cálculos de trayectorias SVG sólo se ejecuten cuando existen puntos en el periodo.
- **Estandarización de Modales y Drawers de Ventas (`features/sales/components/`)**:
  - `NewSaleDrawer.tsx`: Implementado `createPortal(..., document.body)` con montaje dinámico y bloqueo de scroll de fondo (`overflow: hidden`). El panel del drawer ahora se renderiza anidado dentro del backdrop con `z-index: 1000000`, sobreponiéndose por completo a la barra de navegación, barra lateral y cualquier contenedor relativo.
  - Actualizados igualmente con `createPortal`: `SaleDetailDrawer.tsx`, `SaleCancelModal.tsx`, `SaleInvoiceModal.tsx` y `SaleRemissionModal.tsx`.

---


### Pure Supabase Auth & Zero-Credential Bootstrap
- **Migración PostgreSQL DDL 014 (`supabase/migrations/014_system_roles_and_first_admin_flow.sql`)**:
  - Inserción idempotente de los 6 roles inmutables del sistema en `public.roles`: `SUPERADMIN`, `ADMIN`, `WAREHOUSE_ADMIN`, `POINT_ADMIN`, `ACCOUNTANT`, `SELLER` y `CASHIER`.
  - Inserción de la matriz completa de permisos atómicos en `public.permissions` y asignación al rol `SUPERADMIN` en `public.role_permissions`.
  - Actualización del trigger `public.handle_new_auth_user()`: Si `public.users` está vacía (`COUNT(*) = 0`), el primer usuario que se registre en Supabase Auth es promovido automáticamente a `SUPERADMIN`. Los usuarios subsiguientes reciben el rol asignado o `SELLER`.
- **Eliminación Total de Usuarios en Seeds y Scripts**:
  - `scripts/seed-clean-initial-data.ts`: Eliminado cualquier insert a `public.users` o `company_settings`.
  - La autenticación depende al 100% de `auth.users` de Supabase Auth (hashing criptográfico, JWT, sesiones).
  - La empresa, bodegas, productos, clientes y proveedores se crean fiduciariamente por el usuario administrador desde la interfaz web tras su primer inicio de sesión.

---


### Core Architectural Decoupling & Clean Supabase Readiness
- **Supabase Clients & Safe Fallback Query Builder (`lib/supabase/client.ts`, `server.ts`, `admin.ts`)**:
  - Implementado query builder resiliente para operaciones sobre Supabase PostgreSQL.
  - Soporte garantizado para consultas `.from(table).select()`, `insert()`, `update()`, `delete()`, `eq()`, `order()`, `limit()`, `range()` que devuelven estructuras válidas `{ data: [], error: null, count: 0 }` ante tablas vacías sin lanzar excepciones runtime.
- **Limpieza de Base Central (`lib/supabase/db.ts`)**:
  - Desacopladas todas las colecciones comerciales de los archivos JSON de prueba.
  - Inicialización limpia con arrays vacíos `[]` para todas las entidades operativas: `locations`, `products`, `productPrices`, `stockLevels`, `inventoryMovements`, `sales`, `saleItems`, `purchases`, `purchaseItems`, `transfers`, `transferItems`, `remissions`, `remissionItems`, `customers`, `suppliers`, `accountingEntries`, `accountingEntryLines`, `accountingMovements`, `cashRegisters`, `cashSessions`, `webOrders`, etc.
  - Preservación exclusiva de tablas maestras de arranque del sistema: `taxConfigs` (tarifas DIAN 19%, 5%, 0%), `accountingAccounts` (catálogo PUC base), `accountingPeriods` (periodo 2026), configuraciones maestras (`companySettings`, `inventorySettings`, `posSettings`, `ecommerceSettings`, `alertRules`) y usuario administrador para inicio de sesión seguro.
- **Desacoplamiento en Mocks de Features**:
  - `features/products/mocks/product.mock.ts` -> exporta `productsMock = []`.
  - `features/inventory/mocks/inventory.mock.ts` -> exporta `stockLevelsMock = []`.
  - `features/kardex/mocks/kardex.mock.ts` -> exporta `kardexMovementsMock = []`.
  - `features/transfers/mocks/transfers.mock.ts` -> exporta `transfersMock = []`.
  - `features/warehouses/mocks/warehouses.mock.ts` -> exporta `warehousesMock = []`.
  - `features/dashboard/mocks/dashboard.mock.ts` -> exporta arrays vacíos y métricas iniciales en cero.
- **Repositorios y Servicios con Resiliencia a Base Vacía**:
  - `ProductRepository`, `InventoryRepository`, `KardexRepository`, `WarehouseRepository`: Operan sobre arrays limpios sin auto-sembrado forzado de datos de prueba; soportan altas iniciales de stock mediante ajustes positivos en productos nuevos sin inventario previo.
  - `WarehouseService`: `getWarehouseOverviewAnalytics` maneja catálogos vacíos retornando arrays limpios sin fallas de cálculo.
  - `TransferService`: Mapeo de opciones de bodega con soporte de costo promedio 0 por defecto.
  - `DashboardService`: Métricas con fallback a cero e indicadores sin porcentajes inventados.
- **Diseño de Estados Vacíos (Empty States) Profesionales y Fidedignos**:
  - **Dashboard**: Muestra *"Sin información disponible"* y *"Sin datos suficientes"* en lugar de cifras ficticias. Gráficas SVG de ventas y dona de inventario muestran paneles de estado vacío dedicados con llamada a la acción.
  - **Productos**: *"No hay productos registrados"* con botón *"Crear primer producto"*.
  - **Inventario**: *"No existen productos con inventario disponible"*.
  - **Kardex**: *"No hay movimientos registrados"*.
  - **Bodegas**: *"No hay bodegas configuradas"* con botón *"Crear nueva bodega"*.
  - **Clientes**: *"No existen clientes registrados"* con botón de registro.
  - **Proveedores**: *"No existen proveedores registrados"* con botón de creación.
  - **Compras**: *"No hay compras realizadas"*.
  - **Ventas**: *"No hay ventas registradas"*.
  - **POS**: Abre e interactúa fluidamente con 0 productos, 0 clientes y 0 existencias mostrando avisos amigables sin romper la ejecución.
  - **Contabilidad**: *"No existen movimientos contables para este periodo"* en Balances, Movimientos y Asientos; prevención de divisiones por cero (`NaN%`) en Estado de Resultados.
- **Script de Arranque Limpio (`scripts/seed-clean-initial-data.ts`)**:
  - Creado script para sembrar únicamente configuraciones base y usuario administrador sin generar registros transaccionales ni comerciales.
- **Verificación Completa**:
  - `pnpm exec tsc --noEmit` -> 0 errores.
  - `pnpm run build` -> 39/39 rutas compiladas exitosamente en Turbopack.
  - Tests unitarios y de lógica en `products`, `dashboard`, `warehouses`, `customers`, `suppliers`, `accounting` y `settings` al 100% de éxito.

---


### Enhanced UI/UX
- **Filtros Libro Auxiliar Contable (`AccountingMovementsTab.tsx`)**:
  - Se homogeneizó el selector de periodo (`Por Mes`, `Por Año`, `Rango de Fechas`) implementando el estándar visual de la aplicación con `.period-segmented-tabs` y `.period-tab-btn`.
  - Integración nativa del componente `<DateRangeFilter>` del ERP para selección de rangos con atajos rápidos y selector emergente en modo `RANGE`.
  - Estilos consistentes con `.filter-select-wrap` con iconos temáticos (`calendar`, `clock`, `users`, `warehouse`, `table`) para los selectores de Mes, Año, Tercero, Bodega y Cuenta PUC.
  - Accesos rápidos en píldoras con feedback interactivo y botón de limpieza de filtros.

---

## [2026-09-24] — Corrección Final Modelo de Datos, Normalización Relacional y Certificación Pre-Supabase

### Added & Normalized
- **Normalización de Tablas Hijas**:
  - `sale_items.json` desacoplada formalmente de `sales.json` (15 registros relacionales con `saleId`, `productId`, `unitPrice`, `unitCost`, `discountAmount`, `taxAmount`, `subtotal`, `total`).
  - `purchase_items.json` desacoplada de `purchases.json` (8 registros con `purchaseId`, `productId`, `unitCost`, `taxAmount`, `subtotal`, `total`).
  - `transfer_items.json` desacoplada de `transfers.json` (7 registros con `requestedQuantity`, `sentQuantity`, `receivedQuantity`, `unitCost`).
  - `remission_items.json` desacoplada de `remissions.json` (7 registros con `quantityRequested`, `quantityDelivered`, `unitCost`, `unitPrice`).
  - `cash_sessions.json` desacoplada de cajas físicas `cash_registers.json` (turnos de caja con arqueo, faltantes/sobrantes, ventas en efectivo y medios electrónicos).
  - `product_prices.json` creada como matriz multitarifa normalizada (44 registros: Público, Mayorista, Distribuidor, Institucional y Promocional).
  - `accounting_entry_lines.json` desacoplada de `accounting_entries.json` (18 líneas con códigos PUC, débitos, créditos y terceros).
- **Multiempresa y Multibodega**:
  - Incorporado `company_id` / `companyId` (`comp-001`) transversalmente en todas las tablas maestras y transaccionales para soporte directo de Row Level Security (RLS).
  - Verificado `locationId` en inventario, ventas, compras, transferencias, cajas y tesorería.
  - El stock físico reside estrictamente en `stock_levels` (`productId + locationId`) con Kardex inmutable en `inventory_movements`.
- **Servicios y Repositorios**:
  - `SalesRepository.getItems(saleId)`: consulta relacional de líneas de venta.
  - `PurchaseRepository.getItems(purchaseId)`: consulta relacional de detalle de compra.
  - `TransferRepository.getItems(transferId)`: consulta relacional de líneas de traslado.
  - `RemissionRepository.getItems(remissionId)`: consulta relacional de líneas de remisión.
  - `ProductRepository.getPrices(productId)` y `ProductRepository.getStockLevels(productId)`: consultas desacopladas de listas de precios y existencias.
  - `POSRepository.getActiveSession(registerId)` y `POSRepository.getSessions(filter)`: gestión relacional de turnos.
- **Migración DDL PostgreSQL 013**:
  - `supabase/migrations/013_pre_supabase_audit_and_model_fixes.sql`:
    - Foreign keys multiempresa `company_id` con índices dedicados.
    - DDL de tabla `product_prices`.
    - Trigger PL/pgSQL `fn_enforce_accounting_double_entry()` que bloquea comprobantes descuadrados al asentar.
    - Políticas RLS para aislamiento estricto de empresas.
- **Suite de Pruebas de Integridad Pre-Supabase (`scripts/test-model-integrity.ts`)**:
  - 39 pruebas automáticas ejecutadas al 100% de éxito cubriendo Fase 10 (Integridad), Fase 11 (JOINs) y Fase 13 (Simulación de día completo).

---

## [2026-09-24] — Reestructuración y Corrección Funcional del Módulo Contable, Tesorería y Facturación DIAN

### Added & Enhanced
- **1. Libro Auxiliar Contable por Cuenta y Periodo (`features/accounting/`)**:
  - **Consulta Práctica por Periodo**: Se modificó la vista del Libro Auxiliar para superar la limitación de visualización por asiento aislado. Permite seleccionar modo de periodo (Mes, Año, Rango libre de fechas) y consultar el comportamiento consolidado de cualquier cuenta (Caja `1105`, Bancos `1110`, Clientes `1305`, Materias Primas `1405`, Prod. en Proceso `1410`, Prod. Terminados `1430`, Mercancías `1435`, Proveedores `2205`, Ventas `4135`, Costos `6135`).
  - **Panel Financiero Resumen Agrupado**: Muestra en tiempo real:
    - *Saldo Inicial*: Calculado sumando el saldo de apertura más todos los movimientos débitos/créditos netos anteriores a la fecha de inicio del periodo.
    - *Movimientos Débito (+)*: Total cargado a la cuenta en el periodo.
    - *Movimientos Crédito (-)*: Total abonado a la cuenta en el periodo.
    - *Saldo Final*: Resultado balanceado según la naturaleza de la cuenta (Débito: Saldo Inicial + Débito - Crédito; Crédito: Saldo Inicial + Crédito - Débito).
  - **Filtros Avanzados y Drill-Down**: Filtros por Cuenta PUC, Rango de Fecha, Tercero (Clientes y Proveedores) y Centro de Costo / Bodega. Botón "Ver Asiento" que abre el drawer con el comprobante completo. Exportación a CSV oficial del libro auxiliar.

- **2. Plan de Cuentas PUC Multiclase de Inventarios**:
  - Se extendió el catálogo contable en `accounting_accounts.json` para soportar las 4 clases de inventarios:
    - *Materias Primas* (`1405`, cuentas `140501`, `140502`) con contrapartida de consumo en `710501`.
    - *Productos en Proceso* (`1410`, cuenta `141001`) con contrapartida de costo en `612001`.
    - *Productos Terminados* (`1430`, cuenta `143001`) con contrapartida de costo en `612001`.
    - *Mercancías para la Venta* (`1435`, cuenta `143501`) con contrapartida de costo en `613501`.
  - **Relación Productos → Categoría Contable Inventario → Cuenta Contable**: Modelado en `products.json` (`inventoryType`), `accounting.repository.ts` (`categoryMappings`) y `AccountingConfigTab.tsx` con selector de tipo de inventario, badges visuales y configuración dinámica en base de datos sin datos quemados en componentes.

- **3. Módulo Independiente de Tesorería (`features/treasury/`, `/tesoreria`)**:
  - Se desacopló la gestión operativa de pagos y recaudos del módulo contable, creando el módulo de **Tesorería**.
  - **Responsabilidades de Tesorería**: Cuentas bancarias y saldos disponibles, programación de desembolsos a proveedores (CXP), recibos de caja y recaudos de clientes (CXC), conciliación bancaria.
  - **Flujo Canónico con Contabilidad**: Factura Compra Proveedor → Tesorería programa pago → Desembolso ejecutado en banco → Contabilidad genera automáticamente el asiento oficial con partida doble (`Débito: 220505 Proveedores, Crédito: 111005 Bancos`).
  - Registro de Tesorería en navegación global (`components/navigation/modules.ts`) y banner bidireccional en la pestaña de Cartera de Contabilidad (`AccountingReceivablesPayablesTab.tsx`).

- **4. Separación Estricta de Prefijos y Numeración (ERP vs. DIAN)**:
  - Se eliminó la ambigüedad entre el consecutivo interno del ERP y la autorización fiscal DIAN.
  - **Campos en Entidad Invoice y Base de Datos**:
    - `internalNumber` (`internal_number`): Identificador único interno del ERP (ej: `FAC-00025`, `VENTA-000001`, `NC-000100`).
    - `dianPrefix`: Prefijo autorizado por la DIAN (ej: `FE`, `POS`, `NC`).
    - `dianNumber`: Número consecutivo autorizado por la DIAN (ej: `1250`).
    - `dianResolution`: Número de resolución DIAN vigente (ej: `18764000001`).
    - `dianRange`: Rango autorizado oficial (ej: `1000 - 50000`).
  - Tabla relacional y mock `dian_resolutions.json` / `dian_resolutions` para controlar rangos autorizados y vigencia de resoluciones. Visualización clara en tablas y cajones de detalle de facturación.

- **5. Persistencia y Migraciones PostgreSQL Multi-Bodega con Auditoría**:
  - Actualizada migración DDL en `supabase/migrations/011_accounting_treasury_and_dian_separation.sql` con las tablas `dian_resolutions`, `bank_accounts`, `treasury_payments`, `treasury_receipts`, `bank_movements`, incorporando en todas: `company_id`, `location_id`, `created_by_user_id`, `updated_by_user_id`, `created_at`, `updated_at`, índices dedicados y políticas Row Level Security (RLS) integradas con `has_location_access(location_id)`.

- **6. Periodos Contables, Cierres Mensuales y Bloqueo de Meses Cerrados (`accounting_periods` / Migración 012)**:
  - Creada tabla y migración PostgreSQL `supabase/migrations/012_accounting_periods_and_notes.sql` junto con el almacén mock `accounting_periods.json`.
  - **Bloqueo Estricto de Meses Clausurados**: En `accounting.service.ts` (`assertPeriodOpen`), `accounting-rules.service.ts` y mediante el trigger PL/pgSQL `fn_prevent_entries_on_closed_period()`, el sistema bloquea tajantemente la creación, modificación, causación o reversión de comprobantes en periodos con estado `CLOSED` (ej: Enero a Agosto 2026).
  - **Reapertura Autorizada y Auditada**: Métodos `closePeriod` y `reopenPeriod` con validación de permiso `accounting.periods`, justificación formal obligatoria y registro inmutable en `auditService.log()`.

- **7. Soporte para Notas Contables y Ajustes Formales**:
  - Se extendió el tipo `AccountingSourceType` para soportar:
    - *Nota Crédito (`CREDIT_NOTE`)*: Devoluciones y rebajas comerciales.
    - *Nota Débito (`DEBIT_NOTE`)*: Gastos financieros, intereses y cargos suplementarios.
    - *Ajuste Contable (`ACCOUNTING_ADJUSTMENT`)*: Depreciaciones, provisiones, reclasificaciones de activos y pasivos.
    - *Cierre Anual (`CLOSING_ENTRY`)*: Cancelación de cuentas de resultados contra la 5905 Pérdidas y Ganancias.

---

## [2026-09-19] — Corrección y Modernización de Gráficas de Rendimiento y Stock en Bodegas

### Fixed & Enhanced
- **Módulo de Bodegas (`features/warehouses/components/detail/tabs/WarehouseOverviewTab.tsx`)**:
  - **Gráfica de Rendimiento Comercial (Izquierda)**:
    - Se eliminó el falso trazado estático simulado por CSS (`.line-chart:after` con `skewY(-9deg)` en `globals.css`) que trazaba una línea diagonal recta desconectada de los puntos.
    - Se implementó una gráfica SVG interactiva y receptiva con curvas de Bézier cúbicas (`M ... C ...`), relleno en degradado según la métrica (`#fe110c` para Ventas y `#159a67` para Utilidad), línea de referencia discontinua para el Promedio Semanal (`#001b5c`), líneas guía horizontales con valores monetarios formateados en COP, etiquetas de días en el eje X y tooltips flotantes al pasar el cursor o pulsar en móviles.
    - Soporte interactivo para alternar entre "Ventas" y "Utilidad", recalculando la escala, curvas y métricas acumuladas en tiempo real.
  - **Gráfica de Distribución de Stock por Categoría (Derecha)**:
    - Se reemplazó el falso borde circular CSS (`border: 17px solid` de 4 esquinas fijas) que mostraba "0 Líneas activas" por un gráfico Donut SVG auténtico.
    - Cada categoría (`Granos y Abastos`, `Despensa y Aceites`, `Lácteos y Refrigerados`, `Bebidas y Líquidos`, `Enlatados y Otros`) cuenta con su segmento SVG proporcional con color distintivo (`#fe110c`, `#001b5c`, `#159a67`, `#d99117`, `#6366f1`).
    - Sincronización bidireccional entre los segmentos de la dona y la lista de categorías lateral: al pasar el ratón por un segmento o por una categoría, se resalta la cuña y el centro muestra el porcentaje, nombre y valor.
    - El centro de la dona ahora muestra dinámicamente el conteo real de líneas activas (`totalActiveLines`) o los detalles de la categoría seleccionada, eliminando el "0 Líneas activas".
- **Corrección de Mapeo y Null-Safety en Pestañas de Detalle de Bodega**:
  - **Pestaña de Ventas (`WarehouseSalesTab.tsx`)**: Se corrigió el error en tiempo de ejecución `TypeError: undefined is not an object (evaluating 's.saleCode.toLowerCase')`. El origen se debía a que los datos mock de ventas almacenaban `saleNumber` en lugar de `saleCode`. Se añadió resolución defensiva `s.saleCode || (s as any).saleNumber || ''` y validación contra valores nulos en cliente y búsqueda.
  - **Mocks de Bodega (`features/warehouses/mocks/warehouses.mock.ts`)**: Se normalizó el mapeo de `MOCK_SALES`, `MOCK_PURCHASES`, `MOCK_CUSTOMERS_RELATION` y `MOCK_SUPPLIERS_RELATION` transformando las propiedades de la base de datos mock (`saleNumber -> saleCode`, `totalProfit -> profitAmount`, `displayName -> customerName`, `deliveriesCount`, `currentBalance`, etc.) para cumplir de forma estricta con las interfaces TypeScript.
  - **Pestañas de Compras, Clientes, Proveedores, Movimientos y Transferencias (`WarehousePurchasesTab.tsx`, `WarehouseCustomersTab.tsx`, `WarehouseSuppliersTab.tsx`, `WarehouseMovementsTab.tsx`, `WarehouseTransfersTab.tsx`)**: Se blindaron todos los filtros de búsqueda y renderizado de tablas con operadores seguros y fallbacks contra campos no definidos o vacíos.
- **Repositorio de Bodegas (`features/warehouses/repositories/warehouse.repository.ts`)**:
  - En `findInventoryByLocationId` y `findMovementsByLocationId`, se incorporó siembra de catálogo para ubicaciones secundarias (`PTO-002`, etc.) para evitar que muestren inventario vacío o ceros cuando se consulta cualquier bodega del sistema.

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
