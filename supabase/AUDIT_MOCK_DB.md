# ==============================================================================
# ARCHIVO DE AUDITORÍA Y ESPECIFICACIÓN DE MIGRACIÓN: MOCK-DB -> SUPABASE
# ERP SUPER MÁS S.A.S. (COLOMBIA)
# Total archivos analizados: 42 JSONs
# ==============================================================================

Este documento detalla el mapeo formal de cada uno de los 42 archivos de datos de `lib/supabase/mock-db/`
hacia su tabla correspondiente en Supabase PostgreSQL, incluyendo relaciones, tipos de datos
y los aspectos marcados estrictamente como "PENDIENTE DE DEFINICIÓN".

---

## GRUPO 1: IDENTIDAD, EMPRESA Y CONFIGURACIÓN GLOBAL

### 1. `company_settings.json` -> Tabla: `companies`
- **Propósito**: Datos institucionales, tributarios y de contacto de la persona jurídica. Preparada para soporte multiempresa futuro.
- **Campos principales**:
  - `id`: UUID (PK)
  - `business_name`: TEXT (Razón social)
  - `trade_name`: TEXT (Nombre comercial)
  - `tax_id`: VARCHAR(20) (NIT)
  - `verification_digit`: VARCHAR(1) (DV)
  - `tax_regime`: VARCHAR(50) (Régimen tributario)
  - `economic_activity_code`: VARCHAR(10) (Código CIIU)
  - `legal_representative_name`: TEXT
  - `legal_representative_doc`: VARCHAR(30)
  - `address`: TEXT
  - `city`: VARCHAR(100)
  - `department`: VARCHAR(100)
  - `country`: VARCHAR(50) DEFAULT 'Colombia'
  - `phone`: VARCHAR(50)
  - `email`: VARCHAR(150)
  - `invoice_email`: VARCHAR(150)
  - `logo_url`: TEXT
  - `currency`: VARCHAR(5) DEFAULT 'COP'
  - `status`: VARCHAR(20) DEFAULT 'ACTIVE'
  - `created_at`: TIMESTAMPTZ
  - `updated_at`: TIMESTAMPTZ
- **Relaciones**: 1:N con `locations`, 1:N con `tax_configs`.
- **Información faltante / Pendiente**:
  - PENDIENTE DE DEFINICIÓN: Código CIIU secundario y tarifas ICA municipales aplicables.

### 2. `locations.json` -> Tabla: `locations`
- **Propósito**: Nodos físicos de la red logística (CEDI, bodegas satélite y puntos de venta/tiendas mostrador).
- **Campos principales**:
  - `id`: UUID (PK)
  - `company_id`: UUID (FK -> companies.id)
  - `code`: VARCHAR(20) UNIQUE (Código homologado de bodega)
  - `name`: VARCHAR(150)
  - `type`: VARCHAR(30) ('WAREHOUSE' | 'STORE_POINT' | 'DISTRIBUTION_CENTER')
  - `status`: VARCHAR(20) DEFAULT 'ACTIVE'
  - `address`: TEXT
  - `city`: VARCHAR(100)
  - `department`: VARCHAR(100)
  - `phone`: VARCHAR(50)
  - `email`: VARCHAR(150)
  - `manager_name`: VARCHAR(150)
  - `manager_email`: VARCHAR(150)
  - `manager_phone`: VARCHAR(50)
  - `description`: TEXT
  - `is_ecommerce_source`: BOOLEAN DEFAULT false (Bodega de despacho web)
  - `is_store_point`: BOOLEAN DEFAULT false (Habilitada para ventas mostrador)
  - `allow_inventory_ops`: BOOLEAN DEFAULT true
  - `allow_sales`: BOOLEAN DEFAULT true
  - `allow_purchases`: BOOLEAN DEFAULT true
  - `allow_transfers`: BOOLEAN DEFAULT true
  - `auto_block_zero_stock`: BOOLEAN DEFAULT true
  - `low_stock_threshold_percent`: NUMERIC(5,2) DEFAULT 15.00
  - `created_at`: TIMESTAMPTZ
  - `updated_at`: TIMESTAMPTZ
- **Relaciones**: FK -> companies.id; 1:N con `stock_levels`, `cash_registers`, `user_locations`.
- **Información faltante / Pendiente**:
  - PENDIENTE DE DEFINICIÓN: Formato de nomenclatura final del código de bodega (ej. BOD-xxx vs SEDE-xxx).

