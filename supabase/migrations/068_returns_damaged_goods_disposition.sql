-- ==============================================================================
-- MIGRACIÓN 068: DEVOLUCIONES DE CLIENTE CON PRODUCTO EN MAL ESTADO (DESTINO PRODUCCIÓN / PROVEEDOR)
-- SUPER MÁS ERP/POS
-- ==============================================================================
--
-- Regla del dueño:
--   "Revisión cuando el producto está malo, para no hacer reingreso al sistema (se revisa para cuando
--    es proveedor externo o se envía a producción de nuevo)". Cuando un producto vuelve por una
--   devolución se escoge si se manda a producción o a devolución con el proveedor, y queda especificado.
--
-- Qué hace:
--   1. inventory_movement_type += 'DAMAGED_RETURN': movimiento de Kardex informativo (entrada 0 /
--      salida 0) para la mercancía en mal estado. Decisión: el modelo de inventario (003, 008/017) solo
--      conoce stock por producto + sede; no existe bodega de cuarentena ni saldo "no disponible"
--      (reserved_quantity es para reservas de venta y su lectura la usan POS y disponibilidad web).
--      Crear una sede de cuarentena la haría visible en disponibilidad pública, traslados y POS, así que
--      el movimiento NO toca la cantidad de stock_levels (el trigger suma quantity_in - quantity_out = 0)
--      y la cantidad real en mal estado queda en la línea de la devolución (return_items).
--   2. return_items: condición por línea (BUENO / MAL_ESTADO) y, si está en mal estado, destino
--      (PRODUCCION / PROVEEDOR), proveedor (obligatorio para PROVEEDOR, con la compra de referencia),
--      sede de producción o nota (obligatoria si no hay sede), estado (PENDIENTE / ENVIADO), quién y
--      cuándo se envió y los asientos DV (al registrar) y DC (al enviar al proveedor).
--   3. accounting_default_accounts: propósitos opcionales DAMAGED_GOODS_SUPPLIER y
--      DAMAGED_GOODS_PRODUCTION (auxiliares del grupo 14). No se siembran: el contador los crea y
--      configura. Mientras no existan se usa la cuenta de inventario del producto (la de defecto).
--   4. fn_process_customer_return (045) redefinida: BUENO igual que antes (CUSTOMER_RETURN, reingresa
--      al stock vendible). MAL_ESTADO no reingresa al stock vendible, registra DAMAGED_RETURN en Kardex
--      y, si la venta está causada, un comprobante DV: Dr cuenta de mercancía en mal estado (o la del
--      producto) / Cr costo de ventas mapeado (062). Rechaza MAL_ESTADO sin destino.
--   5. fn_create_electronic_note (062) redefinida: copia exacta salvo el reingreso de inventario de la
--      nota crédito por devolución, que ahora solo toma las líneas BUENO (las de mal estado ya
--      reversaron su costo con el DV y no vuelven a la cuenta de inventario vendible).
--   6. fn_return_disposition_options: proveedores, sedes y proveedor sugerido (última compra recibida
--      del producto) para el formulario de devolución.
--   7. fn_list_damaged_return_items: listado "Productos en mal estado por destino" (filtros, paginado,
--      costo solo con cost.read).
--   8. fn_dispatch_damaged_return_item: marca una línea como enviada (Kardex informativo, auditoría y,
--      si es al proveedor y tuvo DV, comprobante DC: Dr proveedores / Cr cuenta de mercancía en mal estado).
--   9. return_items deja de aceptar INSERT/UPDATE/DELETE directos desde el navegador: solo las RPC.
--
-- No borra datos. Las líneas existentes quedan BUENO (comportamiento anterior). Se puede re-ejecutar.
-- ==============================================================================

-- El valor nuevo del enum va fuera de la transacción: PostgreSQL no permite usar un valor
-- recién agregado dentro de la misma transacción en que se crea.
ALTER TYPE public.inventory_movement_type ADD VALUE IF NOT EXISTS 'DAMAGED_RETURN';

BEGIN;

-- Si una tabla está bloqueada por otra sesión, se falla rápido en vez de esperar (y bloquear a otros).
SET LOCAL lock_timeout = '5s';

-- ------------------------------------------------------------------------------
-- 1. TIPO DE MOVIMIENTO DE KARDEX PARA MERCANCÍA EN MAL ESTADO
-- ------------------------------------------------------------------------------
-- PostgreSQL 12+ permite ADD VALUE dentro de la transacción; el valor solo se usa en tiempo de ejecución
-- de las funciones (después del COMMIT), nunca dentro de esta migración.