### 3. `settings.json` -> Tabla: `system_settings`
- **Propósito**: Diccionario dinámico key-value para parámetros operativos transversales, banderas del sistema y políticas.
- **Campos principales**:
  - `id`: UUID (PK)
  - `key`: VARCHAR(100) UNIQUE
  - `category`: VARCHAR(50)
  - `value`: JSONB (soporta boolean, number, string u objeto)
  - `type`: VARCHAR(20) ('BOOLEAN' | 'NUMBER' | 'STRING' | 'JSON')
  - `description`: TEXT
  - `is_critical`: BOOLEAN DEFAULT false
  - `requires_audit`: BOOLEAN DEFAULT true
  - `updated_by_user_id`: UUID
  - `updated_at`: TIMESTAMPTZ
- **Relaciones**: Sin FK directa para permitir flexibilidad, referenciada en auditoría.
- **Información faltante / Pendiente**: Ninguna.

### 4. `inventory_settings.json`, `pos_settings.json`, `ecommerce_settings.json`
- **Propósito**: Sub-configuraciones de los módulos especializados. Se normalizan como registros en `system_settings` y como columnas especializadas en `locations` o `companies`.
- **Información faltante / Pendiente**:
  - PENDIENTE DE DEFINICIÓN: Método de costeo contable oficial (Promedio Ponderado vs PEPS/FIFO sujeto a dictamen del revisor fiscal).

---

## GRUPO 2: PRODUCTOS, MARCAS, CATEGORÍAS Y STOCK MULTI-BODEGA

### 5. `categories.json` -> Tabla: `categories`
- **Campos**: `id` (UUID), `name`, `slug`, `code`, `description`, `parent_id` (auto-relación jerárquica), `is_active`, `sort_order`, `created_at`.
- **Relaciones**: 1:N con `products`.

### 6. `brands.json` -> Tabla: `brands`
- **Campos**: `id` (UUID), `name`, `slug`, `logo_url`, `is_active`, `created_at`.
- **Relaciones**: 1:N con `products`.

### 7. `products.json` -> Tabla: `products` (Catálogo Maestro Único)
- **Propósito**: Única fuente de verdad de los productos del ERP. No se duplican para canales de venta.
- **Campos principales**:
  - `id`: UUID (PK)
  - `sku`: VARCHAR(50) UNIQUE NOT NULL
  - `barcode`: VARCHAR(50) UNIQUE
  - `name`: VARCHAR(255) NOT NULL
  - `slug`: VARCHAR(255) UNIQUE
  - `short_description`: TEXT
  - `full_description`: TEXT
  - `category_id`: UUID (FK -> categories.id)
  - `brand_id`: UUID (FK -> brands.id)
  - `unit_of_measure`: VARCHAR(20) NOT NULL (UND, PAQ, KG, etc.)
  - `cost_price`: NUMERIC(15,2) NOT NULL DEFAULT 0.00
  - `public_sale_price`: NUMERIC(15,2) NOT NULL DEFAULT 0.00
  - `wholesale_price`: NUMERIC(15,2) NOT NULL DEFAULT 0.00
  - `min_wholesale_quantity`: INTEGER DEFAULT 12
  - `tax_rate_percent`: NUMERIC(5,2) DEFAULT 19.00
  - `is_tax_exempt`: BOOLEAN DEFAULT false
  - `primary_image_url`: TEXT
  - `secondary_images`: JSONB DEFAULT '[]'
  - `min_stock_threshold`: INTEGER DEFAULT 10
  - `critical_stock_threshold`: INTEGER DEFAULT 5
  - `is_active`: BOOLEAN DEFAULT true
  - `is_published_supermas`: BOOLEAN DEFAULT true (Catálogo B2C)
  - `is_published_distributor`: BOOLEAN DEFAULT true (Catálogo B2B)
  - `created_at`: TIMESTAMPTZ
  - `updated_at`: TIMESTAMPTZ
- **Relaciones**: FK -> categories, brands; 1:N con `stock_levels`, `inventory_movements`, `sale_items`, `purchase_items`.
- **Información faltante / Pendiente**:
  - PENDIENTE DE DEFINICIÓN: Definición de código arancelario / partidas para posibles importaciones.

### 8. `stock_levels.json` & `warehouse_inventory.json` -> Tabla: `stock_levels`
- **Propósito**: Agregado instantáneo de lectura de existencias por producto y bodega física (`productId + locationId`).
- **Campos**:
  - `id`: UUID (PK)
  - `product_id`: UUID (FK -> products.id, UNIQUE compuesto con location_id)
  - `location_id`: UUID (FK -> locations.id)
  - `quantity`: NUMERIC(12,2) NOT NULL DEFAULT 0.00
  - `reserved_quantity`: NUMERIC(12,2) NOT NULL DEFAULT 0.00 (Apartado para pedidos web no despachados)
  - `available_quantity`: GENERATED ALWAYS AS (quantity - reserved_quantity) STORED
  - `average_cost`: NUMERIC(15,2) NOT NULL DEFAULT 0.00
  - `total_value_at_cost`: GENERATED ALWAYS AS (quantity * average_cost) STORED
  - `min_stock`: INTEGER DEFAULT 10
  - `max_stock`: INTEGER DEFAULT 1000
  - `health_status`: VARCHAR(20) ('AVAILABLE' | 'LOW_STOCK' | 'CRITICAL' | 'OUT_OF_STOCK')
  - `last_movement_at`: TIMESTAMPTZ
  - `updated_at`: TIMESTAMPTZ
- **Regla crítica**: EL STOCK NUNCA SE ACTUALIZA ARBITRARIAMENTE SIN UN REGISTRO EN `inventory_movements`.

---

## GRUPO 3: KARDEX Y MOVIMIENTOS DE INVENTARIO

### 9. `inventory_movements.json`, `product_movements.json`, `warehouse_movements.json` -> Tabla: `inventory_movements` (Kardex Inmutable)
- **Propósito**: Fuente histórica y contable de verdad absoluta de todas las entradas y salidas de existencias. No se permite DELETE ni UPDATE físico.
- **Campos principales**:
  - `id`: UUID (PK)
  - `consecutive`: BIGSERIAL UNIQUE
  - `product_id`: UUID (FK -> products.id)
  - `location_id`: UUID (FK -> locations.id)
  - `movement_type`: VARCHAR(40) ('PURCHASE_ENTRY' | 'SALE_OUT' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'POSITIVE_ADJUSTMENT' | 'NEGATIVE_ADJUSTMENT' | 'RETURN')
  - `quantity_in`: NUMERIC(12,2) DEFAULT 0.00
  - `quantity_out`: NUMERIC(12,2) DEFAULT 0.00
  - `previous_stock`: NUMERIC(12,2) NOT NULL
  - `new_stock`: NUMERIC(12,2) NOT NULL
  - `unit_cost`: NUMERIC(15,2) NOT NULL
  - `total_cost`: NUMERIC(15,2) NOT NULL
  - `document_type`: VARCHAR(30) ('PURCHASE_INVOICE' | 'SALE_INVOICE' | 'REMISSION' | 'TRANSFER_ORDER' | 'STOCK_ADJUSTMENT')
  - `document_reference`: VARCHAR(100) NOT NULL
  - `reason`: TEXT
  - `user_id`: UUID (FK -> users.id)
  - `created_at`: TIMESTAMPTZ DEFAULT NOW()
- **Información faltante / Pendiente**:
  - PENDIENTE DE DEFINICIÓN: Manejo de números de lote y fecha de vencimiento (requerido a futuro para perecederos).

### 10. `transfers.json`, `transfer_locations.json`, `transfer_availability.json` -> Tablas: `transfers` y `transfer_items`
- **Propósito**: Despacho y recepción controlada de existencias entre dos sedes físicas.
- **Campos `transfers`**: `id`, `code` (TR-xxx), `origin_location_id`, `destination_location_id`, `status` ('PENDING' | 'IN_TRANSIT' | 'RECEIVED' | 'REJECTED'), `dispatch_date`, `receipt_date`, `created_by_user_id`, `received_by_user_id`, `notes`.
- **Campos `transfer_items`**: `id`, `transfer_id` (FK), `product_id` (FK), `requested_quantity`, `sent_quantity`, `received_quantity`, `unit_cost`.

---

## GRUPO 4: VENTAS, CAJAS POS Y CLIENTES

### 11. `customers.json`, `customer_documents.json`, `customer_payments.json` -> Tablas: `customers` y `customer_payments`
- **Campos `customers`**: `id`, `document_type` ('CC' | 'NIT' | 'CE' | 'PASSPORT'), `document_number`, `verification_digit`, `first_name`, `last_name`, `company_name`, `customer_type` ('INDIVIDUAL' | 'COMPANY'), `customer_category` ('RETAIL' | 'WHOLESALE' | 'VIP'), `email`, `phone`, `address`, `city`, `department`, `credit_limit`, `current_balance`, `is_active`.