-- ------------------------------------------------------------------------------
-- 2. CONDICIÓN Y DESTINO POR LÍNEA DE DEVOLUCIÓN
-- ------------------------------------------------------------------------------
ALTER TABLE public.return_items
  ADD COLUMN IF NOT EXISTS item_condition VARCHAR(12) NOT NULL DEFAULT 'BUENO',
  ADD COLUMN IF NOT EXISTS disposition_destination VARCHAR(12),
  ADD COLUMN IF NOT EXISTS disposition_status VARCHAR(12),
  ADD COLUMN IF NOT EXISTS disposition_supplier_id UUID REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS disposition_purchase_id UUID REFERENCES public.purchases(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS disposition_location_id UUID REFERENCES public.locations(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS disposition_notes TEXT,
  ADD COLUMN IF NOT EXISTS disposition_account_id UUID REFERENCES public.accounting_accounts(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS disposition_entry_id UUID REFERENCES public.accounting_entries(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS dispatched_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dispatched_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS dispatch_reference VARCHAR(100),
  ADD COLUMN IF NOT EXISTS dispatch_notes TEXT,
  ADD COLUMN IF NOT EXISTS dispatch_entry_id UUID REFERENCES public.accounting_entries(id) ON DELETE RESTRICT;

ALTER TABLE public.return_items DROP CONSTRAINT IF EXISTS chk_return_items_condition;
ALTER TABLE public.return_items ADD CONSTRAINT chk_return_items_condition
  CHECK (item_condition IN ('BUENO', 'MAL_ESTADO'));

ALTER TABLE public.return_items DROP CONSTRAINT IF EXISTS chk_return_items_disposition;
ALTER TABLE public.return_items ADD CONSTRAINT chk_return_items_disposition CHECK (
  (
    item_condition = 'BUENO'
    AND disposition_destination IS NULL AND disposition_status IS NULL
    AND disposition_supplier_id IS NULL AND disposition_purchase_id IS NULL
    AND disposition_location_id IS NULL AND disposition_account_id IS NULL
    AND disposition_entry_id IS NULL AND dispatched_at IS NULL AND dispatch_entry_id IS NULL
  )
  OR (
    item_condition = 'MAL_ESTADO'
    AND disposition_destination IN ('PRODUCCION', 'PROVEEDOR')
    AND disposition_status IN ('PENDIENTE', 'ENVIADO')
    -- Proveedor: obligatorio y sin sede de producción.
    AND (disposition_destination <> 'PROVEEDOR'
         OR (disposition_supplier_id IS NOT NULL AND disposition_location_id IS NULL))
    -- Producción: sin proveedor; sede de producción o nota (mínimo 5 caracteres).
    AND (disposition_destination <> 'PRODUCCION'
         OR (disposition_supplier_id IS NULL AND disposition_purchase_id IS NULL
             AND (disposition_location_id IS NOT NULL OR LENGTH(BTRIM(COALESCE(disposition_notes, ''))) >= 5)))
    -- Enviado ⇔ fecha de envío.
    AND ((disposition_status = 'ENVIADO') = (dispatched_at IS NOT NULL))
    -- El comprobante DC solo existe en envíos al proveedor.
    AND (dispatch_entry_id IS NULL OR (disposition_destination = 'PROVEEDOR' AND disposition_status = 'ENVIADO'))
  )
);

CREATE INDEX IF NOT EXISTS idx_return_items_damaged
  ON public.return_items (company_id, disposition_destination, disposition_status, created_at DESC)
  WHERE item_condition = 'MAL_ESTADO';
CREATE INDEX IF NOT EXISTS idx_return_items_disposition_supplier
  ON public.return_items (disposition_supplier_id)
  WHERE disposition_supplier_id IS NOT NULL;

-- Las líneas solo las escriben las RPC (SECURITY DEFINER): el navegador no puede insertar una línea
-- "en mal estado" sin Kardex ni marcarla como enviada sin auditoría.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.return_items FROM anon, authenticated;

-- ------------------------------------------------------------------------------
-- 3. CUENTAS OPCIONALES PARA MERCANCÍA EN MAL ESTADO
-- ------------------------------------------------------------------------------
ALTER TABLE public.accounting_default_accounts DROP CONSTRAINT IF EXISTS chk_accounting_default_accounts_purpose;
ALTER TABLE public.accounting_default_accounts ADD CONSTRAINT chk_accounting_default_accounts_purpose CHECK (purpose IN (
  'CASH', 'CUSTOMER_CREDIT', 'SALES_INCOME', 'VAT_GENERATED', 'COST_OF_SALES', 'INVENTORY',
  'SALES_RETURNS', 'FINANCIAL_INCOME',
  'VAT_DEDUCTIBLE',     -- IVA descontable en compras (2408xx)
  'SUPPLIERS_PAYABLE',  -- Proveedores nacionales por pagar (2205xx)
  'DAMAGED_GOODS_SUPPLIER',   -- Mercancía en mal estado pendiente de devolver al proveedor (14xx auxiliar)
  'DAMAGED_GOODS_PRODUCTION'  -- Mercancía en mal estado enviada a producción (14xx auxiliar)
));

-- Copia de 064 con los dos propósitos nuevos (auxiliares del grupo 14).
CREATE OR REPLACE FUNCTION public.fn_validate_default_account_purpose()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_acc RECORD;
  v_prefix VARCHAR(4);
BEGIN
  v_prefix := CASE NEW.purpose
    WHEN 'CASH' THEN '1105'
    WHEN 'CUSTOMER_CREDIT' THEN '1305'
    WHEN 'SALES_INCOME' THEN '41'
    WHEN 'VAT_GENERATED' THEN '2408'
    WHEN 'COST_OF_SALES' THEN '61'
    WHEN 'INVENTORY' THEN '14'
    WHEN 'SALES_RETURNS' THEN '4175'
    WHEN 'FINANCIAL_INCOME' THEN '42'
    WHEN 'VAT_DEDUCTIBLE' THEN '2408'
    WHEN 'SUPPLIERS_PAYABLE' THEN '2205'
    WHEN 'DAMAGED_GOODS_SUPPLIER' THEN '14'
    WHEN 'DAMAGED_GOODS_PRODUCTION' THEN '14'
    ELSE NULL END;
  IF v_prefix IS NULL THEN
    RAISE EXCEPTION 'Propósito contable sin regla de validación: %.', NEW.purpose USING ERRCODE = '22023';
  END IF;

  SELECT id, code, name, is_active INTO v_acc FROM public.accounting_accounts WHERE id = NEW.accounting_account_id;
  IF NOT FOUND OR v_acc.is_active = false THEN
    RAISE EXCEPTION 'La cuenta contable para "%" no existe o está inactiva.', NEW.purpose USING ERRCODE = '23503';
  END IF;

  -- El ingreso por ventas (41) no puede ser la cuenta de devoluciones (4175), que es de naturaleza débito.
  IF v_acc.code NOT LIKE v_prefix || '%' OR (NEW.purpose = 'SALES_INCOME' AND v_acc.code LIKE '4175%') THEN
    RAISE EXCEPTION 'La cuenta % % no corresponde al propósito "%" (se espera una cuenta del grupo %).',
      v_acc.code, v_acc.name, NEW.purpose, v_prefix USING ERRCODE = '22023';
  END IF;

  -- 068: la mercancía en mal estado se asienta en una auxiliar (último nivel), como el inventario del producto (062).
  IF NEW.purpose IN ('DAMAGED_GOODS_SUPPLIER', 'DAMAGED_GOODS_PRODUCTION')
     AND EXISTS (SELECT 1 FROM public.accounting_accounts c WHERE c.parent_id = v_acc.id) THEN
    RAISE EXCEPTION 'La cuenta % % tiene subcuentas: para "%" seleccione la auxiliar (último nivel).',
      v_acc.code, v_acc.name, NEW.purpose USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

-- Cuenta débito de la mercancía en mal estado: la configurada para el destino si existe y está activa;
-- si no, la cuenta de inventario del producto (o INVENTORY). Nunca se inventa una cuenta.
CREATE OR REPLACE FUNCTION public.fn_damaged_goods_account(
  p_company_id UUID,
  p_product_id UUID,
  p_destination VARCHAR
)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT COALESCE(
    (SELECT d.accounting_account_id
     FROM public.accounting_default_accounts d
     JOIN public.accounting_accounts a ON a.id = d.accounting_account_id AND a.is_active = true
     WHERE d.company_id = p_company_id
       AND d.purpose = CASE p_destination
                         WHEN 'PROVEEDOR' THEN 'DAMAGED_GOODS_SUPPLIER'
                         WHEN 'PRODUCCION' THEN 'DAMAGED_GOODS_PRODUCTION'
                       END),
    public.fn_product_inventory_account(p_company_id, p_product_id)
  );
$$;

REVOKE ALL ON FUNCTION public.fn_damaged_goods_account(UUID, UUID, VARCHAR) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_damaged_goods_account(UUID, UUID, VARCHAR) TO service_role;

-- ------------------------------------------------------------------------------
-- 4. DEVOLUCIÓN DE CLIENTE CON CONDICIÓN Y DESTINO POR LÍNEA (reemplaza 045)
-- ------------------------------------------------------------------------------
-- Misma firma. Cada elemento de p_items acepta, además de product_id / quantity / reason:
--   condition: 'BUENO' (defecto) | 'MAL_ESTADO'
--   destination: 'PRODUCCION' | 'PROVEEDOR' (obligatorio si MAL_ESTADO)
--   supplier_id (obligatorio si PROVEEDOR), production_location_id (opcional si PRODUCCION),
--   disposition_notes (obligatoria si PRODUCCION sin sede).
-- El mismo producto puede venir en varias líneas (p. ej. 2 en buen estado y 1 en mal estado).
CREATE OR REPLACE FUNCTION public.fn_process_customer_return(
    p_sale_id UUID,
    p_items JSONB,
    p_reason TEXT,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_user_id UUID;
    v_company_id UUID;
    v_user_name VARCHAR(150);
    v_sale RECORD;
    v_item JSONB;
    v_prod_id UUID;
    v_qty NUMERIC(12,2);
    v_sale_item RECORD;
    v_already_returned NUMERIC(12,2);
    v_return_id UUID;
    v_return_code VARCHAR(50);
    v_return_item_id UUID;
    v_prev_stock NUMERIC(12,2);
    v_new_stock NUMERIC(12,2);
    v_total_units NUMERIC(12,2) := 0;
    v_total_amount NUMERIC(15,2) := 0;
    v_items_count INTEGER := 0;
    v_good_units NUMERIC(12,2) := 0;
    v_damaged_units NUMERIC(12,2) := 0;
    v_condition VARCHAR(12);
    v_destination VARCHAR(12);
    v_supplier RECORD;
    v_supplier_id UUID;
    v_purchase_id UUID;
    v_prod_location RECORD;
    v_prod_location_id UUID;
    v_disp_notes TEXT;
    v_line_reason TEXT;
    v_destination_label TEXT;
    v_line_cost NUMERIC(15,2);
    v_inventory_account UUID;
    v_damaged_account UUID;
    v_sale_caused BOOLEAN := false;
    v_acc_lines JSONB := '[]'::JSONB;
    v_damaged_ids UUID[] := ARRAY[]::UUID[];
    v_entry JSONB;
    v_accounting_note TEXT;
    v_audit_items JSONB := '[]'::JSONB;
BEGIN
    v_user_id := auth.uid();

    -- Control de acceso: usuario de la empresa con permiso, o contexto de servidor confiable.
    IF v_user_id IS NOT NULL THEN
        v_company_id := public.get_auth_company_id();
        IF v_company_id IS NULL THEN
            RAISE EXCEPTION 'No se pudo determinar la empresa del usuario autenticado.'
                USING ERRCODE = '42501';
        END IF;
        IF NOT (public.has_permission('sales.create') OR public.has_permission('inventory.adjust') OR public.is_admin()) THEN
            RAISE EXCEPTION 'No tienes permisos para procesar devoluciones de venta.'
                USING ERRCODE = '42501';
        END IF;
    ELSIF public.fn_is_trusted_server_context() THEN
        SELECT company_id INTO v_company_id FROM public.sales WHERE id = p_sale_id;
    ELSE
        RAISE EXCEPTION 'Acceso denegado: usuario no autenticado.' USING ERRCODE = '28000';
    END IF;

    IF v_company_id IS NULL THEN
        RAISE EXCEPTION 'No se pudo determinar la empresa del usuario autenticado.'
            USING ERRCODE = '42501';
    END IF;

    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'Debe especificar al menos un producto a devolver.'
            USING ERRCODE = '22023';
    END IF;

    IF p_reason IS NULL OR LENGTH(BTRIM(p_reason)) < 3 THEN
        RAISE EXCEPTION 'El motivo de la devolución es obligatorio (mínimo 3 caracteres).'
            USING ERRCODE = '22023';
    END IF;

    -- Bloqueo pesimista de la venta
    PERFORM pg_advisory_xact_lock(hashtext('sale_operation_' || p_sale_id::text));

    SELECT id, company_id, sale_number, customer_id, location_id, status
    INTO v_sale
    FROM public.sales
    WHERE id = p_sale_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'La venta especificada no existe.' USING ERRCODE = '23503';
    END IF;

    IF v_sale.company_id != v_company_id THEN
        RAISE EXCEPTION 'La venta pertenece a otra empresa.' USING ERRCODE = '42501';
    END IF;

    IF v_sale.status = 'CANCELLED' THEN
        RAISE EXCEPTION 'No se pueden procesar devoluciones sobre una venta anulada.'
            USING ERRCODE = '22023';
    END IF;

    IF v_user_id IS NOT NULL THEN
        SELECT full_name INTO v_user_name FROM public.users WHERE id = v_user_id;
    END IF;
    IF v_user_name IS NULL OR TRIM(v_user_name) = '' THEN
        v_user_name := 'Usuario Sistema';
    END IF;

    v_return_code := public.fn_next_return_code(v_company_id, 'CUSTOMER_RETURN');
    v_return_id := gen_random_uuid();

    -- Cabecera primero para satisfacer la FK de return_items (045)
    INSERT INTO public.returns (
        id, company_id, code, return_type, status, source_document_type, source_document_id,
        source_document_code, customer_id, location_id, total_items, total_units, total_amount,
        reason, notes, created_by_user_id, created_at, updated_at
    ) VALUES (
        v_return_id, v_company_id, v_return_code, 'CUSTOMER_RETURN', 'COMPLETED', 'SALE', p_sale_id,
        v_sale.sale_number, v_sale.customer_id, v_sale.location_id, 0, 0, 0,
        BTRIM(p_reason), p_notes, v_user_id, NOW(), NOW()
    );

    -- La venta tiene su asiento contabilizado: solo así se reversa el costo de la mercancía en mal estado.
    SELECT EXISTS (
        SELECT 1 FROM public.accounting_entries
        WHERE company_id = v_company_id AND document_type = 'SALE'
          AND document_reference = v_sale.sale_number AND status = 'POSTED'
    ) INTO v_sale_caused;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_prod_id := NULLIF(v_item->>'product_id', '')::UUID;
        v_qty := ROUND((v_item->>'quantity')::NUMERIC, 2);
        v_line_reason := NULLIF(BTRIM(v_item->>'reason'), '');

        IF v_prod_id IS NULL THEN
            RAISE EXCEPTION 'Cada línea de la devolución debe indicar el producto.' USING ERRCODE = '22023';
        END IF;
        IF v_qty IS NULL OR v_qty <= 0 THEN
            RAISE EXCEPTION 'La cantidad a devolver debe ser estrictamente mayor a 0.'
                USING ERRCODE = '22023';
        END IF;

        -- Consultar ítem original en la venta
        SELECT si.id, si.product_id, si.quantity, si.unit_cost, si.unit_price, p.name AS product_name
        INTO v_sale_item
        FROM public.sale_items si
        JOIN public.products p ON p.id = si.product_id
        WHERE si.sale_id = p_sale_id AND si.product_id = v_prod_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'El producto % no formó parte de la venta %.', v_prod_id, v_sale.sale_number
                USING ERRCODE = '22023';
        END IF;

        -- ------------------------------------------------------------------
        -- Condición y destino de la línea
        -- ------------------------------------------------------------------
        v_condition := UPPER(COALESCE(NULLIF(BTRIM(v_item->>'condition'), ''), 'BUENO'));
        v_destination := UPPER(NULLIF(BTRIM(v_item->>'destination'), ''));
        v_supplier_id := NULLIF(BTRIM(v_item->>'supplier_id'), '')::UUID;
        v_prod_location_id := NULLIF(BTRIM(v_item->>'production_location_id'), '')::UUID;
        v_disp_notes := NULLIF(BTRIM(v_item->>'disposition_notes'), '');
        v_purchase_id := NULL;
        v_destination_label := NULL;

        IF v_condition NOT IN ('BUENO', 'MAL_ESTADO') THEN
            RAISE EXCEPTION 'Condición no válida para "%": % (use BUENO o MAL_ESTADO).', v_sale_item.product_name, v_condition
                USING ERRCODE = '22023';
        END IF;

        IF v_condition = 'BUENO' THEN
            IF v_destination IS NOT NULL OR v_supplier_id IS NOT NULL OR v_prod_location_id IS NOT NULL THEN
                RAISE EXCEPTION 'La línea de "%" está en buen estado: no lleva destino, proveedor ni sede de producción.', v_sale_item.product_name
                    USING ERRCODE = '22023';
            END IF;
            v_disp_notes := NULL;
        ELSE
            IF v_destination IS NULL THEN
                RAISE EXCEPTION 'La línea de "%" está en mal estado: elija el destino (PRODUCCION o PROVEEDOR).', v_sale_item.product_name
                    USING ERRCODE = '23502';
            END IF;
            IF v_destination NOT IN ('PRODUCCION', 'PROVEEDOR') THEN
                RAISE EXCEPTION 'Destino no válido para "%": % (use PRODUCCION o PROVEEDOR).', v_sale_item.product_name, v_destination
                    USING ERRCODE = '22023';
            END IF;

            IF v_destination = 'PROVEEDOR' THEN
                IF v_prod_location_id IS NOT NULL THEN
                    RAISE EXCEPTION 'La línea de "%" va al proveedor: no lleva sede de producción.', v_sale_item.product_name
                        USING ERRCODE = '22023';
                END IF;
                IF v_supplier_id IS NULL THEN
                    RAISE EXCEPTION 'La línea de "%" se devuelve al proveedor: seleccione el proveedor.', v_sale_item.product_name
                        USING ERRCODE = '23502';
                END IF;
                SELECT id, name, tax_id INTO v_supplier
                FROM public.suppliers
                WHERE id = v_supplier_id AND company_id = v_company_id AND is_active = true;
                IF NOT FOUND THEN
                    RAISE EXCEPTION 'El proveedor seleccionado para "%" no existe, está inactivo o es de otra empresa.', v_sale_item.product_name
                        USING ERRCODE = '22023';
                END IF;
                -- Compra de referencia para la devolución en compra (DC): la última recibida de ese
                -- proveedor con este producto. Puede no existir (queda NULL).
                SELECT pu.id INTO v_purchase_id
                FROM public.purchases pu
                JOIN public.purchase_items pi ON pi.purchase_id = pu.id
                WHERE pu.company_id = v_company_id
                  AND pu.supplier_id = v_supplier_id
                  AND pi.product_id = v_prod_id
                  AND UPPER(COALESCE(pu.inventory_status, '')) IN ('RECEIVED', 'RECIBIDA', 'PARTIALLY_RECEIVED', 'RECIBIDA_PARCIALMENTE')
                ORDER BY pu.issue_date DESC, pu.created_at DESC
                LIMIT 1;
                v_destination_label := 'proveedor ' || v_supplier.name;
            ELSE
                IF v_supplier_id IS NOT NULL THEN
                    RAISE EXCEPTION 'La línea de "%" va a producción: no lleva proveedor.', v_sale_item.product_name
                        USING ERRCODE = '22023';
                END IF;
                IF v_prod_location_id IS NOT NULL THEN
                    SELECT id, code, name INTO v_prod_location
                    FROM public.locations
                    WHERE id = v_prod_location_id AND company_id = v_company_id AND status = 'ACTIVE';
                    IF NOT FOUND THEN
                        RAISE EXCEPTION 'La sede de producción seleccionada para "%" no existe, está inactiva o es de otra empresa.', v_sale_item.product_name
                            USING ERRCODE = '22023';
                    END IF;
                    v_destination_label := 'producción ' || v_prod_location.name;
                ELSE
                    IF v_disp_notes IS NULL OR LENGTH(v_disp_notes) < 5 THEN
                        RAISE EXCEPTION 'La línea de "%" va a producción sin sede: escriba una nota del área o responsable (mínimo 5 caracteres).', v_sale_item.product_name
                            USING ERRCODE = '23502';
                    END IF;
                    v_destination_label := 'producción (' || v_disp_notes || ')';
                END IF;
            END IF;
        END IF;

        -- Validar devoluciones previas del mismo producto en esta venta (incluye las líneas de esta
        -- misma devolución insertadas antes en el ciclo)
        SELECT COALESCE(SUM(ri.quantity), 0)
        INTO v_already_returned
        FROM public.return_items ri
        JOIN public.returns r ON r.id = ri.return_id
        WHERE r.source_document_id = p_sale_id
          AND ri.product_id = v_prod_id
          AND r.status != 'CANCELLED';

        IF (v_already_returned + v_qty) > v_sale_item.quantity THEN
            RAISE EXCEPTION 'No se puede devolver % unidades de "%". Vendidas: %, ya devueltas: %, máximo restante: %.',
                v_qty,
                v_sale_item.product_name,
                v_sale_item.quantity,
                v_already_returned,
                (v_sale_item.quantity - v_already_returned)
                USING ERRCODE = '22023';
        END IF;

        -- Stock actual en la sede para el Kardex
        SELECT COALESCE(quantity, 0)
        INTO v_prev_stock
        FROM public.stock_levels
        WHERE product_id = v_prod_id AND location_id = v_sale.location_id
        FOR UPDATE;

        v_prev_stock := COALESCE(v_prev_stock, 0.00);
        v_return_item_id := gen_random_uuid();

        IF v_condition = 'BUENO' THEN
            v_new_stock := v_prev_stock + v_qty;

            -- Reingreso a inventario vendible (Kardex CUSTOMER_RETURN), igual que 045
            INSERT INTO public.inventory_movements (
                company_id, location_id, product_id, movement_type, quantity_in, quantity_out,
                previous_stock, new_stock, unit_cost, total_cost, document_type, document_reference,
                reason, user_id, created_at
            ) VALUES (
                v_company_id, v_sale.location_id, v_prod_id, 'CUSTOMER_RETURN', v_qty, 0.00,
                v_prev_stock, v_new_stock, v_sale_item.unit_cost, ROUND(v_qty * v_sale_item.unit_cost, 2),
                'SALE_RETURN', v_return_code,
                'Devolución de cliente por venta ' || v_sale.sale_number || ': ' || BTRIM(p_reason),
                v_user_id, NOW()
            );
            v_good_units := v_good_units + v_qty;
        ELSE
            -- Mercancía en mal estado: movimiento informativo, NO suma al stock vendible
            -- (entrada 0 / salida 0; la cantidad queda en la línea de la devolución).
            INSERT INTO public.inventory_movements (
                company_id, location_id, product_id, movement_type, quantity_in, quantity_out,
                previous_stock, new_stock, unit_cost, total_cost, document_type, document_reference,
                reason, user_id, created_at
            ) VALUES (
                v_company_id, v_sale.location_id, v_prod_id, 'DAMAGED_RETURN', 0.00, 0.00,
                v_prev_stock, v_prev_stock, v_sale_item.unit_cost, 0.00,
                'SALE_RETURN_DAMAGED', v_return_code,
                'Devolución en mal estado (no reingresa a inventario vendible) venta ' || v_sale.sale_number
                  || ': ' || v_qty::TEXT || ' und de "' || v_sale_item.product_name || '" con destino '
                  || v_destination_label || '. Motivo: ' || COALESCE(v_line_reason, BTRIM(p_reason)),
                v_user_id, NOW()
            );
            v_damaged_units := v_damaged_units + v_qty;

            -- Reversión del costo de ventas hacia la cuenta de mercancía en mal estado (comprobante DV)
            v_line_cost := ROUND(v_qty * v_sale_item.unit_cost, 2);
            IF v_sale_caused AND v_line_cost > 0 THEN
                v_inventory_account := COALESCE(public.fn_product_inventory_account(v_company_id, v_prod_id),
                                                 public.fn_get_default_account(v_company_id, 'INVENTORY'));
                v_damaged_account := COALESCE(public.fn_damaged_goods_account(v_company_id, v_prod_id, v_destination),
                                              v_inventory_account);
                v_acc_lines := v_acc_lines || jsonb_build_object(
                    'account_id', v_damaged_account,
                    'debit_amount', v_line_cost, 'credit_amount', 0,
                    'description', 'Mercancía en mal estado ' || v_return_code || ' - ' || v_sale_item.product_name
                                   || ' (destino ' || v_destination || ')');
                v_acc_lines := v_acc_lines || jsonb_build_object(
                    'account_id', public.fn_inventory_line_account(v_company_id, v_inventory_account, 'COST_OF_SALES'),
                    'debit_amount', 0, 'credit_amount', v_line_cost,
                    'description', 'Reversión costo de ventas devolución ' || v_return_code || ' - ' || v_sale_item.product_name);
                v_damaged_ids := v_damaged_ids || v_return_item_id;
            END IF;
        END IF;

        INSERT INTO public.return_items (
            id, return_id, company_id, product_id, quantity, unit_cost, unit_price, total_amount, reason,
            item_condition, disposition_destination, disposition_status, disposition_supplier_id,
            disposition_purchase_id, disposition_location_id, disposition_notes, created_at
        ) VALUES (
            v_return_item_id, v_return_id, v_company_id, v_prod_id, v_qty,
            v_sale_item.unit_cost, v_sale_item.unit_price, ROUND(v_qty * v_sale_item.unit_price, 2), v_line_reason,
            v_condition,
            CASE WHEN v_condition = 'MAL_ESTADO' THEN v_destination END,
            CASE WHEN v_condition = 'MAL_ESTADO' THEN 'PENDIENTE' END,
            CASE WHEN v_condition = 'MAL_ESTADO' AND v_destination = 'PROVEEDOR' THEN v_supplier_id END,
            v_purchase_id,
            CASE WHEN v_condition = 'MAL_ESTADO' AND v_destination = 'PRODUCCION' THEN v_prod_location_id END,
            v_disp_notes,
            NOW()
        );

        v_audit_items := v_audit_items || jsonb_build_object(
            'return_item_id', v_return_item_id,
            'product_id', v_prod_id,
            'product_name', v_sale_item.product_name,
            'quantity', v_qty,
            'condition', v_condition,
            'destination', CASE WHEN v_condition = 'MAL_ESTADO' THEN v_destination END,
            'supplier_id', CASE WHEN v_destination = 'PROVEEDOR' THEN v_supplier_id END,
            'production_location_id', CASE WHEN v_destination = 'PRODUCCION' THEN v_prod_location_id END,
            'disposition_notes', v_disp_notes,
            'reason', COALESCE(v_line_reason, BTRIM(p_reason)));

        v_total_units := v_total_units + v_qty;
        v_total_amount := v_total_amount + ROUND(v_qty * v_sale_item.unit_price, 2);
        v_items_count := v_items_count + 1;
    END LOOP;

    -- Comprobante DV de la mercancía en mal estado (una sola partida doble por devolución)
    IF jsonb_array_length(v_acc_lines) > 0 THEN
        v_entry := public.fn_create_accounting_entry(
            p_date := (NOW() AT TIME ZONE 'America/Bogota')::DATE,
            p_concept := 'Devolución en venta ' || v_return_code || ' (venta ' || v_sale.sale_number
                         || '): mercancía en mal estado sin reingreso a inventario vendible',
            p_document_type := 'SALE_RETURN',
            p_document_reference := v_return_code,
            p_lines := v_acc_lines,
            p_location_id := v_sale.location_id,
            p_auto_post := true,
            p_company_id := v_company_id
        );

        UPDATE public.return_items
        SET disposition_entry_id = (v_entry->>'entry_id')::UUID,
            disposition_account_id = COALESCE(
                public.fn_damaged_goods_account(v_company_id, product_id, disposition_destination),
                public.fn_get_default_account(v_company_id, 'INVENTORY'))
        WHERE id = ANY(v_damaged_ids);
    ELSIF v_damaged_units > 0 THEN
        v_accounting_note := CASE
            WHEN NOT v_sale_caused THEN 'Sin comprobante DV: la venta no tiene asiento contabilizado.'
            ELSE 'Sin comprobante DV: la mercancía en mal estado no tiene costo registrado.'
        END;
    END IF;

    UPDATE public.returns
    SET total_items = v_items_count,
        total_units = v_total_units,
        total_amount = v_total_amount,
        updated_at = NOW()
    WHERE id = v_return_id;

    INSERT INTO public.audit_logs (
        company_id, user_id, user_name, action, module, entity_name, entity_id, location_id, new_value, created_at
    ) VALUES (
        v_company_id, v_user_id, v_user_name, 'CUSTOMER_RETURN_PROCESSED', 'RETURNS', 'returns',
        v_return_id, v_sale.location_id,
        jsonb_build_object(
            'code', v_return_code,
            'sale_id', p_sale_id,
            'sale_number', v_sale.sale_number,
            'total_items', v_items_count,
            'total_units', v_total_units,
            'good_units', v_good_units,
            'damaged_units', v_damaged_units,
            'total_amount', v_total_amount,
            'reason', BTRIM(p_reason),
            'items', v_audit_items,
            'accounting_entry', v_entry->>'entry_number',
            'accounting_note', v_accounting_note
        ),
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'return_id', v_return_id,
        'code', v_return_code,
        'total_units', v_total_units,
        'total_amount', v_total_amount,
        'items_count', v_items_count,
        'good_units', v_good_units,
        'damaged_units', v_damaged_units,
        'accounting_entry_number', v_entry->>'entry_number',
        'accounting_note', v_accounting_note
    );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_process_customer_return(UUID, JSONB, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_process_customer_return(UUID, JSONB, TEXT, TEXT) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 5. NOTAS CRÉDITO/DÉBITO: EL REINGRESO DE INVENTARIO SOLO PARA LÍNEAS BUENO
-- ------------------------------------------------------------------------------
-- Copia exacta de 062 salvo el filtro de condición en el bloque "Mercancía devuelta" (marcado con 068).

CREATE OR REPLACE FUNCTION public.fn_create_electronic_note(
  p_original_invoice_id UUID,
  p_document_type VARCHAR,
  p_concept_code VARCHAR,
  p_reason TEXT,
  p_lines JSONB,
  p_return_id UUID,
  p_idempotency_key VARCHAR,
  p_environment VARCHAR
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_orig RECORD;
  v_existing RECORD;
  v_seq RECORD;
  v_ret RECORD;
  v_item RECORD;
  v_line JSONB;
  v_note_id UUID := gen_random_uuid();
  v_now_bogota TIMESTAMP := (NOW() AT TIME ZONE 'America/Bogota');
  v_next BIGINT;
  v_max_used BIGINT;
  v_ln INT := 0;
  v_qty NUMERIC(12,2);
  v_net NUMERIC(15,2);
  v_tax NUMERIC(15,2);
  v_rate NUMERIC(5,2);
  v_treat VARCHAR(10);
  v_desc TEXT;
  v_sku VARCHAR(80);
  v_prod UUID;
  v_by_qty BOOLEAN;
  v_prev_qty NUMERIC(12,2);
  v_prev_net NUMERIC(15,2);
  v_sub NUMERIC(15,2) := 0;
  v_taxsum NUMERIC(15,2) := 0;
  v_total NUMERIC(15,2);
  v_concept_desc TEXT;
  v_customer_doc VARCHAR(50);
  v_customer_name VARCHAR(200);
  v_acc_lines JSONB := '[]'::JSONB;
  v_entry JSONB;
  v_ret_cost NUMERIC(15,2) := 0;
  v_income_purpose VARCHAR(40);
  v_ret_grp RECORD;
  v_ret_inventory UUID;
BEGIN
  IF p_environment IS NULL OR p_environment NOT IN ('HABILITACION', 'PRODUCCION') THEN
    RAISE EXCEPTION 'Ambiente DIAN inválido: %', p_environment USING ERRCODE = '22023';
  END IF;
  IF p_document_type NOT IN ('CREDIT_NOTE', 'DEBIT_NOTE') THEN
    RAISE EXCEPTION 'Tipo de nota inválido: %', p_document_type USING ERRCODE = '22023';
  END IF;
  IF p_idempotency_key IS NULL OR LENGTH(TRIM(p_idempotency_key)) < 8 THEN
    RAISE EXCEPTION 'Se requiere una clave de idempotencia válida.' USING ERRCODE = '22023';
  END IF;
  IF p_reason IS NULL OR LENGTH(TRIM(p_reason)) < 5 THEN
    RAISE EXCEPTION 'Escriba el motivo de la nota (mínimo 5 caracteres).' USING ERRCODE = '22023';
  END IF;

  v_concept_desc := CASE
    WHEN p_document_type = 'CREDIT_NOTE' THEN CASE p_concept_code
      WHEN '1' THEN 'Devolución parcial de los bienes y/o no aceptación parcial del servicio'
      WHEN '2' THEN 'Anulación de factura electrónica'
      WHEN '3' THEN 'Rebaja o descuento parcial o total'
      WHEN '4' THEN 'Ajuste de precio'
      WHEN '5' THEN 'Descuento comercial por pronto pago'
      WHEN '6' THEN 'Descuento comercial por volumen de ventas'
      ELSE NULL END
    ELSE CASE p_concept_code
      WHEN '1' THEN 'Intereses'
      WHEN '2' THEN 'Gastos por cobrar'
      WHEN '3' THEN 'Cambio del valor'
      WHEN '4' THEN 'Otros'
      ELSE NULL END
  END;
  IF v_concept_desc IS NULL THEN
    RAISE EXCEPTION 'Concepto % no válido para %.', p_concept_code, p_document_type USING ERRCODE = '22023';
  END IF;

  -- Factura original bloqueada: serializa notas concurrentes sobre la misma factura.
  SELECT * INTO v_orig FROM public.electronic_invoices WHERE id = p_original_invoice_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La factura original no existe.' USING ERRCODE = 'P0002';
  END IF;

  IF v_caller IS NOT NULL THEN
    IF public.get_auth_company_id() IS DISTINCT FROM v_orig.company_id THEN
      RAISE EXCEPTION 'Acceso denegado: la factura no pertenece a su empresa.' USING ERRCODE = '42501';
    END IF;
    IF NOT (public.is_admin() OR public.has_permission('invoices.cancel')) THEN
      RAISE EXCEPTION 'Acceso denegado: requiere el permiso invoices.cancel (notas crédito/débito).' USING ERRCODE = '42501';
    END IF;
    IF NOT (public.is_admin() OR public.has_location_access(v_orig.location_id)) THEN
      RAISE EXCEPTION 'Acceso denegado: la factura es de una sede que no tiene asignada.' USING ERRCODE = '42501';
    END IF;
  ELSIF NOT public.fn_is_trusted_server_context() THEN
    RAISE EXCEPTION 'Acceso denegado: usuario no autenticado.' USING ERRCODE = '28000';
  END IF;

  -- El ambiente lo define la configuración DIAN activa de la empresa, no quien llama.
  IF p_environment IS DISTINCT FROM public.fn_dian_active_environment(v_orig.company_id) THEN
    RAISE EXCEPTION 'El ambiente solicitado (%) no es el ambiente DIAN activo de la empresa (%).',
      p_environment, public.fn_dian_active_environment(v_orig.company_id) USING ERRCODE = '55000';
  END IF;

  -- Idempotencia: misma clave → misma nota, solo si es del mismo tipo y sobre la misma factura.
  SELECT id, prefix, number, document_type, original_invoice_id INTO v_existing
  FROM public.electronic_invoices
  WHERE company_id = v_orig.company_id AND idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_existing.document_type IS DISTINCT FROM p_document_type
       OR v_existing.original_invoice_id IS DISTINCT FROM p_original_invoice_id THEN
      RAISE EXCEPTION 'La clave de idempotencia ya se usó para otro documento electrónico (%). Genere una nueva.',
        v_existing.prefix || v_existing.number::TEXT USING ERRCODE = '23505';
    END IF;
    RETURN jsonb_build_object('success', true, 'idempotent_replay', true,
      'note_id', v_existing.id, 'prefix', v_existing.prefix, 'number', v_existing.number);
  END IF;

  IF v_orig.document_type <> 'INVOICE' THEN
    RAISE EXCEPTION 'Las notas se emiten sobre una factura electrónica de venta, no sobre otra nota.' USING ERRCODE = '22023';
  END IF;
  IF v_orig.environment <> p_environment THEN
    RAISE EXCEPTION 'La factura es del ambiente % y la nota se pidió en %.', v_orig.environment, p_environment USING ERRCODE = '22023';
  END IF;
  IF v_orig.transmission_state <> 'ACCEPTED' OR v_orig.cufe IS NULL THEN
    RAISE EXCEPTION 'La factura % debe estar ACEPTADA por la DIAN antes de emitirle notas (estado actual: %).',
      v_orig.prefix || v_orig.number::TEXT, v_orig.transmission_state USING ERRCODE = '55000';
  END IF;

  -- ----------------------------------------------------------------------------
  -- Líneas
  -- ----------------------------------------------------------------------------
  CREATE TEMP TABLE IF NOT EXISTS tmp_note_lines (
    ln INT, sale_item_id UUID, product_id UUID, sku VARCHAR(80), description TEXT,
    quantity NUMERIC(12,2), unit_price NUMERIC(15,2), discount NUMERIC(5,2), net NUMERIC(15,2),
    treat VARCHAR(10), rate NUMERIC(5,2), tax NUMERIC(15,2), by_qty BOOLEAN, returned BOOLEAN
  ) ON COMMIT DROP;
  DELETE FROM tmp_note_lines;

  IF p_document_type = 'CREDIT_NOTE' THEN
    IF p_concept_code = '2' THEN
      IF EXISTS (SELECT 1 FROM public.electronic_invoices WHERE original_invoice_id = v_orig.id AND document_type = 'CREDIT_NOTE') THEN
        RAISE EXCEPTION 'La factura ya tiene notas crédito; no se puede anular completa. Emita una nota por el saldo.' USING ERRCODE = '55000';
      END IF;
      -- Las líneas de valor 0 (obsequios, precio 0) no tienen nada que acreditar: se omiten.
      p_lines := (SELECT jsonb_agg(jsonb_build_object('sale_item_id', si.id, 'quantity', si.quantity) ORDER BY si.created_at, si.id)
                  FROM public.sale_items si WHERE si.sale_id = v_orig.sale_id AND si.subtotal > 0);
      p_return_id := NULL;
    ELSIF p_concept_code = '1' AND p_return_id IS NULL THEN
      RAISE EXCEPTION 'La nota por devolución (concepto 1) requiere la devolución registrada y completada en el módulo Devoluciones.'
        USING ERRCODE = '23502';
    ELSIF p_return_id IS NOT NULL THEN
      SELECT * INTO v_ret FROM public.returns WHERE id = p_return_id FOR UPDATE;
      IF NOT FOUND OR v_ret.company_id <> v_orig.company_id OR v_ret.return_type <> 'CUSTOMER_RETURN'
         OR v_ret.source_document_type <> 'SALE' OR v_ret.source_document_id <> v_orig.sale_id THEN
        RAISE EXCEPTION 'La devolución no corresponde a la venta de esta factura.' USING ERRCODE = '22023';
      END IF;
      IF v_ret.status <> 'COMPLETED' THEN
        RAISE EXCEPTION 'La devolución % no está completada (estado %): no se puede acreditar.', v_ret.code, v_ret.status USING ERRCODE = '55000';
      END IF;
      IF EXISTS (SELECT 1 FROM public.electronic_invoices WHERE return_id = p_return_id) THEN
        RAISE EXCEPTION 'La devolución % ya tiene una nota crédito.', v_ret.code USING ERRCODE = '23505';
      END IF;
      IF p_concept_code <> '1' THEN
        RAISE EXCEPTION 'Una nota por devolución de mercancía usa el concepto 1 (devolución).' USING ERRCODE = '22023';
      END IF;
      -- Cada producto devuelto se asigna a las líneas de la venta de ese producto, en orden.
      p_lines := '[]'::JSONB;
      FOR v_item IN
        SELECT ri.product_id, SUM(ri.quantity) AS qty, SUM(ri.quantity * ri.unit_cost) AS cost
        FROM public.return_items ri WHERE ri.return_id = p_return_id GROUP BY ri.product_id
      LOOP
        v_ret_cost := v_ret_cost + COALESCE(v_item.cost, 0);
        v_qty := v_item.qty;
        FOR v_line IN
          SELECT jsonb_build_object('sale_item_id', si.id, 'avail', si.quantity - COALESCE((
                   SELECT SUM(l.quantity) FROM public.electronic_document_lines l
                   JOIN public.electronic_invoices n ON n.id = l.document_id
                   WHERE l.source_sale_item_id = si.id AND n.document_type = 'CREDIT_NOTE' AND l.quantity_returned), 0))
          FROM public.sale_items si WHERE si.sale_id = v_orig.sale_id AND si.product_id = v_item.product_id
          ORDER BY si.created_at, si.id
        LOOP
          EXIT WHEN v_qty <= 0;
          IF (v_line->>'avail')::NUMERIC > 0 THEN
            p_lines := p_lines || jsonb_build_object('sale_item_id', v_line->>'sale_item_id',
                                                     'quantity', LEAST(v_qty, (v_line->>'avail')::NUMERIC));
            v_qty := v_qty - LEAST(v_qty, (v_line->>'avail')::NUMERIC);
          END IF;
        END LOOP;
        IF v_qty > 0 THEN
          RAISE EXCEPTION 'La devolución tiene más unidades de un producto que las facturadas pendientes de acreditar.' USING ERRCODE = '22023';
        END IF;
      END LOOP;
    END IF;

    IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
      RAISE EXCEPTION 'La nota crédito debe tener al menos una línea.' USING ERRCODE = '23502';
    END IF;
    -- Una línea de la venta solo puede aparecer una vez por nota (si no, se acreditaría dos veces).
    IF (SELECT COUNT(*) FROM jsonb_array_elements(p_lines) e) <> (SELECT COUNT(DISTINCT e->>'sale_item_id') FROM jsonb_array_elements(p_lines) e) THEN
      RAISE EXCEPTION 'Una misma línea de la factura aparece repetida en la nota.' USING ERRCODE = '22023';
    END IF;

    FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
    LOOP
      SELECT si.*, p.sku AS p_sku, p.name AS p_name, p.iva_treatment AS p_treat
      INTO v_item
      FROM public.sale_items si JOIN public.products p ON p.id = si.product_id
      WHERE si.id = NULLIF(v_line->>'sale_item_id', '')::UUID AND si.sale_id = v_orig.sale_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Una línea de la nota no pertenece a la factura original.' USING ERRCODE = '22023';
      END IF;

      v_by_qty := (v_line ? 'quantity') AND NOT (v_line ? 'net_amount');
      IF p_concept_code = '1' AND NOT v_by_qty THEN
        RAISE EXCEPTION 'La devolución (concepto 1) se acredita por cantidades, no por valor.' USING ERRCODE = '22023';
      END IF;

      -- Lo ya acreditado de esta línea en notas anteriores
      SELECT COALESCE(SUM(l.quantity) FILTER (WHERE l.quantity_returned), 0), COALESCE(SUM(l.net_amount), 0)
      INTO v_prev_qty, v_prev_net
      FROM public.electronic_document_lines l
      JOIN public.electronic_invoices n ON n.id = l.document_id
      WHERE l.source_sale_item_id = v_item.id AND n.document_type = 'CREDIT_NOTE';

      IF v_by_qty THEN
        v_qty := ROUND((v_line->>'quantity')::NUMERIC, 2);
        IF v_qty IS NULL OR v_qty <= 0 THEN
          RAISE EXCEPTION 'Cantidad inválida en la nota.' USING ERRCODE = '22003';
        END IF;
        IF v_prev_qty + v_qty > v_item.quantity THEN
          RAISE EXCEPTION 'Producto %: se acreditarían % unidades y la factura tiene % (ya acreditadas %).',
            v_item.p_sku, v_prev_qty + v_qty, v_item.quantity, v_prev_qty USING ERRCODE = '22003';
        END IF;
        -- Proporcional a la línea facturada (respeta descuentos y redondeos de la venta)
        IF v_prev_qty + v_qty = v_item.quantity THEN
          -- Última devolución de la línea: se acredita exactamente el saldo que queda (incluye rebajas previas)
          v_net := v_item.subtotal - v_prev_net;
          IF v_net <= 0 THEN
            RAISE EXCEPTION 'Producto %: la línea ya fue acreditada en su totalidad por notas anteriores.', v_item.p_sku USING ERRCODE = '22003';
          END IF;
        ELSE
          v_net := ROUND(v_item.subtotal * v_qty / v_item.quantity, 2);
        END IF;
      ELSE
        v_net := ROUND((v_line->>'net_amount')::NUMERIC, 2);
        v_qty := 1;
        IF v_net IS NULL OR v_net <= 0 THEN
          RAISE EXCEPTION 'Valor inválido en la nota.' USING ERRCODE = '22003';
        END IF;
      END IF;

      IF v_prev_net + v_net > v_item.subtotal THEN
        RAISE EXCEPTION 'Producto %: el valor acreditado (%) superaría el facturado (%).',
          v_item.p_sku, v_prev_net + v_net, v_item.subtotal USING ERRCODE = '22003';
      END IF;

      v_rate := COALESCE(v_item.tax_rate_percent, 0);
      v_treat := CASE WHEN v_rate > 0 THEN 'GRAVADO'
                      ELSE COALESCE(NULLIF(v_item.iva_treatment, 'GRAVADO'), CASE WHEN v_item.p_treat IN ('EXENTO','EXCLUIDO') THEN v_item.p_treat END) END;
      IF v_treat IS NULL THEN
        RAISE EXCEPTION 'El producto % (IVA 0 %%) no está clasificado como exento o excluido.', v_item.p_sku USING ERRCODE = '23502';
      END IF;
      IF v_by_qty AND v_prev_qty + v_qty = v_item.quantity THEN
        -- Saldo de IVA de la línea; nunca negativo (redondeos de notas anteriores por valor).
        v_tax := GREATEST(0, v_item.tax_amount - COALESCE((SELECT SUM(l.tax_amount) FROM public.electronic_document_lines l
                   JOIN public.electronic_invoices n ON n.id = l.document_id
                   WHERE l.source_sale_item_id = v_item.id AND n.document_type = 'CREDIT_NOTE'), 0));
      ELSE
        v_tax := ROUND(v_net * v_rate / 100, 2);
      END IF;

      v_ln := v_ln + 1;
      -- Por cantidad: mismo precio unitario y % de descuento de la venta (cantidad × precio − descuento = neto).
      -- Por valor: una unidad al valor acreditado.
      INSERT INTO tmp_note_lines VALUES (v_ln, v_item.id, v_item.product_id, v_item.p_sku, v_item.p_name,
        v_qty,
        CASE WHEN v_by_qty THEN v_item.unit_price ELSE v_net END,
        CASE WHEN v_by_qty THEN COALESCE(v_item.discount_percent, 0) ELSE 0 END,
        v_net, v_treat, v_rate, v_tax, v_by_qty,
        -- Solo una devolución registrada (mercancía que volvió al inventario) cuenta como cantidad devuelta.
        v_by_qty AND p_return_id IS NOT NULL);
    END LOOP;

  ELSE -- DEBIT_NOTE
    IF p_return_id IS NOT NULL THEN
      RAISE EXCEPTION 'Una nota débito no se asocia a devoluciones.' USING ERRCODE = '22023';
    END IF;
    IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
      RAISE EXCEPTION 'La nota débito debe tener al menos una línea.' USING ERRCODE = '23502';
    END IF;
    FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
    LOOP
      v_desc := NULLIF(TRIM(v_line->>'description'), '');
      v_qty := ROUND(COALESCE((v_line->>'quantity')::NUMERIC, 1), 2);
      v_net := ROUND(v_qty * ROUND((v_line->>'unit_price')::NUMERIC, 2), 2);
      v_prod := NULLIF(v_line->>'product_id', '')::UUID;
      v_sku := NULL;
      IF v_prod IS NOT NULL THEN
        SELECT sku, COALESCE(v_desc, name) INTO v_sku, v_desc FROM public.products WHERE id = v_prod AND company_id = v_orig.company_id;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'Producto de la nota débito no encontrado.' USING ERRCODE = '22023';
        END IF;
      END IF;
      IF v_desc IS NULL THEN
        RAISE EXCEPTION 'Cada línea de la nota débito necesita una descripción.' USING ERRCODE = '23502';
      END IF;
      IF v_qty <= 0 OR v_net IS NULL OR v_net <= 0 THEN
        RAISE EXCEPTION 'Cantidad o valor inválido en la nota débito.' USING ERRCODE = '22003';
      END IF;
      CASE UPPER(COALESCE(v_line->>'iva', ''))
        WHEN 'IVA_19' THEN v_treat := 'GRAVADO'; v_rate := 19;
        WHEN 'IVA_5' THEN v_treat := 'GRAVADO'; v_rate := 5;
        WHEN 'EXENTO' THEN v_treat := 'EXENTO'; v_rate := 0;
        WHEN 'EXCLUIDO' THEN v_treat := 'EXCLUIDO'; v_rate := 0;
        ELSE RAISE EXCEPTION 'Indique el IVA de cada línea: IVA_19, IVA_5, EXENTO o EXCLUIDO.' USING ERRCODE = '22023';
      END CASE;
      v_tax := ROUND(v_net * v_rate / 100, 2);
      v_ln := v_ln + 1;
      INSERT INTO tmp_note_lines VALUES (v_ln, NULL, v_prod, COALESCE(v_sku, 'ND-' || v_ln), v_desc,
        v_qty, ROUND((v_line->>'unit_price')::NUMERIC, 2), 0, v_net, v_treat, v_rate, v_tax, false, false);
    END LOOP;
  END IF;

  SELECT COALESCE(SUM(net), 0), COALESCE(SUM(tax), 0) INTO v_sub, v_taxsum FROM tmp_note_lines;
  v_total := v_sub + v_taxsum;
  IF v_total <= 0 THEN
    RAISE EXCEPTION 'La nota no tiene valor.' USING ERRCODE = '22003';
  END IF;

  -- ----------------------------------------------------------------------------
  -- Consecutivo de la nota
  -- ----------------------------------------------------------------------------
  -- Habilitación: prefijos de prueba NCT/NDT se crean si faltan. Producción: el prefijo lo define la
  -- empresa al pasar a producción; si no está configurado no se emite la nota (no se inventa).
  IF p_environment = 'HABILITACION' THEN
    INSERT INTO public.dian_note_sequences (company_id, environment, document_type, prefix)
    VALUES (v_orig.company_id, p_environment, p_document_type,
            CASE WHEN p_document_type = 'CREDIT_NOTE' THEN 'NCT' ELSE 'NDT' END)
    ON CONFLICT (company_id, environment, document_type) DO NOTHING;
  END IF;

  SELECT * INTO v_seq FROM public.dian_note_sequences
  WHERE company_id = v_orig.company_id AND environment = p_environment AND document_type = p_document_type
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No hay consecutivo de % configurado para el ambiente % (dian_note_sequences). Configúrelo antes de emitir notas.',
      CASE WHEN p_document_type = 'CREDIT_NOTE' THEN 'notas crédito' ELSE 'notas débito' END, p_environment
      USING ERRCODE = 'P0002';
  END IF;

  SELECT MAX(number) INTO v_max_used FROM public.electronic_invoices WHERE prefix = v_seq.prefix;
  v_next := GREATEST(v_seq.last_number + 1, COALESCE(v_max_used + 1, 1));
  UPDATE public.dian_note_sequences SET last_number = v_next, updated_at = NOW() WHERE id = v_seq.id;

  INSERT INTO public.electronic_invoices (
    id, company_id, location_id, sale_id, customer_id,
    prefix, number, dian_prefix, dian_number, internal_number,
    document_type, original_invoice_id, return_id, note_concept_code, note_reason,
    subtotal_amount, tax_amount, total_amount,
    dian_status, environment, software_id, idempotency_key,
    issue_date, issue_time, transmission_state, created_by_user_id, created_at, updated_at
  ) VALUES (
    v_note_id, v_orig.company_id, v_orig.location_id, v_orig.sale_id, v_orig.customer_id,
    v_seq.prefix, v_next, v_seq.prefix, v_next, v_orig.internal_number,
    p_document_type, v_orig.id, p_return_id, p_concept_code, TRIM(p_reason),
    v_sub, v_taxsum, v_total,
    'PENDING', p_environment, v_orig.software_id, p_idempotency_key,
    v_now_bogota::DATE, TO_CHAR(v_now_bogota, 'HH24:MI:SS') || '-05:00', 'NUMBERED', v_caller, NOW(), NOW()
  );

  INSERT INTO public.electronic_document_lines (
    document_id, company_id, line_number, source_sale_item_id, product_id, sku, description,
    quantity, unit_price, discount_percent, net_amount, iva_treatment, tax_rate_percent, tax_amount, total_amount, quantity_returned)
  SELECT v_note_id, v_orig.company_id, ln, sale_item_id, product_id, sku, description,
         quantity, unit_price, discount, net, treat, rate, tax, net + tax, returned
  FROM tmp_note_lines ORDER BY ln;

  -- ----------------------------------------------------------------------------
  -- Contabilidad (misma transacción)
  -- ----------------------------------------------------------------------------
  SELECT document_number, COALESCE(company_name, TRIM(CONCAT(first_name, ' ', last_name)))
  INTO v_customer_doc, v_customer_name
  FROM public.customers WHERE id = v_orig.customer_id;

  IF p_document_type = 'CREDIT_NOTE' THEN
    v_acc_lines := v_acc_lines || jsonb_build_object(
      'account_id', public.fn_get_default_account(v_orig.company_id, 'SALES_RETURNS'),
      'debit_amount', v_sub, 'credit_amount', 0,
      'third_party_doc', v_customer_doc, 'third_party_name', v_customer_name,
      'description', v_concept_desc || ' - factura ' || v_orig.prefix || v_orig.number::TEXT);
    IF v_taxsum > 0 THEN
      v_acc_lines := v_acc_lines || jsonb_build_object(
        'account_id', public.fn_get_default_account(v_orig.company_id, 'VAT_GENERATED'),
        'debit_amount', v_taxsum, 'credit_amount', 0,
        'third_party_doc', v_customer_doc, 'third_party_name', v_customer_name,
        'description', 'Reversión IVA generado nota ' || v_seq.prefix || v_next::TEXT);
    END IF;
    v_acc_lines := v_acc_lines || jsonb_build_object(
      'account_id', public.fn_get_default_account(v_orig.company_id, 'CUSTOMER_CREDIT'),
      'debit_amount', 0, 'credit_amount', v_total,
      'third_party_doc', v_customer_doc, 'third_party_name', v_customer_name,
      'description', 'Saldo a favor del cliente por nota ' || v_seq.prefix || v_next::TEXT);
    -- Mercancía devuelta (registrada en Devoluciones): vuelve al inventario y se reversa el costo.
    -- 062: un par por cuenta de inventario de los productos devueltos (la del producto o la de defecto)
    -- contra su costo de ventas mapeado, igual que la causación de la venta.
    -- 068: solo líneas BUENO; las de MAL_ESTADO ya reversaron su costo con el comprobante DV de la devolución.
    IF v_ret_cost > 0 THEN
      FOR v_ret_grp IN
        SELECT public.fn_product_inventory_account(v_orig.company_id, ri.product_id) AS inventory_account_id,
               ROUND(SUM(ri.quantity * ri.unit_cost), 2) AS cost_amount
        FROM public.return_items ri
        WHERE ri.return_id = p_return_id
          AND ri.item_condition = 'BUENO'  -- 068: la mercancía en mal estado no vuelve al inventario vendible
        GROUP BY 1
        ORDER BY 2 DESC, 1
      LOOP
        CONTINUE WHEN v_ret_grp.cost_amount <= 0;
        v_ret_inventory := COALESCE(v_ret_grp.inventory_account_id,
                                    public.fn_get_default_account(v_orig.company_id, 'INVENTORY'));
        v_acc_lines := v_acc_lines || jsonb_build_object(
          'account_id', v_ret_inventory,
          'debit_amount', v_ret_grp.cost_amount, 'credit_amount', 0,
          'description', 'Reingreso inventario devolución ' || v_ret.code);
        v_acc_lines := v_acc_lines || jsonb_build_object(
          'account_id', public.fn_inventory_line_account(v_orig.company_id, v_ret_inventory, 'COST_OF_SALES'),
          'debit_amount', 0, 'credit_amount', v_ret_grp.cost_amount,
          'description', 'Reversión costo de ventas devolución ' || v_ret.code);
      END LOOP;
    END IF;
  ELSE
    v_income_purpose := CASE WHEN p_concept_code = '1' THEN 'FINANCIAL_INCOME' ELSE 'SALES_INCOME' END;
    v_acc_lines := v_acc_lines || jsonb_build_object(
      'account_id', public.fn_get_default_account(v_orig.company_id, 'CUSTOMER_CREDIT'),
      'debit_amount', v_total, 'credit_amount', 0,
      'third_party_doc', v_customer_doc, 'third_party_name', v_customer_name,
      'description', 'Cobro adicional nota ' || v_seq.prefix || v_next::TEXT);
    v_acc_lines := v_acc_lines || jsonb_build_object(
      'account_id', public.fn_get_default_account(v_orig.company_id, v_income_purpose),
      'debit_amount', 0, 'credit_amount', v_sub,
      'third_party_doc', v_customer_doc, 'third_party_name', v_customer_name,
      'description', v_concept_desc || ' - factura ' || v_orig.prefix || v_orig.number::TEXT);
    IF v_taxsum > 0 THEN
      v_acc_lines := v_acc_lines || jsonb_build_object(
        'account_id', public.fn_get_default_account(v_orig.company_id, 'VAT_GENERATED'),
        'debit_amount', 0, 'credit_amount', v_taxsum,
        'third_party_doc', v_customer_doc, 'third_party_name', v_customer_name,
        'description', 'IVA generado nota ' || v_seq.prefix || v_next::TEXT);
    END IF;
  END IF;

  v_entry := public.fn_create_accounting_entry(
    p_date := v_now_bogota::DATE,
    p_concept := CASE WHEN p_document_type = 'CREDIT_NOTE' THEN 'Nota crédito ' ELSE 'Nota débito ' END
                 || v_seq.prefix || v_next::TEXT || ' a factura ' || v_orig.prefix || v_orig.number::TEXT || ' - ' || v_concept_desc,
    p_document_type := p_document_type,
    p_document_reference := v_seq.prefix || v_next::TEXT,
    p_lines := v_acc_lines,
    p_location_id := v_orig.location_id,
    p_auto_post := true,
    p_company_id := v_orig.company_id
  );

  INSERT INTO public.dian_events (invoice_id, company_id, created_by_user_id, environment, event_type, status, payload_sent)
  VALUES (v_note_id, v_orig.company_id, v_caller, p_environment, 'NUMBER_ASSIGNED', 'SUCCESS',
    jsonb_build_object('prefix', v_seq.prefix, 'number', v_next, 'document_type', p_document_type,
                       'original', v_orig.prefix || v_orig.number::TEXT, 'concept', p_concept_code));

  INSERT INTO public.audit_logs (company_id, user_id, user_name, action, module, entity_name, entity_id, location_id, new_value, created_at)
  VALUES (v_orig.company_id, v_caller,
    COALESCE((SELECT full_name FROM public.users WHERE id = v_caller), 'Sistema'),
    CASE WHEN p_document_type = 'CREDIT_NOTE' THEN 'CREDIT_NOTE_NUMBERED' ELSE 'DEBIT_NOTE_NUMBERED' END,
    'INVOICES', 'electronic_invoices', v_note_id::TEXT, v_orig.location_id,
    jsonb_build_object('prefix', v_seq.prefix, 'number', v_next, 'original_invoice', v_orig.prefix || v_orig.number::TEXT,
                       'concept', p_concept_code, 'reason', TRIM(p_reason), 'total', v_total,
                       'accounting_entry', v_entry->>'entry_number'),
    NOW());

  RETURN jsonb_build_object(
    'success', true,
    'idempotent_replay', false,
    'note_id', v_note_id,
    'prefix', v_seq.prefix,
    'number', v_next,
    'total', v_total,
    'accounting_entry_number', v_entry->>'entry_number'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_create_electronic_note(UUID, VARCHAR, VARCHAR, TEXT, JSONB, UUID, VARCHAR, VARCHAR) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_create_electronic_note(UUID, VARCHAR, VARCHAR, TEXT, JSONB, UUID, VARCHAR, VARCHAR) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 6. OPCIONES DEL FORMULARIO: PROVEEDORES, SEDES Y PROVEEDOR SUGERIDO
-- ------------------------------------------------------------------------------
-- Quien registra devoluciones (sales.create / inventory.adjust) no siempre puede leer proveedores por
-- RLS (suppliers.read): esta función entrega solo id, nombre y NIT de los activos de su empresa.
CREATE OR REPLACE FUNCTION public.fn_return_disposition_options(p_sale_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_company UUID;
  v_sale_company UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Acceso denegado: usuario no autenticado.' USING ERRCODE = '28000';
  END IF;
  v_company := public.get_auth_company_id();
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'Acceso denegado: el usuario no tiene empresa asignada.' USING ERRCODE = '42501';
  END IF;
  IF NOT (public.has_permission('sales.create') OR public.has_permission('inventory.adjust') OR public.is_admin()) THEN
    RAISE EXCEPTION 'No tienes permisos para registrar devoluciones de venta.' USING ERRCODE = '42501';
  END IF;

  SELECT company_id INTO v_sale_company FROM public.sales WHERE id = p_sale_id;
  IF v_sale_company IS NULL THEN
    RAISE EXCEPTION 'La venta especificada no existe.' USING ERRCODE = 'P0002';
  END IF;
  IF v_sale_company <> v_company THEN
    RAISE EXCEPTION 'La venta pertenece a otra empresa.' USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object(
    'suppliers', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id', s.id,
               'name', COALESCE(NULLIF(BTRIM(s.commercial_name), ''), s.name),
               'tax_id', s.tax_id) ORDER BY COALESCE(NULLIF(BTRIM(s.commercial_name), ''), s.name))
      FROM public.suppliers s
      WHERE s.company_id = v_company AND s.is_active = true), '[]'::JSONB),
    'locations', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', l.id, 'code', l.code, 'name', l.name, 'type', l.type) ORDER BY l.name)
      FROM public.locations l
      WHERE l.company_id = v_company AND l.status = 'ACTIVE'), '[]'::JSONB),
    'suggestions', COALESCE((
      SELECT jsonb_agg(x.suggestion)
      FROM (
        SELECT DISTINCT ON (pi.product_id)
          jsonb_build_object(
            'product_id', pi.product_id,
            'supplier_id', s.id,
            'supplier_name', COALESCE(NULLIF(BTRIM(s.commercial_name), ''), s.name),
            'purchase_id', pu.id,
            'purchase_number', pu.purchase_number,
            'purchase_date', pu.issue_date) AS suggestion
        FROM public.purchase_items pi
        JOIN public.purchases pu ON pu.id = pi.purchase_id
        JOIN public.suppliers s ON s.id = pu.supplier_id AND s.is_active = true
        WHERE pu.company_id = v_company
          AND pi.product_id IN (SELECT si.product_id FROM public.sale_items si WHERE si.sale_id = p_sale_id)
          AND UPPER(COALESCE(pu.inventory_status, '')) IN ('RECEIVED', 'RECIBIDA', 'PARTIALLY_RECEIVED', 'RECIBIDA_PARCIALMENTE')
        ORDER BY pi.product_id, pu.issue_date DESC, pu.created_at DESC
      ) x), '[]'::JSONB)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_return_disposition_options(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_return_disposition_options(UUID) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 7. LISTADO "PRODUCTOS EN MAL ESTADO POR DESTINO"
-- ------------------------------------------------------------------------------
-- p_destination: NULL | 'PRODUCCION' | 'PROVEEDOR'; p_status: NULL | 'PENDIENTE' | 'ENVIADO'.
-- El costo solo se entrega con cost.read (o administrador).
CREATE OR REPLACE FUNCTION public.fn_list_damaged_return_items(
  p_destination VARCHAR DEFAULT NULL,
  p_status VARCHAR DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 25,
  p_offset INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_company UUID;
  v_destination VARCHAR(12) := UPPER(NULLIF(BTRIM(p_destination), ''));
  v_status VARCHAR(12) := UPPER(NULLIF(BTRIM(p_status), ''));
  v_search TEXT := NULLIF(BTRIM(p_search), '');
  v_limit INTEGER := LEAST(GREATEST(COALESCE(p_limit, 25), 1), 100);
  v_offset INTEGER := GREATEST(COALESCE(p_offset, 0), 0);
  v_show_cost BOOLEAN;
  v_total BIGINT;
  v_rows JSONB;
  v_summary JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Acceso denegado: usuario no autenticado.' USING ERRCODE = '28000';
  END IF;
  v_company := public.get_auth_company_id();
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'Acceso denegado: el usuario no tiene empresa asignada.' USING ERRCODE = '42501';
  END IF;
  IF NOT (public.is_admin() OR public.has_any_permission(ARRAY[
      'sales.create', 'sales.read', 'inventory.read', 'inventory.adjust', 'purchases.read', 'purchases.create']::VARCHAR[])) THEN
    RAISE EXCEPTION 'No tienes permisos para consultar las devoluciones en mal estado.' USING ERRCODE = '42501';
  END IF;
  IF v_destination IS NOT NULL AND v_destination NOT IN ('PRODUCCION', 'PROVEEDOR') THEN
    RAISE EXCEPTION 'Destino no válido: %.', p_destination USING ERRCODE = '22023';
  END IF;
  IF v_status IS NOT NULL AND v_status NOT IN ('PENDIENTE', 'ENVIADO') THEN
    RAISE EXCEPTION 'Estado no válido: %.', p_status USING ERRCODE = '22023';
  END IF;

  v_show_cost := public.is_admin() OR public.has_permission('cost.read');

  SELECT COUNT(*) INTO v_total
  FROM public.return_items ri
  JOIN public.returns r ON r.id = ri.return_id
  JOIN public.products p ON p.id = ri.product_id
  LEFT JOIN public.suppliers s ON s.id = ri.disposition_supplier_id
  WHERE ri.company_id = v_company
    AND ri.item_condition = 'MAL_ESTADO'
    AND (v_destination IS NULL OR ri.disposition_destination = v_destination)
    AND (v_status IS NULL OR ri.disposition_status = v_status)
    AND (v_search IS NULL
         OR r.code ILIKE '%' || v_search || '%'
         OR COALESCE(r.source_document_code, '') ILIKE '%' || v_search || '%'
         OR p.name ILIKE '%' || v_search || '%'
         OR COALESCE(p.sku, '') ILIKE '%' || v_search || '%'
         OR COALESCE(s.name, '') ILIKE '%' || v_search || '%');

  SELECT COALESCE(jsonb_agg(row_data ORDER BY sort_status, sort_date DESC), '[]'::JSONB) INTO v_rows
  FROM (
    SELECT
      CASE WHEN ri.disposition_status = 'PENDIENTE' THEN 0 ELSE 1 END AS sort_status,
      ri.created_at AS sort_date,
      jsonb_build_object(
        'id', ri.id,
        'return_id', r.id,
        'return_code', r.code,
        'return_date', r.created_at,
        'sale_number', r.source_document_code,
        'location_id', r.location_id,
        'location_name', loc.name,
        'customer_name', COALESCE(NULLIF(BTRIM(c.company_name), ''), NULLIF(BTRIM(c.commercial_name), ''),
                                  NULLIF(BTRIM(CONCAT(c.first_name, ' ', c.last_name)), '')),
        'product_id', p.id,
        'product_name', p.name,
        'sku', p.sku,
        'quantity', ri.quantity,
        'unit_cost', CASE WHEN v_show_cost THEN ri.unit_cost END,
        'total_cost', CASE WHEN v_show_cost THEN ROUND(ri.quantity * ri.unit_cost, 2) END,
        'reason', COALESCE(ri.reason, r.reason),
        'destination', ri.disposition_destination,
        'status', ri.disposition_status,
        'supplier_id', s.id,
        'supplier_name', COALESCE(NULLIF(BTRIM(s.commercial_name), ''), s.name),
        'supplier_tax_id', s.tax_id,
        'purchase_number', pu.purchase_number,
        'production_location_id', pl.id,
        'production_location_name', pl.name,
        'disposition_notes', ri.disposition_notes,
        'registered_by_name', cu.full_name,
        'dispatched_at', ri.dispatched_at,
        'dispatched_by_name', du.full_name,
        'dispatch_reference', ri.dispatch_reference,
        'dispatch_notes', ri.dispatch_notes,
        'return_entry_number', de.entry_number,
        'dispatch_entry_number', xe.entry_number
      ) AS row_data
    FROM public.return_items ri
    JOIN public.returns r ON r.id = ri.return_id
    JOIN public.products p ON p.id = ri.product_id
    LEFT JOIN public.locations loc ON loc.id = r.location_id
    LEFT JOIN public.customers c ON c.id = r.customer_id
    LEFT JOIN public.suppliers s ON s.id = ri.disposition_supplier_id
    LEFT JOIN public.purchases pu ON pu.id = ri.disposition_purchase_id
    LEFT JOIN public.locations pl ON pl.id = ri.disposition_location_id
    LEFT JOIN public.users cu ON cu.id = r.created_by_user_id
    LEFT JOIN public.users du ON du.id = ri.dispatched_by_user_id
    LEFT JOIN public.accounting_entries de ON de.id = ri.disposition_entry_id
    LEFT JOIN public.accounting_entries xe ON xe.id = ri.dispatch_entry_id
    WHERE ri.company_id = v_company
      AND ri.item_condition = 'MAL_ESTADO'
      AND (v_destination IS NULL OR ri.disposition_destination = v_destination)
      AND (v_status IS NULL OR ri.disposition_status = v_status)
      AND (v_search IS NULL
           OR r.code ILIKE '%' || v_search || '%'
           OR COALESCE(r.source_document_code, '') ILIKE '%' || v_search || '%'
           OR p.name ILIKE '%' || v_search || '%'
           OR COALESCE(p.sku, '') ILIKE '%' || v_search || '%'
           OR COALESCE(s.name, '') ILIKE '%' || v_search || '%')
    ORDER BY CASE WHEN ri.disposition_status = 'PENDIENTE' THEN 0 ELSE 1 END, ri.created_at DESC
    LIMIT v_limit OFFSET v_offset
  ) q;

  SELECT jsonb_build_object(
    'pending_supplier_units', COALESCE(SUM(quantity) FILTER (WHERE disposition_destination = 'PROVEEDOR' AND disposition_status = 'PENDIENTE'), 0),
    'pending_production_units', COALESCE(SUM(quantity) FILTER (WHERE disposition_destination = 'PRODUCCION' AND disposition_status = 'PENDIENTE'), 0),
    'pending_lines', COUNT(*) FILTER (WHERE disposition_status = 'PENDIENTE'),
    'sent_lines', COUNT(*) FILTER (WHERE disposition_status = 'ENVIADO')
  ) INTO v_summary
  FROM public.return_items
  WHERE company_id = v_company AND item_condition = 'MAL_ESTADO';

  RETURN jsonb_build_object(
    'rows', v_rows,
    'total', v_total,
    'limit', v_limit,
    'offset', v_offset,
    'show_cost', v_show_cost,
    'summary', v_summary
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_list_damaged_return_items(VARCHAR, VARCHAR, TEXT, INTEGER, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_list_damaged_return_items(VARCHAR, VARCHAR, TEXT, INTEGER, INTEGER) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 8. MARCAR COMO ENVIADO (A PRODUCCIÓN O AL PROVEEDOR)
-- ------------------------------------------------------------------------------
-- Idempotente: una línea ya enviada devuelve already_dispatched = true sin repetir efectos.
-- Proveedor con comprobante DV previo → comprobante DC: Dr proveedores (SUPPLIERS_PAYABLE, tercero
-- proveedor) / Cr la misma cuenta de mercancía en mal estado del DV, al costo de la línea.
-- Producción: sin asiento (el costo ya quedó en la cuenta de mercancía en mal estado con el DV).
CREATE OR REPLACE FUNCTION public.fn_dispatch_damaged_return_item(
  p_return_item_id UUID,
  p_dispatch_reference VARCHAR DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_company UUID;
  v_user_name VARCHAR(150);
  v_item RECORD;
  v_supplier RECORD;
  v_purchase_number VARCHAR(50);
  v_prod_location_name VARCHAR(150);
  v_reference VARCHAR(100) := NULLIF(BTRIM(p_dispatch_reference), '');
  v_notes TEXT := NULLIF(BTRIM(p_notes), '');
  v_stock NUMERIC(12,2);
  v_cost NUMERIC(15,2);
  v_entry JSONB;
  v_entry_id UUID;
  v_accounting_note TEXT;
  v_destination_label TEXT;
BEGIN
  SELECT ri.*, r.code AS return_code, r.location_id AS return_location_id, r.company_id AS return_company_id,
         r.status AS return_status, r.source_document_code, p.name AS product_name
  INTO v_item
  FROM public.return_items ri
  JOIN public.returns r ON r.id = ri.return_id
  JOIN public.products p ON p.id = ri.product_id
  WHERE ri.id = p_return_item_id
  FOR UPDATE OF ri;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La línea de devolución no existe.' USING ERRCODE = 'P0002';
  END IF;

  IF v_caller IS NOT NULL THEN
    v_company := public.get_auth_company_id();
    IF v_company IS DISTINCT FROM v_item.return_company_id THEN
      RAISE EXCEPTION 'Acceso denegado: la devolución no pertenece a su empresa.' USING ERRCODE = '42501';
    END IF;
    IF NOT (public.is_admin() OR public.has_permission('inventory.adjust') OR public.has_permission('purchases.create')) THEN
      RAISE EXCEPTION 'Acceso denegado: requiere inventory.adjust o purchases.create para despachar mercancía en mal estado.'
        USING ERRCODE = '42501';
    END IF;
    IF NOT (public.is_admin() OR public.has_location_access(v_item.return_location_id)) THEN
      RAISE EXCEPTION 'Acceso denegado: la mercancía está en una sede que no tiene asignada.' USING ERRCODE = '42501';
    END IF;
    SELECT full_name INTO v_user_name FROM public.users WHERE id = v_caller;
  ELSIF public.fn_is_trusted_server_context() THEN
    v_company := v_item.return_company_id;
  ELSE
    RAISE EXCEPTION 'Acceso denegado: usuario no autenticado.' USING ERRCODE = '28000';
  END IF;
  v_user_name := COALESCE(NULLIF(BTRIM(v_user_name), ''), 'Usuario Sistema');

  IF v_item.item_condition <> 'MAL_ESTADO' THEN
    RAISE EXCEPTION 'La línea está en buen estado: reingresó al inventario y no se despacha.' USING ERRCODE = '22023';
  END IF;
  IF v_item.return_status <> 'COMPLETED' THEN
    RAISE EXCEPTION 'La devolución % no está completada (estado %).', v_item.return_code, v_item.return_status
      USING ERRCODE = '55000';
  END IF;

  IF v_item.disposition_status = 'ENVIADO' THEN
    RETURN jsonb_build_object('success', true, 'already_dispatched', true,
      'return_item_id', v_item.id, 'dispatched_at', v_item.dispatched_at);
  END IF;

  IF v_item.disposition_destination = 'PROVEEDOR' THEN
    SELECT id, name, tax_id, commercial_name INTO v_supplier
    FROM public.suppliers WHERE id = v_item.disposition_supplier_id;
    SELECT purchase_number INTO v_purchase_number FROM public.purchases WHERE id = v_item.disposition_purchase_id;
    v_destination_label := 'proveedor ' || COALESCE(NULLIF(BTRIM(v_supplier.commercial_name), ''), v_supplier.name);
  ELSE
    SELECT name INTO v_prod_location_name FROM public.locations WHERE id = v_item.disposition_location_id;
    v_destination_label := 'producción ' || COALESCE(v_prod_location_name, '(' || COALESCE(v_item.disposition_notes, 'sin sede') || ')');
  END IF;

  -- Kardex informativo del despacho (no cambia el stock vendible: la mercancía nunca entró a él)
  SELECT COALESCE(quantity, 0) INTO v_stock
  FROM public.stock_levels
  WHERE product_id = v_item.product_id AND location_id = v_item.return_location_id
  FOR UPDATE;
  v_stock := COALESCE(v_stock, 0.00);

  INSERT INTO public.inventory_movements (
    company_id, location_id, product_id, movement_type, quantity_in, quantity_out,
    previous_stock, new_stock, unit_cost, total_cost, document_type, document_reference,
    reason, user_id, created_at
  ) VALUES (
    v_company, v_item.return_location_id, v_item.product_id, 'DAMAGED_RETURN', 0.00, 0.00,
    v_stock, v_stock, v_item.unit_cost, 0.00, 'DAMAGED_DISPATCH', v_item.return_code,
    'Envío a ' || v_destination_label || ' de ' || v_item.quantity::TEXT || ' und en mal estado de "'
      || v_item.product_name || '" (devolución ' || v_item.return_code || ')'
      || COALESCE('. Ref: ' || v_reference, '') || COALESCE('. ' || v_notes, ''),
    v_caller, NOW()
  );

  -- Comprobante DC: solo si la mercancía en mal estado tiene su DV (si no, no hay valor que trasladar)
  v_cost := ROUND(v_item.quantity * v_item.unit_cost, 2);
  IF v_item.disposition_destination = 'PROVEEDOR' THEN
    IF v_item.disposition_entry_id IS NOT NULL AND v_item.disposition_account_id IS NOT NULL AND v_cost > 0 THEN
      v_entry := public.fn_create_accounting_entry(
        p_date := (NOW() AT TIME ZONE 'America/Bogota')::DATE,
        p_concept := 'Devolución en compra a ' || COALESCE(NULLIF(BTRIM(v_supplier.commercial_name), ''), v_supplier.name)
                     || ': ' || v_item.quantity::TEXT || ' und de "' || v_item.product_name || '" en mal estado (devolución '
                     || v_item.return_code || COALESCE(', compra ' || v_purchase_number, '') || ')',
        p_document_type := 'PURCHASE_RETURN',
        p_document_reference := v_item.return_code,
        p_lines := jsonb_build_array(
          jsonb_build_object(
            'account_id', public.fn_get_default_account(v_company, 'SUPPLIERS_PAYABLE'),
            'debit_amount', v_cost, 'credit_amount', 0,
            'third_party_doc', v_supplier.tax_id, 'third_party_name', v_supplier.name,
            'description', 'Devolución en compra pendiente de nota del proveedor - ' || v_item.return_code),
          jsonb_build_object(
            'account_id', v_item.disposition_account_id,
            'debit_amount', 0, 'credit_amount', v_cost,
            'third_party_doc', v_supplier.tax_id, 'third_party_name', v_supplier.name,
            'description', 'Salida de mercancía en mal estado al proveedor - ' || v_item.return_code)
        ),
        p_location_id := v_item.return_location_id,
        p_auto_post := true,
        p_company_id := v_company
      );
      v_entry_id := (v_entry->>'entry_id')::UUID;
    ELSE
      v_accounting_note := 'Sin comprobante DC: la devolución no tuvo comprobante DV (venta sin asiento o costo 0).';
    END IF;
  END IF;

  UPDATE public.return_items
  SET disposition_status = 'ENVIADO',
      dispatched_at = NOW(),
      dispatched_by_user_id = v_caller,
      dispatch_reference = v_reference,
      dispatch_notes = v_notes,
      dispatch_entry_id = v_entry_id
  WHERE id = v_item.id;

  INSERT INTO public.audit_logs (
    company_id, user_id, user_name, action, module, entity_name, entity_id, location_id,
    previous_value, new_value, created_at
  ) VALUES (
    v_company, v_caller, v_user_name, 'DAMAGED_RETURN_ITEM_DISPATCHED', 'RETURNS', 'return_items',
    v_item.id, v_item.return_location_id,
    jsonb_build_object('status', 'PENDIENTE'),
    jsonb_build_object(
      'status', 'ENVIADO',
      'return_code', v_item.return_code,
      'product_id', v_item.product_id,
      'product_name', v_item.product_name,
      'quantity', v_item.quantity,
      'condition', v_item.item_condition,
      'destination', v_item.disposition_destination,
      'supplier_id', v_item.disposition_supplier_id,
      'production_location_id', v_item.disposition_location_id,
      'dispatch_reference', v_reference,
      'dispatch_notes', v_notes,
      'accounting_entry', v_entry->>'entry_number',
      'accounting_note', v_accounting_note
    ),
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'already_dispatched', false,
    'return_item_id', v_item.id,
    'destination', v_item.disposition_destination,
    'accounting_entry_number', v_entry->>'entry_number',
    'accounting_note', v_accounting_note
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_dispatch_damaged_return_item(UUID, VARCHAR, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_dispatch_damaged_return_item(UUID, VARCHAR, TEXT) TO authenticated, service_role;

COMMIT;