### 12. `cash_registers.json` y `cash_movements.json` -> Tablas: `cash_registers`, `cash_sessions`, `cash_movements`
- **Propósito**: Gestión estricta de terminales de punto de venta, arqueos de caja, bases y diferencias.
- **Campos `cash_sessions`**: `id`, `cash_register_id` (FK), `user_id` (FK cajero), `opening_time`, `closing_time`, `opening_float`, `expected_cash_amount`, `counted_cash_amount`, `difference_amount`, `status` ('OPEN' | 'CLOSED'), `supervisor_notes`.
- **Campos `cash_movements`**: `id`, `session_id`, `type` ('DEPOSIT' | 'WITHDRAWAL' | 'SALE_CASH' | 'REFUND'), `amount`, `reason`, `authorized_by_user_id`.

### 13. `sales.json` -> Tablas: `sales` y `sale_items`
- **Propósito**: Registro mercantil de ventas de mostrador POS y comerciales.
- **Campos `sales`**:
  - `id`: UUID (PK)
  - `location_id`: UUID (FK -> locations.id)
  - `sale_number`: VARCHAR(50) UNIQUE (VTA-2026-xxxx)
  - `customer_id`: UUID (FK -> customers.id)
  - `seller_user_id`: UUID (FK -> users.id)
  - `cash_session_id`: UUID (FK -> cash_sessions.id, nullable si es venta remota)
  - `subtotal_amount`: NUMERIC(15,2) NOT NULL
  - `discount_amount`: NUMERIC(15,2) DEFAULT 0.00
  - `tax_amount`: NUMERIC(15,2) DEFAULT 0.00
  - `total_amount`: NUMERIC(15,2) NOT NULL
  - `total_cost_amount`: NUMERIC(15,2) NOT NULL (Cálculo del servidor)
  - `estimated_profit_amount`: GENERATED ALWAYS AS (total_amount - tax_amount - total_cost_amount) STORED
  - `payment_method`: VARCHAR(30) ('CASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'BANK_TRANSFER' | 'CREDIT' | 'MIXED')
  - `status`: VARCHAR(20) ('ISSUED' | 'PENDING' | 'CANCELLED')
  - `invoice_id`: UUID (FK -> electronic_invoices.id, nullable si no se emitió factura electrónica inmediata)
  - `created_at`: TIMESTAMPTZ DEFAULT NOW()
- **Campos `sale_items`**: `id`, `sale_id` (FK), `product_id` (FK), `quantity`, `unit_cost`, `unit_price`, `discount_percent`, `tax_rate_percent`, `tax_amount`, `subtotal`, `total`.

---

## GRUPO 5: COMPRAS, PROVEEDORES Y DOCUMENTOS DE GASTO

### 14. `suppliers.json` & `purchases.json` -> Tablas: `suppliers`, `purchases`, `purchase_items`, `supplier_payments`
- **Campos `suppliers`**: `id`, `tax_id` (NIT), `verification_digit`, `name`, `legal_name`, `contact_name`, `email`, `phone`, `address`, `city`, `payment_terms_days`, `is_active`.
- **Campos `purchases`**: `id`, `purchase_number` (COM-2026-xxxx), `supplier_invoice_number`, `supplier_id` (FK), `location_id` (FK bodega destino), `issue_date`, `due_date`, `subtotal_amount`, `tax_amount`, `total_amount`, `payment_status` ('PAID' | 'PARTIAL' | 'PENDING' | 'OVERDUE'), `inventory_status` ('RECEIVED' | 'PENDING').
- **Regla transaccional**: Al confirmar una compra en estado 'RECEIVED', se debe insertar el inventario y crear movimientos en `inventory_movements` con el costo unitario pactado.

---

## GRUPO 6: LOGÍSTICA, REMISIONES Y ECOMMERCE

### 15. `remissions.json` -> Tablas: `remissions` y `remission_items`
- **Propósito**: Despacho de mercancía con validez logística previa o alterna a la facturación electrónica.
- **Campos**: `id`, `code` (REM-2026-xxxx), `sale_id` (FK nullable), `customer_id` (FK), `origin_location_id` (FK), `driver_name`, `driver_license`, `vehicle_plate`, `status` ('CREATED' | 'DISPATCHED' | 'DELIVERED' | 'CANCELLED'), `dispatch_date`, `delivery_date`, `notes`.

### 16. `web_orders.json` -> Tablas: `web_orders` y `web_order_items`
- **Propósito**: Gestión integral de pedidos del canal online (Catálogo Super Más B2C y B2B).
- **Campos**: `id`, `order_number` (WEB-2026-xxxx), `channel` ('SUPERMAS_B2C' | 'DISTRIBUTOR_B2B'), `customer_id` (FK), `customer_name`, `customer_phone`, `shipping_address`, `shipping_city`, `dispatch_location_id` (FK -> locations.id, CEDI por defecto), `subtotal`, `shipping_fee`, `total`, `payment_status` ('PENDING' | 'CONFIRMED' | 'FAILED'), `fulfillment_status` ('PENDING' | 'CONFIRMED' | 'PREPARING' | 'DISPATCHED' | 'DELIVERED' | 'CANCELLED'), `sale_id` (FK nullable), `invoice_id` (FK nullable).

---

## GRUPO 7: FACTURACIÓN ELECTRÓNICA, DIAN, IMPUESTOS Y EXÓGENA

### 17. `invoices.json` & `tax_configs.json` -> Tablas: `electronic_invoices`, `dian_events`, `tax_rates`
- **Campos `electronic_invoices`**:
  - `id`: UUID (PK)
  - `prefix`: VARCHAR(10) NOT NULL (ej. SETT, FEVP, FEVD)
  - `number`: BIGINT NOT NULL
  - `full_number`: GENERATED ALWAYS AS (prefix || '-' || number) STORED
  - `document_type`: VARCHAR(30) ('INVOICE' | 'CREDIT_NOTE' | 'DEBIT_NOTE')
  - `sale_id`: UUID (FK -> sales.id)
  - `customer_id`: UUID (FK -> customers.id)
  - `company_id`: UUID (FK -> companies.id)
  - `cufe`: VARCHAR(100) UNIQUE (Código Único de Factura Electrónica)
  - `qr_code_data`: TEXT
  - `xml_signed_url`: TEXT (Almacenado en Supabase Storage)
  - `pdf_url`: TEXT (Almacenado en Supabase Storage)
  - `dian_status`: VARCHAR(30) ('PENDING' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'ACCEPTED_WITH_OBSERVATIONS')
  - `dian_response_message`: TEXT
  - `created_at`: TIMESTAMPTZ DEFAULT NOW()
- **Información faltante / Pendiente**:
  - PENDIENTE DE DEFINICIÓN: Resolución de facturación DIAN oficial, vigencia de prefijos, clave técnica de facturación y proveedor tecnológico de emisión (SOAP/REST).

### 18. `accounting_accounts.json`, `accounting_entries.json`, `accounting_movements.json` -> Tablas: `accounting_accounts`, `accounting_entries`, `accounting_entry_lines`, `cost_centers`
- **Propósito**: Contabilidad general bajo norma local PUC y estándares NIIF.
- **Regla estricta**: Doble partida obligatoria: `SUM(debit) == SUM(credit)`. Un asiento en estado `POSTED` jamás se modifica ni se borra.
- **Información faltante / Pendiente**:
  - PENDIENTE DE DEFINICIÓN: Plan Único de Cuentas (PUC) oficial del contador de Super Más y homologación de cuentas clase 14 (Inventarios), 41 (Ingresos operacionales) y 61 (Costo de ventas).

### 19. `exogena_normativa.json` & `exogena_generations.json` -> Tablas: `exogena_formats` y `exogena_records`
- **Propósito**: Generación de medios magnéticos para la DIAN (Formatos 1001, 1007, 1008, 1009).
- **Información faltante / Pendiente**:
  - PENDIENTE DE DEFINICIÓN: Parámetros del año gravable vigente y topes de reporte fijados por resolución DIAN.

---

## GRUPO 8: AUDITORÍA, ALERTAS Y SEGURIDAD

### 20. `alerts.json` & `alert_rules.json` -> Tablas: `alert_rules` y `system_alerts`
- **Campos `system_alerts`**: `id`, `rule_id` (FK), `location_id` (FK nullable), `title`, `message`, `priority` ('CRITICA' | 'ALTA' | 'MEDIA' | 'BAJA'), `status` ('NEW' | 'READ' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'), `module`, `entity_type`, `entity_id`, `created_at`.

### 21. `audit_logs.json` -> Tabla: `audit_logs`
- **Propósito**: Trazabilidad e historial inmutable. No permite DELETE ni UPDATE físico por RLS.
- **Campos**: `id`, `user_id` (FK), `user_name`, `action`, `module`, `entity_name`, `entity_id`, `location_id`, `previous_value` (JSONB), `new_value` (JSONB), `ip_address`, `timestamp`.

### 22. `users.json` & `user_assignments.json` -> Tablas: `roles`, `permissions`, `role_permissions`, `users`, `user_locations`
- **Propósito**: Integración con Supabase Auth (`auth.users` -> `public.users`) y control de acceso RBAC por sede física.
- **Roles inmutables**: `SUPERADMIN`, `WAREHOUSE_ADMIN`, `POINT_ADMIN`, `ACCOUNTANT`, `SELLER`, `CASHIER`.
